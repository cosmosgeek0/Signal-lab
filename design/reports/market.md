# PAGE
Market front page.

# WHAT WAS BROKEN
- Global insight grid collapsed into five useful cards plus a large empty dead area when Yahoo quotes were limited.
- Quote notice read as a cramped status string and surfaced `unavailable` in the primary hero region.
- Insight cards repeated source/status twice: small source text plus bottom LIVE/STALE chips.
- News rail duplicated source counts, carried impact-code chip noise, and read as a long headline dump rather than a compact desk rail.
- Dark taxonomy bar was overly glossy and fought the data hierarchy.

# CHANGES
1. Filled the global insight grid to eight cards by adding honest chart-route fallback cards for US equities, rates, and dollar/gold when world quotes are limited.
2. Replaced the malformed quote warning with a compact, single-line market notice that keeps the limitation honest without a dead panel.
3. Removed repeated bottom source/status chips from normal insight cards; hard error/locked states are still allowed to surface.
4. Rebuilt the news rail summary around Fresh / Markets / Crypto counts and capped the front-page story list to a tighter desk view.
5. Removed rail impact-code spam and source coverage spam from the front-page rail; the expanded wire and data drawer still carry detail.
6. Added Market-scoped CSS for title/filter rhythm, sticky compact news rail, calmer dark taxonomy, and tighter global-card spacing.

# REFERENCES USED
1. TradingView Markets — borrowed category-led breadth and chart-first global market hierarchy. https://www.tradingview.com/markets/
2. Binance Markets — borrowed dense market buckets and compact quote/table facts without extra explanation chrome. https://www.binance.com/en/markets/overview
3. Coinbase Explore — borrowed compact market stats before filtered asset lists and clean stat/table ordering. https://www.coinbase.com/explore

# FILES TOUCHED
- `bslab/static/app/screens/market.js`
- `bslab/static/app/app.css`
- `design/reports/market.md`

# GATES RUN + results
- `node --check bslab/static/app/screens/market.js` — PASS.
- `.venv/bin/python -m py_compile web_app.py` — PASS.
- Browser render check on `http://127.0.0.1:8801/` — PASS: booted, 8 global insight cards, 0 exact dash values in primary insight cards, 11 news rows, 0 primary-grid ghost tiles, clean quote notice.
- `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8801` — PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.

# SCREENSHOTS
- Before light: `design/screenshots/market-before-light.png`
- Before dark: `design/screenshots/market-before-dark.png`
- After light: `design/screenshots/market-after-light.png`
- After dark: `design/screenshots/market-after-dark.png`
