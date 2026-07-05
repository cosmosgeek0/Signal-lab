# PAGE
Bubbles - scoped rescue on `http://127.0.0.1:8805/bubbles?asset=crypto&window=24h&limit=100`.

# WHAT WAS BROKEN
- Bubble color read as toy neon green/red instead of finance heatmap signal.
- Labels were heavy and glow-heavy, especially in dark mode and at zoomed scale.
- The page had no explicit legend explaining size, color, source support, or breadth.
- Hover did not expose a finance-grade detail card with price, market cap, volume, and source status.
- Physics felt like a positioned bubble grid with tiny drift rather than a live field with mass, collision, and inertia.
- Side rail over-indexed on generic status copy instead of market readout.

# CHANGES
1. Replaced neon bubble accents with muted up/down/flat tones and magnitude-driven intensity.
2. Reworked bubble skin with thinner rims, lower gloss, quieter shadows, and lighter symbol/change typography.
3. Added a visible legend: up/down/flat counts, size equals move, and source-backed coverage.
4. Added hover/focus detail card with logo, symbol, window, move, sparkline, price, market cap, volume, and source status.
5. Retuned physics: mass-aware collision settling, stronger but damped inertia, boundary bounce, and drag throw velocity.
6. Rebuilt side rail into live breadth, scale explanation, and leaders instead of repeated generic status.
7. Added responsive wrapping and text constraints for zoomed/smaller viewports.

# REFERENCES USED
1. Crypto Bubbles - https://cryptobubbles.net/en - borrowed the live, physical, at-a-glance bubble-field interaction.
2. TradingView Crypto Heatmap - https://www.tradingview.com/heatmap/crypto/ - borrowed direction plus magnitude color logic.
3. Coinbase Explore - https://www.coinbase.com/explore - borrowed restrained market copy, compact stats, and table restraint.

# FILES TOUCHED
- `bslab/static/app/screens/bubbles.js`
- `bslab/static/app/app.css` under `/* ===== PAGE RESCUE: bubbles ===== */`
- `design/reports/bubbles.md`
- `design/screenshots/bubbles-before-light.png`
- `design/screenshots/bubbles-before-dark.png`
- `design/screenshots/bubbles-after-light.png`
- `design/screenshots/bubbles-after-dark.png`
- `design/screenshots/bubbles-after-hover-light.png`

# GATES RUN + RESULTS
- Sanity: `node --check bslab/static/app/screens/bubbles.js` - PASS.
- Render: fresh headless Chrome CDP on port 8805 - PASS; 100 bubbles rendered, legend present, dark theme rendered, hover card visible at 286x180 with price/market cap/volume/status content.
- UI smoke: `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8805` - PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.

# SCREENSHOTS
- Before light: `design/screenshots/bubbles-before-light.png`
- Before dark: `design/screenshots/bubbles-before-dark.png`
- After light: `design/screenshots/bubbles-after-light.png`
- After dark: `design/screenshots/bubbles-after-dark.png`
- Hover proof: `design/screenshots/bubbles-after-hover-light.png`
