PAGE
Front page / global markets (`/`) on `http://127.0.0.1:8812`.

WHAT WAS BROKEN
The front page still read like the old global dashboard: warming metric furniture, duplicated crypto surfaces, stale world-feed assumptions, and row lanes that could look empty even when the stock endpoint had usable rows. The news rail also had weak hierarchy and spacing, and the page did not follow the requested TradingView-style market sequence.

CHANGES
1. Rebuilt the front page around the required sequence: Indices -> US stocks -> World stocks -> Crypto -> Futures and commodities.
2. Removed the front-page atlas/taxonomy clutter, memecoin trending scatter, duplicate crypto-major block, and old futures/commodities spillover from the mounted front page.
3. Added a real TradingView chart shell per section with light/dark theme propagation.
4. Added clean source rows beside each chart, with logo-first assets and compact rank/price/session/open columns.
5. Fixed US stocks to read from `ov.stocks.items`; it no longer depends on stale world-feed rows.
6. Added `data-us-stocks-table-audit="stocks-overview"` for the populated US stock table and `data-us-stocks-table-audit="empty-compact"` for the honest empty state.
7. Converted route-only rows to compact `Chart` rows so the page no longer exposes "unavailable" furniture.
8. Collapsed crypto into one market-cap style section from the top-coins source.
9. Redesigned the front-page news rail spacing, story hierarchy, favicons, lane chips, and grouped story rhythm inside the sprint CSS block.
10. Removed sprint-added hairlines between sections/rows and used spacing, type, and rhythm instead.
11. Hid the old exchange tape on the front page so the new sequence owns the first screen.

REFERENCES USED
1. TradingView Markets - https://www.tradingview.com/markets/ - sequential asset-class market hub with charts and quote rows.
2. Binance Markets Overview - https://www.binance.com/en/markets/overview - compact crypto market rows with price, 24h movement, and market-data hierarchy.
3. CoinMarketCap - https://coinmarketcap.com/ - market-cap ranked crypto list with logos, price, percent move, and chart-first scanning.

FILES TOUCHED
- `bslab/static/app/screens/market.js`
- `bslab/static/app/app.css` under `/* ===== SPRINT2: global ===== */`
- `design/reports/s2-global.md`
- `design/screenshots/s2-global-after-light.png`
- `design/screenshots/s2-global-after-dark.png`

`web_app.py` was read only.

GATES RUN + RESULTS
- Sanity: `node --check bslab/static/app/screens/market.js` - PASS.
- Sanity: `.venv/bin/python -m pytest -q` - PASS, 59 passed.
- API/source audit: `/api/market-overview` - PASS, `stocks.status=stale`, 16 stock-source rows available from `coingecko · on-chain tokenized equities`.
- US-stocks-table audit - PASS: `frontStockRows()` uses `ov.stocks.items`, does not call `worldItem()`, and emits the stock-source audit attribute.
- Render: headless Chrome CDP on `:8812` - PASS, light and dark both booted with 5 sequential sections, 5 TradingView chart iframes, matching chart themes, 12 visible US stock rows, 11 news rows, 8 favicons, no boot error, and no "unavailable" text.
- UI smoke: `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8812` - PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.

SCREENSHOTS
- Before light: `/Users/cosmosgeek/Desktop/PROJECTS/signallab/design/screenshots/global-market-light.png`
- Before dark: `/Users/cosmosgeek/Desktop/PROJECTS/signallab/design/screenshots/global-market-dark.png`
- After light: `/Users/cosmosgeek/Desktop/PROJECTS/signallab/design/screenshots/s2-global-after-light.png`
- After dark: `/Users/cosmosgeek/Desktop/PROJECTS/signallab/design/screenshots/s2-global-after-dark.png`
