# PAGE
Header / nav / category overlay rescue.

# WHAT WAS BROKEN
- Persistent nav led with product pages: Market, Radar, Heatmap, Bubbles, Funding, Movers.
- Category overlay mixed market families, analysis tools, settings and data health under one oversized "Categories" title.
- Active state tracked app route, not market family, so Global/Indices/Crypto/Forex context was not reflected in the header.
- Header category clicks did not drive the existing atlas tape/chart category.
- Overlay styling leaned glossy and oversized; dark mode reduced legibility.

# CHANGES
1. Replaced the visible nav with the bible order: Global, Indices, US stocks, World stocks, Crypto, Futures, Forex, Gov bonds, Corp bonds, ETFs, Economy.
2. Moved Radar, Heatmap, Bubbles, Funding, Movers, news, data health and settings into the category overlay as secondary analysis tools.
3. Added category-aware active state from `?sec=` and route aliases, including Crypto active on crypto tool pages.
4. Added a header-side sync bridge that clicks the existing atlas taxonomy button after category navigation, so the active tape/chart follows the selected section.
5. Restyled the overlay into a 95%+ opaque, four-column, hairline directory with thin type, subtitles, and no glossy panels.
6. Replaced pill-like nav feedback with a thin active tape/underline and removed nav icons from the persistent rail.
7. Fixed the 1280px header layout so the full Global-to-Economy rail is visible without clipping.

# REFERENCES USED
- [TradingView Markets](https://www.tradingview.com/markets/) - borrowed the persistent market-family structure and expectation that the selected family controls the chart/tape context.
- [Binance Markets](https://www.binance.com/en/markets/overview) - borrowed the dense category grouping pattern: primary categories first, specialized tools/zones second.
- [Coinbase Explore](https://www.coinbase.com/explore) - borrowed the legible, solid, table-like clarity for market navigation and header dropdown content.

# FILES TOUCHED
- `bslab/static/app/ui/header.js`
- `bslab/static/app/app.css` under `/* ===== PAGE RESCUE: nav ===== */`
- `design/reports/nav.md`
- `design/screenshots/nav-before-light.png`
- `design/screenshots/nav-before-dark.png`
- `design/screenshots/nav-after-light.png`
- `design/screenshots/nav-after-dark.png`

# GATES RUN + results
- Web reference check: PASS - official TradingView, Binance and Coinbase reference pages inspected.
- Sanity: PASS - `node --check bslab/static/app/ui/header.js`
- Sanity: PASS - `node --check bslab/static/app/ui/menu.js`
- Sanity: PASS - `.venv/bin/python -m compileall web_app.py bslab scripts`
- Render: PASS - browser on `http://127.0.0.1:8808/?sec=forex`, menu open, light/dark screenshots saved; active nav `forex`, active atlas category `forex`, tape shows FX pairs.
- UI smoke: PASS - `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8808`

# SCREENSHOTS
- Before light: `design/screenshots/nav-before-light.png`
- Before dark: `design/screenshots/nav-before-dark.png`
- After light: `design/screenshots/nav-after-light.png`
- After dark: `design/screenshots/nav-after-dark.png`
