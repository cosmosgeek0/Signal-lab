# PAGE
Radar

# WHAT WAS BROKEN
- Hero and source copy framed the page around Binance/local overlap instead of exchange-neutral microstructure.
- Stale cache state read as broken coverage, including tracked/live count patterns that looked like failure rather than source freshness.
- Signals were basis-only and did not expose funding skew, book friction, venue coverage, or cache health as first-class microstructure.
- Large glossy panels and dark-mode shine made Radar diverge from the cleaner Funding baseline.
- The screener table lacked venue context and still used generic spot/perp labels instead of a granular microstructure column set.

# CHANGES
1. Renamed the page to "Microstructure Radar" and rewrote the subtitle around spot/perp markets, freshness, and cache state without Binance-led copy.
2. Replaced the long coverage sentence with compact source chips: Universe, Freshness, Venue coverage, and Integrity.
3. Reworked stat tiles so stale data shows "96 markets" and "snapshot stale" instead of a broken "0 of N tracked" state.
4. Rebuilt the top content into Funding-style grouped sections: Microstructure leaders plus Market pulse.
5. Added leader groups for basis outliers, funding skew, book friction, and 15m basis movement.
6. Added market-pulse cards for basis bands, funding split, book friction, and freshness using existing live/cache fields.
7. Added a Venues column and clearer screener labels for spot mid, perp mid, basis, funding, friction, age, score, and status.
8. Added compact empty/footer language for no-fresh-row states and flattened Radar-only CSS under the required rescue marker.

# REFERENCES USED
- [Coinalyze](https://coinalyze.net/) — borrowed the microstructure metric mix: basis, funding, spread/futures context, and compact market rows.
- [CoinGlass](https://www.coinglass.com/) — borrowed the derivatives-workbench grouping: funding, open-interest/liquidation-style health, and dense status chips.
- [TradingView Crypto Pairs Screener](https://www.tradingview.com/crypto-screener/) — borrowed the screener rhythm: filters, sortable metric chips, exchange/pair context, and dense row hierarchy.

# FILES TOUCHED
- `bslab/static/app/screens/radar.js`
- `bslab/static/app/app.css`
- `design/reports/radar.md`

# GATES RUN + results
- `node --check bslab/static/app/screens/radar.js` — PASS
- Shimmed ES-module import sanity for `bslab/static/app/screens/radar.js` — PASS (`radar import ok`)
- Browser render check on `http://127.0.0.1:8802/radar` — PASS: 4 source chips, 4 pulse cards, 4 leader boards, 25 rows, no Radar-page Binance copy, no broken tracked-count pattern, no console errors.
- `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8802` — PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.

# SCREENSHOTS
- Before light: `design/screenshots/radar-before-light.png`
- Before dark: `design/screenshots/radar-before-dark.png`
- After light: `design/screenshots/radar-after-light.png`
- After dark: `design/screenshots/radar-after-dark.png`
