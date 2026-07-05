# PAGE
Movers

# WHAT WAS BROKEN
- Stale exchange data rendered as five full exchange boards, each showing the same "Live mover board warming" row.
- The subtitle said the exchange source was warming, but the page still looked like a broken live dashboard.
- The 24h market rows were too sparse for a finance board: logo, name, sparkline and value were present, but price context was missing.
- The exchange health details were not visible where the empty exchange boards appeared.
- The stale exchange state did not communicate live symbols, last update age, or recent-row count.

# CHANGES
1. Replaced the empty exchange-board fallback with one compact stale panel when `/api/movers` has no fresh rows.
2. Added an exchange source status line under the page title with a colored freshness dot and last-update age.
3. Added stale-state metrics for live symbols, last exchange update and recent rows.
4. Rebuilt 24h mover rows into denser market rows with logo, ticker/name, price, sparkline and colored move/volume value.
5. Updated the hero exchange card so stale data reads as "Source stale" instead of a fake warming impulse.
6. Added live exchange rendering path that restores real spot gainers, spot losers, basis and funding boards when fresh rows exist.
7. Added responsive movers-only CSS so row text and values do not overflow in light or dark screenshots.

# REFERENCES USED
1. Binance Markets — https://www.binance.com/en/markets/overview — borrowed the Hot / Top Gainer / Top Volume separation and compact market stat rhythm.
2. Coinbase Explore — https://www.coinbase.com/explore — borrowed the asset-row anatomy: asset, price, chart, change, market cap / volume context.
3. TradingView crypto markets — https://www.tradingview.com/markets/cryptocurrencies/prices-all/ — borrowed sortable movers-list density around instrument, price, 24h change, market cap and volume.

# FILES TOUCHED
- `bslab/static/app/screens/movers.js`
- `bslab/static/app/app.css` under `/* ===== PAGE RESCUE: movers ===== */`
- `design/reports/movers.md`

# GATES RUN + RESULTS
- `node --check bslab/static/app/screens/movers.js` — PASS
- Render check on `http://127.0.0.1:8807/movers` — PASS: boot error false, stale panel true, fake exchange boards 0, token rows 24, overflow rows 0, "0 exchange symbols moved" absent.
- `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8807` — PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.

# SCREENSHOTS
- Before light: `design/screenshots/movers-before-light.png`
- Before dark: `design/screenshots/movers-before-dark.png`
- After light: `design/screenshots/movers-after-light.png`
- After dark: `design/screenshots/movers-after-dark.png`
