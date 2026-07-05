from __future__ import annotations

import asyncio
import concurrent.futures
import json
import math
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from typing import Any

import websockets

FAPI_BASE = "https://fapi.binance.com"
FORCE_ORDER_WS = "wss://fstream.binance.com/ws/!forceOrder@arr"
REQUEST_TIMEOUT_SEC = 2.5
FAST_TTL_SEC = 12.0
SLOW_TTL_SEC = 90.0
OI_TTL_SEC = 45.0
KLINE_TTL_SEC = 180.0
EXCHANGE_INFO_TTL_SEC = 600.0
SENTIMENT_TTL_SEC = 75.0
DEFI_TTL_SEC = 600.0
SENTIMENT_SYMBOL_LIMIT = 18
DEFI_LIMIT = 80
TICKER_SCAN_LIMIT = 520
BAD_DEFI_ICON_SLUGS = {"antarctic-exchange", "standx-perp"}

WINDOW_SPECS: dict[str, dict[str, Any]] = {
    "1h": {"hours": 1, "period": "5m", "limit": 12},
    "4h": {"hours": 4, "period": "5m", "limit": 48},
    "12h": {"hours": 12, "period": "15m", "limit": 48},
    "24h": {"hours": 24, "period": "30m", "limit": 48},
    "7d": {"hours": 24 * 7, "period": "1h", "limit": 168},
    "30d": {"hours": 24 * 30, "period": "4h", "limit": 180},
}

COINGLASS_SURFACES: list[dict[str, Any]] = [
    {
        "name": "Multi-exchange liquidation heatmap",
        "surface": "Liquidation",
        "status": "requires_key",
        "url": "https://docs.coinglass.com/",
        "timeframes": ["1h", "4h", "12h", "24h"],
        "detail": "CoinGlass-style historical liquidation clusters need CoinGlass API access.",
    },
    {
        "name": "All-exchange funding matrix",
        "surface": "Funding rate",
        "status": "requires_key",
        "url": "https://docs.coinglass.com/",
        "timeframes": ["current", "1d", "7d", "30d"],
        "detail": "Binance is keyless here; full venue matrix is a paid/keyed provider lane.",
    },
    {
        "name": "Open interest by venue",
        "surface": "Open interest",
        "status": "requires_key",
        "url": "https://docs.coinglass.com/",
        "timeframes": ["1d", "7d", "30d", "1y"],
        "detail": "Public Binance OI is active; venue-wide history requires a provider key.",
    },
    {
        "name": "ETF flow board",
        "surface": "ETF",
        "status": "requires_key",
        "url": "https://docs.coinglass.com/",
        "timeframes": ["daily", "weekly", "monthly"],
        "detail": "Do not show synthetic ETF flows. Wire this only with licensed ETF flow data.",
    },
    {
        "name": "Options max-pain and gamma",
        "surface": "Options",
        "status": "requires_key",
        "url": "https://docs.coinglass.com/",
        "timeframes": ["expiry", "daily"],
        "detail": "Options surfaces stay disabled until a real derivatives data provider is configured.",
    },
    {
        "name": "Long historical liquidation/OI ranges",
        "surface": "History",
        "status": "requires_key",
        "url": "https://docs.coinglass.com/",
        "timeframes": ["90d", "1y", "all"],
        "detail": "Binance public derivatives history is short-window only here; longer ranges need a licensed provider.",
    },
]

JsonDict = dict[str, Any]
_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_LOCK = threading.Lock()
_PAYLOAD_CACHE: dict[str, tuple[float, JsonDict]] = {}
_PAYLOAD_CACHE_LOCK = threading.Lock()

QUOTE_SUFFIXES = ("USDT", "USDC", "FDUSD", "TUSD", "BUSD", "USD")


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        n = float(value)
        return n if math.isfinite(n) else default
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def base_from_symbol(symbol: str | None) -> str:
    clean = "".join(ch for ch in str(symbol or "").upper() if ch.isalnum())
    for quote in QUOTE_SUFFIXES:
        if clean.endswith(quote) and len(clean) > len(quote):
            return clean[: -len(quote)]
    return clean


def _cache_key(path: str, params: JsonDict) -> str:
    return f"{path}:{urllib.parse.urlencode(sorted(params.items()))}"


def cached_public_get(path: str, params: JsonDict | None = None, ttl: float = FAST_TTL_SEC) -> Any:
    params = params or {}
    key = _cache_key(path, params)
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and now - cached[0] <= ttl:
            return cached[1]
    query = urllib.parse.urlencode(params)
    url = f"{FAPI_BASE}{path}?{query}" if query else f"{FAPI_BASE}{path}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CosmosGeek-Radar/1.0 derivatives-public-data",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as response:
        payload = json.loads(response.read().decode("utf-8"))
    with _CACHE_LOCK:
        _CACHE[key] = (now, payload)
    return payload


def _exchange_symbol_meta() -> dict[str, JsonDict]:
    try:
        payload = cached_public_get("/fapi/v1/exchangeInfo", ttl=EXCHANGE_INFO_TTL_SEC)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
        return {}
    out: dict[str, JsonDict] = {}
    for row in payload.get("symbols", []) if isinstance(payload, dict) else []:
        symbol = str(row.get("symbol") or "").upper()
        if not symbol:
            continue
        contract = str(row.get("contractType") or "").upper()
        underlying = str(row.get("underlyingType") or "").upper()
        asset_class = "tradfi" if contract == "TRADIFI_PERPETUAL" or underlying in {"EQUITY", "KR_EQUITY", "COMMODITY"} else "crypto"
        out[symbol] = {
            "contract_type": contract,
            "underlying_type": underlying,
            "underlying_subtype": row.get("underlyingSubType") or [],
            "asset_class": asset_class,
            "base_asset": row.get("baseAsset"),
            "quote_asset": row.get("quoteAsset"),
        }
    return out


def cached_url_get(url: str, ttl: float = DEFI_TTL_SEC) -> Any:
    now = time.monotonic()
    key = f"url:{url}"
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and now - cached[0] <= ttl:
            return cached[1]
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CosmosGeek-Radar/1.0 public-defi-data",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC + 3.5) as response:
        payload = json.loads(response.read().decode("utf-8"))
    with _CACHE_LOCK:
        _CACHE[key] = (now, payload)
    return payload


def _event_from_force_order(payload: JsonDict) -> JsonDict | None:
    order = payload.get("o") or {}
    symbol = str(order.get("s") or payload.get("ps") or "").upper()
    if not symbol.endswith("USDT"):
        return None
    side = str(order.get("S") or "").upper()
    qty = safe_float(order.get("z") or order.get("q"))
    price = safe_float(order.get("ap") or order.get("p"))
    value = qty * price
    if value <= 0:
        return None
    ts_ms = safe_int(payload.get("E") or order.get("T") or time.time() * 1000)
    direction = "long" if side == "SELL" else "short" if side == "BUY" else "unknown"
    return {
        "id": f"{symbol}:{ts_ms}:{side}:{round(value, 4)}",
        "symbol": symbol,
        "base": base_from_symbol(symbol),
        "side": side,
        "direction": direction,
        "price": price,
        "qty": qty,
        "value": value,
        "ts_ms": ts_ms,
        "source": "Binance USD-M public liquidation stream",
    }


class DerivativesStream:
    def __init__(self) -> None:
        self._events: deque[JsonDict] = deque(maxlen=1000)
        self._lock = threading.Lock()
        self._task: asyncio.Task[None] | None = None
        self.state = "idle"
        self.last_error = ""
        self.last_event_ms = 0
        self.connected_at_ms = 0
        self.connect_count = 0

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(), name="derivatives-force-order-stream")

    async def stop(self) -> None:
        if not self._task:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None
        self.state = "stopped"

    async def _run(self) -> None:
        while True:
            try:
                self.state = "connecting"
                async with websockets.connect(
                    FORCE_ORDER_WS,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=5,
                    max_queue=512,
                ) as ws:
                    self.state = "live"
                    self.connected_at_ms = int(time.time() * 1000)
                    self.connect_count += 1
                    async for msg in ws:
                        payload = json.loads(msg)
                        event = _event_from_force_order(payload)
                        if event:
                            with self._lock:
                                self._events.appendleft(event)
                                self.last_event_ms = event["ts_ms"]
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - background stream must retry forever
                self.state = "warming"
                self.last_error = f"{type(exc).__name__}: {exc}"
                await asyncio.sleep(3)

    def snapshot(self) -> JsonDict:
        with self._lock:
            events = list(self._events)
        now_ms = int(time.time() * 1000)
        age = (now_ms - self.last_event_ms) / 1000 if self.last_event_ms else None
        return {
            "state": self.state,
            "events": events,
            "event_count": len(events),
            "last_event_ms": self.last_event_ms,
            "last_event_age_seconds": age,
            "connected_at_ms": self.connected_at_ms,
            "connect_count": self.connect_count,
            "last_error": self.last_error,
            "source": "Binance USD-M !forceOrder@arr",
        }


DERIVATIVES = DerivativesStream()


def _ticker_rows(limit: int) -> tuple[list[JsonDict], list[str]]:
    errors: list[str] = []
    meta = _exchange_symbol_meta()
    try:
        rows = cached_public_get("/fapi/v1/ticker/24hr", ttl=FAST_TTL_SEC)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        errors.append(f"ticker24hr: {type(exc).__name__}")
        rows = []
    out: list[JsonDict] = []
    for row in rows if isinstance(rows, list) else []:
        symbol = str(row.get("symbol") or "").upper()
        if not symbol.endswith("USDT"):
            continue
        quote_volume = safe_float(row.get("quoteVolume"))
        if quote_volume <= 0:
            continue
        symbol_meta = meta.get(symbol, {})
        out.append(
            {
                "symbol": symbol,
                "base": base_from_symbol(symbol),
                "asset_class": symbol_meta.get("asset_class") or "crypto",
                "contract_type": symbol_meta.get("contract_type") or "PERPETUAL",
                "underlying_type": symbol_meta.get("underlying_type") or "COIN",
                "underlying_subtype": symbol_meta.get("underlying_subtype") or [],
                "last_price": safe_float(row.get("lastPrice")),
                "price_change_pct_24h": safe_float(row.get("priceChangePercent")),
                "volume_24h": safe_float(row.get("volume")),
                "quote_volume_24h": quote_volume,
                "high_24h": safe_float(row.get("highPrice")),
                "low_24h": safe_float(row.get("lowPrice")),
            }
        )
    out.sort(key=lambda r: r["quote_volume_24h"], reverse=True)
    return out[: max(8, min(TICKER_SCAN_LIMIT, limit))], errors


def _premium_map() -> tuple[dict[str, JsonDict], list[str]]:
    errors: list[str] = []
    try:
        rows = cached_public_get("/fapi/v1/premiumIndex", ttl=FAST_TTL_SEC)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        errors.append(f"premiumIndex: {type(exc).__name__}")
        rows = []
    out: dict[str, JsonDict] = {}
    for row in rows if isinstance(rows, list) else []:
        symbol = str(row.get("symbol") or "").upper()
        if not symbol.endswith("USDT"):
            continue
        mark = safe_float(row.get("markPrice"))
        index = safe_float(row.get("indexPrice"))
        out[symbol] = {
            "symbol": symbol,
            "mark_price": mark,
            "index_price": index,
            "last_funding_rate": safe_float(row.get("lastFundingRate")),
            "next_funding_time_ms": safe_int(row.get("nextFundingTime")),
            "premium_bps": ((mark - index) / index * 10000) if index else 0.0,
            "time_ms": safe_int(row.get("time")),
        }
    return out, errors


def _open_interest(symbol: str, price: float) -> JsonDict:
    row = cached_public_get("/fapi/v1/openInterest", {"symbol": symbol}, ttl=OI_TTL_SEC)
    oi = safe_float(row.get("openInterest"))
    return {
        "symbol": symbol,
        "base": base_from_symbol(symbol),
        "open_interest": oi,
        "oi_notional": oi * price if price else 0.0,
        "time_ms": safe_int(row.get("time")),
    }


def _window_spec(window: str) -> dict[str, Any]:
    return WINDOW_SPECS.get(window, WINDOW_SPECS["4h"])


def _open_interest_history(symbol: str = "BTCUSDT", window: str = "4h") -> tuple[list[JsonDict], list[str]]:
    errors: list[str] = []
    spec = _window_spec(window)
    try:
        rows = cached_public_get(
            "/futures/data/openInterestHist",
            {"symbol": symbol, "period": spec["period"], "limit": spec["limit"]},
            ttl=OI_TTL_SEC,
        )
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        errors.append(f"openInterestHist: {type(exc).__name__}")
        rows = []
    out = []
    for row in rows if isinstance(rows, list) else []:
        out.append(
            {
                "ts_ms": safe_int(row.get("timestamp")),
                "open_interest": safe_float(row.get("sumOpenInterest")),
                "open_interest_value": safe_float(row.get("sumOpenInterestValue")),
            }
        )
    return out, errors


def _rsi_from_closes(closes: list[float], period: int = 14) -> float | None:
    if len(closes) <= period + 1:
        return None
    gains = []
    losses = []
    for prev, cur in zip(closes[-period - 1 : -1], closes[-period:]):
        diff = cur - prev
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _rsi(symbol: str) -> JsonDict:
    rows = cached_public_get(
        "/fapi/v1/klines",
        {"symbol": symbol, "interval": "15m", "limit": 64},
        ttl=KLINE_TTL_SEC,
    )
    closes = [safe_float(row[4]) for row in rows if isinstance(row, list) and len(row) > 4]
    rsi = _rsi_from_closes(closes)
    last = closes[-1] if closes else 0.0
    return {
        "symbol": symbol,
        "base": base_from_symbol(symbol),
        "price": last,
        "rsi_15m": rsi,
        "state": "overbought" if rsi is not None and rsi >= 70 else "oversold" if rsi is not None and rsi <= 30 else "neutral",
    }


def _window_ms(window: str) -> int:
    return int(_window_spec(window)["hours"]) * 60 * 60 * 1000


def _liquidation_summary(events: list[JsonDict], window: str) -> JsonDict:
    now_ms = int(time.time() * 1000)
    cutoff = now_ms - _window_ms(window)
    active = [event for event in events if event.get("ts_ms", 0) >= cutoff]
    total = sum(safe_float(e.get("value")) for e in active)
    long_total = sum(safe_float(e.get("value")) for e in active if e.get("direction") == "long")
    short_total = sum(safe_float(e.get("value")) for e in active if e.get("direction") == "short")
    by_symbol: dict[str, JsonDict] = {}
    for event in active:
        symbol = event["symbol"]
        row = by_symbol.setdefault(
            symbol,
            {"symbol": symbol, "base": event["base"], "value": 0.0, "long": 0.0, "short": 0.0, "events": 0},
        )
        value = safe_float(event.get("value"))
        row["value"] += value
        row["events"] += 1
        if event.get("direction") == "long":
            row["long"] += value
        elif event.get("direction") == "short":
            row["short"] += value
    rows = sorted(by_symbol.values(), key=lambda r: r["value"], reverse=True)
    return {
        "window": window,
        "total": total,
        "long": long_total,
        "short": short_total,
        "event_count": len(active),
        "by_symbol": rows[:120],
        "events": active[:120],
    }


def _merge_live_rows(live_rows: list[JsonDict]) -> dict[str, JsonDict]:
    out: dict[str, JsonDict] = {}
    for row in live_rows:
        symbol = str(row.get("symbol") or "").upper()
        if symbol:
            out[symbol] = row
    return out


def _latest_series(path: str, symbol: str, spec: dict[str, Any], ttl: float = SENTIMENT_TTL_SEC) -> list[JsonDict]:
    rows = cached_public_get(
        path,
        {"symbol": symbol, "period": spec["period"], "limit": spec["limit"]},
        ttl=ttl,
    )
    return rows if isinstance(rows, list) else []


def _sentiment_for_symbol(symbol: str, spec: dict[str, Any]) -> JsonDict:
    global_rows = _latest_series("/futures/data/globalLongShortAccountRatio", symbol, spec)
    top_account_rows = _latest_series("/futures/data/topLongShortAccountRatio", symbol, spec)
    top_position_rows = _latest_series("/futures/data/topLongShortPositionRatio", symbol, spec)
    last_global = global_rows[-1] if global_rows else {}
    last_account = top_account_rows[-1] if top_account_rows else {}
    last_position = top_position_rows[-1] if top_position_rows else {}
    long_account = safe_float(last_global.get("longAccount"))
    short_account = safe_float(last_global.get("shortAccount"))
    top_long_account = safe_float(last_account.get("longAccount"))
    top_short_account = safe_float(last_account.get("shortAccount"))
    top_long_position = safe_float(last_position.get("longAccount"))
    top_short_position = safe_float(last_position.get("shortAccount"))
    return {
        "symbol": symbol,
        "base": base_from_symbol(symbol),
        "global_ratio": safe_float(last_global.get("longShortRatio")),
        "long_account_pct": long_account * 100,
        "short_account_pct": short_account * 100,
        "top_account_ratio": safe_float(last_account.get("longShortRatio")),
        "top_long_account_pct": top_long_account * 100,
        "top_short_account_pct": top_short_account * 100,
        "top_position_ratio": safe_float(last_position.get("longShortRatio")),
        "top_long_position_pct": top_long_position * 100,
        "top_short_position_pct": top_short_position * 100,
        "crowd_bias_pct": (long_account - short_account) * 100,
        "top_position_bias_pct": (top_long_position - top_short_position) * 100,
        "history": [
            {
                "ts_ms": safe_int(row.get("timestamp")),
                "ratio": safe_float(row.get("longShortRatio")),
                "long_pct": safe_float(row.get("longAccount")) * 100,
            }
            for row in global_rows[-60:]
        ],
        "time_ms": safe_int(last_global.get("timestamp") or last_account.get("timestamp") or last_position.get("timestamp")),
        "source": "Binance USD-M public long/short ratios",
    }


def _taker_flow_for_symbol(symbol: str, spec: dict[str, Any]) -> JsonDict:
    rows = _latest_series("/futures/data/takerlongshortRatio", symbol, spec)
    last = rows[-1] if rows else {}
    buy = safe_float(last.get("buyVol"))
    sell = safe_float(last.get("sellVol"))
    total = buy + sell
    return {
        "symbol": symbol,
        "base": base_from_symbol(symbol),
        "buy_sell_ratio": safe_float(last.get("buySellRatio")),
        "buy_volume": buy,
        "sell_volume": sell,
        "buy_share_pct": (buy / total * 100) if total else 0.0,
        "sell_share_pct": (sell / total * 100) if total else 0.0,
        "flow_bias_pct": ((buy - sell) / total * 100) if total else 0.0,
        "history": [
            {
                "ts_ms": safe_int(row.get("timestamp")),
                "ratio": safe_float(row.get("buySellRatio")),
                "buy": safe_float(row.get("buyVol")),
                "sell": safe_float(row.get("sellVol")),
            }
            for row in rows[-60:]
        ],
        "time_ms": safe_int(last.get("timestamp")),
        "source": "Binance USD-M taker buy/sell volume",
    }


def _build_sentiment(symbols: list[str], spec: dict[str, Any]) -> tuple[JsonDict, list[str]]:
    errors: list[str] = []
    selected = symbols[:SENTIMENT_SYMBOL_LIMIT]
    sentiment_rows: list[JsonDict] = []
    flow_rows: list[JsonDict] = []
    if not selected:
        return {"long_short": {"rows": []}, "taker_flow": {"rows": []}}, errors
    with concurrent.futures.ThreadPoolExecutor(max_workers=9) as pool:
        sent_futures = {pool.submit(_sentiment_for_symbol, symbol, spec): symbol for symbol in selected}
        flow_futures = {pool.submit(_taker_flow_for_symbol, symbol, spec): symbol for symbol in selected}
        for fut in concurrent.futures.as_completed(sent_futures):
            symbol = sent_futures[fut]
            try:
                item = fut.result()
                if item.get("time_ms"):
                    sentiment_rows.append(item)
            except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
                errors.append(f"longShort:{symbol}:{type(exc).__name__}")
        for fut in concurrent.futures.as_completed(flow_futures):
            symbol = flow_futures[fut]
            try:
                item = fut.result()
                if item.get("time_ms"):
                    flow_rows.append(item)
            except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
                errors.append(f"takerFlow:{symbol}:{type(exc).__name__}")
    sentiment_rows.sort(key=lambda r: abs(safe_float(r.get("crowd_bias_pct"))), reverse=True)
    flow_rows.sort(key=lambda r: abs(safe_float(r.get("flow_bias_pct"))), reverse=True)
    return {
        "long_short": {
            "rows": sentiment_rows,
            "most_long": sorted(sentiment_rows, key=lambda r: r.get("long_account_pct", 0), reverse=True)[:8],
            "most_short": sorted(sentiment_rows, key=lambda r: r.get("short_account_pct", 0), reverse=True)[:8],
            "source": "Binance global/top-trader long-short public endpoints",
            "window_period": spec["period"],
        },
        "taker_flow": {
            "rows": flow_rows,
            "buy_pressure": sorted(flow_rows, key=lambda r: r.get("flow_bias_pct", 0), reverse=True)[:8],
            "sell_pressure": sorted(flow_rows, key=lambda r: r.get("flow_bias_pct", 0))[:8],
            "source": "Binance taker buy/sell public endpoint",
            "window_period": spec["period"],
        },
    }, errors


def _compact_protocol(row: JsonDict) -> JsonDict:
    slug = row.get("slug") or row.get("module") or row.get("name")
    slug_text = str(slug or "").strip()
    logo = row.get("logo")
    logo_text = str(logo or "").lower()
    if slug_text.lower() in BAD_DEFI_ICON_SLUGS or any(bad in logo_text for bad in BAD_DEFI_ICON_SLUGS):
        logo = None
    return {
        "name": row.get("displayName") or row.get("name") or row.get("slug") or "Protocol",
        "symbol": (row.get("module") or row.get("symbol") or row.get("name") or "")[:18].upper(),
        "slug": slug,
        "url": f"https://defillama.com/protocol/{urllib.parse.quote(slug_text)}" if slug_text else "https://defillama.com/",
        "category": row.get("category") or row.get("protocolType") or "protocol",
        "logo": logo,
        "chains": row.get("chains") or [],
        "total24h": safe_float(row.get("total24h")),
        "total7d": safe_float(row.get("total7d")),
        "total30d": safe_float(row.get("total30d")),
        "total1y": safe_float(row.get("total1y")),
        "change_1d_pct": safe_float(row.get("change_1d")),
        "change_7d_pct": safe_float(row.get("change_7d")),
        "change_1m_pct": safe_float(row.get("change_1m")),
    }


def _has_protocol_activity(row: JsonDict) -> bool:
    return any(safe_float(row.get(key)) > 0 for key in ("total24h", "total7d", "total30d", "total1y"))


def _defi_payload() -> tuple[JsonDict, list[str]]:
    errors: list[str] = []

    def get(name: str, url: str) -> tuple[str, Any, str]:
        try:
            return name, cached_url_get(url, ttl=DEFI_TTL_SEC), ""
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            return name, None, f"{name}:{type(exc).__name__}"

    urls = {
        "chains": "https://api.llama.fi/v2/chains",
        "dexs": "https://api.llama.fi/overview/dexs?excludeTotalDataChartBreakdown=true",
        "fees": "https://api.llama.fi/overview/fees?excludeTotalDataChartBreakdown=true",
        "yields": "https://yields.llama.fi/pools",
        "stablecoins": "https://stablecoins.llama.fi/stablecoins?includePrices=true",
        "options": "https://api.llama.fi/overview/options?excludeTotalDataChartBreakdown=true",
        "open_interest": "https://api.llama.fi/overview/open-interest?excludeTotalDataChartBreakdown=true",
        "bridges": "https://api.llama.fi/overview/bridge-aggregators?excludeTotalDataChartBreakdown=true",
    }
    results: dict[str, Any] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(get, name, url) for name, url in urls.items()]
        for fut in concurrent.futures.as_completed(futures):
            name, data, err = fut.result()
            if err:
                errors.append(err)
            results[name] = data

    chains_raw = results.get("chains") if isinstance(results.get("chains"), list) else []
    chains = [
        {
            "name": row.get("name") or row.get("tokenSymbol") or "Chain",
            "symbol": row.get("tokenSymbol") or row.get("name") or "",
            "chain_id": row.get("chainId"),
            "gecko_id": row.get("gecko_id"),
            "tvl": safe_float(row.get("tvl")),
            "source": "DeFiLlama chains",
            "url": f"https://defillama.com/chain/{urllib.parse.quote(str(row.get('name') or ''))}",
        }
        for row in chains_raw
        if safe_float(row.get("tvl")) > 0
    ]
    chains.sort(key=lambda r: r["tvl"], reverse=True)

    dexs_raw = ((results.get("dexs") or {}).get("protocols") if isinstance(results.get("dexs"), dict) else []) or []
    dexs = [_compact_protocol(row) for row in dexs_raw if safe_float(row.get("total24h")) > 0]
    dexs.sort(key=lambda r: r["total24h"], reverse=True)

    fees_raw = ((results.get("fees") or {}).get("protocols") if isinstance(results.get("fees"), dict) else []) or []
    fees = [_compact_protocol(row) for row in fees_raw if safe_float(row.get("total24h")) > 0]
    fees.sort(key=lambda r: r["total24h"], reverse=True)

    options_raw = ((results.get("options") or {}).get("protocols") if isinstance(results.get("options"), dict) else []) or []
    options = [_compact_protocol(row) for row in options_raw if _has_protocol_activity(row)]
    options.sort(key=lambda r: max(safe_float(r.get("total24h")), safe_float(r.get("total7d")), safe_float(r.get("total30d"))), reverse=True)

    open_interest_raw = ((results.get("open_interest") or {}).get("protocols") if isinstance(results.get("open_interest"), dict) else []) or []
    open_interest = [_compact_protocol(row) for row in open_interest_raw if _has_protocol_activity(row)]
    open_interest.sort(key=lambda r: max(safe_float(r.get("total24h")), safe_float(r.get("total7d")), safe_float(r.get("total30d"))), reverse=True)

    bridges_raw = ((results.get("bridges") or {}).get("protocols") if isinstance(results.get("bridges"), dict) else []) or []
    bridges = [_compact_protocol(row) for row in bridges_raw if _has_protocol_activity(row)]
    bridges.sort(key=lambda r: max(safe_float(r.get("total24h")), safe_float(r.get("total7d")), safe_float(r.get("total30d"))), reverse=True)

    stable_raw = ((results.get("stablecoins") or {}).get("peggedAssets") if isinstance(results.get("stablecoins"), dict) else []) or []
    stablecoins: list[JsonDict] = []
    for row in stable_raw:
        circulating = row.get("circulating") if isinstance(row.get("circulating"), dict) else {}
        supply = safe_float(circulating.get("peggedUSD"))
        if supply <= 0:
            continue
        stablecoins.append(
            {
                "name": row.get("name") or row.get("symbol") or "Stablecoin",
                "symbol": row.get("symbol") or row.get("name") or "",
                "gecko_id": row.get("gecko_id"),
                "peg_type": row.get("pegType"),
                "peg_mechanism": row.get("pegMechanism"),
                "supply": supply,
                "price": safe_float(row.get("price")),
                "chains": row.get("chains") or [],
                "source": "DeFiLlama stablecoins",
                "url": "https://defillama.com/stablecoins",
            }
        )
    stablecoins.sort(key=lambda r: r["supply"], reverse=True)

    yields_raw = ((results.get("yields") or {}).get("data") if isinstance(results.get("yields"), dict) else []) or []
    yields: list[JsonDict] = []
    for row in yields_raw:
        tvl = safe_float(row.get("tvlUsd"))
        apy = safe_float(row.get("apy"))
        if tvl < 1_000_000 or row.get("outlier") or apy <= 0:
            continue
        yields.append(
            {
                "name": f"{row.get('project') or 'pool'} · {row.get('symbol') or ''}".strip(),
                "symbol": row.get("symbol") or row.get("project") or "",
                "project": row.get("project"),
                "chain": row.get("chain"),
                "pool": row.get("pool"),
                "tvl": tvl,
                "apy": apy,
                "apy_1d_pct": safe_float(row.get("apyPct1D")),
                "apy_7d_pct": safe_float(row.get("apyPct7D")),
                "stablecoin": bool(row.get("stablecoin")),
                "il_risk": row.get("ilRisk"),
                "exposure": row.get("exposure"),
                "source": "DeFiLlama yields",
                "url": f"https://defillama.com/yields/pool/{urllib.parse.quote(str(row.get('pool') or ''))}",
            }
        )
    yields_by_tvl = sorted(yields, key=lambda r: r["tvl"], reverse=True)
    yields_by_apy = sorted(yields, key=lambda r: r["apy"], reverse=True)

    dexs_total = results.get("dexs") if isinstance(results.get("dexs"), dict) else {}
    fees_total = results.get("fees") if isinstance(results.get("fees"), dict) else {}
    options_total = results.get("options") if isinstance(results.get("options"), dict) else {}
    open_interest_total = results.get("open_interest") if isinstance(results.get("open_interest"), dict) else {}
    bridges_total = results.get("bridges") if isinstance(results.get("bridges"), dict) else {}
    total_chain_tvl = sum(r["tvl"] for r in chains)
    total_stable_supply = sum(r["supply"] for r in stablecoins)

    return {
        "summary": {
            "chain_tvl": total_chain_tvl,
            "dex_volume_24h": safe_float(dexs_total.get("total24h")),
            "dex_volume_7d": safe_float(dexs_total.get("total7d")),
            "dex_volume_30d": safe_float(dexs_total.get("total30d")),
            "dex_volume_1y": safe_float(dexs_total.get("total1y")),
            "fees_24h": safe_float(fees_total.get("total24h")),
            "fees_7d": safe_float(fees_total.get("total7d")),
            "fees_30d": safe_float(fees_total.get("total30d")),
            "fees_1y": safe_float(fees_total.get("total1y")),
            "options_24h": safe_float(options_total.get("total24h")),
            "options_7d": safe_float(options_total.get("total7d")),
            "options_30d": safe_float(options_total.get("total30d")),
            "options_1y": safe_float(options_total.get("total1y")),
            "open_interest_24h": safe_float(open_interest_total.get("total24h")),
            "open_interest_7d": safe_float(open_interest_total.get("total7d")),
            "open_interest_30d": safe_float(open_interest_total.get("total30d")),
            "open_interest_1y": safe_float(open_interest_total.get("total1y")),
            "bridges_24h": safe_float(bridges_total.get("total24h")),
            "bridges_7d": safe_float(bridges_total.get("total7d")),
            "bridges_30d": safe_float(bridges_total.get("total30d")),
            "bridges_1y": safe_float(bridges_total.get("total1y")),
            "stablecoin_supply": total_stable_supply,
            "stablecoin_assets": len(stablecoins),
            "yield_pools": len(yields),
            "source": "DeFiLlama public APIs",
        },
        "chains": chains[:DEFI_LIMIT],
        "dexs": dexs[:DEFI_LIMIT],
        "fees": fees[:DEFI_LIMIT],
        "options": options[:DEFI_LIMIT],
        "open_interest": open_interest[:DEFI_LIMIT],
        "bridges": bridges[:DEFI_LIMIT],
        "stablecoins": stablecoins[:DEFI_LIMIT],
        "yields": yields_by_tvl[:DEFI_LIMIT],
        "yield_opportunities": yields_by_apy[:DEFI_LIMIT],
        "status": "live" if not errors else "degraded",
    }, errors


def build_derivatives_payload(
    live_rows: list[JsonDict],
    health: JsonDict,
    stream_snapshot: JsonDict,
    limit: int = 120,
    window: str = "4h",
) -> JsonDict:
    started = time.perf_counter()
    limit = max(20, min(240, limit))
    if window not in WINDOW_SPECS:
        window = "4h"
    spec = _window_spec(window)
    cache_key = f"{window}:{limit}"
    now = time.monotonic()
    with _PAYLOAD_CACHE_LOCK:
        cached = _PAYLOAD_CACHE.get(cache_key)
        if cached and now - cached[0] <= 8.0:
            payload = dict(cached[1])
            payload["cache"] = {"hit": True, "age_seconds": round(now - cached[0], 3)}
            payload["latency_ms"] = round((time.perf_counter() - started) * 1000, 2)
            return payload

    errors: list[str] = []
    all_tickers, ticker_errors = _ticker_rows(max(limit, TICKER_SCAN_LIMIT))
    errors.extend(ticker_errors)
    tradfi_tickers = [row for row in all_tickers if row.get("asset_class") == "tradfi"]
    tickers = [row for row in all_tickers if row.get("asset_class") != "tradfi"][:limit]
    premium, premium_errors = _premium_map()
    errors.extend(premium_errors)
    live_by_symbol = _merge_live_rows(live_rows)

    if not tickers:
        for row in live_rows[:limit]:
            symbol = str(row.get("symbol") or "").upper()
            if not symbol:
                continue
            tickers.append(
                {
                    "symbol": symbol,
                    "base": base_from_symbol(symbol),
                    "last_price": safe_float(row.get("futures_mid") or row.get("spot_mid")),
                    "price_change_pct_24h": 0.0,
                    "volume_24h": 0.0,
                    "quote_volume_24h": 0.0,
                    "fallback_source": "local Binance stream snapshot",
                }
            )

    funding_rows: list[JsonDict] = []
    for row in tickers:
        symbol = row["symbol"]
        p = premium.get(symbol, {})
        live = live_by_symbol.get(symbol, {})
        mark = safe_float(p.get("mark_price")) or safe_float(row.get("last_price"))
        index = safe_float(p.get("index_price"))
        funding = safe_float(p.get("last_funding_rate"), safe_float(live.get("funding_rate")))
        funding_rows.append(
            {
                **row,
                "mark_price": mark,
                "index_price": index,
                "last_funding_rate": funding,
                "funding_rate": funding,
                "funding_pct": funding * 100,
                "premium_bps": safe_float(p.get("premium_bps")),
                "next_funding_time_ms": safe_int(p.get("next_funding_time_ms")),
                "basis_bps": safe_float(live.get("mid_spread_bps") or live.get("spot_to_perp_bps")),
                "opportunity_score": safe_float(live.get("opportunity_score")),
                "age_seconds": safe_float(live.get("age_seconds")),
                "source": "Binance USD-M public REST",
            }
        )

    oi_rows: list[JsonDict] = []
    oi_symbols = [row["symbol"] for row in funding_rows[:18]] if tickers and not ticker_errors else []
    if oi_symbols:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = {
                pool.submit(_open_interest, row["symbol"], safe_float(row.get("mark_price") or row.get("last_price"))): row["symbol"]
                for row in funding_rows[:18]
            }
            for fut in concurrent.futures.as_completed(futures):
                try:
                    item = fut.result()
                    if item.get("oi_notional", 0) > 0:
                        oi_rows.append(item)
                except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
                    errors.append(f"openInterest:{futures[fut]}:{type(exc).__name__}")
    oi_rows.sort(key=lambda row: row.get("oi_notional", 0.0), reverse=True)
    oi_history, oi_hist_errors = _open_interest_history(
        "BTCUSDT" if "BTCUSDT" in oi_symbols else (oi_symbols[0] if oi_symbols else "BTCUSDT"),
        window,
    )
    errors.extend(oi_hist_errors)

    rsi_rows: list[JsonDict] = []
    if oi_symbols:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(_rsi, symbol): symbol for symbol in oi_symbols[:18]}
            for fut in concurrent.futures.as_completed(futures):
                try:
                    item = fut.result()
                    if item.get("rsi_15m") is not None:
                        rsi_rows.append(item)
                except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, IndexError) as exc:
                    errors.append(f"rsi:{futures[fut]}:{type(exc).__name__}")
    rsi_rows.sort(key=lambda row: abs(safe_float(row.get("rsi_15m")) - 50), reverse=True)

    liquidations = _liquidation_summary(stream_snapshot.get("events", []), window)
    sentiment_payload, sentiment_errors = _build_sentiment([row["symbol"] for row in funding_rows], spec)
    errors.extend(sentiment_errors)
    defi_payload, defi_errors = _defi_payload()
    errors.extend(defi_errors)

    payload = {
        "ok": True,
        "updated_at_ms": int(time.time() * 1000),
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "cache": {"hit": False, "age_seconds": 0.0},
        "limit": limit,
        "window": window,
        "window_spec": {"period": spec["period"], "limit": spec["limit"], "hours": spec["hours"]},
        "windows": list(WINDOW_SPECS.keys()),
        "market": {"rows": funding_rows[:limit], "count": len(funding_rows)},
        "tradfi_perps": {
            "rows": tradfi_tickers[:80],
            "count": len(tradfi_tickers),
            "source": "Binance USD-M TRADIFI_PERPETUAL contracts",
            "equities": sum(1 for row in tradfi_tickers if "EQUITY" in str(row.get("underlying_type") or "")),
            "commodities": sum(1 for row in tradfi_tickers if str(row.get("underlying_type") or "") == "COMMODITY"),
        },
        "funding": {
            "rows": sorted(funding_rows, key=lambda r: abs(r.get("funding_rate", 0.0)), reverse=True)[:limit],
            "highest": sorted(funding_rows, key=lambda r: r.get("funding_rate", 0.0), reverse=True)[:8],
            "lowest": sorted(funding_rows, key=lambda r: r.get("funding_rate", 0.0))[:8],
        },
        "open_interest": {
            "rows": oi_rows[:limit],
            "history": oi_history,
            "symbol": "BTCUSDT" if "BTCUSDT" in oi_symbols else (oi_symbols[0] if oi_symbols else ""),
        },
        "rsi": {"rows": rsi_rows[:limit], "interval": "15m", "period": 14},
        "long_short": sentiment_payload["long_short"],
        "taker_flow": sentiment_payload["taker_flow"],
        "defi": defi_payload,
        "provider_map": {
            "coinglass": COINGLASS_SURFACES,
            "note": "CoinGlass is used as a product/data-surface reference only until API credentials are configured.",
        },
        "liquidations": liquidations,
        "exchange_liquidations": [
            {
                "exchange": "Binance",
                "liquidations": liquidations["total"],
                "long": liquidations["long"],
                "short": liquidations["short"],
                "share_pct": 100.0 if liquidations["total"] else 0.0,
                "source": "public stream",
            },
            {
                "exchange": "CoinGlass multi-exchange",
                "liquidations": None,
                "long": None,
                "short": None,
                "share_pct": None,
                "status": "requires_key",
                "source": "CoinGlass API",
            },
        ],
        "stream": stream_snapshot,
        "sources": [
            {
                "name": "Binance liquidation stream",
                "status": stream_snapshot.get("state") or "warming",
                "detail": "!forceOrder@arr, keyless, live from server start",
            },
            {
                "name": "Binance mark/funding",
                "status": "live" if not premium_errors else "degraded",
                "detail": "/fapi/v1/premiumIndex",
            },
            {
                "name": "Binance open interest",
                "status": "live" if oi_rows else "warming",
                "detail": "/fapi/v1/openInterest + openInterestHist",
            },
            {
                "name": "Binance long/short",
                "status": "live" if sentiment_payload["long_short"]["rows"] else "warming",
                "detail": "/futures/data global/top-trader ratios",
            },
            {
                "name": "Binance taker flow",
                "status": "live" if sentiment_payload["taker_flow"]["rows"] else "warming",
                "detail": "/futures/data/takerlongshortRatio",
            },
            {
                "name": "Binance TradFi perps",
                "status": "live" if tradfi_tickers else "warming",
                "detail": "TRADIFI_PERPETUAL equity and commodity contracts kept out of crypto heatmaps",
            },
            {
                "name": "DeFiLlama breadth",
                "status": defi_payload.get("status", "warming"),
                "detail": "chains, DEX volume, fees/revenue and yields",
            },
            {
                "name": "CoinGlass liquidation heatmap",
                "status": "requires_key",
                "detail": "Exact multi-exchange historical heatmap needs CoinGlass API access",
            },
        ],
        "errors": errors[:40],
        "health": health,
    }
    with _PAYLOAD_CACHE_LOCK:
        _PAYLOAD_CACHE[cache_key] = (now, payload)
        for key, (ts, _) in list(_PAYLOAD_CACHE.items()):
            if now - ts > 20:
                _PAYLOAD_CACHE.pop(key, None)
    return payload
