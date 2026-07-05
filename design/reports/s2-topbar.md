# PAGE
Sprint 2 top bar / nav.

# WHAT WAS BROKEN
- The persistent header still showed the old 11-item market rail.
- The page also exposed a second 11-category nav strip, duplicating the IA.
- The header hairline and compressed 44px chrome made the top bar feel cramped.
- Currency existed in code but rendered as a hidden/blank control.
- Source selector and clock were still occupying top-bar space after IA v2 removed them.
- Market strip entries could fall back to dead `Chart` labels when no live value existed.

# CHANGES
1. Replaced the persistent nav with exactly `GLOBAL` and `CRYPTO`.
2. Added the requested `GLOBAL` popup rows: Indices, US stocks, World stocks, Futures & commodities, Crypto.
3. Added the requested `CRYPTO` popup rows: Prices, Basis radar, Heatmap, Bubbles, Funding, Movers.
4. Removed data source and clock from the top bar; kept data health, theme and preferences.
5. Restored a visible `USD` currency control.
6. Removed the header hairline and increased header/control spacing.
7. Hid the superseded 11-tab page category strip; top-bar menus now own this IA.
8. Pruned dead market strip entries by hiding rail chips whose value state is `Chart`, `unavailable`, blank or `-`.
9. Restyled dropdowns as clean opaque menus in light and dark.

# REFERENCES USED
- [TradingView Markets](https://www.tradingview.com/markets/) - followed the market-family grouping: indices, US stocks, world stocks, crypto, futures/commodities.
- [Binance Markets Overview](https://www.binance.com/en/markets/overview) - followed compact market header density, visible price lists and category grouping.
- [CoinGecko](https://www.coingecko.com/) - followed header utility placement for search, currency, theme and market stats.

# FILES TOUCHED
- `bslab/static/app/ui/header.js`
- `bslab/static/app/app.css` under `/* ===== SPRINT2: topbar ===== */`
- `design/reports/s2-topbar.md`
- `design/screenshots/s2-topbar-before-light.png`
- `design/screenshots/s2-topbar-before-dark.png`
- `design/screenshots/s2-topbar-after-light.png`
- `design/screenshots/s2-topbar-after-dark.png`

# GATES RUN + RESULTS
- Web reference check: PASS - TradingView, Binance and CoinGecko inspected before coding.
- Sanity: PASS - `node --check bslab/static/app/ui/header.js`
- Sanity: PASS - `node --check bslab/static/app/ui/menu.js`
- Sanity: PASS - `.venv/bin/python -m compileall web_app.py bslab scripts`
- Render: PASS - fresh Chrome on `http://127.0.0.1:8811/`; nav = `GLOBAL`, `CRYPTO`; Global and Crypto popup row lists exact; `USD` visible; header border `0px`; dead strip entries visible = `0`; no JS errors.
- UI smoke: PASS - `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8811`

# SCREENSHOTS
- Before light: `design/screenshots/s2-topbar-before-light.png`
- Before dark: `design/screenshots/s2-topbar-before-dark.png`
- After light: `design/screenshots/s2-topbar-after-light.png`
- After dark: `design/screenshots/s2-topbar-after-dark.png`
