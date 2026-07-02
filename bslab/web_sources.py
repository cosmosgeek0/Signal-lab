"""External public-data source layer.

Keyless, server-side, TTL-cached, timeout-bounded adapters for market context:
Binance REST (real-time ticks), CoinGecko (coins + tokenized equities),
CoinPaprika, Alternative.me (Fear & Greed), DefiLlama (TVL + stablecoins +
DEX volume), 10 news RSS feeds + GDELT, open.er-api.com (FX). No source here
ever needs an API key — key-required providers are not part of this product.

Rules enforced here:
* never on the hot path — only the slow /api/market-overview family reads this;
* stale-if-error — a source failure serves the last good payload and reports
  ``stale``/``error`` status instead of breaking the app;
* bounded — every fetch has a timeout and a response-size cap;
* honest — no data is ever synthesized; missing sources report their state.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Callable, Optional

JsonDict = dict[str, Any]

USER_AGENT = "CGSignalLab/1.0 (public research dashboard)"
MAX_BYTES = 3_500_000          # response size cap
ERROR_RETRY_SEC = 60.0         # back off after a failure instead of hammering


class _Redirect308(urllib.request.HTTPRedirectHandler):
    """urllib doesn't follow 308 Permanent Redirect by default (CoinDesk RSS)."""
    def http_error_308(self, req, fp, code, msg, headers):  # noqa: N802
        return self.http_error_301(req, fp, 301, msg, headers)


_OPENER = urllib.request.build_opener(_Redirect308())


def fetch_bytes(url: str, timeout: float = 6.0, accept: str = "application/json") -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with _OPENER.open(req, timeout=timeout) as resp:
        return resp.read(MAX_BYTES)


def fetch_json(url: str, timeout: float = 6.0) -> Any:
    return json.loads(fetch_bytes(url, timeout).decode("utf-8", "replace"))


class TTLSource:
    """One cached external source: fetch on demand, serve stale on error."""

    def __init__(self, sid: str, label: str, kind: str, ttl: float,
                 fetcher: Optional[Callable[[], Any]], detail: str = "",
                 status_override: str = "") -> None:
        self.id = sid
        self.label = label
        self.kind = kind
        self.ttl = ttl
        self.fetcher = fetcher
        self.detail = detail
        self.status_override = status_override
        self.data: Any = None
        self.fetched_mono = 0.0
        self.last_ok_ts: Optional[float] = None
        self.last_error = ""
        self.latency_ms: Optional[float] = None
        self._next_try = 0.0
        self._lock = threading.Lock()
        self._refreshing = False

    def get_nowait(self) -> Any:
        """Non-blocking read: return whatever we have NOW and refresh in a
        background thread if expired. Used for slow sources (news) so no HTTP
        request ever waits on them."""
        if self.fetcher is None:
            return None
        now = time.monotonic()
        fresh = self.data is not None and (now - self.fetched_mono) < self.ttl
        if not fresh and now >= self._next_try and not self._refreshing:
            self._refreshing = True

            def run() -> None:
                try:
                    self.get()
                finally:
                    self._refreshing = False
            threading.Thread(target=run, name=f"cg-src-{self.id}", daemon=True).start()
        return self.data

    def get(self) -> Any:
        if self.fetcher is None:
            return None
        now = time.monotonic()
        if self.data is not None and (now - self.fetched_mono) < self.ttl:
            return self.data
        if now < self._next_try:
            return self.data  # backing off; serve stale (or None)
        with self._lock:
            now = time.monotonic()
            if self.data is not None and (now - self.fetched_mono) < self.ttl:
                return self.data
            if now < self._next_try:
                return self.data
            try:
                t0 = time.perf_counter()
                data = self.fetcher()
                self.latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                self.data = data
                self.fetched_mono = time.monotonic()
                self.last_ok_ts = time.time()
                self.last_error = ""
                self._next_try = 0.0
            except Exception as exc:  # noqa: BLE001 - a source must never raise out
                self.last_error = f"{type(exc).__name__}: {exc}"
                self._next_try = time.monotonic() + ERROR_RETRY_SEC
            return self.data

    def age_seconds(self) -> Optional[float]:
        if self.last_ok_ts is None:
            return None
        return round(time.time() - self.last_ok_ts, 1)

    def status(self) -> JsonDict:
        if self.status_override:
            state = self.status_override
        elif self.fetcher is None:
            state = "disabled"
        elif self.data is None and self.last_error:
            state = "error"
        elif self.data is None:
            state = "idle"
        elif (time.monotonic() - self.fetched_mono) < self.ttl * 1.5:
            state = "live"
        else:
            state = "stale"
        return {
            "id": self.id, "label": self.label, "kind": self.kind, "status": state,
            "detail": self.detail, "ttl_sec": self.ttl, "age_seconds": self.age_seconds(),
            "latency_ms": self.latency_ms, "error": self.last_error[:160],
        }


# ---- fetchers ----------------------------------------------------------------

CG = "https://api.coingecko.com/api/v3"


def _cg_global() -> JsonDict:
    return fetch_json(f"{CG}/global")["data"]


def _cg_markets() -> list:
    # top-250: wide icon/price coverage in ONE call (~1 MB, cached server-side)
    url = (f"{CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250"
           "&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d")
    return fetch_json(url, timeout=15.0)


def _fng() -> list:
    return fetch_json("https://api.alternative.me/fng/?limit=30&format=json", timeout=8.0)["data"]


def _paprika_global() -> JsonDict:
    return fetch_json("https://api.coinpaprika.com/v1/global")


def _paprika_tickers() -> list:
    return fetch_json("https://api.coinpaprika.com/v1/tickers?limit=100", timeout=8.0)


def _llama_tvl() -> list:
    return fetch_json("https://api.llama.fi/v2/historicalChainTvl", timeout=8.0)


def _llama_stables() -> JsonDict:
    return fetch_json("https://stablecoins.llama.fi/stablecoins?includePrices=true", timeout=8.0)


def _gdelt_news() -> JsonDict:
    # NOTE: plain http on purpose — GDELT's TLS handshake times out from some
    # networks while http works; the payload is public news metadata.
    q = urllib.parse.quote("(bitcoin OR ethereum OR cryptocurrency) sourcelang:english")
    url = (f"http://api.gdeltproject.org/api/v2/doc/doc?query={q}"
           "&mode=artlist&format=json&maxrecords=16&sort=datedesc")
    return fetch_json(url, timeout=8.0)


def _fx_rates() -> JsonDict:
    data = fetch_json("https://open.er-api.com/v6/latest/USD", timeout=8.0)
    if data.get("result") != "success":
        raise ValueError("FX provider returned non-success")
    return data


def _binance_ticker() -> JsonDict:
    """Binance public REST 24h ticker — REAL-TIME prices, 24h change and quote
    volume for every listed pair. Keyless, one call, 10s TTL. This is what
    makes numbers tick between slower CoinGecko refreshes."""
    rows = fetch_json("https://api.binance.com/api/v3/ticker/24hr", timeout=10.0)
    out = {}
    for r in rows:
        sym = r.get("symbol", "")
        if sym.endswith("USDT"):
            try:
                out[sym] = {
                    "price": float(r["lastPrice"]),
                    "chg24h": float(r["priceChangePercent"]),
                    "qvol": float(r["quoteVolume"]),
                }
            except (KeyError, TypeError, ValueError):
                continue
    return out


def _cg_stocks() -> list:
    """CoinGecko 'tokenized-stock' category: on-chain tokenized equities (xStock,
    Ondo, bStocks wrappers) whose price tracks the underlying listed company.
    This is real, keyless stock-market exposure — the same data Uniswap shows."""
    url = (f"{CG}/coins/markets?vs_currency=usd&category=tokenized-stock"
           "&order=market_cap_desc&per_page=50&page=1&sparkline=true"
           "&price_change_percentage=24h,7d")
    return fetch_json(url, timeout=15.0)


def _llama_dex() -> JsonDict:
    """DefiLlama DEX volume overview: real daily volume bars + 24h total."""
    d = fetch_json("https://api.llama.fi/overview/dexs?excludeTotalDataChartBreakdown=true",
                   timeout=10.0)
    return {
        "total24h": d.get("total24h"),
        "change_1d": d.get("change_1d"),
        "chart": (d.get("totalDataChart") or [])[-45:],
    }


def _cg_trending() -> list:
    data = fetch_json(f"{CG}/search/trending", timeout=8.0)
    out = []
    for row in (data.get("coins") or [])[:12]:
        item = row.get("item") or {}
        out.append({
            "id": item.get("id"),
            "base": str(item.get("symbol") or "").upper(),
            "name": item.get("name"),
            "rank": item.get("market_cap_rank"),
            "image": item.get("small") or item.get("thumb"),
        })
    return out


RSS_FEEDS = [
    ("coindesk.com", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("cointelegraph.com", "https://cointelegraph.com/rss"),
    ("theblock.co", "https://www.theblock.co/rss.xml"),
    ("decrypt.co", "https://decrypt.co/feed"),
    ("beincrypto.com", "https://beincrypto.com/feed/"),
    ("newsbtc.com", "https://www.newsbtc.com/feed/"),
    ("ambcrypto.com", "https://ambcrypto.com/feed/"),
    ("u.today", "https://u.today/rss"),
    ("cryptoslate.com", "https://cryptoslate.com/feed/"),
    ("bitcoinmagazine.com", "https://bitcoinmagazine.com/feed"),
]
_RSS_PER_FEED = 12   # one prolific outlet must never drown the rest


def _rss_news() -> list:
    """Merge public crypto RSS feeds (headline + link + time, with source
    attribution). Standard syndication use; full articles are never copied."""
    import email.utils
    import xml.etree.ElementTree as ET
    items = []
    errors = []
    for domain, url in RSS_FEEDS:
        try:
            root = ET.fromstring(fetch_bytes(url, timeout=6.0, accept="application/rss+xml, application/xml, text/xml"))
            n_feed = 0
            for it in root.iter("item"):
                if n_feed >= _RSS_PER_FEED:
                    break
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or "").strip()
                pub = it.findtext("pubDate")
                iso = None
                if pub:
                    try:
                        iso = email.utils.parsedate_to_datetime(pub).strftime("%Y-%m-%dT%H:%M:%SZ")
                    except (TypeError, ValueError):
                        iso = None
                if title and link:
                    items.append({"title": title[:200], "url": link, "domain": domain, "time": iso})
                    n_feed += 1
        except Exception as exc:  # noqa: BLE001 - one dead feed must not kill the rest
            errors.append(f"{domain}: {type(exc).__name__}")
    if not items:
        raise OSError("all RSS feeds failed: " + "; ".join(errors))
    items.sort(key=lambda i: i["time"] or "", reverse=True)
    return items[:72]


SOURCES: dict[str, TTLSource] = {
    s.id: s for s in [
        TTLSource("binance_rest", "Binance public REST", "primary", 10.0, _binance_ticker,
                  "real-time price, 24h change and volume for every listed pair"),
        TTLSource("coingecko", "CoinGecko public", "context", 90.0, _cg_markets,
                  "top-250 coins, prices, mcap, 7d sparklines, images — 90s refresh"),
        TTLSource("coingecko_global", "CoinGecko global", "context", 90.0, _cg_global,
                  "global market cap, volume, BTC/ETH dominance — 90s refresh"),
        TTLSource("paprika", "CoinPaprika public", "fallback", 300.0, _paprika_tickers,
                  "fallback tickers: price, mcap, volume, supply, ATH"),
        TTLSource("paprika_global", "CoinPaprika global", "fallback", 300.0, _paprika_global,
                  "fallback global market cap and dominance"),
        TTLSource("fng", "Alternative.me F&G", "context", 1800.0, _fng,
                  "Fear & Greed index, 30-day history"),
        TTLSource("llama_tvl", "DefiLlama TVL", "context", 900.0, _llama_tvl,
                  "total DeFi TVL history"),
        TTLSource("llama_stables", "DefiLlama stablecoins", "context", 900.0, _llama_stables,
                  "stablecoin supply and USDT/USDC share"),
        TTLSource("llama_dex", "DefiLlama DEX volume", "context", 600.0, _llama_dex,
                  "aggregate DEX trading volume, daily bars"),
        TTLSource("cg_stocks", "Tokenized stocks (CoinGecko)", "context", 300.0, _cg_stocks,
                  "on-chain tokenized equities — Tesla, NVIDIA, SpaceX… track the real stock"),
        TTLSource("news", "GDELT news", "news", 600.0, _gdelt_news,
                  "open crypto news headlines (GDELT doc 2.0)"),
        TTLSource("rss", "Market news RSS ×10", "news", 240.0, _rss_news,
                  "CoinDesk, Cointelegraph, The Block, Decrypt, BeInCrypto, NewsBTC, AMBCrypto, U.Today…"),
        TTLSource("trending", "CoinGecko trending", "context", 600.0, _cg_trending,
                  "trending searches on CoinGecko"),
        TTLSource("fx", "FX rates (open.er-api.com)", "context", 21600.0, _fx_rates,
                  "USD→INR/EUR/GBP/JPY display conversion"),
    ]
}




def warm_sources() -> None:
    """Background warm-up so the first Market page load is instant."""
    def run() -> None:
        for sid in ("coingecko_global", "fng", "coingecko", "llama_stables", "llama_tvl",
                    "llama_dex", "cg_stocks", "fx", "rss", "trending", "news"):
            try:
                SOURCES[sid].get()
            except Exception:  # noqa: BLE001
                pass
    threading.Thread(target=run, name="cg-source-warmup", daemon=True).start()


def statuses() -> list:
    return [s.status() for s in SOURCES.values()]


# ---- normalized composers ------------------------------------------------------

def _downsample(vals: list, n: int) -> list:
    if len(vals) <= n:
        return list(vals)
    step = len(vals) / float(n)
    out = [vals[int(i * step)] for i in range(n - 1)]
    out.append(vals[-1])
    return out


def global_overview() -> JsonDict:
    """Global market context. CoinGecko first, CoinPaprika fallback. Honest
    status when neither is reachable."""
    g = SOURCES["coingecko_global"].get_nowait()
    if g:
        dom = g.get("market_cap_percentage") or {}
        return {
            "status": SOURCES["coingecko_global"].status()["status"],
            "source": "coingecko",
            "mcap_usd": (g.get("total_market_cap") or {}).get("usd"),
            "volume_usd": (g.get("total_volume") or {}).get("usd"),
            "btc_dominance": dom.get("btc"),
            "eth_dominance": dom.get("eth"),
            "dominance": {k.upper(): v for k, v in sorted(dom.items(), key=lambda kv: -kv[1])[:8]},
            "mcap_change_24h_pct": g.get("market_cap_change_percentage_24h_usd"),
            "active_cryptocurrencies": g.get("active_cryptocurrencies"),
        }
    p = SOURCES["paprika_global"].get_nowait()
    if p:
        return {
            "status": SOURCES["paprika_global"].status()["status"],
            "source": "coinpaprika",
            "mcap_usd": p.get("market_cap_usd"),
            "volume_usd": p.get("volume_24h_usd"),
            "btc_dominance": p.get("bitcoin_dominance_percentage"),
            "eth_dominance": None,
            "mcap_change_24h_pct": p.get("market_cap_change_24h"),
            "active_cryptocurrencies": p.get("cryptocurrencies_number"),
        }
    return {"status": "unavailable", "source": None,
            "error": SOURCES["coingecko_global"].last_error or SOURCES["paprika_global"].last_error}


def fear_greed() -> JsonDict:
    rows = SOURCES["fng"].get_nowait()
    if not rows:
        return {"status": "unavailable", "error": SOURCES["fng"].last_error}
    try:
        history = [{"value": int(r["value"]), "ts": int(r["timestamp"])} for r in rows]
    except (KeyError, TypeError, ValueError):
        return {"status": "unavailable", "error": "unexpected F&G payload"}
    return {
        "status": SOURCES["fng"].status()["status"],
        "source": "alternative.me",
        "value": history[0]["value"],
        "label": rows[0].get("value_classification"),
        "history": list(reversed(history)),
    }


def defi_overview() -> JsonDict:
    tvl = SOURCES["llama_tvl"].get_nowait()
    out: JsonDict = {"status": "unavailable"}
    if tvl:
        recent = tvl[-120:]
        out = {
            "status": SOURCES["llama_tvl"].status()["status"],
            "source": "defillama",
            "tvl_usd": recent[-1].get("tvl"),
            "chart": _downsample([r.get("tvl") for r in recent], 40),
        }
    else:
        out["error"] = SOURCES["llama_tvl"].last_error
    return out


def stablecoin_overview() -> JsonDict:
    data = SOURCES["llama_stables"].get_nowait()
    if not data or "peggedAssets" not in data:
        return {"status": "unavailable", "error": SOURCES["llama_stables"].last_error}
    total = 0.0
    top: list = []
    for asset in data["peggedAssets"]:
        circ = ((asset.get("circulating") or {}).get("peggedUSD")) or 0.0
        if asset.get("pegType") != "peggedUSD" or circ <= 0:
            continue
        total += circ
        top.append({"symbol": asset.get("symbol"), "name": asset.get("name"), "circulating_usd": circ})
    top.sort(key=lambda a: -a["circulating_usd"])
    by = {a["symbol"]: a["circulating_usd"] for a in top}
    return {
        "status": SOURCES["llama_stables"].status()["status"],
        "source": "defillama",
        "total_usd": total,
        "usdt_share_pct": (by.get("USDT", 0) / total * 100) if total else None,
        "usdc_share_pct": (by.get("USDC", 0) / total * 100) if total else None,
        "top": top[:6],
    }


def dex_overview() -> JsonDict:
    """Aggregate DEX trading volume (DefiLlama) — total 24h + real daily bars."""
    d = SOURCES["llama_dex"].get_nowait()
    if not d or d.get("total24h") is None:
        return {"status": "unavailable", "error": SOURCES["llama_dex"].last_error}
    bars = [[int(ts), float(v)] for ts, v in (d.get("chart") or []) if isinstance(v, (int, float))]
    return {
        "status": SOURCES["llama_dex"].status()["status"],
        "source": "defillama",
        "total24h_usd": d.get("total24h"),
        "change_1d_pct": d.get("change_1d"),
        "bars": bars[-32:],
    }


# Tokenized-equity wrappers: same company listed via several issuers. Strip the
# wrapper suffix to recover the real ticker and dedupe to one row per company.
_STOCK_NAME_JUNK = (" xstock", " (ondo tokenized stock)", " (bstocks tokenized stock)",
                    " tokenized stock", " (backed)", " (swarm)")


def _stock_clean(symbol: str, name: str) -> tuple[str, str]:
    sym = symbol.upper()
    low = " " + (name or "").lower()
    if "ondo" in low and sym.endswith("ON") and len(sym) > 3:
        sym = sym[:-2]
    elif "bstock" in low and sym.endswith("B") and len(sym) > 2:
        sym = sym[:-1]
    elif "xstock" in low and sym.endswith("X") and len(sym) > 2:
        sym = sym[:-1]
    clean = name or sym
    lowname = clean.lower()
    for junk in _STOCK_NAME_JUNK:
        idx = lowname.find(junk)
        if idx > 0:
            clean = clean[:idx]
            lowname = clean.lower()
    return sym, clean.strip(" -·")


def stocks_overview(limit: int = 16) -> JsonDict:
    """Tokenized equities from CoinGecko's tokenized-stock category, deduped to
    one entry per underlying company (mcap-ordered, first wrapper wins)."""
    raw = SOURCES["cg_stocks"].get_nowait()
    if not raw:
        return {"status": "unavailable", "items": [], "error": SOURCES["cg_stocks"].last_error}
    items = []
    seen: set = set()
    for c in raw:
        ticker, clean = _stock_clean(str(c.get("symbol") or ""), c.get("name") or "")
        # dedupe by recovered ticker: CRCLX and CRCLON are both CRCL (Circle)
        if not ticker or ticker in seen or c.get("current_price") is None:
            continue
        seen.add(ticker)
        spark = ((c.get("sparkline_in_7d") or {}).get("price")) or []
        items.append({
            "id": c.get("id"),
            "base": ticker,
            "wrapper_symbol": str(c.get("symbol") or "").upper(),
            "name": clean,
            "wrapper": c.get("name"),
            "image": c.get("image"),
            "price": c.get("current_price"),
            "chg24h": c.get("price_change_percentage_24h_in_currency"),
            "chg7d": c.get("price_change_percentage_7d_in_currency"),
            "spark": _downsample(spark, 42),
            "mcap": c.get("market_cap"),
            "volume": c.get("total_volume"),
        })
        if len(items) >= limit:
            break
    return {"status": SOURCES["cg_stocks"].status()["status"],
            "source": "coingecko · on-chain tokenized equities", "items": items}


def stock_by_base(base: str) -> Optional[JsonDict]:
    base = base.upper()
    for it in stocks_overview(limit=50).get("items", []):
        if it["base"] == base or it["wrapper_symbol"] == base:
            return it
    return None


def top_coins(limit: int = 250) -> JsonDict:
    """Normalized top-coin list. CoinGecko primary (images + sparklines),
    CoinPaprika fallback (no images/sparklines — resolver falls back)."""
    cg = SOURCES["coingecko"].get_nowait()
    if cg:
        coins = []
        for c in cg[:limit]:
            spark = ((c.get("sparkline_in_7d") or {}).get("price")) or []
            coins.append({
                "id": c.get("id"),
                "base": str(c.get("symbol") or "").upper(),
                "name": c.get("name"),
                "image": c.get("image"),
                "rank": c.get("market_cap_rank"),
                "price": c.get("current_price"),
                "mcap": c.get("market_cap"),
                "volume": c.get("total_volume"),
                "chg1h": c.get("price_change_percentage_1h_in_currency"),
                "chg24h": c.get("price_change_percentage_24h_in_currency"),
                "chg7d": c.get("price_change_percentage_7d_in_currency"),
                "chg30d": c.get("price_change_percentage_30d_in_currency"),
                "spark": _downsample(spark, 42),
                "ath": c.get("ath"),
                "ath_change_pct": c.get("ath_change_percentage"),
                "atl": c.get("atl"),
                "supply": c.get("circulating_supply"),
                "total_supply": c.get("total_supply"),
                "high_24h": c.get("high_24h"),
                "low_24h": c.get("low_24h"),
            })
        return {"status": SOURCES["coingecko"].status()["status"], "source": "coingecko", "coins": coins}
    pk = SOURCES["paprika"].get_nowait()
    if pk:
        coins = []
        for c in pk[:limit]:
            q = ((c.get("quotes") or {}).get("USD")) or {}
            coins.append({
                "id": c.get("id"), "base": str(c.get("symbol") or "").upper(), "name": c.get("name"),
                "image": None, "rank": c.get("rank"), "price": q.get("price"),
                "mcap": q.get("market_cap"), "volume": q.get("volume_24h"),
                "chg1h": q.get("percent_change_1h"), "chg24h": q.get("percent_change_24h"),
                "chg7d": q.get("percent_change_7d"), "chg30d": q.get("percent_change_30d"),
                "spark": [], "ath": q.get("ath_price"), "ath_change_pct": q.get("percent_from_price_ath"),
                "atl": None, "supply": c.get("circulating_supply"), "total_supply": c.get("total_supply"),
                "high_24h": None, "low_24h": None,
            })
        return {"status": SOURCES["paprika"].status()["status"], "source": "coinpaprika", "coins": coins}
    return {"status": "unavailable", "coins": [],
            "error": SOURCES["coingecko"].last_error or SOURCES["paprika"].last_error}


def coin_by_base(base: str) -> Optional[JsonDict]:
    base = base.upper()
    for coin in top_coins().get("coins", []):
        if coin["base"] == base:
            return coin
    # fallback: trending coins outside the top-100 still get an id (enables the
    # real market_chart history) plus name/image/rank — never a dead-end page
    for item in SOURCES["trending"].get_nowait() or []:
        if item.get("base") == base and item.get("id"):
            return {
                "id": item["id"], "base": base, "name": item.get("name") or base,
                "image": item.get("image"), "rank": item.get("rank"),
                "price": None, "mcap": None, "volume": None,
                "chg1h": None, "chg24h": None, "chg7d": None, "chg30d": None,
                "spark": [], "ath": None, "ath_change_pct": None, "atl": None,
                "supply": None, "total_supply": None, "high_24h": None, "low_24h": None,
            }
    # tokenized equities: clicking a stock opens a full asset page with the same
    # real market_chart history (the wrapper token has its own CoinGecko id)
    st = stock_by_base(base)
    if st and st.get("id"):
        return {
            "id": st["id"], "base": st["base"], "name": st["name"],
            "image": st.get("image"), "rank": None, "kind": "stock",
            "price": st.get("price"), "mcap": st.get("mcap"), "volume": st.get("volume"),
            "chg1h": None, "chg24h": st.get("chg24h"), "chg7d": st.get("chg7d"), "chg30d": None,
            "spark": st.get("spark") or [], "ath": None, "ath_change_pct": None, "atl": None,
            "supply": None, "total_supply": None, "high_24h": None, "low_24h": None,
        }
    return None


def news_context(limit: int = 28) -> JsonDict:
    """Headlines merged from every live news source (RSS + GDELT), newest
    first, deduped by title. Non-blocking: no request ever waits on a feed."""
    items: list = []
    sources_used: list = []
    rss = SOURCES["rss"].get_nowait()
    if rss:
        items.extend(rss)
        sources_used.append("rss")
    gd = SOURCES["news"].get_nowait()
    if gd:
        for a in (gd.get("articles") or []):
            seen = str(a.get("seendate") or "")
            iso = (f"{seen[0:4]}-{seen[4:6]}-{seen[6:8]}T{seen[9:11]}:{seen[11:13]}:{seen[13:15]}Z"
                   if len(seen) >= 15 else None)
            title = (a.get("title") or "").strip()[:200]
            if title and a.get("url"):
                items.append({"title": title, "url": a.get("url"), "domain": a.get("domain"), "time": iso})
        sources_used.append("gdelt")
    if not items:
        return {
            "status": "unavailable",
            "error": SOURCES["rss"].last_error or SOURCES["news"].last_error,
            "options": ["RSS ×10: CoinDesk, Cointelegraph, The Block, Decrypt, BeInCrypto, "
                        "NewsBTC, AMBCrypto, U.Today… (keyless, retrying)",
                        "GDELT (keyless, retrying)"],
            "items": [],
        }
    seen_titles: set = set()
    unique = []
    for it in sorted(items, key=lambda i: i["time"] or "", reverse=True):
        key = it["title"].lower()[:80]
        if key in seen_titles:
            continue
        seen_titles.add(key)
        unique.append(it)
    return {"status": "live", "source": "+".join(sources_used), "items": unique[:limit]}


def trending() -> JsonDict:
    rows = SOURCES["trending"].get_nowait()
    if not rows:
        return {"status": "unavailable", "coins": [], "error": SOURCES["trending"].last_error}
    return {"status": SOURCES["trending"].status()["status"], "source": "coingecko", "coins": rows}


def global_history() -> JsonDict:
    """REAL 7-day history for the market cards, aggregated from per-coin data
    we already cache: total mcap(t) = Σ price_i(t)·supply_i over the top-250,
    and BTC/ETH dominance(t) from the same series. No fabricated lines."""
    tc = top_coins()
    coins = [c for c in tc.get("coins", [])
             if c.get("supply") and len(c.get("spark") or []) == 42
             and all(isinstance(v, (int, float)) for v in c["spark"])]
    if len(coins) < 20:
        return {"status": "unavailable", "error": "not enough per-coin history"}
    n = 42
    total = [0.0] * n
    btc = [0.0] * n
    eth = [0.0] * n
    for c in coins:
        supply = float(c["supply"])
        for i, px in enumerate(c["spark"]):
            v = px * supply
            total[i] += v
            if c["base"] == "BTC":
                btc[i] = v
            elif c["base"] == "ETH":
                eth[i] = v
    return {
        "status": tc.get("status", "live"),
        "source": tc.get("source", "coingecko"),
        "note": f"aggregate of {len(coins)} top coins · 7d hourly",
        "mcap": [round(v) for v in total],
        "btc_dom": [round(btc[i] / total[i] * 100, 3) if total[i] else None for i in range(n)],
        "eth_dom": [round(eth[i] / total[i] * 100, 3) if total[i] else None for i in range(n)],
    }


# ---- icon resolution for bases outside the top-250 ---------------------------
# CoinGecko /search returns ranked matches WITH image URLs. One bounded call
# per unknown base, cached 24h, resolved in a background thread.

_ICON_TTL = 7 * 86400.0        # successful lookups: 7 days
_ICON_RETRY = 180.0            # failed lookups (rate limits etc.): retry in 3 min
_icon_cache: dict = {}          # BASE -> (monotonic_ts, url or None)
_icon_lock = threading.Lock()
_icon_pending: set = set()

# Resolved icons persist on disk so server restarts never re-burn the provider
# rate budget — coverage accumulates instead of resetting.
import os as _os
_ICON_DISK = _os.environ.get("BSLAB_ICON_CACHE", "data/icon_cache.json")


def _icon_disk_load() -> None:
    try:
        with open(_ICON_DISK, encoding="utf-8") as fh:
            stored = json.load(fh)
        now = time.monotonic()
        for base, url in stored.items():
            if url:
                _icon_cache[base.upper()] = (now, url)
    except (OSError, ValueError):
        pass


def _icon_disk_save() -> None:
    try:
        _os.makedirs(_os.path.dirname(_ICON_DISK) or ".", exist_ok=True)
        with _icon_lock:
            data = {b: url for b, (_, url) in _icon_cache.items() if url}
        with open(_ICON_DISK, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
    except OSError:
        pass


_icon_disk_load()


# Ambiguous/short tickers search better by project name (still exact-symbol
# matched afterwards, so a wrong project can never slip in).
ICON_QUERY_ALIASES = {
    "ROSE": "oasis network", "SNX": "synthetix", "ZIL": "zilliqa",
    "AI": "sleepless ai", "WOO": "woo network", "QTUM": "qtum",
    "IMX": "immutable", "PORTAL": "portal gaming", "GMT": "stepn",
    "MEME": "memecoin", "ORDI": "ordinals", "NFP": "nfprompt",
    "PIXEL": "pixels", "1000SATS": "sats ordinals", "KSM": "kusama",
    "MINA": "mina protocol",
}


def _search_icon(base: str) -> Optional[str]:
    query = ICON_QUERY_ALIASES.get(base.upper(), base)
    data = fetch_json(f"{CG}/search?query={urllib.parse.quote(query)}", timeout=8.0)
    want = base.upper()
    alt = want.replace("1000", "")   # 1000SATS-style Binance multipliers
    for coin in (data.get("coins") or [])[:10]:
        sym = str(coin.get("symbol") or "").upper()
        if sym == want or sym == alt:
            return coin.get("large") or coin.get("thumb")
    return None


def extra_icons(bases: list) -> dict:
    """Resolved image URLs for the requested bases; unknown ones are queued for
    background resolution (rate-friendly: one lookup per 400 ms)."""
    now = time.monotonic()
    out = {}
    to_resolve = []
    with _icon_lock:
        for base in bases:
            b = base.upper()
            hit = _icon_cache.get(b)
            ttl = _ICON_TTL if (hit and hit[1]) else _ICON_RETRY
            if hit and (now - hit[0]) < ttl:
                if hit[1]:
                    out[b] = hit[1]
            elif b not in _icon_pending:
                _icon_pending.add(b)
                to_resolve.append(b)
    if to_resolve:
        def run() -> None:
            for b in to_resolve:
                try:
                    url = _search_icon(b)
                except Exception:  # noqa: BLE001
                    url = None
                with _icon_lock:
                    _icon_cache[b] = (time.monotonic(), url)
                    _icon_pending.discard(b)
                time.sleep(1.2)  # stay well under CoinGecko keyless rate limits
            _icon_disk_save()
        threading.Thread(target=run, name="cg-icon-resolve", daemon=True).start()
    return out


# ---- per-coin history (real price/volume/mcap series for ANY coin) -----------

_CHART_TTL = 300.0
_CHART_MAX = 90
_chart_cache: dict = {}          # key -> (monotonic_ts, data)
_chart_lock = threading.Lock()

VALID_DAYS = {"1", "7", "30", "90", "365", "max"}


def coin_chart(coin_id: str, days: str = "1") -> Optional[JsonDict]:
    """CoinGecko market_chart for one coin: dense real [ts, value] series for
    price, volume and market cap. TTL-cached per (coin, window), bounded LRU."""
    days = days if days in VALID_DAYS else "1"
    key = f"{coin_id}:{days}"
    now = time.monotonic()
    hit = _chart_cache.get(key)
    if hit and now - hit[0] < _CHART_TTL:
        return hit[1]
    with _chart_lock:
        hit = _chart_cache.get(key)
        if hit and time.monotonic() - hit[0] < _CHART_TTL:
            return hit[1]
        try:
            data = fetch_json(f"{CG}/coins/{urllib.parse.quote(coin_id)}/market_chart"
                              f"?vs_currency=usd&days={days}", timeout=10.0)
        except Exception:  # noqa: BLE001 - stale-if-error
            return hit[1] if hit else None
        out = {
            "prices": _downsample(data.get("prices") or [], 420),
            "volumes": _downsample(data.get("total_volumes") or [], 420),
            "mcaps": _downsample(data.get("market_caps") or [], 420),
        }
        if len(_chart_cache) >= _CHART_MAX:  # drop the oldest entry
            oldest = min(_chart_cache, key=lambda k: _chart_cache[k][0])
            _chart_cache.pop(oldest, None)
        _chart_cache[key] = (time.monotonic(), out)
        return out


FX_DISPLAY = ("INR", "EUR", "GBP", "JPY")


def fx_state() -> JsonDict:
    data = SOURCES["fx"].get()
    if not data:
        return {"status": "unavailable", "base": "USD", "rates": {}, "error": SOURCES["fx"].last_error}
    rates = data.get("rates") or {}
    return {
        "status": SOURCES["fx"].status()["status"],
        "source": "open.er-api.com",
        "base": "USD",
        "rates": {k: rates.get(k) for k in FX_DISPLAY if rates.get(k)},
        "updated": data.get("time_last_update_utc"),
    }
