# PAGE
Data-health drawer and floating health badge.

# WHAT WAS BROKEN
- The drawer needed too much scanning: gauge, issue cards, storage bar, telemetry tiles, activity dots, category tiles, source rows, collector rows and reports all competed in the first viewport.
- Repeated status chips made the same point several times instead of answering: sources up, degraded, or off.
- Individual adapter rows were useful but too loud for a drawer; source health should summarize first and expose raw JSON only as a diagnostic escape hatch.
- The badge tooltip repeated collector/cache details but did not give the source-map state at a glance.
- Dark mode amplified the old card stack and made the drawer feel heavier than a settings surface.

# CHANGES
1. Replaced the watchtower gauge and issue-card stack with one compact source-map summary showing Up / Degraded / Off counts and a thin composition bar.
2. Collapsed the 20 adapter entries into grouped source rows: Primary feeds, Local cache, Market context, News wires and Fallback adapters.
3. Added mixed-state group labels, so groups with both degraded and off adapters show an affected count instead of under-reporting one status.
4. Reduced collector/cache detail to four quiet rows: feed status, symbol freshness, last update, cache age/latency and row/refresh counts.
5. Cut report chrome down to three direct diagnostic links: Source map, Health JSON and Full snapshot.
6. Updated the floating badge to fetch source counts and show the same Up / Degraded / Off summary in its tooltip.
7. Added health-scoped CSS under `/* ===== PAGE RESCUE: health ===== */` for compact row rhythm, small status color, hairline grouping and light/dark parity.

# REFERENCES USED
1. Pyth Terminal feed cards - https://www.pyth.network/blog/the-pyth-terminal-front-door-to-the-data - borrowed the "see data first" source transparency: compact counts before raw feed details.
2. 1Password settings rows, taste log Entry #0 - `design/TASTE_LOG.md` - borrowed the row craft: colored square icon, one label, one quiet value, two text weights and crisp hairlines.
3. Kraken Pro status surfaces - https://status.kraken.com/ - borrowed explicit operational/degraded language and grouped service state instead of repeating individual warnings.

# FILES TOUCHED
- `bslab/static/app/ui/drawer.js`
- `bslab/static/app/ui/health.js`
- `bslab/static/app/app.css`
- `design/reports/health-drawer.md`

# GATES RUN + results
- `node --check bslab/static/app/ui/drawer.js` - PASS.
- `node --check bslab/static/app/ui/health.js` - PASS.
- `.venv/bin/python -m compileall -q web_app.py bslab scripts` - PASS.
- Headless Chrome render capture on `http://127.0.0.1:8803` - PASS; drawer opened in light and dark with five grouped rows and no boot errors.
- PNG render verification - PASS; all before/after images are valid 1440x1100 PNGs.
- `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8803` - PASS across `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.

# SCREENSHOTS
- Before light: `design/screenshots/health-drawer-before-light.png`
- Before dark: `design/screenshots/health-drawer-before-dark.png`
- After light: `design/screenshots/health-drawer-after-light.png`
- After dark: `design/screenshots/health-drawer-after-dark.png`
