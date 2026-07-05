# Sprint 2 Asset Page

## Scope
- Owned surface: `bslab/static/app/screens/symbol.js`
- Owned CSS: `bslab/static/app/app.css` under `/* ===== SPRINT2: asset ===== */`
- Server: `http://127.0.0.1:8815`

## References
1. CoinMarketCap Bitcoin page - https://coinmarketcap.com/currencies/bitcoin/ - identity, rank, live price, market cap, volume, supply, converter/performance context.
2. CoinGecko Bitcoin page - https://www.coingecko.com/en/coins/bitcoin - chart, market cap/volume/supply stats, exchange markets table, CEX/DEX and spot/perpetual/futures market context.
3. TradingView BTCUSD symbol page - https://www.tradingview.com/symbols/BTCUSD/ - symbol-first chart, clean tab model, technical/market context around the chart.

## Visible Changes
1. Removed the boxed outer asset shell and dark-mode glass panel treatment.
2. Rebuilt the top as a CMC/CoinGecko-style identity header: logo, breadcrumb, name, watch button, pair chip, live chip.
3. Moved price into a clean right-side quote block with source links for CoinGecko, CoinMarketCap, and TradingView.
4. Added an open hero stat row: rank, market cap, 24h volume, 7d move, supply, basis, FDV, venue.
5. Removed the visible left sidebar that made the page read like stacked cards.
6. Removed the visible terminal rail and disabled order-ticket furniture.
7. Promoted volume/exchange context above the chart as four open columns: price, liquidity, exchange, funding.
8. Made the chart full-width and visually dominant, with controls kept as compact tabs/pills.
9. Converted lower panels from bordered card grids into open sections and row-like stats.
10. Kept all asset tabs functional while reducing line/box clutter in both themes.

## Screenshots
- Before light: `design/screenshots/asset-before-light.png`
- Before dark: `design/screenshots/asset-before-dark.png`
- After light: `design/screenshots/asset-after-light.png`
- After dark: `design/screenshots/asset-after-dark.png`

## Validation
- Sanity: `node --check bslab/static/app/screens/symbol.js` - PASS
- Sanity: `.venv/bin/python -m py_compile web_app.py scripts/ui_smoke.py scripts/click_audit.py scripts/deep_audit.py` - PASS
- Tests: `.venv/bin/python -m pytest -q` - PASS, 59 passed
- Render: focused Chrome render probe on `/symbol/BTCUSDT?tab=overview` - PASS; chart SVG, 8 tabs, 8 hero stats, 4 context rows, no visible side rail/terminal ticket.
- UI smoke: `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8815` - PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.
- Asset tabs: focused Chrome tab probe on `/symbol/ETHUSDT?tab=overview` - PASS, 9/9.

## Note
- Full repo `deep_audit.py` was attempted but not used as a gate here because it aborts later in the Funding route at `scripts/deep_audit.py:297` on an undefined ETH chip click. The focused asset-tab probe covers the Sprint 2 asset requirement.
