from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


FAPI_BASE = "https://fapi.binance.com"
ENRICHMENT_TTL_SEC = 60.0
REQUEST_TIMEOUT_SEC = 4.0
MAX_SYMBOLS = 12

JsonDict = dict[str, Any]
_CACHE: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str, ttl: float = ENRICHMENT_TTL_SEC) -> Any | None:
    item = _CACHE.get(key)
    if not item:
        return None
    created, payload = item
    if time.monotonic() - created <= ttl:
        return payload
    return None


def _cache_set(key: str, payload: Any) -> Any:
    _CACHE[key] = (time.monotonic(), payload)
    return payload


def _public_get(path: str, params: JsonDict) -> Any:
    query = urllib.parse.urlencode(params)
    url = f"{FAPI_BASE}{path}?{query}" if query else f"{FAPI_BASE}{path}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CGSignalLab/1.0 public-data research dashboard",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as response:
        return json.loads(response.read().decode("utf-8"))


def cached_public_get(path: str, params: JsonDict, ttl: float = ENRICHMENT_TTL_SEC) -> Any:
    key = f"{path}:{urllib.parse.urlencode(sorted(params.items()))}"
    cached = _cache_get(key, ttl)
    if cached is not None:
        return cached
    return _cache_set(key, _public_get(path, params))


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def enrich_symbol(symbol: str) -> JsonDict:
    out: JsonDict = {"symbol": symbol, "ok": True, "errors": []}
    try:
        oi = cached_public_get("/fapi/v1/openInterest", {"symbol": symbol})
        out["open_interest"] = safe_float(oi.get("openInterest"))
        out["open_interest_time_ms"] = safe_int(oi.get("time"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
        out["errors"].append(f"openInterest: {type(exc).__name__}")

    try:
        premium = cached_public_get("/fapi/v1/premiumIndex", {"symbol": symbol})
        out["mark_price"] = safe_float(premium.get("markPrice"))
        out["index_price"] = safe_float(premium.get("indexPrice"))
        out["last_funding_rate"] = safe_float(premium.get("lastFundingRate"))
        out["next_funding_time_ms"] = safe_int(premium.get("nextFundingTime"))
        out["premium_bps"] = (
            ((out["mark_price"] - out["index_price"]) / out["index_price"]) * 10000
            if out.get("index_price")
            else 0.0
        )
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
        out["errors"].append(f"premiumIndex: {type(exc).__name__}")

    try:
        ticker = cached_public_get("/fapi/v1/ticker/24hr", {"symbol": symbol})
        out["price_change_pct_24h"] = safe_float(ticker.get("priceChangePercent"))
        out["volume_24h"] = safe_float(ticker.get("volume"))
        out["quote_volume_24h"] = safe_float(ticker.get("quoteVolume"))
        out["last_price"] = safe_float(ticker.get("lastPrice"))
        out["high_24h"] = safe_float(ticker.get("highPrice"))
        out["low_24h"] = safe_float(ticker.get("lowPrice"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
        out["errors"].append(f"ticker24hr: {type(exc).__name__}")

    try:
        rows = cached_public_get(
            "/futures/data/globalLongShortAccountRatio",
            {"symbol": symbol, "period": "5m", "limit": 1},
            ttl=ENRICHMENT_TTL_SEC * 2,
        )
        latest = rows[-1] if rows else {}
        out["global_long_short_ratio"] = safe_float(latest.get("longShortRatio"))
        out["global_long_account"] = safe_float(latest.get("longAccount"))
        out["global_short_account"] = safe_float(latest.get("shortAccount"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as exc:
        out["errors"].append(f"globalLongShort: {type(exc).__name__}")

    try:
        rows = cached_public_get(
            "/futures/data/takerlongshortRatio",
            {"symbol": symbol, "period": "5m", "limit": 1},
            ttl=ENRICHMENT_TTL_SEC * 2,
        )
        latest = rows[-1] if rows else {}
        out["taker_buy_sell_ratio"] = safe_float(latest.get("buySellRatio"))
        out["taker_buy_vol"] = safe_float(latest.get("buyVol"))
        out["taker_sell_vol"] = safe_float(latest.get("sellVol"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as exc:
        out["errors"].append(f"takerLongShort: {type(exc).__name__}")

    out["ok"] = not out["errors"]
    return out


def enrich_symbols(symbols: list[str], max_symbols: int = MAX_SYMBOLS) -> JsonDict:
    clean = []
    seen = set()
    for symbol in symbols:
        normalized = "".join(ch for ch in symbol.upper() if ch.isalnum())
        if normalized and normalized not in seen:
            clean.append(normalized)
            seen.add(normalized)
        if len(clean) >= max(1, min(MAX_SYMBOLS, max_symbols)):
            break

    started = time.perf_counter()
    rows = [enrich_symbol(symbol) for symbol in clean]
    errors = [error for row in rows for error in row.get("errors", [])]
    return {
        "ok": not errors,
        "source": "Binance USD-M public REST",
        "ttl_seconds": ENRICHMENT_TTL_SEC,
        "requested_symbols": clean,
        "rows": rows,
        "count": len(rows),
        "errors": errors[:30],
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "note": "Optional public enrichment. No keys, no account endpoints, no trading.",
    }
