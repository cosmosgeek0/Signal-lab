# PAGE
Sprint 2 search modal.

# WHAT WAS BROKEN
- The command surface opened as a navigation palette first, not a market search modal.
- Categories were hidden in a dropdown and did not match the sprint order.
- Empty-state/default results did not show price-bearing market rows.
- Stocks and indices were not searchable from the modal even though the app already had public market data.
- Recent searches were not persisted or visible as a first-class search state.
- The visual treatment inherited older glossy command styles and sat too high on the viewport.

# CHANGES
1. Rebuilt `ui/command.js` around a centered TradingView-style search dialog with a search-first header.
2. Added visible category tabs: All, Crypto, Stocks, Indices, Pages.
3. Added live crypto results from `/api/search`, showing logos, symbols, prices and basis/source metadata.
4. Added stock and index result hydration from `/api/market-overview`, using Yahoo/CoinGecko-backed rows already available to the app.
5. Added persistent recent searches; selecting a result stores it and the next open shows a Recent section.
6. Added page shortcuts for Global, Indices, Crypto, US stocks, World stocks, Radar, Heatmap, Bubbles, Funding, Movers, Data health, Preferences and theme.
7. Added keyboard behavior for arrow selection, enter activation, escape close and Alt+1..5 category switching.
8. Added the sprint CSS block to center the modal, tighten row rhythm, expose tabs, reduce box/gloss weight and keep dark mode legible.

# REFERENCES USED
- [TradingView Symbol Search](https://www.tradingview.com/support/solutions/43000746682-tradingview-symbol-search-tips-for-finding-assets/) - borrowed Cmd/Ctrl-K search entry, symbol-first behavior and multi-market narrowing.
- [Binance search experience](https://www.binance.com/en/blog/ecosystem/421499824684903967) - borrowed broader search results, filters/categories and trending/result discovery pattern.
- [CoinGecko trending search](https://docs.coingecko.com/reference/trending-search) - borrowed the idea that search should mix coins, categories and discovery-style result groups.

# FILES TOUCHED
- `bslab/static/app/ui/command.js`
- `bslab/static/app/app.css` under `/* ===== SPRINT2: search ===== */`
- `design/reports/s2-search.md`
- `design/screenshots/s2-search-before-light.png`
- `design/screenshots/s2-search-before-dark.png`
- `design/screenshots/s2-search-after-light.png`
- `design/screenshots/s2-search-after-dark.png`

# GATES RUN + results
- Web reference check: PASS - TradingView, Binance and CoinGecko search references inspected.
- Sanity: PASS - `node --check bslab/static/app/ui/command.js`
- Render: PASS - Chrome CDP on `http://127.0.0.1:8813`, modal open in light/dark, 5 tabs present, recent search visible, price-bearing rows visible, no page-side JS errors.
- Render tab probe: PASS - Stocks, Indices, Pages and Crypto tabs each rendered rows; Stocks/Indices rows carried live source prices where available.
- UI smoke: PASS - `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8813`
- Note: first `ui_smoke` attempt hit transient third-party TradingView widget CSS chunk console noise on `/`; immediate rerun passed all routes.

# SCREENSHOTS
- Before light: `design/screenshots/s2-search-before-light.png`
- Before dark: `design/screenshots/s2-search-before-dark.png`
- After light: `design/screenshots/s2-search-after-light.png`
- After dark: `design/screenshots/s2-search-after-dark.png`
