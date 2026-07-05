# PAGE STATUS (merge pass 2026-07-05): rescue_needed | usable | polished
- Market: usable* (rescued; BUG: US-stocks/world lanes render 0 rows with NO compact empty state when world feed stale — round-2 target, audit us-stocks-table red on purpose)
- Radar: usable · Health drawer: usable · Heatmap/Liquidations: usable · Bubbles: usable
- Funding: usable (baseline, polished pass done) · Movers: usable · Nav overlay: usable (category rail + tools menu live)

# SITE MAP — CosmosGeek Radar (plain words, kept current by every run)
> RULE: read this first, update it last, every run.
- / (market.js): Global-first market overview — category nav opens on Global, sourced global stat cards sit before the chart/news surface, Global/Indices use one compact selector tape, and crypto/exchange-only sections appear only on Crypto or Binance-only mode.
- /radar (radar.js): spot-vs-perp basis radar, signals, distribution, market table.
- /heatmap (heatmap.js): breadth map. /bubbles (bubbles.js): bubble view.
- /funding (funding.js): funding distribution + history; first paint seeds real state-lite funding rows, then /api/funding replaces them. /movers (movers.js): external 24h movers + exchange-local momentum boards with a clickable warming row when local movers are stale.
- /symbol/<X> (symbol.js): asset profile — chart (native/TV), tabs, stats, news, quality.
- Shell: main.js (router, footer, boot flag) · ui/header.js (sidebar/nav, far-right persisted UTC/IST/local market clock) · ui/* (menus, sheets, command, drawer, health).
- Header nav LAW: clicking a nav item NAVIGATES; the category menu opens on hover/focus only. Never let a popup steal the primary click.
- Header clock LAW: default is UTC; click cycles UTC → IST → local and persists; hover/focus shows all three zones.
- Market default LAW: / must open on Global, not a crypto or single-exchange lane. The old exchange/crypto top tape stays hidden outside Crypto/Binance-only.
- Market atlas: chart embed follows app theme (rebuilds on theme flip); Global/Indices suppress duplicate symbol/group grids and use wordmark-style index labels in the selector tape; index/futures/FX/bond/economy rows use real TradingView SVG marks with badge fallback; ONE TradingView attribution per surface (the copyright under the embed).
- Market news rail: front-page right rail uses /api/news-context; state cells show freshest/source count, then category/search/sort controls, a promoted lead story and grouped live feed. Expand opens the full wire drawer with metadata-first story rows on the left and source-state/provider coverage on the right. Current screenshots: design/screenshots/market-wire-drawer-light.png and design/screenshots/market-wire-drawer-dark.png.
- Current Global screenshots: design/screenshots/global-market-light.png and design/screenshots/global-market-dark.png.
- Data: web_app.py endpoints ← bslab/web_sources.py (keyless adapters) ← bslab/web_cache.py (hot path).
- Gates: pytest · scripts/ui_smoke.py · scripts/click_audit.py · scripts/deep_audit.py.
(Each run: correct and extend this map in plain words.)
