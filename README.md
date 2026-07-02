# CG Signal Lab - Public Crypto Market Terminal

Binance public spot/perp basis terminal for market overview, funding, movers, heatmaps, watchlists, symbol workspaces, data quality, and optional public futures enrichment.

No Binance API key. No orders. No live trading. No secrets.

## Architecture

```
Binance public WS ──▶ collector (bslab.run) ──▶ SQLite (basis_snapshots, WAL)
                                                      │  read-only, bounded
                                                      ▼
                            background cache (bslab/web_cache.py)
                            • refreshes every ~1.5s in one worker thread
                            • ONE bounded read (ts_ms index, LIMIT) + dedupe
                            • precomputes health/summary/live/ticker/opps/
                              funding/heatmap/symbols/regime/movers in memory
                                                      │  in-memory snapshot
                                                      ▼
                  fast API (web_app.py) ──▶ GET /api/state-lite ──▶ browser
                  every endpoint serves the precomputed snapshot (gzipped); the
                  page embeds the lite snapshot as window.__BOOTSTRAP_STATE__ for
                  an instant first paint, then polls only /api/state-lite (~1.5s)
                  and lazily fetches the active tab's endpoint (~4s).
```

No HTTP request scans SQLite. The collector writes; the cache reads once per
tick; the browser reads memory. This is what keeps `/api/health` < 100 ms and
`/api/state` / `/api/live` / `/api/summary` < 200 ms even on a 2.6M-row DB,
instead of the per-request `COUNT(*)` / `GROUP BY` full scans that previously
pinned CPU at 100% and pushed latency to tens of seconds.

## What it does

- Pulls public Binance spot + USD-M futures symbol lists.
- Streams spot best bid/ask for USDT pairs through spot `@bookTicker` streams.
- Streams futures all-market best bid/ask through USD-M futures `!bookTicker`.
- Streams futures mark price + funding through USD-M futures `!markPrice@arr@1s`.
- Calculates two basis views:
  - `spot_to_perp_bps`: buy spot at ask, sell perp at bid.
  - `perp_to_spot_bps`: buy perp at ask, sell spot at bid. This is only a signal; spot shorting needs borrow and is not implemented.
- Saves one snapshot per second into SQLite.
- Provides a Uvicorn/Starlette browser terminal with clean light-first product navigation, inline ticker/metric strips, dense exchange-style tables, ECharts charts, watchlists, mosaic heatmaps, symbol workspaces, and JSON APIs.
- Optionally enriches selected symbols with Binance public USD-M REST data such as open interest, premium index, 24h ticker stats, long/short ratio, and taker buy/sell ratio. This is cached conservatively and does not require keys.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run collector

```bash
.venv/bin/python -m bslab.run --db data/binance_signal_lab.sqlite --top 25
```

Stop with Ctrl+C.

## Run dashboard

```bash
.venv/bin/uvicorn web_app:app --host 127.0.0.1 --port 8501
```

Cloudflare Tunnel should point `radar.cosmosgeek.org` to `http://localhost:8501`.

## Create read indexes (run once)

The bounded reads are fast on the existing `ts_ms` index, but these recommended
indexes make them optimal. This is a **manual, one-time** step (it writes to the
DB; the API never creates indexes on a request path):

```bash
.venv/bin/python scripts/ensure_indexes.py --db data/binance_signal_lab.sqlite
```

## Check performance

With the dashboard running, measure core endpoint latency (PASS if every core
endpoint stays under 1000 ms; targets are far lower):

```bash
.venv/bin/python scripts/perf_check.py --base http://127.0.0.1:8501
```

## Debug the dashboard DB read path

```bash
.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite
```

This prints cwd, absolute DB path, DB exists yes/no, SQLite tables, schema columns, latest timestamp, recent row counts, distinct symbols, first ten latest rows, internal live/summary query probes, and a clear OK/FAIL status. The dashboard exposes the same safe diagnostics at `/api/debug`, plus a pass/fail smoke check at `/api/selftest`.

## Dashboard tabs

- Radar: live sortable table with symbol badges, pin/favorite, copy symbol, basis, spreads, funding, age, score, search, filters, and threshold slider.
- Opportunities: top spot->perp, perp->spot, funding leaderboards, and basis expansion boards.
- Funding: positive/negative leaderboards, distribution chart, and funding changes when enough history exists.
- Movers: 1m, 5m, 15m, and 60m spot, futures, basis, and funding movement boards.
- Heatmap: basis, funding, or score mosaic with variable tile sizing; click any tile to open symbol detail.
- Symbol Detail: deep-linkable symbol workspace with Overview, Basis, Price, Funding, Spread, and Quality tabs; search/copy/favorite actions; summary stats; recent extremes; latest rows; and ECharts history charts.
- Data Quality: DB state, schema state, stale counts, retry counts, latency, debug/selftest links.
- Futures Pulse: SQLite-derived market regime plus optional public Binance USD-M REST enrichment.

Keyboard shortcuts: `/` focuses search, `D` toggles theme, `?` opens the help overlay, `Esc` closes it, and `1` through `8` switch Radar, Opportunities, Funding, Movers, Heatmap, Symbol Detail, Data Quality, and Futures Pulse. The header also has a search button and a help button.

Deep links: append `?tab=heatmap`, `?theme=light`, or `?symbol=ETHUSDT` (combinable), or open `/symbol/ETHUSDT`, to land in a specific state. Theme, selected tab, selected symbol, search text, active filter, heatmap settings, threshold, watchlist, and chart window are all persisted in `localStorage` and survive every background refresh.

## Live UI & motion

The terminal is light-first and deliberately *alive* without being noisy — every animation is short, purposeful, driven by real polled data, and fully disabled under `prefers-reduced-motion`:

- **Shared mega-menu** — Markets / Basis / Funding / Research open one Aave-style floating surface that glides and swaps content between nav items (not a jumpy box per item); closes on outside click, `Esc`, or scroll.
- **Live market tape + rotating headline** — a slim marquee of real phrases (symbol count, live/stale, cache/api ms, basis leaders, funding extremes) that pauses on hover; each item opens that symbol. A headline cross-fades real market state every ~4.5s.
- **Animated metric strip** — symbol counts count up; every value flashes green/red on change, updated in place (no per-tick re-render).
- **Micro-visual widgets** — a freshness ring, basis-spread distribution curve, funding-balance bars, and a network-pulse heartbeat, all SVG and driven by the same poll.
- **Live activity feed** — the right rail streams client-derived events (new basis leader, session high, funding extreme, stale↔fresh, cache health, opened/pinned symbols); newest slides in, capped at 20.
- **Gliding tab underline** and smooth row hover/selection, ticker/number flashes, and ECharts draw-on-load.
- **Network-health wifi badge** (bottom-right) with animated signal bars graded from real latency/cache, a hover popover, and click-through to Data Quality.
- **Market spotlight hero** on Radar — the strongest live dislocation with a big flashing price, inline stats, and a wide area chart; glows on new session highs.
- **Market-mood chip** (CALM/STEADY/ACTIVE) and **Coinbase/Uniswap subscript micro-prices** (`0.0₆42`); ticker sparklines use gradient area fills.
- **TradingView-style chart tools** on Symbol Detail — Line/Area, SMA/EMA overlay, log/linear axis, crosshair, and a fullscreen chart modal (`F` / `Esc`).
- **Backpack-style top-of-book / basis ladder** on Symbol Detail and a **Base-style "how basis works" flow diagram** in Methodology.
- **Staggered row-reveal** on re-sort/filter/page and a sorted-header bump.

None of this adds a network call: the tape, headline, metric animations, activity feed, and widgets are all computed in the browser from the existing `/api/state-lite` poll. Charts/history load only when the Symbol Detail tab is active.

## Dashboard API

All endpoints return JSON and are designed to stay safe if SQLite is missing, empty, or temporarily locked by the collector. Core endpoints serve the precomputed in-memory snapshot (no per-request DB scan) and responses are gzipped. The frontend polls **only `/api/state-lite`** every ~1.5s; each tab lazily fetches its own endpoint every ~4s while visible.

- `/api/state-lite` — compact hot payload the dashboard polls (~10 KB gzipped): health + cache metrics + metric strip + ticker majors + top-50 radar preview
- `/api/radar?limit=300&filter=all` — full radar rows (server-side filter), fetched when the Radar tab is active
- `/api/sparks` — precomputed per-symbol mini price series (from the cache's existing bounded read; powers the table sparklines, ~23 KB gzipped)
- `/api/overview` — Binance-universe overview: metrics, majors, top basis/score, funding extremes, movers (composed in memory, ~7 KB gzipped)
- `/api/market-overview` — full Market-page payload: Binance universe **plus** cached external context (CoinGecko global + top-100 w/ 7d sparklines & images, CoinPaprika fallback, Alternative.me Fear & Greed, DefiLlama TVL + stablecoins, FX). Each block carries its own `status`; a failing source degrades to `unavailable`, never fake data
- `/api/coin-profile/{symbol}` — rich symbol profile: external coin data (rank/mcap/volume/supply/ATH/performance) + the live Binance row, composed from caches only
- `/api/news-context` — cached crypto headlines (GDELT, keyless); **non-blocking** — requests never wait on the news source
- `/api/fx` — display-currency state and USD→INR/EUR/GBP/JPY rates (open.er-api.com, keyless, 6 h TTL)
- `/api/icon-manifest` — local CC0 icon list for the token-icon resolver; missing icons fall back to deterministic monograms with no browser-side third-party image requests
- `/api/sources` — health for every source: Binance WS, local cache, CoinGecko, CoinPaprika, Alternative.me, DefiLlama, GDELT, FX, and CoinMarketCap (`key_required`; no keys are ever hardcoded). External adapters live in `bslab/web_sources.py`: TTL-cached (180 s–6 h), timeout-bounded, stale-if-error, never on the hot path
- `/api/pages/markets?page=1&page_size=50&sort=abs_basis&direction=desc&filter=all&q=` — paginated + sorted market rows (drives the radar table pagination)
- `/api/search?q=btc` — fuzzy symbol search (drives the command palette)
- `/api/symbol/{symbol}` — one symbol's latest row from cache
- `/api/symbol/{symbol}/history?window=5m|15m|1h|4h|24h|all` — bounded per-symbol history for the detail charts
- `/symbol/{symbol}` — clean browser route for the symbol workspace
- `/api/detail?symbol=BTCUSDT&minutes=60` — one symbol's latest row + bounded price history
- `/static/icons/<base>.svg` — bundled CC0 token icons (spothq/cryptocurrency-icons)
- `/api/state` — full composite snapshot (kept for power users / compatibility)
- `/api/perf` — cache metrics + payload sizes (refresh duration, age, row/symbol counts, refresh/fail counts)
- `/api/health`
- `/api/selftest`
- `/api/debug`
- `/api/summary`
- `/api/live?limit=300`
- `/api/symbols`
- `/api/history?symbol=BTCUSDT&minutes=60`
- `/api/opportunities`
- `/api/funding`
- `/api/movers?minutes=1`
- `/api/movers?minutes=5`
- `/api/movers?minutes=15`
- `/api/heatmap`
- `/api/ticker`
- `/api/watchlist`
- `/api/enrichment`
- `/api/market-regime`

## Frontend

The frontend is a **no-build ES-module application** served by Starlette — no
Node, npm, Vite, React build pipeline, or CDN runtime dependency. `bslab/web_static.py`
is a thin HTML shell that injects the bootstrap snapshot (`window.__CG_BOOT__`) and the
bundled-icon list (`window.__CG_ICONS__`); the product itself lives in `bslab/static/app/`
(`main.js` + `lib/` + `ui/` + `screens/`) and is served from `/static/app/`. See
[DESIGN.md](DESIGN.md) for the architecture and design system.

- **Three screens.** Radar (`/`, market table + signals), Symbol (`/symbol/{SYM}`,
  full asset page with a large central chart), Heatmap (`/heatmap`, tile surface).
  Everything else lives in overlays: the ⌘K/`/` command palette and the data & status
  drawer. No permanent right rail, no methodology or disclaimers in the main viewport.
- **Charts are hand-built inline SVG** (area/line with crosshair, tooltip and axes) plus
  compact sparklines — no charting library, no CDN, fully offline.
- **Token icons** are real coin logos from [`spothq/cryptocurrency-icons`](https://github.com/spothq/cryptocurrency-icons)
  (CC0) under `bslab/static/icons/`, served at `/static/icons/<base>.svg`; symbols without a
  bundled icon fall back to a generated gradient monogram (never a blank circle). UI icons are
  inlined Lucide (ISC) paths — no icon font, no CDN.
- **Command palette** (`/` or the search box) queries `/api/search` for fuzzy symbol lookup
  with full keyboard navigation.
- **Theme** (light default / dark) is toggled from the header or data drawer and persisted in
  `localStorage`, along with the watchlist and advanced-column choices.
- **Number formatting** uses adaptive decimal precision (BTC shows 2 decimals, micro-cap tokens
  up to 8) and tabular figures for clean column alignment.

### Reliability / data layer

- **Background cache, not per-request scans.** `bslab/web_cache.py` reads SQLite once every ~1.5 s in a worker thread, precomputes every payload, and serves them from memory. A single bounded read (`ORDER BY ts_ms DESC LIMIT`, deduped by symbol in Python) replaces the old per-request `COUNT(*)` / `GROUP BY symbol` full scans. Total row count uses `MAX(_rowid_)` (O(1)), never `COUNT(*)`.
- **Read-only, never mutates.** The DB is opened with a `mode=ro` URI and a generous `busy_timeout`, so reads ride out a momentarily locked WAL writer and can never create or modify the collector DB. Index creation is a separate manual script.
- **Last-good retention + calm status.** If a refresh fails (DB locked/slow), the previous good snapshot is kept and metrics record the failure. The browser keeps last-good rows on screen; the header shows only `LIVE` / `STALE` / `SYNCING` (never a scary `API RETRY` wall), and error details go to a collapsible debug drawer.
- **Split payload + tab-scoped polling.** The core poll is `/api/state-lite` (~10 KB gzipped); the heavier per-tab endpoints (`/api/radar`, `/api/detail`, `/api/heatmap`, `/api/movers`, `/api/funding`, `/api/opportunities`, `/api/enrichment`) are fetched only while their tab is visible, with no overlapping fetches.
- **Off the hot path.** Optional Binance REST enrichment runs only on the Futures Pulse tab / manual refresh (60 s cache, worker thread) and never blocks `/api/state`. Movers are recomputed on a slower ~15 s cadence.

## Optional public enrichment

The `/api/enrichment` endpoint uses only public Binance USD-M market-data endpoints and caches results for 60 seconds or longer. It is bounded to a small selected symbol set and can fail without affecting the core SQLite dashboard. Do not reduce the cache interval aggressively; this is a monitoring dashboard, not a high-frequency polling system.

## Local test commands

```bash
python -m pytest
.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite
.venv/bin/python scripts/ensure_indexes.py --db data/binance_signal_lab.sqlite
.venv/bin/python -m bslab.run --db data/test.sqlite --top 10
BSLAB_DB=data/test.sqlite .venv/bin/uvicorn web_app:app --host 127.0.0.1 --port 8501
.venv/bin/python scripts/perf_check.py --base http://127.0.0.1:8501
```

Tuning env vars: `BSLAB_CACHE_REFRESH_SEC` (default 1.5), `BSLAB_CACHE_MOVERS_SEC` (default 15), `BSLAB_RECENT_READ_LIMIT` (default 15000 — most-recent rows scanned per refresh).

## Safety

This project is deliberately public-data-only. It has no API-key support and no order execution. Treat every signal as research until it survives paper trading and manual review.

## First signals to watch

- Large positive `spot_to_perp_bps`: futures bid above spot ask.
- Large positive `perp_to_spot_bps`: spot bid above futures ask; this is usually harder to trade safely because it requires spot inventory or borrow.
- Funding rate pressure: large positive funding can make short-perp side receive/pay differently depending exchange rules; read exchange fee/funding docs before any real money.
- Persistency: ignore single-tick ghosts. Watch whether gap persists for 5s, 15s, 60s.
- Liquidity: future versions should include depth/liquidity filters before any real trade logic.
