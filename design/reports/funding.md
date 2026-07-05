# PAGE
Funding page rescue for `/funding`.

# WHAT WAS BROKEN
- Hero only reported positive/negative counts; it did not expose source freshness, tracked coverage, or whether the desk was live/stale.
- Funding and basis context was split across charts and row subtitles, so the page lacked an OI-style market-context scan.
- Distribution, basis scatter, history, and extremes read as isolated panels rather than grouped desk sections.
- History chart had no selected-symbol context beyond chips; current funding, signed basis, and score were not visible beside the chart.
- Ranked extremes rows were too thin: no rank, no score, and basis context was cramped.
- Dark mode inherited a global diagonal shine that made the baseline funding page feel too glossy.

# CHANGES
1. Added a funding hero metadata strip with public mark-stream source, tracked count, stale count, status, update age, and live LED.
2. Added an OI-style context band using real available fields: average funding, highest positive, deepest negative, basis pressure, opportunity max, and source state.
3. Grouped the page into clear sections: Context, Distribution and basis, Funding history, and Extremes.
4. Upgraded history with a selected-symbol stat strip: payer side, current funding, signed basis, score, and status.
5. Rebuilt extremes rows with ranks, token icon, funding value, signed basis, and opportunity score.
6. Added distribution footer labels and scatter quadrant labels so negative/positive funding and spot/perp-rich areas are easier to scan.
7. Added funding-only ticking value classes for changing live metrics.
8. Tightened funding-only CSS: reduced top dead air, restrained panel radius/shadows, removed funding-page diagonal dark shine.

# REFERENCES USED
1. CoinGlass funding pages — https://www.coinglass.com/FundingRate — borrowed the rate-extremes and funding-pressure framing.
2. Coinalyze futures stats — https://coinalyze.net/futures-data/ — borrowed the futures-stat context model around funding, OI, liquidations, and long/short; implemented with available signed basis/opportunity fields because no OI feed is in the allowed scope.
3. DeFiLlama board layout — https://defillama.com/yields — borrowed the dense board rhythm: compact metric cells above scan-first tables.

# FILES TOUCHED
- `bslab/static/app/screens/funding.js`
- `bslab/static/app/app.css` under `/* ===== PAGE RESCUE: funding ===== */`
- `design/reports/funding.md`

# GATES RUN + results
- Sanity: `node --check bslab/static/app/screens/funding.js` — PASS
- Render: headless Chrome capture on `http://127.0.0.1:8806/funding` for light/dark before and after — PASS, no boot/watchdog errors
- Smoke: `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8806` — PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`

# SCREENSHOTS
- Before light: `design/screenshots/funding-before-light.png`
- Before dark: `design/screenshots/funding-before-dark.png`
- After light: `design/screenshots/funding-after-light.png`
- After dark: `design/screenshots/funding-after-dark.png`
