# Sprint 2 Wave 2 Global CSS Polish

Date: 2026-07-05  
Server: http://127.0.0.1:8816  
Runtime implementation scope: `bslab/static/app/app.css` only

## Laws Applied

- NO-LINES LAW: removed broad card/panel hairlines and kept separators only where they clarify tabular rows or real status boundaries.
- NO-BOX-WALL LAW: flattened dark-mode surfaces so page structure is carried by spacing, typography, and active-state fill instead of stacked outlines.
- Funding baseline: kept the quieter funding-page rhythm as the target for other global surfaces.

## External References

- MDN, `prefers-color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme
- MDN, `color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Material Design, dark theme guidance: https://m2.material.io/design/color/dark-theme.html

## Visible Improvements

1. Removed the global dark diagonal shine/beam from the app canvas.
2. Flattened dark-mode page background to a quiet near-black canvas instead of glossy stacked gradients.
3. Removed broad default outlines from panels, workbenches, source strips, chips, and segmented controls.
4. Restyled inactive pills/buttons to rely on tonal fill and whitespace instead of border cages.
5. Kept active controls readable with stronger fill contrast, especially at 200 percent zoom.
6. Unboxed the asset profile hero; the BTC page no longer starts inside a giant framed panel.
7. Tightened asset-page type and price hierarchy so the first viewport reaches meaningful market data sooner.
8. Removed asset hero divider/hairline noise while preserving source and terminal affordances.
9. Flattened the heatmap workbench; it no longer reads as a nested framed control wall in dark mode.
10. Softened heatmap legend/source rows into bands with type hierarchy instead of outlined boxes.
11. Converted the movers timeframe control from a glossy segmented frame into quiet equal-width controls.
12. Reduced movers digest-card walling; at 200 percent zoom it now uses a two-column rhythm before collapsing on smaller widths.
13. Softened radar, market, funding, and bubbles shared surface chrome through global panel/chip overrides.
14. Preserved row separators in data tables where the design law explicitly allows row separation.

## Worst Pages - Before/After Evidence

### Asset Page: `/symbol/BTCUSDT?tab=overview`

- Light before: `design/screenshots/s2-wave2-before-symbol-light-200.png`
- Light after: `design/screenshots/s2-wave2-after-symbol-light-200.png`
- Dark before: `design/screenshots/s2-wave2-before-symbol-dark-200.png`
- Dark after: `design/screenshots/s2-wave2-after-symbol-dark-200.png`
- Result: removed the giant framed shell, dark beam, heavy source/button outlines, and price divider; the page now reads as an asset document instead of a boxed modal.

### Derivatives Heatmap: `/heatmap`

- Light before: `design/screenshots/s2-wave2-before-heatmap-light-200.png`
- Light after: `design/screenshots/s2-wave2-after-heatmap-light-200.png`
- Dark before: `design/screenshots/s2-wave2-before-heatmap-dark-200.png`
- Dark after: `design/screenshots/s2-wave2-after-heatmap-dark-200.png`
- Result: removed the framed workbench wall, glossy segmented controls, and dark-mode beam; active state now carries control hierarchy.

### Movers: `/movers`

- Light before: `design/screenshots/s2-wave2-before-movers-light-200.png`
- Light after: `design/screenshots/s2-wave2-after-movers-light-200.png`
- Dark before: `design/screenshots/s2-wave2-before-movers-dark-200.png`
- Dark after: `design/screenshots/s2-wave2-after-movers-dark-200.png`
- Result: removed the glossy window-control frame, reduced card border pressure, and improved 200 percent zoom density with a two-column digest layout.

## 200 Percent Zoom Sweep

Audit viewport: 720 x 600 CSS px, device scale factor 2.  
All primary routes rendered in both themes with no horizontal overflow.

| Page | Theme | Ready | Overflow X | Controls | Visible-border count |
| --- | --- | ---: | ---: | ---: | ---: |
| market | light | yes | 0 | 164 | 35 |
| market | dark | yes | 0 | 246 | 203 |
| radar | light | yes | 0 | 95 | 453 |
| radar | dark | yes | 0 | 95 | 490 |
| heatmap | light | yes | 0 | 45 | 11 |
| heatmap | dark | yes | 0 | 45 | 11 |
| bubbles | light | yes | 0 | 241 | 1143 |
| bubbles | dark | yes | 0 | 241 | 1146 |
| funding | light | yes | 0 | 31 | 20 |
| funding | dark | yes | 0 | 31 | 32 |
| movers | light | yes | 0 | 57 | 18 |
| movers | dark | yes | 0 | 57 | 18 |
| symbol | light | yes | 0 | 55 | 8 |
| symbol | dark | yes | 0 | 55 | 8 |

Notes:

- Heatmap, movers, funding, and symbol now have low visible-border counts after the global CSS pass.
- Radar and bubbles still report many border-bearing elements because those pages render many native rows/bubbles/tokens. This pass reduced shared chrome, but deeper page-specific cleanup would require files outside `app.css`.
- Market dark still reports many border-bearing elements because the current route renders a large sequence/news surface and many interactive market rows. Further reduction would require page-specific markup or JS audit alignment outside this wave.

## Gate Suite

- `python -m pytest -q`: PASS, 59 passed in 9.99s.
- `python scripts/ui_smoke.py --base http://127.0.0.1:8816`: PASS for `/`, `/radar`, `/heatmap`, `/bubbles`, `/funding`, `/movers`.
- `python scripts/click_audit.py --base http://127.0.0.1:8816`: FAIL, 32/61 checks passed.
- `python scripts/deep_audit.py --base http://127.0.0.1:8816`: FAIL before report generation with `TypeError: Cannot read properties of undefined (reading 'click')`.

Click-audit failures remaining:

- Missing legacy nav/category expectations: `/?sec=indices`, `/?sec=us-stocks`, crypto link behavior.
- Missing legacy market-card selectors: `card:mcap`, `card:vol`, `card:dom`, `card:dex`, `card:fng`, `card:stbl`, `card:tvl`, `card:uni`, `dominance-donut`, `dex-bars`, `major->asset`.
- Missing market table expectations: sector tabs, sortable price header, pinned filter, US stocks table, crypto table depth, and some row chart/view buttons.
- Heatmap click audit reported no heatmap cells in this run while the page itself rendered and smoke passed.
- Header audit still reports missing currency menu and UTC clock selectors.

Deep-audit failure remaining:

- The audit script exits inside its browser-side script with an undefined `.click()` call before it can return a report. This is not a CSS syntax/runtime failure, and fixing it would require changing the audit script or route behavior outside the allowed `app.css` scope.

## Scope Guard

- Runtime code changed: `bslab/static/app/app.css`.
- Evidence artifacts added/updated: `design/screenshots/s2-wave2-*.png`, this report.
- No JS, Python, template, or test files were edited for this Wave 2 CSS pass.
