from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import Any, Callable

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.middleware import Middleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from bslab import web_queries as queries
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

async def homepage(_: Request) -> HTMLResponse:
    # Embed the compact lite snapshot so the first paint shows data immediately
    # (no SYNCING screen when the cache already has rows), plus the available
    # token-icon set so the client can pick real icons vs. monogram fallback.
    lite_json = await run_in_threadpool(market_cache.state_lite_json)
    safe = lite_json.replace("</", "<\\/")
    html = INDEX_HTML.replace(BOOTSTRAP_TOKEN, safe)
    html = html.replace(ICONS_TOKEN, json.dumps(ICON_BASES))
    return HTMLResponse(html)


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
    Route("/api/state", api_state),
    Route("/api/state-lite", api_state_lite),
    Route("/api/radar", api_radar),
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
    Mount("/static", app=StaticFiles(directory=STATIC_DIR, check_dir=False), name="static"),
]


@asynccontextmanager
async def lifespan(_: Starlette):
    sync_config()
    await market_cache.start()
    try:
        yield
    finally:
        await market_cache.stop()


middleware = [Middleware(GZipMiddleware, minimum_size=800)]
app = Starlette(debug=False, routes=routes, lifespan=lifespan, middleware=middleware)
