# PAGE
Heatmap - derivatives/liquidations rescue.

# WHAT WAS BROKEN
- First paint rendered a wall of "waiting / live stream warming" symbol tiles before real data arrived.
- Liquidation mode showed fake-looking empty liquidation tiles when the server had no force-order events yet.
- Legend described direction only; it did not say what tile size represented versus what color represented.
- Source state was spread across noisy pills instead of one compact line.
- Dark mode made the old placeholder tiles and summary cards low-contrast and gray-heavy.

# CHANGES
1. Replaced warmup placeholder tiles with one compact source-warming line.
2. Added honest liquidation fallback logic: size = 24h USD-M quote volume, color = 24h move until real liquidation events arrive.
3. Added explicit Size / Color legend with a down-to-up color scale.
4. Consolidated derivative source state into one line: live count, key-required count, and stream detail.
5. Reworked liquidation summary cards around map sizing, map color, stream events, CoinGlass locked history, and top OI.
6. Reduced heatmap chrome and tightened spacing so the data grid is denser.
7. Fixed dark-mode heatmap colors and card contrast.
8. Fixed liquidation value formatting so short-dominant real liquidation rows do not read as "waiting".

# REFERENCES USED
- [TradingView Crypto Coins Heatmap](https://www.tradingview.com/heatmap/crypto/) - borrowed the core rule that area and color must carry separate market meanings.
- [CoinGlass Liquidation HeatMap](https://www.coinglass.com/pro/futures/LiquidationHeatMap) - borrowed the liquidation-specific context while keeping provider-gated history honest instead of faking backfill.
- [Binance Markets](https://www.binance.com/en/markets) - borrowed compact market-board scanning: clear categories, price/change emphasis, and dense readable cards.

# FILES TOUCHED
- bslab/static/app/screens/heatmap.js
- bslab/static/app/app.css, under `/* ===== PAGE RESCUE: heatmap ===== */`
- design/reports/heatmap.md

# GATES RUN + results
- `node --check bslab/static/app/screens/heatmap.js` - PASS
- Chrome render probe on `http://127.0.0.1:8804/heatmap?mode=treemap&metric=liquidation&window=4h` - PASS, 96 cells, 96 context cells, legend present, no warming tiles.
- `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8804` - PASS

# SCREENSHOTS
- Before light: design/screenshots/heatmap-before-light.png
- Before dark: design/screenshots/heatmap-before-dark.png
- After light: design/screenshots/heatmap-after-light.png
- After dark: design/screenshots/heatmap-after-dark.png
