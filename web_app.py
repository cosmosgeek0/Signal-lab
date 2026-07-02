from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import Any, Callable

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import MutableHeaders
from starlette.middleware import Middleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from bslab import web_queries as queries
from bslab import web_sources as sources
from bslab.web_cache import CACHE as market_cache
from bslab.web_static import INDEX_HTML

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bslab", "static")
ICONS_DIR = os.path.join(STATIC_DIR, "icons")
try:
    ICON_BASES = sorted(name[:-4].upper() for name in os.listdir(ICONS_DIR) if name.endswith(".svg"))
except OSError:
    ICON_BASES = []
ICONS_TOKEN = '"__CG_ICONS__"'

WINDOW_MINUTES = {"5m": 5, "15m": 15, "1h": 60, "4h": 240, "24h": 1440, "7d": 10080, "all": 0}


DB_PATH = queries.DB_PATH
STALE_AFTER_SEC = queries.STALE_AFTER_SEC
DEFAULT_HISTORY_MINUTES = queries.DEFAULT_HISTORY_MINUTES
MAJOR_SYMBOLS = queries.MAJOR_SYMBOLS
TABLE_NAME = queries.TABLE_NAME
REQUIRED_COLUMNS = queries.REQUIRED_COLUMNS
CACHE = queries.CACHE
LAST_GOOD = queries.LAST_GOOD

JsonDict = dict[str, Any]

BOOTSTRAP_TOKEN = '"__CG_BOOTSTRAP_JSON__"'


def sync_config() -> None:
    queries.DB_PATH = DB_PATH


def int_param(request: Request, name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(request.query_params.get(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def split_symbols(raw: str | None) -> list[str]:
    if not raw:
        return []
    out = []
    for part in raw.split(","):
        symbol = "".join(ch for ch in part.strip().upper() if ch.isalnum())
        if symbol:
            out.append(symbol)
    return out


def safe_payload(kind: str, builder: Callable[[], JsonDict]) -> JsonDict:
    sync_config()
    try:
        return builder()
    except Exception as exc:  # noqa: BLE001 - all endpoints must return JSON
        return queries.fallback_payload(kind, f"{type(exc).__name__}: {exc}")


def cached(key: str, ttl: float, kind: str, builder: Callable[[], JsonDict]) -> JsonDict:
    sync_config()
    return queries.cached_payload(key, ttl, kind, builder)


def empty_health(status: str = "DB WARMING", error: str = "") -> JsonDict:
    sync_config()
    return queries.empty_health(status, error)


def diagnose_db(db_path: str | None = None, sample_limit: int = 10) -> JsonDict:
    sync_config()
    return queries.diagnose_db(db_path or DB_PATH, sample_limit=sample_limit)


# ---- DB-reading builders (used by tests, web_debug, and the manual
# diagnostic endpoints). The hot dashboard endpoints do NOT use these; they
# serve precomputed payloads from bslab.web_cache. ----------------------------

def build_live(limit: int = 300) -> JsonDict:
    return safe_payload("live", lambda: queries.build_live(limit))


def build_summary() -> JsonDict:
    return safe_payload("summary", queries.build_summary)


def build_symbols() -> JsonDict:
    return safe_payload("symbols", queries.build_symbols)


def build_history(symbol: str, minutes: int) -> JsonDict:
    return safe_payload("history", lambda: queries.build_history(symbol, minutes))


def build_opportunities() -> JsonDict:
    return safe_payload("opportunities", queries.build_opportunities)


def build_funding() -> JsonDict:
    return safe_payload("funding", queries.build_funding)


def build_movers(minutes: int) -> JsonDict:
    return safe_payload("movers", lambda: queries.build_movers(minutes))


def build_heatmap(limit: int = 300, mode: str = "basis") -> JsonDict:
    return safe_payload("heatmap", lambda: queries.build_heatmap(limit, mode))


def build_ticker() -> JsonDict:
    return safe_payload("ticker", queries.build_ticker)


def build_watchlist(symbols: list[str] | None = None, limit: int = 32) -> JsonDict:
    return safe_payload("watchlist", lambda: queries.build_watchlist(symbols, limit))


def build_enrichment(symbols: list[str] | None = None, limit: int = 12) -> JsonDict:
    return safe_payload("enrichment", lambda: queries.build_enrichment(symbols, limit))


def build_market_regime() -> JsonDict:
    return safe_payload("market_regime", queries.build_market_regime)


def build_debug() -> JsonDict:
    return safe_payload("debug", queries.build_debug)


def build_selftest() -> JsonDict:
    return safe_payload("selftest", queries.build_selftest)


def build_detail(symbol: str, minutes: int) -> JsonDict:
    # Latest row from the in-memory cache + bounded per-symbol history read.
    history = safe_payload("history", lambda: queries.build_history(symbol, minutes))
    snapshot = market_cache.state()
    row = next((r for r in snapshot.get("live", []) if r.get("symbol") == symbol), None)
    return {
        "ok": True,
        "symbol": symbol,
        "minutes": minutes,
        "row": row,
        "rows": history.get("rows", []),
        "health": snapshot.get("health", {}),
    }


# ---- routes -----------------------------------------------------------------

class NoHeuristicCache:
    """Add ``Cache-Control: no-cache`` to every response of the wrapped ASGI
    app. Without it, browsers heuristically cache the ES modules (StaticFiles
    only sends ETag/Last-Modified) and can serve STALE module versions without
    revalidating after a deploy — a mixed-version module graph fails to link
    and the app boots to a blank page. ``no-cache`` still allows cheap 304
    revalidation; it is not ``no-store``.
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_header(message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-cache"
            await send(message)

        await self.app(scope, receive, send_with_header)


async def homepage(_: Request) -> HTMLResponse:
    # Embed the compact lite snapshot so the first paint shows data immediately
    # (no SYNCING screen when the cache already has rows), plus the available
    # token-icon set so the client can pick real icons vs. monogram fallback.
    lite_json = await run_in_threadpool(market_cache.state_lite_json)
    safe = lite_json.replace("</", "<\\/")
    html = INDEX_HTML.replace(BOOTSTRAP_TOKEN, safe)
    html = html.replace(ICONS_TOKEN, json.dumps(ICON_BASES))
    # The shell must never be cached: it carries the asset version + snapshot.
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


async def api_search(request: Request) -> JSONResponse:
    q = request.query_params.get("q", "")
    limit = int_param(request, "limit", 20, 1, 50)
    return JSONResponse(await run_in_threadpool(market_cache.search, q, limit))


async def api_pages_markets(request: Request) -> JSONResponse:
    page = int_param(request, "page", 1, 1, 100000)
    page_size = int_param(request, "page_size", 50, 1, 200)
    sort = request.query_params.get("sort", "abs_basis_bps").strip()
    direction = request.query_params.get("direction", "desc").strip().lower()
    symbol_filter = request.query_params.get("filter", "all").strip().lower()
    query = request.query_params.get("q", "")
    return JSONResponse(await run_in_threadpool(
        market_cache.page, page, page_size, sort, direction, symbol_filter, query))


async def api_symbol(request: Request) -> JSONResponse:
    symbol = request.path_params.get("symbol", "").strip().upper()
    return JSONResponse(await run_in_threadpool(market_cache.symbol, symbol))


async def api_symbol_history(request: Request) -> JSONResponse:
    symbol = request.path_params.get("symbol", "BTCUSDT").strip().upper()
    window = request.query_params.get("window", "1h").strip().lower()
    minutes = WINDOW_MINUTES.get(window, 60)
    payload = await run_in_threadpool(build_history, symbol, minutes)
    payload["window"] = window
    return JSONResponse(payload)


async def api_state(_: Request) -> Response:
    # Full snapshot (kept for compatibility / power users). Pre-serialized.
    payload = await run_in_threadpool(market_cache.state_json)
    return Response(payload, media_type="application/json")


async def api_state_lite(_: Request) -> Response:
    # Compact hot endpoint the frontend polls every ~1.5s (< 100 KB, gzipped).
    payload = await run_in_threadpool(market_cache.state_lite_json)
    return Response(payload, media_type="application/json")


async def api_radar(request: Request) -> JSONResponse:
    limit = int_param(request, "limit", 300, 1, 1500)
    symbol_filter = request.query_params.get("filter", "all").strip().lower()
    return JSONResponse(await run_in_threadpool(market_cache.radar, limit, symbol_filter))


async def api_sparks(_: Request) -> JSONResponse:
    # Precomputed per-symbol mini price series (from the cache's existing
    # bounded read); powers the table sparklines. No extra DB work.
    return JSONResponse(await run_in_threadpool(market_cache.sparks))


async def api_overview(_: Request) -> JSONResponse:
    # Market landing page payload; composed from the in-memory snapshot.
    return JSONResponse(await run_in_threadpool(market_cache.overview))


def build_market_overview() -> JsonDict:
    """Full Market-page payload: Binance universe + every external context
    source. Each block is independent and carries its own status — a failing
    source degrades to 'unavailable', never breaks the page."""
    base = market_cache.overview()

    def block(fn: Callable[[], JsonDict]) -> JsonDict:
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - blocks must never break the page
            return {"status": "unavailable", "error": f"{type(exc).__name__}: {exc}"}

    tc = block(sources.top_coins)
    try:
        rest = sources.SOURCES["binance_rest"].get_nowait() or {}
    except Exception:  # noqa: BLE001
        rest = {}
    live_bases = {}
    for row in market_cache.state().get("live", []):
        sym = row.get("symbol", "")
        for quote in ("USDT", "USDC", "FDUSD"):
            if sym.endswith(quote):
                live_bases.setdefault(sym[: -len(quote)], row)
                break
    for coin in tc.get("coins", []):
        row = live_bases.get(coin["base"])
        if row:
            coin["binance"] = {
                "symbol": row["symbol"],
                "basis_bps": row.get("mid_spread_bps"),
                "funding_rate": row.get("funding_rate"),
                "score": row.get("opportunity_score"),
            }
            # real-time price from the local Binance stream, but ONLY when it
            # agrees with the reference price (±3%) — never show wrong numbers
            spot = row.get("spot_mid")
            ref = coin.get("price")
            if spot and ref and abs(spot - ref) / ref <= 0.03:
                coin["price_live"] = spot
    # Binance public REST: real-time ticks for every listed coin (keyless).
    for coin in tc.get("coins", []):
        t = rest.get(coin["base"] + "USDT")
        if t:
            coin["price_live"] = t["price"]
            coin["chg24h"] = t["chg24h"]          # fresher than the 90s snapshot
            coin["vol_live"] = t["qvol"]
    return {
        **base,
        "global": block(sources.global_overview),
        "fear_greed": block(sources.fear_greed),
        "defi": block(sources.defi_overview),
        "stablecoins": block(sources.stablecoin_overview),
        "top_coins": tc,
        "global_history": block(sources.global_history),
        "trending": block(sources.trending),
        "stocks": block(sources.stocks_overview),
        "dex": block(sources.dex_overview),
        "fx": block(sources.fx_state),
        "source_status": sources.statuses(),
    }


async def api_market_overview(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(build_market_overview))


def build_coin_profile(symbol: str) -> JsonDict:
    """Rich symbol profile: external coin data (CoinGecko/Paprika caches) +
    the live Binance row. Composed from caches only — no per-request fetch."""
    clean = "".join(ch for ch in symbol.upper() if ch.isalnum())
    base = clean
    for quote in ("USDT", "USDC", "FDUSD", "BUSD"):
        if clean.endswith(quote) and len(clean) > len(quote):
            base = clean[: -len(quote)]
            break
    row = next((r for r in market_cache.state().get("live", []) if r.get("symbol") == clean), None)
    if row is None:  # maybe they passed a bare base
        row = next((r for r in market_cache.state().get("live", [])
                    if r.get("symbol") == base + "USDT"), None)
    coin = None
    try:
        coin = sources.coin_by_base(base)
    except Exception:  # noqa: BLE001
        coin = None
    return {
        "ok": True,
        "symbol": clean,
        "base": base,
        "coin": coin,                 # None when no external source has it
        "row": row,                   # None when not a tracked Binance pair
        "health": market_cache.health(),
    }


async def api_coin_profile(request: Request) -> JSONResponse:
    symbol = request.path_params.get("symbol", "").strip()
    return JSONResponse(await run_in_threadpool(build_coin_profile, symbol))


async def api_news_context(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(lambda: {"ok": True, **sources.news_context()}))


async def api_coin_history(request: Request) -> JSONResponse:
    """Real price/volume/mcap history for any coin (CoinGecko market_chart,
    cached + bounded). Powers the asset-page Price/Volume/Market-cap charts."""
    base = "".join(ch for ch in request.path_params.get("base", "").upper() if ch.isalnum())
    days = request.query_params.get("days", "1")

    def build() -> JsonDict:
        clean = base
        for quote in ("USDT", "USDC", "FDUSD", "BUSD"):
            if clean.endswith(quote) and len(clean) > len(quote):
                clean = clean[: -len(quote)]
                break
        coin = None
        try:
            coin = sources.coin_by_base(clean)
        except Exception:  # noqa: BLE001
            coin = None
        if not coin or not coin.get("id"):
            return {"ok": True, "status": "unavailable", "base": clean,
                    "error": "no external profile for this asset", "prices": [], "volumes": [], "mcaps": []}
        chart = sources.coin_chart(coin["id"], days)
        if not chart:
            return {"ok": True, "status": "unavailable", "base": clean,
                    "error": "history source unreachable", "prices": [], "volumes": [], "mcaps": []}
        return {"ok": True, "status": "live", "source": "coingecko", "base": clean,
                "id": coin["id"], "days": days, **chart}
    return JSONResponse(await run_in_threadpool(build))


async def api_fx(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(lambda: {"ok": True, **sources.fx_state()}))


async def api_icon_manifest(_: Request) -> JSONResponse:
    # Local-only: the browser resolves bundled CC0 SVGs or deterministic
    # monograms and never loads third-party token images.
    return JSONResponse({"ok": True, "local": ICON_BASES, "remote": {}})


async def api_sources(_: Request) -> JSONResponse:
    # Data-source health: Binance/local cache + every external adapter.
    def build() -> JsonDict:
        payload = market_cache.sources()
        internal = [s for s in payload["sources"] if s["id"] in {"binance", "cache"}]
        return {**payload, "sources": internal + sources.statuses()}
    return JSONResponse(await run_in_threadpool(build))


async def api_detail(request: Request) -> JSONResponse:
    symbol = request.query_params.get("symbol", "BTCUSDT").strip().upper()
    minutes = int_param(request, "minutes", DEFAULT_HISTORY_MINUTES, 1, 1440)
    return JSONResponse(await run_in_threadpool(build_detail, symbol, minutes))


async def api_health(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.health))


async def api_summary(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.summary))


async def api_live(request: Request) -> JSONResponse:
    limit = int_param(request, "limit", 300, 1, 1500)
    return JSONResponse(await run_in_threadpool(market_cache.live, limit))


async def api_symbols(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.symbols))


async def api_history(request: Request) -> JSONResponse:
    symbol = request.query_params.get("symbol", "BTCUSDT").strip().upper()
    minutes = int_param(request, "minutes", DEFAULT_HISTORY_MINUTES, 1, 1440)
    # Bounded single-symbol read (symbol+ts index); only the detail tab calls it.
    return JSONResponse(await run_in_threadpool(build_history, symbol, minutes))


async def api_opportunities(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.opportunities))


async def api_funding(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.funding))


async def api_movers(request: Request) -> JSONResponse:
    minutes = int_param(request, "minutes", 5, 1, 60)
    return JSONResponse(await run_in_threadpool(market_cache.movers, minutes))


async def api_heatmap(request: Request) -> JSONResponse:
    limit = int_param(request, "limit", 320, 1, 600)
    mode = request.query_params.get("mode", "basis").strip().lower()
    if mode not in {"basis", "funding"}:
        mode = "basis"
    return JSONResponse(await run_in_threadpool(market_cache.heatmap, mode, limit))


async def api_ticker(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.ticker))


async def api_watchlist(request: Request) -> JSONResponse:
    symbols = split_symbols(request.query_params.get("symbols"))
    limit = int_param(request, "limit", 32, 1, 100)
    return JSONResponse(await run_in_threadpool(market_cache.watchlist, symbols, limit))


async def api_enrichment(request: Request) -> JSONResponse:
    # Optional public Binance REST. Disabled from core polling: only the Futures
    # Pulse tab / manual refresh hits this. 60s cached, threadpooled, never on
    # the /api/state path.
    symbols = split_symbols(request.query_params.get("symbols"))
    limit = int_param(request, "limit", 12, 1, 12)
    key = f"enrichment:{','.join(symbols[:limit])}:{limit}"
    return JSONResponse(await run_in_threadpool(cached, key, 60.0, "enrichment", lambda: build_enrichment(symbols, limit)))


async def api_market_regime(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.regime))


async def api_debug(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(build_debug))


async def api_selftest(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(build_selftest))


async def api_perf(_: Request) -> JSONResponse:
    return JSONResponse(await run_in_threadpool(market_cache.perf))


routes = [
    Route("/", homepage),
    Route("/symbol/{symbol}", homepage),
    Route("/radar", homepage),
    Route("/heatmap", homepage),
    Route("/funding", homepage),
    Route("/movers", homepage),
    Route("/api/state", api_state),
    Route("/api/state-lite", api_state_lite),
    Route("/api/radar", api_radar),
    Route("/api/sparks", api_sparks),
    Route("/api/overview", api_overview),
    Route("/api/market-overview", api_market_overview),
    Route("/api/coin-profile/{symbol}", api_coin_profile),
    Route("/api/news-context", api_news_context),
    Route("/api/coin-history/{base}", api_coin_history),
    Route("/api/fx", api_fx),
    Route("/api/icon-manifest", api_icon_manifest),
    Route("/api/sources", api_sources),
    Route("/api/detail", api_detail),
    Route("/api/health", api_health),
    Route("/api/selftest", api_selftest),
    Route("/api/debug", api_debug),
    Route("/api/perf", api_perf),
    Route("/api/summary", api_summary),
    Route("/api/live", api_live),
    Route("/api/symbols", api_symbols),
    Route("/api/history", api_history),
    Route("/api/opportunities", api_opportunities),
    Route("/api/funding", api_funding),
    Route("/api/movers", api_movers),
    Route("/api/heatmap", api_heatmap),
    Route("/api/ticker", api_ticker),
    Route("/api/watchlist", api_watchlist),
    Route("/api/enrichment", api_enrichment),
    Route("/api/market-regime", api_market_regime),
    Route("/api/search", api_search),
    Route("/api/pages/markets", api_pages_markets),
    Route("/api/symbol/{symbol}", api_symbol),
    Route("/api/symbol/{symbol}/history", api_symbol_history),
    Mount("/static", app=NoHeuristicCache(StaticFiles(directory=STATIC_DIR, check_dir=False)), name="static"),
]


@asynccontextmanager
async def lifespan(_: Starlette):
    sync_config()
    await market_cache.start()
    sources.warm_sources()  # background daemon; never blocks startup
    try:
        yield
    finally:
        await market_cache.stop()


middleware = [Middleware(GZipMiddleware, minimum_size=800)]
app = Starlette(debug=False, routes=routes, lifespan=lifespan, middleware=middleware)
