"""External public-data source layer.

Server-side, TTL-cached, timeout-bounded adapters for market context:
Binance REST (real-time ticks), CoinGecko (coins + tokenized equities),
CoinPaprika, Alternative.me (Fear & Greed), DefiLlama (TVL + stablecoins +
DEX volume), news RSS feeds + GDELT, Tree's keyless delayed history endpoint,
Lookonchain, open.er-api.com (FX). Key-required providers are represented
honestly in source health, but inactive until server-side credentials exist.

Rules enforced here:
* never on the hot path — only the slow /api/market-overview family reads this;
* stale-if-error — a source failure serves the last good payload and reports
  ``stale``/``error`` status instead of breaking the app;
* bounded — every fetch has a timeout and a response-size cap;
* honest — no data is ever synthesized; missing sources report their state.
"""
from __future__ import annotations

import html
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from datetime import datetime, timezone
from typing import Any, Callable, Optional

JsonDict = dict[str, Any]

USER_AGENT = "CGSignalLab/1.0 (public research dashboard)"
# Yahoo Finance rejects non-browser agents outright; it gets a browser UA.
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
MAX_BYTES = 3_500_000          # response size cap
ERROR_RETRY_SEC = 60.0         # back off after a failure instead of hammering


class _Redirect308(urllib.request.HTTPRedirectHandler):
    """urllib doesn't follow 308 Permanent Redirect by default (CoinDesk RSS)."""
    def http_error_308(self, req, fp, code, msg, headers):  # noqa: N802
        return self.http_error_301(req, fp, 301, msg, headers)


_OPENER = urllib.request.build_opener(_Redirect308())


def fetch_bytes(url: str, timeout: float = 6.0, accept: str = "application/json",
                ua: str = USER_AGENT) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": accept})
    with _OPENER.open(req, timeout=timeout) as resp:
        return resp.read(MAX_BYTES)


def fetch_json(url: str, timeout: float = 6.0, ua: str = USER_AGENT) -> Any:
    return json.loads(fetch_bytes(url, timeout, ua=ua).decode("utf-8", "replace"))


def post_json(url: str, form: dict[str, Any], timeout: float = 6.0) -> Any:
    body = urllib.parse.urlencode(form).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        method="POST",
    )
    with _OPENER.open(req, timeout=timeout) as resp:
        text = resp.read(MAX_BYTES).decode("utf-8", "replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Lookonchain occasionally emits JavaScript-style \' inside JSON
        # strings. That is not valid JSON, but the rest of the payload is
        # well-formed; normalize this one escape instead of dropping the feed.
        return json.loads(text.replace("\\'", "'"))


class TTLSource:
    """One cached external source: fetch on demand, serve stale on error."""

    def __init__(self, sid: str, label: str, kind: str, ttl: float,
                 fetcher: Optional[Callable[[], Any]], detail: str = "",
                 status_override: str = "", retry_sec: float = ERROR_RETRY_SEC) -> None:
        self.id = sid
        self.label = label
        self.kind = kind
        self.ttl = ttl
        self.fetcher = fetcher
        self.detail = detail
        self.status_override = status_override
        self.retry_sec = retry_sec
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
                self._next_try = time.monotonic() + self.retry_sec
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
BINANCE_SPOT = "https://api.binance.com"


def _cg_global() -> JsonDict:
    return fetch_json(f"{CG}/global")["data"]


def _cg_markets() -> list:
    # top-250: wide icon/price coverage in ONE call (~1 MB, cached server-side)
    url = (f"{CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250"
           "&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d,200d,1y")
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
    q = urllib.parse.quote(
        '("Federal Reserve" OR "interest rates" OR inflation OR CPI OR jobs '
        'OR treasury OR yields OR dollar OR stocks OR Nasdaq OR "S&P 500" '
        'OR earnings OR oil OR gold OR copper OR forex OR ETF OR bitcoin '
        'OR ethereum OR cryptocurrency) sourcelang:english'
    )
    url = (f"http://api.gdeltproject.org/api/v2/doc/doc?query={q}"
           "&mode=artlist&format=json&maxrecords=40&sort=datedesc")
    return fetch_json(url, timeout=8.0)


X_NEWS_HANDLES = {
    "faststocknewss": "equity",
    "Benzinga": "equity",
    "StockMKTNewz": "equity",
    "WSJmarkets": "macro",
    "financialjuice": "macro",
    "zerohedge": "macro",
    "DeItaone": "squawk",
    "WatcherGuru": "crypto",
    "lookonchain": "onchain",
}


def _x_bearer() -> str:
    return (os.getenv("X_BEARER_TOKEN") or os.getenv("TWITTER_BEARER_TOKEN") or "").strip()


def _fetch_x_json(url: str, bearer: str, timeout: float = 8.0) -> JsonDict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Authorization": f"Bearer {bearer}",
        },
    )
    with _OPENER.open(req, timeout=timeout) as resp:
        text = resp.read(MAX_BYTES).decode("utf-8", "replace")
    return json.loads(text)


def _x_news() -> list:
    """Official X API recent-search adapter for the requested X-only wires.

    It is intentionally dormant unless a server-side bearer token is configured.
    No key is ever sent to the browser; the UI reports ``requires_key`` until
    the backend has credentials.
    """
    bearer = _x_bearer()
    if not bearer:
        raise PermissionError("set X_BEARER_TOKEN or TWITTER_BEARER_TOKEN server-side")
    query = "(" + " OR ".join(f"from:{h}" for h in X_NEWS_HANDLES) + ") -is:reply -is:retweet"
    params = urllib.parse.urlencode({
        "query": query,
        "max_results": "60",
        "tweet.fields": "created_at,entities",
        "expansions": "author_id",
        "user.fields": "username,name",
    })
    data = _fetch_x_json(f"https://api.x.com/2/tweets/search/recent?{params}", bearer, timeout=8.0)
    users = {
        str(u.get("id")): str(u.get("username") or "").strip()
        for u in (data.get("includes") or {}).get("users", [])
    }
    out = []
    for row in data.get("data") or []:
        author = users.get(str(row.get("author_id"))) or ""
        if not author:
            continue
        text = html.unescape(str(row.get("text") or "")).strip()
        if not text:
            continue
        text = re.sub(r"https?://\S+", "", text).strip(" -–—:·")
        text = re.sub(r"\s+", " ", text)
        lane = X_NEWS_HANDLES.get(author) or X_NEWS_HANDLES.get(author.lower()) or "squawk"
        symbols = []
        for tag in ((row.get("entities") or {}).get("cashtags") or []):
            sym = str(tag.get("tag") or "").upper()
            if sym and sym not in symbols:
                symbols.append(sym)
        tid = str(row.get("id") or "")
        out.append({
            "title": text[:240],
            "url": f"https://x.com/{author}/status/{tid}" if tid else f"https://x.com/{author}",
            "domain": "@" + author,
            "time": str(row.get("created_at") or "").replace("+00:00", "Z"),
            "lane": lane,
            "symbols_hint": symbols[:4],
        })
    if not out:
        raise OSError("X API returned no matching posts")
    return out


def _lookonchain_news() -> list:
    """Lookonchain public feed endpoint used by its /feeds page.

    The site renders the feed through a bounded form POST. We store only the
    headline, source link and creation time, never article bodies/images.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    data = post_json(
        "https://www.lookonchain.com/ashx/index.ashx",
        {"max_time": now, "protype": "", "page": "1", "count": "20"},
        timeout=8.0,
    )
    rows = data.get("content") or []
    out = []
    for row in rows[:20]:
        title = html.unescape(str(row.get("stitle") or "").strip())
        link = str(row.get("surl") or "").strip() or (
            "https://www.lookonchain.com/feeds/" + str(row.get("nnewflash_id") or "").strip()
        )
        raw_ts = str(row.get("dcreate_time") or "").strip()
        iso = None
        if raw_ts:
            try:
                iso = datetime.strptime(raw_ts, "%Y-%m-%d %H:%M:%S").replace(
                    tzinfo=timezone.utc
                ).strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                iso = None
        if title and link:
            out.append({
                "title": title[:220],
                "url": link,
                "domain": "lookonchain.com",
                "time": iso,
                "origin": urllib.parse.urlparse(link).netloc.replace("www.", ""),
            })
    if not out:
        raise OSError("Lookonchain returned no feed rows")
    return out


def _tree_news() -> list:
    """Tree of Alpha keyless history snapshot.

    Tree's docs route true live updates through websocket access; this keyless
    endpoint is delayed history/context only. We keep headline/link/time and
    coin tags, never bodies or media, and the UI labels it as delayed relay.
    """
    rows = fetch_json("https://news.treeofalpha.com/api/news?limit=60", timeout=9.0)
    out = []
    for row in rows:
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        src = str(row.get("source") or "").strip()
        handle = ""
        if src.lower() == "twitter":
            m = re.match(r"^(.{2,80}?)\s*\(@([A-Za-z0-9_]{2,20})\):\s*(.+)$", title, re.S)
            if m:
                handle = m.group(2)
                title = m.group(3)
        title = title.split("\n", 1)[0].strip()           # drop translations
        title = re.sub(r"https?://\S+", "", title).strip(" -–—:·")
        if len(title) < 8:
            continue
        ts = row.get("time")
        iso = None
        if isinstance(ts, (int, float)) and ts > 0:
            iso = datetime.fromtimestamp(ts / 1000.0, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        syms: list = []
        for s in (row.get("suggestions") or []):
            coin = str((s or {}).get("coin") or "").upper()
            if coin and coin not in syms:
                syms.append(coin)
        out.append({
            "title": html.unescape(title)[:220],
            "url": str(row.get("url") or "").strip() or "https://news.treeofalpha.com",
            "domain": ("@" + handle) if handle else (src.lower() or "treeofalpha"),
            "time": iso,
            "lane": "squawk",
            "symbols_hint": syms[:4],
        })
    if not out:
        raise OSError("Tree of Alpha returned no rows")
    return out[:60]


# World markets: (yahoo symbol, display name, group). One spark call covers all.
WORLD_SYMBOLS = [
    ("^GSPC", "S&P 500", "us"), ("^IXIC", "Nasdaq", "us"), ("^DJI", "Dow Jones", "us"),
    ("^RUT", "Russell 2000", "us"), ("^VIX", "VIX", "us"),
    ("^FTSE", "FTSE 100", "europe"), ("^GDAXI", "DAX", "europe"),
    ("^FCHI", "CAC 40", "europe"), ("^STOXX50E", "Euro Stoxx 50", "europe"),
    ("^N225", "Nikkei 225", "asia"), ("^HSI", "Hang Seng", "asia"),
    ("000001.SS", "SSE Composite", "asia"), ("^KS11", "KOSPI", "asia"),
    ("^NSEI", "Nifty 50", "india"), ("^BSESN", "Sensex", "india"),
    ("^NSEBANK", "Nifty Bank", "india"),
    ("AAPL", "Apple", "stocks"), ("MSFT", "Microsoft", "stocks"),
    ("NVDA", "NVIDIA", "stocks"), ("GOOGL", "Alphabet", "stocks"),
    ("AMZN", "Amazon", "stocks"), ("META", "Meta", "stocks"),
    ("TSLA", "Tesla", "stocks"), ("AVGO", "Broadcom", "stocks"),
    ("JPM", "JPMorgan", "stocks"), ("LLY", "Eli Lilly", "stocks"),
    ("GC=F", "Gold", "commodities"), ("SI=F", "Silver", "commodities"),
    ("CL=F", "WTI Crude", "commodities"), ("NG=F", "Natural gas", "commodities"),
    ("HG=F", "Copper", "commodities"),
    ("DX-Y.NYB", "Dollar index", "fx"), ("EURUSD=X", "EUR/USD", "fx"),
    ("USDJPY=X", "USD/JPY", "fx"), ("USDINR=X", "USD/INR", "fx"),
    ("^TNX", "US 10Y yield", "rates"), ("^TYX", "US 30Y yield", "rates"),
]

# Ranked market boards need more than the hero/ticker symbols. Keep this list
# curated and bounded: one cached Yahoo spark request still covers every row,
# and unavailable quotes are labeled as unavailable rather than fabricated.
WORLD_SYMBOLS.extend([
    # US large-cap equity lane
    ("NFLX", "Netflix", "stocks"), ("ORCL", "Oracle", "stocks"),
    ("COST", "Costco", "stocks"), ("WMT", "Walmart", "stocks"),
    ("MA", "Mastercard", "stocks"), ("V", "Visa", "stocks"),
    ("UNH", "UnitedHealth", "stocks"), ("HD", "Home Depot", "stocks"),
    ("PG", "Procter & Gamble", "stocks"), ("JNJ", "Johnson & Johnson", "stocks"),
    ("XOM", "Exxon Mobil", "stocks"), ("BAC", "Bank of America", "stocks"),
    ("KO", "Coca-Cola", "stocks"), ("PEP", "PepsiCo", "stocks"),
    ("ABBV", "AbbVie", "stocks"), ("MRK", "Merck", "stocks"),
    ("CRM", "Salesforce", "stocks"), ("AMD", "AMD", "stocks"),
    ("INTC", "Intel", "stocks"), ("CSCO", "Cisco", "stocks"),
    ("ADBE", "Adobe", "stocks"), ("QCOM", "Qualcomm", "stocks"),
    ("TXN", "Texas Instruments", "stocks"), ("NOW", "ServiceNow", "stocks"),
    ("UBER", "Uber", "stocks"), ("SHOP", "Shopify", "stocks"),
    ("PLTR", "Palantir", "stocks"), ("HOOD", "Robinhood", "stocks"),
    ("MSTR", "MicroStrategy", "stocks"), ("COIN", "Coinbase", "stocks"),
    ("MU", "Micron", "stocks"), ("SMCI", "Super Micro Computer", "stocks"),
    ("PANW", "Palo Alto Networks", "stocks"), ("CRWD", "CrowdStrike", "stocks"),
    ("SNOW", "Snowflake", "stocks"), ("ABNB", "Airbnb", "stocks"),
    # Global ADRs / internationally listed large-cap lane
    ("TSM", "TSMC", "world_stocks"), ("ASML", "ASML", "world_stocks"),
    ("TM", "Toyota", "world_stocks"), ("NVO", "Novo Nordisk", "world_stocks"),
    ("SAP", "SAP", "world_stocks"), ("BABA", "Alibaba", "world_stocks"),
    ("SHEL", "Shell", "world_stocks"), ("AZN", "AstraZeneca", "world_stocks"),
    ("NVS", "Novartis", "world_stocks"), ("HSBC", "HSBC", "world_stocks"),
    ("SONY", "Sony", "world_stocks"), ("PDD", "PDD", "world_stocks"),
    ("MELI", "MercadoLibre", "world_stocks"), ("SE", "Sea Limited", "world_stocks"),
    # ETF lane
    ("SPY", "SPDR S&P 500 ETF Trust", "etfs"), ("QQQ", "Invesco QQQ Trust", "etfs"),
    ("VTI", "Vanguard Total Stock Market ETF", "etfs"), ("VOO", "Vanguard S&P 500 ETF", "etfs"),
    ("IVV", "iShares Core S&P 500 ETF", "etfs"), ("IWM", "iShares Russell 2000 ETF", "etfs"),
    ("DIA", "SPDR Dow Jones Industrial Average ETF", "etfs"), ("IBIT", "iShares Bitcoin Trust", "etfs"),
    ("GLD", "SPDR Gold Shares", "etfs"), ("SLV", "iShares Silver Trust", "etfs"),
    ("TLT", "iShares 20+ Year Treasury Bond ETF", "etfs"), ("HYG", "iShares High Yield Corporate Bond ETF", "etfs"),
    ("LQD", "iShares Investment Grade Corporate Bond ETF", "etfs"), ("EEM", "iShares MSCI Emerging Markets ETF", "etfs"),
    ("XLF", "Financial Select Sector SPDR", "etfs"), ("XLK", "Technology Select Sector SPDR", "etfs"),
    ("SMH", "VanEck Semiconductor ETF", "etfs"), ("SOXX", "iShares Semiconductor ETF", "etfs"),
    # Futures / commodities lane
    ("PL=F", "Platinum", "futures"), ("PA=F", "Palladium", "futures"),
    ("BZ=F", "Brent crude oil", "futures"), ("RB=F", "RBOB gasoline", "futures"),
    ("ZC=F", "Corn", "futures"), ("ZS=F", "Soybean", "futures"),
    ("ZW=F", "Wheat", "futures"), ("KC=F", "Coffee", "futures"),
    ("SB=F", "Sugar No. 11", "futures"), ("CT=F", "Cotton No. 2", "futures"),
    ("ES=F", "E-mini S&P 500", "futures"), ("NQ=F", "E-mini Nasdaq 100", "futures"),
    ("YM=F", "E-mini Dow", "futures"), ("RTY=F", "E-mini Russell 2000", "futures"),
    # Forex lane
    ("GBPUSD=X", "GBP/USD", "fx"), ("AUDUSD=X", "AUD/USD", "fx"),
    ("USDCAD=X", "USD/CAD", "fx"), ("USDCHF=X", "USD/CHF", "fx"),
    ("NZDUSD=X", "NZD/USD", "fx"), ("EURJPY=X", "EUR/JPY", "fx"),
    ("EURGBP=X", "EUR/GBP", "fx"), ("USDCNY=X", "USD/CNY", "fx"),
    # Bond proxy lane
    ("^IRX", "US 13-week yield", "rates"), ("^FVX", "US 5Y yield", "rates"),
    ("VCSH", "Vanguard Short-Term Corporate Bond ETF", "corp_bonds"),
    ("VCIT", "Vanguard Intermediate-Term Corporate Bond ETF", "corp_bonds"),
    ("BND", "Vanguard Total Bond Market ETF", "corp_bonds"),
    ("AGG", "iShares Core U.S. Aggregate Bond ETF", "corp_bonds"),
    ("SHYG", "iShares 0-5 Year High Yield Corporate Bond ETF", "corp_bonds"),
])


_YAHOO_HOSTS = ("query1.finance.yahoo.com", "query2.finance.yahoo.com")


# Cash-equity bubble universe. Curated and bounded so the app can show a real
# stock bubble surface without turning a 1-second UI refresh into 100 outbound
# network calls. Yahoo labels/names win when present; these names are fallback.
STOCK_BUBBLE_UNIVERSE = [
    ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("NVDA", "NVIDIA"), ("GOOGL", "Alphabet"),
    ("GOOG", "Alphabet Class C"), ("AMZN", "Amazon"), ("META", "Meta Platforms"),
    ("TSLA", "Tesla"), ("AVGO", "Broadcom"), ("ORCL", "Oracle"), ("WMT", "Walmart"),
    ("JPM", "JPMorgan Chase"), ("LLY", "Eli Lilly"), ("V", "Visa"), ("MA", "Mastercard"),
    ("NFLX", "Netflix"), ("XOM", "Exxon Mobil"), ("COST", "Costco"), ("JNJ", "Johnson & Johnson"),
    ("HD", "Home Depot"), ("PG", "Procter & Gamble"), ("BAC", "Bank of America"),
    ("ABBV", "AbbVie"), ("KO", "Coca-Cola"), ("CRM", "Salesforce"), ("AMD", "AMD"),
    ("PLTR", "Palantir"), ("CSCO", "Cisco"), ("CVX", "Chevron"), ("IBM", "IBM"),
    ("GE", "GE Aerospace"), ("WFC", "Wells Fargo"), ("PM", "Philip Morris"),
    ("UNH", "UnitedHealth"), ("ABT", "Abbott"), ("MCD", "McDonald's"), ("INTU", "Intuit"),
    ("DIS", "Disney"), ("MRK", "Merck"), ("RTX", "RTX"), ("CAT", "Caterpillar"),
    ("VZ", "Verizon"), ("T", "AT&T"), ("PEP", "PepsiCo"), ("QCOM", "Qualcomm"),
    ("TXN", "Texas Instruments"), ("AMGN", "Amgen"), ("ADBE", "Adobe"), ("AMAT", "Applied Materials"),
    ("BKNG", "Booking Holdings"), ("HON", "Honeywell"), ("LOW", "Lowe's"), ("SPGI", "S&P Global"),
    ("NOW", "ServiceNow"), ("ISRG", "Intuitive Surgical"), ("GS", "Goldman Sachs"),
    ("PGR", "Progressive"), ("BLK", "BlackRock"), ("ARM", "Arm Holdings"),
    ("PANW", "Palo Alto Networks"), ("CRWD", "CrowdStrike"), ("SHOP", "Shopify"),
    ("UBER", "Uber"), ("COIN", "Coinbase"), ("MSTR", "MicroStrategy"), ("MU", "Micron"),
    ("SMCI", "Super Micro Computer"), ("SNOW", "Snowflake"), ("ABNB", "Airbnb"),
    ("HOOD", "Robinhood"), ("ROKU", "Roku"), ("SOFI", "SoFi"), ("RIVN", "Rivian"),
    ("LCID", "Lucid"), ("NIO", "NIO"), ("BABA", "Alibaba"), ("TSM", "TSMC"),
    ("ASML", "ASML"), ("TM", "Toyota"), ("NVO", "Novo Nordisk"), ("SAP", "SAP"),
    ("SHEL", "Shell"), ("AZN", "AstraZeneca"), ("HSBC", "HSBC"), ("SONY", "Sony"),
    ("PDD", "PDD"), ("MELI", "MercadoLibre"), ("SE", "Sea Limited"), ("SPOT", "Spotify"),
    ("NET", "Cloudflare"), ("DDOG", "Datadog"), ("MDB", "MongoDB"), ("ZS", "Zscaler"),
    ("OKTA", "Okta"), ("TEAM", "Atlassian"), ("PYPL", "PayPal"), ("INTC", "Intel"),
    ("LRCX", "Lam Research"), ("KLAC", "KLA"), ("ADP", "ADP"), ("GILD", "Gilead"),
    ("SBUX", "Starbucks"), ("NKE", "Nike"), ("BA", "Boeing"), ("DE", "Deere"),
    ("UBS", "UBS"), ("RACE", "Ferrari"), ("RIO", "Rio Tinto"), ("BHP", "BHP"),
]

_STOCK_BUBBLE_WINDOWS = {
    "1h": {"range": "1d", "interval": "5m", "ttl": 45.0, "field": "chg1h", "seconds": 3600},
    "24h": {"range": "1d", "interval": "5m", "ttl": 45.0, "field": "chg24h"},
    "7d": {"range": "5d", "interval": "30m", "ttl": 180.0, "field": "chg7d"},
    "30d": {"range": "1mo", "interval": "1d", "ttl": 900.0, "field": "chg30d"},
    "1y": {"range": "1y", "interval": "1d", "ttl": 3600.0, "field": "chg1y"},
}
_STOCK_BUBBLE_CACHE: dict[str, tuple[float, JsonDict]] = {}
_STOCK_BUBBLE_RETRY_AFTER: dict[str, tuple[float, str]] = {}
_STOCK_BUBBLE_LOCK = threading.Lock()
_NASDAQ_STOCK_SCREENER_URL = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&download=true"
_NASDAQ_HEADERS = {
    "User-Agent": BROWSER_UA,
    "Accept": "application/json,text/plain,*/*",
    "Origin": "https://www.nasdaq.com",
    "Referer": "https://www.nasdaq.com/market-activity/stocks/screener",
}


def _stock_logo_url(symbol: str) -> str:
    return f"https://assets.parqet.com/logos/symbol/{urllib.parse.quote(symbol)}?format=png&size=128"


def _stock_tradingview_url(symbol: str, exchange: str | None = None) -> str:
    ex = str(exchange or "").upper()
    prefix = "NASDAQ" if ex in {"NMS", "NGM", "NCM", "NASDAQ"} else "NYSE"
    return f"https://www.tradingview.com/symbols/{prefix}-{urllib.parse.quote(symbol)}/"


def _stock_float(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).replace("$", "").replace("%", "").replace(",", "").strip()
    if not text or text.upper() in {"N/A", "NA", "--", "-"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _nasdaq_stock_bubbles(limit: int = 100) -> JsonDict:
    """Cash-equity 24h bubble rows from Nasdaq's public stock screener.

    Nasdaq exposes current price, net change, percent change, volume and market
    cap in one bounded public call. It does not expose 1h/7d/30d/1y history
    here, so this adapter intentionally fills only ``chg24h``.
    """
    req = urllib.request.Request(_NASDAQ_STOCK_SCREENER_URL, headers=_NASDAQ_HEADERS)
    with _OPENER.open(req, timeout=16.0) as resp:
        data = json.loads(resp.read(MAX_BYTES).decode("utf-8", "replace"))
    rows = ((data.get("data") or {}).get("rows")) or []
    universe = {sym: name for sym, name in STOCK_BUBBLE_UNIVERSE}
    by_symbol: dict[str, JsonDict] = {}
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        symbol = str(raw.get("symbol") or "").upper().strip()
        if symbol not in universe:
            continue
        price = _stock_float(raw.get("lastsale"))
        change = _stock_float(raw.get("pctchange"))
        if price is None or change is None:
            continue
        net = _stock_float(raw.get("netchange"))
        previous = price - net if net is not None else None
        spark = [round(previous, 6), round(price, 6)] if previous and previous > 0 else []
        href_path = str(raw.get("url") or "").strip()
        by_symbol[symbol] = {
            "id": f"nasdaq-{symbol.lower()}",
            "base": symbol,
            "name": str(raw.get("name") or universe.get(symbol) or symbol).replace(" Common Stock", "").strip(),
            "image": _stock_logo_url(symbol),
            "price": round(price, 6),
            "chg24h": round(change, 4),
            "spark": spark,
            "mcap": _stock_float(raw.get("marketCap")),
            "volume": _stock_float(raw.get("volume")),
            "rank": len(by_symbol) + 1,
            "currency": "USD",
            "exchange": "NASDAQ public screener",
            "href": (
                "https://www.nasdaq.com" + href_path
                if href_path.startswith("/")
                else f"https://www.nasdaq.com/market-activity/stocks/{urllib.parse.quote(symbol.lower())}"
            ),
            "external": True,
        }
    ordered = [by_symbol[sym] for sym, _ in STOCK_BUBBLE_UNIVERSE if sym in by_symbol]
    if len(ordered) < 20:
        raise OSError(f"Nasdaq stock screener returned {len(ordered)} curated symbols")
    return {
        "status": "live",
        "source": "nasdaq screener · cash equities",
        "items": ordered[:limit],
        "window": "24h",
        "supported_windows": ["24h"],
        "note": (
            "Nasdaq public screener supplies cash-equity 1D price, percent change, "
            "volume and market cap. Other stock windows are only shown when Yahoo "
            "chart history is available."
        ),
    }


def _stock_prev_for_window(timestamps: list, closes: list, meta: JsonDict, window: str) -> float | None:
    if not closes:
        return None
    if window == "24h":
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        return float(prev) if isinstance(prev, (int, float)) and prev else closes[0]
    if window == "1h" and timestamps:
        last_ts = meta.get("regularMarketTime") or timestamps[-1]
        if isinstance(last_ts, (int, float)):
            target = last_ts - int(_STOCK_BUBBLE_WINDOWS["1h"]["seconds"])
            for ts, close in reversed(list(zip(timestamps, closes))):
                if isinstance(ts, (int, float)) and ts <= target:
                    return close
    return closes[0]


def _stock_item_from_spark(symbol: str, fallback_name: str, response: JsonDict, window: str,
                           ordinal: int) -> JsonDict | None:
    meta = response.get("meta") or {}
    quote = ((response.get("indicators") or {}).get("quote") or [{}])[0]
    raw_timestamps = response.get("timestamp") or []
    raw_closes = quote.get("close") or response.get("close") or []
    raw_volumes = quote.get("volume") or response.get("volume") or []
    pairs: list[tuple[int | float, float, float]] = []
    for idx, close in enumerate(raw_closes):
        if not isinstance(close, (int, float)):
            continue
        ts = raw_timestamps[idx] if idx < len(raw_timestamps) else idx
        vol = raw_volumes[idx] if idx < len(raw_volumes) and isinstance(raw_volumes[idx], (int, float)) else 0
        pairs.append((ts, float(close), float(vol)))
    if not pairs:
        return None
    timestamps = [p[0] for p in pairs]
    closes = [p[1] for p in pairs]
    volumes = [p[2] for p in pairs]
    last = meta.get("regularMarketPrice")
    if not isinstance(last, (int, float)):
        last = closes[-1]
    prev = _stock_prev_for_window(timestamps, closes, meta, window)
    change = ((float(last) - prev) / prev * 100.0) if prev else None
    field = _STOCK_BUBBLE_WINDOWS[window]["field"]
    name = meta.get("shortName") or meta.get("longName") or fallback_name or symbol
    exchange = meta.get("exchangeName")
    volume = meta.get("regularMarketVolume")
    if not isinstance(volume, (int, float)):
        volume = sum(volumes[-26:]) if volumes else None
    return {
        "id": f"yahoo-{symbol.lower()}",
        "base": symbol.upper(),
        "name": str(name),
        "image": _stock_logo_url(symbol.upper()),
        "price": round(float(last), 6),
        field: round(change, 4) if change is not None else None,
        "spark": _downsample(closes, 42),
        "mcap": None,
        "volume": volume,
        "rank": ordinal,
        "currency": meta.get("currency") or "USD",
        "exchange": exchange,
        "href": _stock_tradingview_url(symbol.upper(), exchange),
        "external": True,
    }


def _yahoo_stock_bubbles(window: str) -> JsonDict:
    cfg = _STOCK_BUBBLE_WINDOWS.get(window) or _STOCK_BUBBLE_WINDOWS["24h"]
    symbols = STOCK_BUBBLE_UNIVERSE
    order = {sym: idx + 1 for idx, (sym, _) in enumerate(symbols)}
    items_by_symbol: dict[str, JsonDict] = {}
    errors: list[str] = []

    def fetch_chunk(chunk: list[tuple[str, str]], idx: int) -> dict[str, JsonDict]:
        syms = ",".join(sym for sym, _ in chunk)
        host = _YAHOO_HOSTS[(int(time.time() / 60) + idx) % len(_YAHOO_HOSTS)]
        url = (f"https://{host}/v7/finance/spark?symbols="
               + urllib.parse.quote(syms)
               + f"&range={cfg['range']}&interval={cfg['interval']}")
        data = fetch_json(url, timeout=12.0, ua=BROWSER_UA)
        result = ((data.get("spark") or {}).get("result")) or []
        fallback_names = {sym: name for sym, name in chunk}
        out: dict[str, JsonDict] = {}
        for row in result:
            sym = str(row.get("symbol") or "").upper()
            resp = (row.get("response") or [None])[0]
            if not sym or not isinstance(resp, dict):
                continue
            item = _stock_item_from_spark(
                sym,
                fallback_names.get(sym, sym),
                resp,
                window,
                order.get(sym, len(out) + 1),
            )
            if item:
                out[sym] = item
        return out

    # Yahoo's keyless spark endpoint works reliably for small batches, but it
    # will 429 large parallel calls. Keep the request pattern bounded and
    # cache the result instead of making the UI depend on a bursty fetch.
    chunks = [symbols[i:i + 10] for i in range(0, len(symbols), 10)]
    for i, chunk in enumerate(chunks):
        try:
            items_by_symbol.update(fetch_chunk(chunk, i))
        except Exception as exc:  # noqa: BLE001 - one chunk must not kill the whole feed
            errors.append(f"{type(exc).__name__}: {exc}")
        time.sleep(0.08)
    ordered = [items_by_symbol[sym] for sym, _ in symbols if sym in items_by_symbol]
    if len(ordered) < 20:
        suffix = f"; first error: {errors[0]}" if errors else ""
        raise OSError(f"Yahoo stock bubbles returned {len(ordered)} symbols{suffix}")
    return {
        "status": "live",
        "source": "yahoo finance chart · cash equities",
        "items": ordered,
        "error": "; ".join(errors[:2]),
        "window": window,
        "range": cfg["range"],
        "interval": cfg["interval"],
    }


def stock_bubbles_overview(window: str = "24h", limit: int = 100) -> JsonDict:
    """Real cash-equity bubble rows.

    Yahoo chart/spark is the preferred source because it can support the full
    window selector. If Yahoo is rate-limited, Nasdaq's screener gives a real
    1D cash-equity fallback. Tokenized-equity wrappers are not used here; this
    page is explicitly a stock page, not an on-chain synthetic-stock page.
    """
    window = window if window in _STOCK_BUBBLE_WINDOWS else "24h"
    cfg = _STOCK_BUBBLE_WINDOWS[window]
    now = time.monotonic()
    with _STOCK_BUBBLE_LOCK:
        cached = _STOCK_BUBBLE_CACHE.get(window)
        cached_source = str((cached[1].get("source") if cached else "") or "")
        ttl = max(float(cfg["ttl"]), 300.0) if cached_source.startswith("nasdaq") else float(cfg["ttl"])
        if cached and (now - cached[0]) < ttl:
            data = dict(cached[1])
            data["items"] = list(data.get("items") or [])[:limit]
            data["age_seconds"] = round(now - cached[0], 1)
            return data
        retry = _STOCK_BUBBLE_RETRY_AFTER.get(window)
    skip_yahoo = bool(retry and now < retry[0])
    try:
        if skip_yahoo:
            raise OSError(f"Yahoo chart is backing off after prior failure: {retry[1]}")
        data = _yahoo_stock_bubbles(window)
        with _STOCK_BUBBLE_LOCK:
            _STOCK_BUBBLE_CACHE[window] = (time.monotonic(), data)
            _STOCK_BUBBLE_RETRY_AFTER.pop(window, None)
        data = dict(data)
        data["items"] = list(data.get("items") or [])[:limit]
        data["age_seconds"] = 0
        return data
    except Exception as exc:  # noqa: BLE001 - source failure falls back cleanly
        with _STOCK_BUBBLE_LOCK:
            _STOCK_BUBBLE_RETRY_AFTER[window] = (time.monotonic() + 300.0, f"{type(exc).__name__}: {exc}"[:180])
        with _STOCK_BUBBLE_LOCK:
            cached = _STOCK_BUBBLE_CACHE.get(window)
        if cached:
            data = dict(cached[1])
            data["status"] = "stale"
            data["error"] = f"{type(exc).__name__}: {exc}"
            data["items"] = list(data.get("items") or [])[:limit]
            data["age_seconds"] = round(time.monotonic() - cached[0], 1)
            return data
        try:
            data = _nasdaq_stock_bubbles(limit=limit)
            data["status"] = "live" if window == "24h" else "limited"
            data["source"] = data.get("source") or "nasdaq screener · cash equities"
            data["error"] = f"Yahoo chart unavailable for {window}: {type(exc).__name__}: {exc}"
            with _STOCK_BUBBLE_LOCK:
                _STOCK_BUBBLE_CACHE[window] = (time.monotonic(), data)
            data = dict(data)
            data["items"] = list(data.get("items") or [])[:limit]
            data["age_seconds"] = 0
            return data
        except Exception as fallback_exc:  # noqa: BLE001 - report both failures
            return {
                "status": "unavailable",
                "source": "stock bubbles unavailable",
                "items": [],
                "error": (
                    f"Yahoo chart failed: {type(exc).__name__}: {exc}; "
                    f"Nasdaq screener failed: {type(fallback_exc).__name__}: {fallback_exc}"
                ),
                "fallback": False,
            }


# Last-good world snapshot persists on disk so a fresh process inside a Yahoo
# rate-limit window still opens with real (stale-labeled) quotes instead of an
# empty Global page. Same pattern as the icon cache below.
_WORLD_DISK = os.environ.get("BSLAB_WORLD_CACHE", "data/world_cache.json")


def _save_world_disk(rows: list) -> None:
    try:
        tmp = _WORLD_DISK + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"ts": time.time(), "rows": rows}, fh)
        os.replace(tmp, _WORLD_DISK)
    except OSError:
        pass


def _load_world_disk() -> tuple[float, list]:
    try:
        with open(_WORLD_DISK, encoding="utf-8") as fh:
            blob = json.load(fh)
        rows = blob.get("rows") or []
        ts = float(blob.get("ts") or 0)
        if isinstance(rows, list) and len(rows) >= 5 and ts > 0:
            return ts, rows
    except (OSError, ValueError):
        pass
    return 0.0, []


def _yahoo_world() -> list:
    """Yahoo Finance spark API: bounded chunked requests for every world symbol —
    US/EU/Asia/India indices, commodities, FX, Treasury yields — with real
    intraday closes. Keyless but aggressively per-IP rate limited, so this
    lives behind a long TTL and stale-if-error; never called per-request."""
    symbols = [s for s, _, _ in WORLD_SYMBOLS]
    blocks: dict = {}
    errors: list[str] = []

    def absorb(data: Any) -> None:
        if not isinstance(data, dict):
            return
        for r in ((data.get("spark") or {}).get("result")) or []:
            resp = (r.get("response") or [None])[0]
            if r.get("symbol") and isinstance(resp, dict):
                blocks[r["symbol"]] = resp
        # Older flat shape: {"^GSPC": {timestamp, close, ...}}
        for k, v in data.items():
            if isinstance(v, dict) and ("close" in v or "meta" in v or "timestamp" in v):
                blocks[k] = v

    chunks = [symbols[i:i + 44] for i in range(0, len(symbols), 44)]
    for ci, chunk in enumerate(chunks):
        syms = ",".join(chunk)
        # Yahoo rate-limits per host: alternate hosts per chunk (the old
        # start-index rotation always landed on the same host) and fall back
        # to the sibling host so one banned host cannot kill the whole lane.
        first = _YAHOO_HOSTS[(int(time.time() / 60) + ci) % len(_YAHOO_HOSTS)]
        hosts = [first] + [hst for hst in _YAHOO_HOSTS if hst != first]
        for hi, host in enumerate(hosts):
            url = (f"https://{host}/v7/finance/spark?symbols="
                   + urllib.parse.quote(syms) + "&range=1d&interval=15m")
            try:
                absorb(fetch_json(url, timeout=12.0, ua=BROWSER_UA))
                break
            except Exception as exc:  # noqa: BLE001 - keep other chunks alive
                errors.append(f"{host}: {type(exc).__name__}: {exc}")
                if hi + 1 < len(hosts):
                    time.sleep(0.35)
        if ci + 1 < len(chunks):
            time.sleep(0.05)
    out = []
    for sym, name, group in WORLD_SYMBOLS:
        b = blocks.get(sym)
        if not b:
            continue
        meta = b.get("meta") or {}
        quote = ((b.get("indicators") or {}).get("quote") or [{}])[0]
        closes = [c for c in (quote.get("close") or b.get("close") or [])
                  if isinstance(c, (int, float))]
        last = meta.get("regularMarketPrice")
        if last is None and closes:
            last = closes[-1]
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        if not isinstance(last, (int, float)):
            continue
        scale = 0.1 if group == "rates" else 1.0   # ^TNX quotes yield ×10
        chg = None
        if isinstance(prev, (int, float)) and prev:
            chg = (last - prev) / prev * 100.0
        out.append({
            "symbol": sym, "name": name, "group": group,
            "last": round(last * scale, 4),
            "prev_close": round(prev * scale, 4) if isinstance(prev, (int, float)) else None,
            "chg_pct": round(chg, 3) if chg is not None else None,
            "spark": [round(c * scale, 4) for c in _downsample(closes, 42)],
            "currency": meta.get("currency"),
            "asof": meta.get("regularMarketTime"),
        })
    if len(out) < 5:
        suffix = f"; first error: {errors[0]}" if errors else ""
        raise OSError(f"yahoo spark returned {len(out)} symbols{suffix}")
    _save_world_disk(out)
    return out


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
           "&price_change_percentage=1h,24h,7d,30d,1y")
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
    ("financialjuice.com", "https://www.financialjuice.com/feed.ashx?xy=rss"),
    ("wsj.com", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain"),
    ("benzinga.com", "https://www.benzinga.com/feed"),
    ("watcher.guru", "https://watcher.guru/news/feed"),
    ("zerohedge.com", "https://cms.zerohedge.com/fullrss2.xml"),
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
    ("cryptobriefing.com", "https://cryptobriefing.com/feed/"),
    ("wublockchain", "https://wublock.substack.com/feed"),
]
_RSS_PER_FEED = 12   # one prolific outlet must never drown the rest
_NEWS_PER_DOMAIN = 4
_RSS_FEED_COUNTS: dict[str, int] = {}
_RSS_FEED_ERRORS: dict[str, str] = {}

_DOMAIN_SIGNAL = {
    "financialjuice.com": 5.0,
    "wsj.com": 4.5,
    "benzinga.com": 3.0,
    "zerohedge.com": 4.0,
    "watcher.guru": 4.0,
    "lookonchain.com": 4.0,
    "coindesk.com": 3.0,
    "cointelegraph.com": 3.0,
    "theblock.co": 3.0,
    "decrypt.co": 2.0,
    "beincrypto.com": 2.0,
    "newsbtc.com": 2.0,
    "ambcrypto.com": 2.0,
    "u.today": 2.0,
    "cryptoslate.com": 2.0,
    "bitcoinmagazine.com": 2.0,
    "cryptobriefing.com": 2.0,
    "wublockchain": 3.0,
}

_NEWS_TAGS = {
    "macro": ("fed", "fomc", "powell", "cpi", "inflation", "pce", "jobs",
              "payroll", "treasury", "yield", "rate", "rates", "dollar",
              "dxy", "recession", "tariff", "gdp", "oil", "gold"),
    "equity": ("stock", "stocks", "nasdaq", "s&p", "dow", "earnings",
               "shares", "ipo", "softbank", "openai", "nvidia", "tesla",
               "apple", "microsoft", "amazon", "alphabet", "meta", "mstr",
               "spx", "spx500", "russell", "equity", "equities"),
    "crypto": ("bitcoin", "btc", "ethereum", "eth", "crypto", "token",
               "binance", "coinbase", "solana", "xrp", "bnb", "doge"),
    "onchain": ("whale", "wallet", "transfer", "deposit", "withdraw",
                "bridge", "unlock", "staking", "on-chain", "onchain"),
    "stablecoins": ("stablecoin", "stablecoins", "usdc", "usdt", "tether",
                    "reserve", "mint", "redeem"),
    "defi": ("defi", "dex", "tvl", "aave", "uniswap", "curve", "morpho",
             "lend", "liquidation", "perp"),
    "policy": ("sec", "cftc", "mifid", "mica", "lawsuit", "court",
               "regulator", "regulatory", "license", "sanction"),
    "flow": ("etf", "inflow", "outflow", "volume", "open interest",
             "liquidity", "funding", "basis", "shorts", "longs"),
    "commodities": ("commodity", "commodities", "gold", "silver", "copper",
                    "oil", "brent", "wti", "crude", "natural gas", "gasoline"),
    "fx": ("forex", "currency", "currencies", "yen", "euro", "sterling",
           "swiss franc", "usd", "eur", "jpy", "gbp", "dollar"),
    "rates": ("bond", "bonds", "yield", "yields", "treasury", "curve",
              "10-year", "10y", "2-year", "2y", "fed", "ecb", "boe"),
}

# Lane = which desk a headline belongs to. Squawk is set by the wire itself;
# macro is inferred from the outlet; everything else is the crypto lane.
_MACRO_DOMAINS = {"wsj.com", "benzinga.com", "financialjuice.com", "zerohedge.com"}
_EQUITY_DOMAINS = {"benzinga.com"}
_CRYPTO_DOMAINS = {
    "watcher.guru", "coindesk.com", "cointelegraph.com", "theblock.co",
    "decrypt.co", "beincrypto.com", "newsbtc.com", "ambcrypto.com",
    "u.today", "cryptoslate.com", "bitcoinmagazine.com", "cryptobriefing.com",
    "wublockchain", "lookonchain.com",
}

_NEGATIVE_NEWS_TERMS = (
    "head coach", "premier league", "football club", "soccer", "tennis",
    "nba", "nfl", "mlb", "cricket", "movie", "trailer", "actor",
    "celebrity", "recipe", "travel guide", "episode recap",
)

_STATIC_SYMBOLS = {
    "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "TRX", "LINK",
    "AVAX", "SUI", "HYPE", "USDT", "USDC", "DAI", "FDUSD", "USDE",
    "AAVE", "UNI", "MKR", "CRV", "ENA", "TIA", "OP", "ARB", "TON",
    "PEPE", "WIF", "BONK", "PUMP", "TRON", "NVIDIA", "NVDA", "TSLA",
    "AAPL", "MSFT", "GOOGL", "META", "COIN", "MSTR", "SPY", "QQQ",
}

_NAME_SYMBOLS = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "solana": "SOL",
    "binance coin": "BNB",
    "bnb": "BNB",
    "xrp": "XRP",
    "dogecoin": "DOGE",
    "tether": "USDT",
    "usdc": "USDC",
    "circle": "USDC",
    "tron": "TRX",
}


def _domain_key(domain: Any) -> str:
    return str(domain or "unknown").lower().replace("www.", "")


def _news_time_score(iso: str | None) -> float:
    if not iso:
        return 0.0
    try:
        age = time.time() - datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        ).timestamp()
    except ValueError:
        return 0.0
    if age < 0:
        return 0.0
    if age <= 30 * 60:
        return 3.0
    if age <= 2 * 3600:
        return 2.0
    if age <= 8 * 3600:
        return 1.0
    if age >= 7 * 86400:
        return -2.0
    return 0.0


def _term_hit(lower: str, term: str) -> bool:
    if " " in term or "-" in term:
        return term in lower
    if len(term) <= 4:
        return re.search(rf"\b{re.escape(term)}\b", lower) is not None
    return term in lower


def _news_lane(item: JsonDict, domain: str, tags: list[str], matched: list[str]) -> str:
    explicit = str(item.get("lane") or "").strip()
    if explicit:
        return explicit
    tagset = set(tags)
    if "onchain" in tagset or domain == "lookonchain.com":
        return "onchain"
    if "equity" in tagset or domain in _EQUITY_DOMAINS:
        return "equity"
    if tagset.intersection({"macro", "commodities", "fx", "rates", "policy"}) or domain in _MACRO_DOMAINS:
        return "macro"
    if "crypto" in tagset or "stablecoins" in tagset or "defi" in tagset or matched:
        return "crypto"
    if domain in _CRYPTO_DOMAINS:
        return "crypto"
    return "macro"


def _classify_news(item: JsonDict, dynamic_symbols: set[str]) -> JsonDict | None:
    title = html.unescape(str(item.get("title") or "")).strip()
    if not title:
        return None
    lower = title.lower()
    # squawk handles keep their display casing (@DeItaone), outlets normalize
    domain = (str(item.get("domain")) if item.get("lane") == "squawk" and item.get("domain")
              else _domain_key(item.get("domain")))
    negative = any(term in lower for term in _NEGATIVE_NEWS_TERMS)

    tags: list[str] = []
    for tag, terms in _NEWS_TAGS.items():
        if any(_term_hit(lower, term) for term in terms):
            tags.append(tag)

    symbols = set(_STATIC_SYMBOLS) | dynamic_symbols
    tagset = set(tags)
    explicit_lane = str(item.get("lane") or "").strip()
    crypto_context = bool(tagset.intersection({"crypto", "stablecoins", "defi", "onchain"})) \
        or domain in _CRYPTO_DOMAINS or explicit_lane in {"squawk", "crypto", "onchain"}
    equity_context = bool(tagset.intersection({"equity", "flow"})) or domain in _EQUITY_DOMAINS
    matched = []
    for hint in (item.get("symbols_hint") or []):   # wire-tagged coins first
        if hint and hint not in matched:
            matched.append(hint)
    for prefix, raw in re.findall(r"(?<![A-Z0-9])(\$?)([A-Z][A-Z0-9]{1,9})(?![A-Z0-9])", title):
        if raw not in symbols:
            continue
        # Unprefixed dynamic token symbols are noisy in macro headlines. Keep
        # them only when the source/title is already market-token context.
        if not prefix:
            if len(raw) <= 2 and raw not in {"AI"}:
                continue
            if raw in dynamic_symbols and raw not in _STATIC_SYMBOLS and not crypto_context:
                continue
            if raw in _STATIC_SYMBOLS and raw not in {"SPY", "QQQ", "NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "COIN", "MSTR"} \
                    and not crypto_context:
                continue
            if raw in {"AI"} and not (crypto_context or equity_context):
                continue
        if raw not in matched:
            matched.append(raw)
        if len(matched) >= 4:
            break
    for name, sym in _NAME_SYMBOLS.items():
        if len(matched) >= 4:
            break
        if name == "circle" and not tagset.intersection({"stablecoins", "crypto"}):
            continue
        if name in {"tether", "tron", "bnb"} and not crypto_context:
            continue
        if _term_hit(lower, name) and sym in symbols and sym not in matched:
            matched.append(sym)

    lane = _news_lane(item, domain, tags, matched)
    score = _DOMAIN_SIGNAL.get(domain, 1.0) + _news_time_score(item.get("time"))
    score += min(7.5, len(tags) * 1.25 + len(matched) * 1.05)
    if lane == "squawk":
        score += 2.0     # the wire is fast, but must not drown the outlets
    if lane in {"macro", "equity"}:
        score += 1.0     # front-page market desk must not collapse into crypto-only news
    if lane == "onchain":
        score += 0.5
    if any(w in lower for w in ("breaking", "urgent", "alert", "launches", "secures",
                                "raises", "files", "approves", "hack", "exploit")):
        score += 1.5
    if negative and not tags and not matched:
        score -= 8.0
    if score < 2.0:
        return None

    ranked_tags = tags[:4] or (["market-wire"] if _DOMAIN_SIGNAL.get(domain, 0) >= 3 else ["market"])
    reason_bits = []
    if matched:
        reason_bits.append("symbol match " + ", ".join(matched[:3]))
    if ranked_tags:
        reason_bits.append("tags " + ", ".join(ranked_tags[:3]))
    if domain in _DOMAIN_SIGNAL:
        reason_bits.append("source priority")
    out = dict(item)
    out.pop("symbols_hint", None)
    out["title"] = title[:220]
    out["headline"] = out["title"]
    out["domain"] = domain
    out["source"] = domain
    out["published_at"] = item.get("time")
    out["lane"] = lane
    out["tags"] = ranked_tags
    out["matched_symbols"] = matched[:4]
    out["impact"] = max(1, min(99, int(round(score * 10))))
    out["reason"] = " · ".join(reason_bits[:3]) or "market relevance"
    return out


def _rss_news() -> list:
    """Merge public crypto RSS feeds (headline + link + time, with source
    attribution). Standard syndication use; full articles are never copied."""
    import email.utils
    import xml.etree.ElementTree as ET
    global _RSS_FEED_COUNTS, _RSS_FEED_ERRORS
    items = []
    errors = []
    counts: dict[str, int] = {}
    error_map: dict[str, str] = {}
    for domain, url in RSS_FEEDS:
        try:
            root = ET.fromstring(fetch_bytes(url, timeout=9.0, accept="application/rss+xml, application/xml, text/xml"))
            n_feed = 0
            for it in root.iter("item"):
                if n_feed >= _RSS_PER_FEED:
                    break
                title = (it.findtext("title") or "").strip()
                if title.startswith("FinancialJuice:"):
                    title = title[len("FinancialJuice:"):].strip()
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
            counts[domain] = n_feed
        except Exception as exc:  # noqa: BLE001 - one dead feed must not kill the rest
            msg = f"{type(exc).__name__}"
            counts[domain] = 0
            error_map[domain] = msg
            errors.append(f"{domain}: {msg}")
    _RSS_FEED_COUNTS = counts
    _RSS_FEED_ERRORS = error_map
    if not items:
        raise OSError("all RSS feeds failed: " + "; ".join(errors))
    items.sort(key=lambda i: i["time"] or "", reverse=True)
    # Keep the bundle broad. The final news composer is responsible for
    # balancing domains/lanes; truncating here silently dropped slower-but-valid
    # sources like Benzinga and WatcherGuru before the provider map could use
    # them.
    return items[:_RSS_PER_FEED * len(RSS_FEEDS)]


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
        TTLSource("news", "GDELT market news", "news", 300.0, _gdelt_news,
                  "open macro, equity, rates, commodity and crypto headlines (GDELT DOC 2.0)"),
        TTLSource("rss", "Market news RSS ×17", "news", 240.0, _rss_news,
                  "FinancialJuice, WSJ Markets, Benzinga, Watcher Guru, ZeroHedge, CoinDesk, "
                  "Cointelegraph, The Block, Decrypt, WuBlockchain, BeInCrypto, NewsBTC…"),
        TTLSource("tree_news", "Tree of Alpha history relay", "news", 60.0, _tree_news,
                  "keyless delayed squawk history; websocket/API key required for true live updates"),
        TTLSource("lookonchain", "Lookonchain feed", "news", 300.0, _lookonchain_news,
                  "public Lookonchain headline feed endpoint — headline/link/time only"),
        TTLSource("x_news", "X official API wires", "news", 45.0, _x_news if _x_bearer() else None,
                  "Fast Stock News, Benzinga, StockMKTNewz, WSJ Markets, FinancialJuice, ZeroHedge, DeItaone, WatcherGuru, Lookonchain",
                  status_override="" if _x_bearer() else "requires_key", retry_sec=120.0),
        # Yahoo bans hot IPs for a while; fast retries only extend the ban, so
        # this source backs off 5 minutes on failure and serves stale forever.
        TTLSource("yahoo_world", "Global markets (Yahoo Finance)", "context", 180.0, _yahoo_world,
                  "US/EU/Asia/India indices, top stocks, commodities, FX, yields — one bounded call",
                  retry_sec=300.0),
        TTLSource("trending", "CoinGecko trending", "context", 600.0, _cg_trending,
                  "trending searches on CoinGecko"),
        TTLSource("fx", "FX rates (open.er-api.com)", "context", 21600.0, _fx_rates,
                  "USD→INR/EUR/GBP/JPY display conversion"),
    ]
}




def _seed_world_from_disk() -> None:
    """Boot with the last-good world snapshot (honestly marked stale) so a
    restart during a Yahoo rate-limit window never opens an empty Global page."""
    ts, rows = _load_world_disk()
    if not rows:
        return
    src = SOURCES["yahoo_world"]
    src.data = rows
    src.last_ok_ts = ts
    # Present as expired: status reads "stale" and the next touch refreshes.
    src.fetched_mono = time.monotonic() - src.ttl * 2


_seed_world_from_disk()


def warm_sources() -> None:
    """Background warm-up so the first Market page load is instant."""
    def run() -> None:
        for sid in ("coingecko_global", "fng", "coingecko", "llama_stables", "llama_tvl",
                    "llama_dex", "cg_stocks", "fx", "tree_news", "yahoo_world", "rss",
                    "lookonchain", "x_news", "trending", "news"):
            try:
                SOURCES[sid].get()
            except Exception:  # noqa: BLE001
                pass
    threading.Thread(target=run, name="cg-source-warmup", daemon=True).start()


def statuses() -> list:
    rows = []
    for src in SOURCES.values():
        row = src.status()
        if row["id"] == "tree_news" and row["status"] == "live":
            row = {**row, "status": "delayed"}
        rows.append(row)
    return rows


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
_STOCK_WRAPPER_MARKERS = ("xstock", "tokenized stock", "bstock", "bstocks", "ondo tokenized", "backed")


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


def _looks_stock_wrapper(symbol: str, name: str) -> bool:
    hay = f"{symbol} {name}".lower()
    return any(marker in hay for marker in _STOCK_WRAPPER_MARKERS)


def _stock_item_from_market(c: JsonDict) -> JsonDict | None:
    raw_symbol = str(c.get("symbol") or c.get("base") or "").upper()
    raw_name = c.get("name") or raw_symbol
    if not _looks_stock_wrapper(raw_symbol, raw_name):
        return None
    price = c.get("current_price")
    if price is None:
        price = c.get("price")
    if price is None:
        return None
    ticker, clean = _stock_clean(raw_symbol, raw_name)
    spark = ((c.get("sparkline_in_7d") or {}).get("price")) or c.get("spark") or []
    return {
        "id": c.get("id"),
        "base": ticker,
        "wrapper_symbol": raw_symbol,
        "name": clean,
        "wrapper": raw_name,
        "image": c.get("image"),
        "price": price,
        "rank": c.get("market_cap_rank"),
        "chg1h": c.get("price_change_percentage_1h_in_currency", c.get("chg1h")),
        "chg24h": c.get("price_change_percentage_24h_in_currency", c.get("chg24h")),
        "chg7d": c.get("price_change_percentage_7d_in_currency", c.get("chg7d")),
        "chg30d": c.get("price_change_percentage_30d_in_currency", c.get("chg30d")),
        "chg1y": c.get("price_change_percentage_1y_in_currency", c.get("chg1y")),
        "spark": _downsample(spark, 42),
        "mcap": c.get("market_cap", c.get("mcap")),
        "volume": c.get("total_volume", c.get("volume")),
    }


def stocks_overview(limit: int = 16) -> JsonDict:
    """Tokenized equities from CoinGecko's tokenized-stock category, deduped to
    one entry per underlying company (mcap-ordered, first wrapper wins)."""
    raw = SOURCES["cg_stocks"].get_nowait()
    if not raw:
        fallback = []
        seen: set = set()
        top = top_coins(250)
        for c in top.get("coins") or []:
            item = _stock_item_from_market(c)
            if not item or item["base"] in seen:
                continue
            seen.add(item["base"])
            fallback.append(item)
            if len(fallback) >= limit:
                break
        if fallback:
            return {"status": top.get("status") or "live",
                    "source": (top.get("source") or "market data") + " · tokenized-stock fallback",
                    "items": fallback, "error": SOURCES["cg_stocks"].last_error}
        return {"status": "unavailable", "items": [], "error": SOURCES["cg_stocks"].last_error}
    items = []
    seen: set = set()
    for c in raw:
        item = _stock_item_from_market(c)
        # dedupe by recovered ticker: CRCLX and CRCLON are both CRCL (Circle)
        if not item or item["base"] in seen:
            continue
        seen.add(item["base"])
        items.append(item)
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


def top_coins(limit: int = 250, wait: bool = False) -> JsonDict:
    """Normalized top-coin list. CoinGecko primary (images + sparklines),
    CoinPaprika fallback (no images/sparklines — resolver falls back)."""
    cg = SOURCES["coingecko"].get() if wait else SOURCES["coingecko"].get_nowait()
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
                "max_supply": c.get("max_supply"),
                "fdv": c.get("fully_diluted_valuation"),
                "price_change_24h": c.get("price_change_24h"),
                "mcap_change_24h": c.get("market_cap_change_24h"),
                "high_24h": c.get("high_24h"),
                "low_24h": c.get("low_24h"),
                "chg200d": c.get("price_change_percentage_200d_in_currency"),
                "chg1y": c.get("price_change_percentage_1y_in_currency"),
                "profile_source": "coingecko",
            })
        return {"status": SOURCES["coingecko"].status()["status"], "source": "coingecko", "coins": coins}
    pk = SOURCES["paprika"].get() if wait else SOURCES["paprika"].get_nowait()
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
                "max_supply": c.get("max_supply"), "fdv": None,
                "price_change_24h": None, "mcap_change_24h": None,
                "high_24h": None, "low_24h": None, "chg200d": None, "chg1y": None,
                "profile_source": "coinpaprika",
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


def _headline_key(title: str) -> str:
    key = re.sub(r"https?://\S+", "", html.unescape(title or "").lower())
    key = re.sub(r"^(breaking|urgent|alert|decrypt|financialjuice|zerohedge|watcherguru)[:\s-]+", "", key)
    key = re.sub(r"[^a-z0-9$%]+", " ", key).strip()
    return " ".join(key.split()[:18])


def _too_similar_news(key: str, keys: list[str]) -> bool:
    if not key:
        return True
    for old in keys:
        if key == old or key[:72] == old[:72]:
            return True
        if len(key) > 34 and len(old) > 34 and SequenceMatcher(None, key, old).ratio() >= 0.87:
            return True
    return False


def _balanced_news(items: list[JsonDict], limit: int) -> list[JsonDict]:
    ranked = sorted(items, key=lambda i: (i.get("impact") or 0, i.get("time") or ""), reverse=True)
    domain_counts: dict[str, int] = {}
    lane_counts: dict[str, int] = {}
    chosen: list[JsonDict] = []
    seen_ids: set[int] = set()
    # Keep one prolific outlet from dominating, but preserve four rows in the
    # compact rail so the source still feels present when it is active.
    domain_cap = 4 if limit < 40 else 5
    lane_caps = {
        "squawk": max(6, min(9, limit // 4)),
        "crypto": max(7, min(12, limit // 3)),
        "onchain": max(4, min(7, limit // 5)),
    }
    lane_targets = [
        ("macro", max(8, limit // 4)),
        ("equity", max(5, limit // 8)),
        ("squawk", max(5, min(7, limit // 5))),
        ("crypto", max(7, limit // 5)),
        ("onchain", max(3, limit // 10)),
    ]

    def can_add(it: JsonDict, soft_lane: bool = False) -> bool:
        domain = str(it.get("domain") or "unknown")
        lane = str(it.get("lane") or "crypto")
        if domain_counts.get(domain, 0) >= domain_cap:
            return False
        if not soft_lane and lane in lane_caps and lane_counts.get(lane, 0) >= lane_caps[lane]:
            return False
        return True

    def add(it: JsonDict, soft_lane: bool = False) -> bool:
        ident = id(it)
        if ident in seen_ids or not can_add(it, soft_lane=soft_lane):
            return False
        chosen.append(it)
        seen_ids.add(ident)
        domain = str(it.get("domain") or "unknown")
        lane = str(it.get("lane") or "crypto")
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        lane_counts[lane] = lane_counts.get(lane, 0) + 1
        return True

    for lane, target in lane_targets:
        if len(chosen) >= limit:
            break
        for it in ranked:
            if len(chosen) >= limit or lane_counts.get(lane, 0) >= target:
                break
            if str(it.get("lane") or "crypto") == lane:
                add(it)
    for it in ranked:
        if len(chosen) >= limit:
            break
        add(it)
    for it in ranked:
        if len(chosen) >= limit:
            break
        add(it, soft_lane=True)
    return chosen[:limit]


def lane_counts_for(items: list[JsonDict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for it in items:
        lane = str(it.get("lane") or "crypto")
        out[lane] = out.get(lane, 0) + 1
    return out


# news_context does real per-call work (classification, near-duplicate
# similarity, source balancing) over hundreds of headlines — several seconds of
# CPU. Memoize the built payload briefly so the front page and its 25s poll
# loop never pay that cost per request.
_NEWS_CTX_MEMO: dict[int, tuple[float, JsonDict]] = {}
_NEWS_CTX_TTL = 20.0


def news_context(limit: int = 42) -> JsonDict:
    cached = _NEWS_CTX_MEMO.get(limit)
    if cached and (time.monotonic() - cached[0]) < _NEWS_CTX_TTL:
        return cached[1]
    payload = _news_context_build(limit)
    _NEWS_CTX_MEMO[limit] = (time.monotonic(), payload)
    return payload


def _news_context_build(limit: int = 42) -> JsonDict:
    """Headlines merged from available news adapters, newest first.

    Non-blocking: no request ever waits on a feed. Keyless adapters may be
    delayed; provider rows carry the honest route/status for each source.
    """
    items: list = []
    sources_used: list = []
    tree = SOURCES["tree_news"].get_nowait()
    if tree:
        items.extend(tree)
        sources_used.append("tree")
    rss = SOURCES["rss"].get_nowait()
    if rss:
        items.extend(rss)
        sources_used.append("rss")
    loc = SOURCES["lookonchain"].get_nowait()
    if loc:
        items.extend(loc)
        sources_used.append("lookonchain")
    x_rows = SOURCES["x_news"].get_nowait()
    if x_rows:
        items.extend(x_rows)
        sources_used.append("x")
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
            "error": SOURCES["tree_news"].last_error or SOURCES["rss"].last_error
                     or SOURCES["lookonchain"].last_error or SOURCES["news"].last_error,
            "options": ["Tree of Alpha delayed history relay (keyless, retrying)",
                        "RSS ×17: WSJ, Benzinga, FinancialJuice, CoinDesk, Cointelegraph, "
                        "The Block, Decrypt… (keyless, retrying)",
                        "Lookonchain public feed (keyless, retrying)",
                        "Official X API adapter (server-side bearer token required)",
                        "GDELT (keyless, retrying)"],
            "items": [],
            "coverage": news_coverage(),
            "providers": news_providers({}),
        }
    seen_titles: list[str] = []
    unique = []
    dynamic_symbols = {str(c.get("base") or "").upper() for c in top_coins(180).get("coins", [])}
    for it in sorted(items, key=lambda i: i["time"] or "", reverse=True):
        scored = _classify_news(it, dynamic_symbols)
        if not scored:
            continue
        key = _headline_key(scored["title"])
        if _too_similar_news(key, seen_titles):
            continue
        seen_titles.append(key)
        unique.append(scored)
    if not unique:
        return {
            "status": "filtered",
            "source": "+".join(sources_used),
            "source_counts": {},
            "items": [],
            "coverage": news_coverage(),
            "providers": news_providers({}),
            "note": "sources returned headlines, but none passed market relevance scoring",
        }

    diversified = _balanced_news(unique, limit)

    source_counts: dict[str, int] = {}
    for it in diversified:
        domain = str(it.get("domain") or "unknown")
        source_counts[domain] = source_counts.get(domain, 0) + 1
    payload_status = "delayed" if sources_used == ["tree"] else "live"
    return {
        "status": payload_status,
        "source": "+".join(sources_used),
        "source_counts": source_counts,
        "coverage": news_coverage(),
        "providers": news_providers(source_counts),
        "lane_counts": lane_counts_for(diversified),
        "items": diversified[:limit],
    }


def news_providers(source_counts: dict[str, int]) -> list[JsonDict]:
    """Every requested news provider with a truthful route and state."""
    tree_status = SOURCES["tree_news"].status()
    rss_status = SOURCES["rss"].status()
    look_status = SOURCES["lookonchain"].status()
    x_status = SOURCES["x_news"].status()
    tree_ok = tree_status["status"] in {"live", "stale"}
    tree_provider_status = "delayed" if tree_status["status"] == "live" else tree_status["status"]
    look_live = look_status["status"] in {"live", "stale"}
    x_live = x_status["status"] in {"live", "stale"}

    def handle_seen(handle: str) -> bool:
        want = "@" + handle.lstrip("@").lower()
        return any(str(k).lower() == want for k in source_counts)

    def count_for(key: str) -> int:
        want = key.lower()
        return sum(v for k, v in source_counts.items() if str(k).lower() == want)

    def rss_count_for(domain: str) -> int:
        return int((_RSS_FEED_COUNTS or {}).get(domain.lower(), 0) or 0)

    def rss_error_for(domain: str) -> str:
        return str((_RSS_FEED_ERRORS or {}).get(domain.lower(), "") or "")

    def rss_status_for(domain: str) -> str:
        if rss_count_for(domain) > 0:
            return rss_status["status"]
        if rss_error_for(domain):
            return "error"
        return rss_status["status"] if count_for(domain) else "stale"

    def x_route_for(handle: str) -> str:
        if x_live:
            return x_status["status"]
        if handle_seen(handle):
            return "tree_backed"
        return "requires_key"

    def x_note_for(handle: str, fallback: str = "X-only source; official X API required for first-party posts.") -> str:
        if x_live:
            return "Official X API adapter is active server-side; keys never leave the backend."
        if handle_seen(handle):
            return "Tree relay is currently covering some posts; official X API is required for first-party low-latency posts."
        return fallback

    tree_count = sum(
        v for k, v in source_counts.items()
        if str(k).startswith("@") or str(k).lower() == "treeofalpha"
    )

    def row(pid: str, label: str, kind: str, status: str, route: str, note: str,
            url: str = "", count_key: str = "", count: int | None = None,
            fetched_count: int | None = None, error: str = "") -> JsonDict:
        return {
            "id": pid, "label": label, "kind": kind, "status": status,
            "route": route, "note": note, "url": url,
            "count": count if count is not None else (count_for(count_key) if count_key else 0),
            "fetched_count": fetched_count,
            "error": error,
        }

    return [
        row("tree", "Tree News", "squawk", tree_provider_status,
            "Keyless history relay; websocket/API key for true live",
            "History is delayed/context only; use Tree websocket with an eligible API key for low-latency updates.",
            "https://news.treeofalpha.com/", count=tree_count),
        row("financialjuice", "FinancialJuice", "macro",
            rss_status_for("financialjuice.com"),
            "Public RSS + optional X", "RSS route is configured; X mirror needs official X API for first-party posts.",
            "https://www.financialjuice.com/feed.ashx?xy=rss", "financialjuice.com",
            fetched_count=rss_count_for("financialjuice.com"), error=rss_error_for("financialjuice.com")),
        row("zerohedge", "ZeroHedge", "macro",
            rss_status_for("zerohedge.com"),
            "Public RSS + optional X", "Full RSS route is configured; X mirror requires X API.",
            "https://cms.zerohedge.com/fullrss2.xml", "zerohedge.com",
            fetched_count=rss_count_for("zerohedge.com"), error=rss_error_for("zerohedge.com")),
        row("watcherguru", "WatcherGuru", "crypto",
            rss_status_for("watcher.guru"),
            "Public RSS + Tree/X optional", "RSS route is configured; Tree may relay delayed context.",
            "https://watcher.guru/news/feed", "watcher.guru",
            fetched_count=rss_count_for("watcher.guru"), error=rss_error_for("watcher.guru")),
        row("lookonchain", "Lookonchain", "onchain",
            "live" if look_live else look_status["status"],
            "Lookonchain feed + Tree/X optional", "First-party site feed is active; only headline/link/time is stored.",
            "https://www.lookonchain.com/feeds", "lookonchain.com"),
        row("benzinga", "Benzinga", "equity",
            rss_status_for("benzinga.com") if rss_status["status"] != "unavailable" else "requires_key",
            "Public RSS; News API for full wire", "RSS route is configured; fast professional Benzinga wire needs an API license.",
            "https://www.benzinga.com/feed", "benzinga.com",
            fetched_count=rss_count_for("benzinga.com"), error=rss_error_for("benzinga.com")),
        row("wsjmarkets", "WSJ Markets", "macro",
            rss_status_for("wsj.com") if rss_status["status"] != "unavailable" else "requires_key",
            "Public RSS headlines; Dow Jones API for full wire", "Use official Dow Jones/Factiva for serious WSJ market coverage.",
            "https://www.wsj.com/news/rss-news-and-feeds", "wsj.com",
            fetched_count=rss_count_for("wsj.com"), error=rss_error_for("wsj.com")),
        row("deitaone", "DeItaone", "squawk",
            x_route_for("DeItaone") if x_status["status"] != "requires_key" else ("tree_backed" if tree_ok else "requires_key"),
            "Tree delayed relay; X API for first-party", "X-only macro account; Tree may relay delayed headlines.",
            "https://x.com/DeItaone", "@DeItaone"),
        row("faststocknewss", "Fast Stock News", "equity",
            x_route_for("faststocknewss"),
            "X API only", x_note_for("faststocknewss", "No stable first-party RSS found; official X API required for first-party posts."),
            "https://x.com/faststocknewss", "@faststocknewss"),
        row("stockmktnewz", "StockMKTNewz", "equity",
            x_route_for("StockMKTNewz"),
            "X API only", x_note_for("StockMKTNewz", "No stable first-party RSS found; official X API required for first-party posts."),
            "https://x.com/StockMKTNewz", "@StockMKTNewz"),
        row("degen_news", "Degen News", "crypto", "not_configured",
            "Directory only", "Linktree is not a feed; needs canonical X/Telegram/RSS/API source.",
            "https://linktr.ee/degen_news"),
    ]


def news_coverage() -> list[JsonDict]:
    """User-requested news providers with honest current state."""
    ids = ("tree_news", "rss", "x_news", "lookonchain", "news")
    out = []
    for sid in ids:
        st = SOURCES[sid].status()
        if sid == "tree_news":
            if st["status"] == "live":
                st["status"] = "delayed"
            st["label"] = "Tree delayed squawk history"
        elif sid == "rss":
            st["label"] = "RSS bundle: WSJ, Benzinga, FinancialJuice, Watcher Guru, ZeroHedge…"
        elif sid == "news":
            st["label"] = "GDELT DOC 2.0 market scan"
        elif sid == "x_news":
            st["label"] = "X official API wires"
        out.append(st)
    return out


WORLD_GROUPS = [
    ("us", "United States"), ("europe", "Europe"), ("asia", "Asia-Pacific"),
    ("india", "India"), ("stocks", "US stocks"), ("commodities", "Commodities"),
    ("world_stocks", "World stocks"), ("etfs", "ETFs"), ("futures", "Futures"),
    ("fx", "Currencies"), ("rates", "Rates"), ("corp_bonds", "Corporate bonds"),
]


def world_markets() -> JsonDict:
    """Global markets block: region-grouped indices + commodities + FX + rates
    with real intraday sparklines (Yahoo Finance spark, one bounded call)."""
    rows = SOURCES["yahoo_world"].get_nowait()
    if not rows:
        return {"status": "unavailable", "groups": [],
                "error": SOURCES["yahoo_world"].last_error}
    by: dict = {}
    for r in rows:
        by.setdefault(r["group"], []).append(r)
    return {
        "status": SOURCES["yahoo_world"].status()["status"],
        "source": "yahoo finance",
        "age_seconds": SOURCES["yahoo_world"].age_seconds(),
        "groups": [{"id": gid, "label": label, "items": by[gid]}
                   for gid, label in WORLD_GROUPS if by.get(gid)],
    }


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


# ---- Binance price history (exchange-native chart provider) ------------------

_BINANCE_CHART_TTL = 180.0
_BINANCE_CHART_MAX = 140
_binance_chart_cache: dict = {}
_binance_chart_lock = threading.Lock()

BINANCE_DAY_SPECS: dict[str, JsonDict] = {
    "1h": {"interval": "1m", "limit": 60, "max": 90},
    "1": {"interval": "5m", "limit": 288, "max": 320},
    "7": {"interval": "1h", "limit": 168, "max": 220},
    "30": {"interval": "4h", "limit": 180, "max": 240},
    "90": {"interval": "8h", "limit": 270, "max": 300},
    "365": {"interval": "1d", "limit": 366, "max": 420},
    "1825": {"interval": "1d", "limit": 1000, "max": 620, "pages": 2},
    "max": {"interval": "1d", "limit": 1000, "max": 760, "pages": 4},
}


def _clean_binance_symbol(symbol: str) -> str:
    clean = "".join(ch for ch in str(symbol or "").upper() if ch.isalnum())
    if not clean:
        return ""
    if any(clean.endswith(q) for q in ("USDT", "USDC", "FDUSD", "BUSD", "USD")):
        return clean
    return clean + "USDT"


def _binance_klines(symbol: str, interval: str, limit: int,
                    end_time: Optional[int] = None) -> list:
    params: dict[str, Any] = {"symbol": symbol, "interval": interval, "limit": int(limit)}
    if end_time:
        params["endTime"] = int(end_time)
    qs = urllib.parse.urlencode(params)
    last_error: Exception | None = None
    for path in ("/api/v3/uiKlines", "/api/v3/klines"):
        try:
            return fetch_json(f"{BINANCE_SPOT}{path}?{qs}", timeout=8.0)
        except Exception as exc:  # noqa: BLE001 - try the raw kline endpoint next
            last_error = exc
    if last_error:
        raise last_error
    return []


def binance_spot_chart(symbol: str, days: str = "1") -> Optional[JsonDict]:
    """Exchange-native close/volume series for Binance-listed spot pairs.

    `days=max` pages daily candles backwards. It is intentionally capped and
    downsampled: enough history for the product view, never a hot-path dump.
    """
    clean = _clean_binance_symbol(symbol)
    days = "max" if days in {"all", "max"} else str(days or "1")
    spec = BINANCE_DAY_SPECS.get(days) or BINANCE_DAY_SPECS["1"]
    if not clean:
        return None
    key = f"{clean}:{days}"
    now = time.monotonic()
    hit = _binance_chart_cache.get(key)
    if hit and now - hit[0] < _BINANCE_CHART_TTL:
        return hit[1]
    with _binance_chart_lock:
        hit = _binance_chart_cache.get(key)
        if hit and time.monotonic() - hit[0] < _BINANCE_CHART_TTL:
            return hit[1]
        try:
            interval = str(spec["interval"])
            limit = int(spec["limit"])
            pages = int(spec.get("pages") or 1)
            rows: list = []
            end_time: Optional[int] = None
            for _ in range(pages):
                chunk = _binance_klines(clean, interval, limit, end_time=end_time)
                if not chunk:
                    break
                rows = chunk + rows
                first_open = int(float(chunk[0][0]))
                next_end = first_open - 1
                if end_time is not None and next_end >= end_time:
                    break
                end_time = next_end
                if len(chunk) < limit:
                    break
                time.sleep(0.08)
            if not rows:
                return hit[1] if hit else None
            dedup: dict[int, list] = {}
            for row in rows:
                try:
                    dedup[int(float(row[0]))] = row
                except (TypeError, ValueError):
                    continue
            rows = [dedup[k] for k in sorted(dedup)]
            prices = []
            volumes = []
            ohlc = []
            for row in rows:
                try:
                    t = int(float(row[0]))
                    o = float(row[1]); h = float(row[2]); l = float(row[3]); c = float(row[4])
                    qv = float(row[7]) if len(row) > 7 else float(row[5]) * c
                except (TypeError, ValueError):
                    continue
                prices.append([t, c])
                volumes.append([t, qv])
                ohlc.append({"t": t, "o": o, "h": h, "l": l, "c": c, "qv": qv})
            max_points = int(spec["max"])
            out = {
                "source": "binance_spot",
                "provider": "Binance spot",
                "symbol": clean,
                "days": days,
                "interval": interval,
                "raw_points": len(prices),
                "prices": _downsample(prices, max_points),
                "volumes": _downsample(volumes, max_points),
                "mcaps": [],
                "ohlc": _downsample(ohlc, max_points),
            }
            if len(_binance_chart_cache) >= _BINANCE_CHART_MAX:
                oldest = min(_binance_chart_cache, key=lambda k: _binance_chart_cache[k][0])
                _binance_chart_cache.pop(oldest, None)
            _binance_chart_cache[key] = (time.monotonic(), out)
            return out
        except Exception:  # noqa: BLE001 - stale-if-error
            return hit[1] if hit else None


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
