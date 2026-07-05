# Sprint 2 Settings

## Scope
- Owned files: `bslab/static/app/ui/settings.js`; CSS added only under `/* ===== SPRINT2: settings ===== */` in `bslab/static/app/app.css`.
- Removed the password-manager-style settings IA from the active settings module.
- Built one compact side sheet with exactly six working controls: Theme, Density, Currency, Basis units, Motion, Default page.

## Visible Changes
1. Killed the old settings rail: no General / Appearance / Data / Security / Privacy / Developer / Labs menu in the active sheet.
2. Replaced the wide 742px settings app with a 424px side sheet.
3. Reduced the surface to six rows with no decorative panels, account/security/labs pages, recovery actions, or shortcuts.
4. Theme is now System / Light / Dark and writes both `themeMode` and the live document theme.
5. Density, currency, basis units, motion, and default page all write persisted settings directly.
6. Basis unit changes force a local view rerender from the settings module so visible basis labels can update without touching screens or shared state.
7. Dark mode uses one quiet sheet surface and row rhythm instead of a wall of boxed panels.

## Screenshots
- Before light: `design/screenshots/s2-settings-before-light.png`
- Before dark: `design/screenshots/s2-settings-before-dark.png`
- After light: `design/screenshots/s2-settings-after-light.png`
- After dark: `design/screenshots/s2-settings-after-dark.png`

Note: the after screenshots are component renders of the real `ui/settings.js` module loaded from the live `:8814` server. Full-app after capture is blocked by a parser error in forbidden file `bslab/static/app/screens/symbol.js:203`.

## Verification
- PASS: `node --check bslab/static/app/ui/settings.js`
- PASS: `.venv/bin/python scripts/web_debug.py --db data/binance_signal_lab.sqlite`
- PASS: settings component render on `http://127.0.0.1:8814`:
  - rows: Theme, Density, Currency, Basis units, Motion, Default page
  - old category buttons: 0
  - sheet width: 424px
- PASS: component interaction check:
  - `themeMode=dark`
  - `density=compact`
  - `currency=EUR`
  - `basisUnit=pct`
  - `motion=reduced`
  - `defaultPage=radar`
- FAIL: `.venv/bin/python scripts/ui_smoke.py --base http://127.0.0.1:8814`
  - all six paths hit the boot-failure panel before settings load
  - Chrome console: `Uncaught SyntaxError: Unexpected token ')'` from `http://127.0.0.1:8814/static/app/screens/symbol.js (203)`
  - `screens/*` is forbidden for this sprint, so I did not fix it here.

## References
- TradingView Supercharts settings: gear access and contextual chart settings informed the compact, task-scoped control surface. https://www.tradingview.com/support/solutions/43000748166-how-to-configure-your-supercharts/
- Coinbase display settings: direct Settings -> Display -> Appearance path and System/Light/Dark theme choices informed the theme row. https://help.coinbase.com/en/coinbase/other-topics/troubleshooting-and-tips/display-settings
- macOS System Settings: native settings are organized as rows of options; used only for craft/rhythm, not copied as a category sidebar. https://support.apple.com/guide/mac-help/change-system-settings-mh15217/mac
