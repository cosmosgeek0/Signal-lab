# CG Signal Lab — Design System

Original design. Visual inspirations, borrowed as *qualities* not assets:
**Coinbase** asset-detail pages and market tables, **Binance** exchange density and
text tabs, **Aave** smooth motion / shared mega-menu / soft data widgets, and
**TradingView** chart interaction. No proprietary assets, icons, or markup are
copied. The whole UI is a single no-build document rendered by Starlette
(`bslab/web_static.py`); charts use Apache ECharts, icons are CC0.

## Principles
- **Light-first.** The default theme is clean near-white (Binance/Figma), dark is the alternate. `:root` **is** the light theme; `[data-theme="dark"]` overrides.
- **Surfaces, not boxes.** Separation comes from spacing, typography, and hairline dividers -- not from wrapping every element in a bordered card. Metrics are a divided text strip; tabs are underline text tabs; buttons are text + hover background (only primary actions get a filled color).
- **Not everything is a card. Cards are not the default primitive.** Use planes, dividers, rows, sheets, drawers, overlays, popovers, and motion. Debug surfaces are hidden by default.
- **Minimal does not mean static.** The product must feel alive — data-driven motion, a moving tape, animated metrics, and a live activity feed — without ever becoming a toy.
- **Data first.** Muted chrome, colour reserved for meaning (up/down/basis/funding).
- **Last-good over blank.** Never blank data or show a red error wall; degrade calmly.
- **Public terminal, not broker UI.** No trading language, no order-entry affordances, no account state, no private APIs.

## Surface taxonomy
- **Page plane:** white page background and content surface. No outer frame.
- **Workspace plane:** primary table/chart area with a section title, one hairline divider, and data rows.
- **Metric strip:** inline groups separated by vertical hairlines, not KPI tiles.
- **Ticker strip:** inline market instruments with dividers and hover popovers, not ticker cards.
- **Right rail:** continuous list rail with row separators, not stacked cards.
- **Sheet/drawer/overlay:** settings, help, command search, and dropdowns may float with soft shadow and hairline border.
- **Rows:** tables, watchlists, leaderboards, recent symbols, and timelines are row systems.
- **Heatmap tiles:** allowed because heatmaps are inherently tiled; the rest of the app must not inherit tile/card grammar.

## Color tokens
CSS variables on `:root` / `[data-theme="light"]` (light, the default) and `[data-theme="dark"]`.

| token | light (default) | dark | use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0b0e11` | page background |
| `--bg-gutter` | `#f5f5f5` | `#0e1217` | optional page gutter / secondary background |
| `--surface` | `#ffffff` | `#0b0e11` | main content surface |
| `--surface-soft` | `#fafafa` | `#11161d` | subtle header row / overlay field |
| `--hairline` | `#eaecef` | `#1e2329` | primary dividers |
| `--hairline-soft` | `#f1f2f4` | `#161a1f` | faint row dividers |
| `--text` | `#1e2329` | `#eaecef` | primary text |
| `--muted` | `#707a8a` | `#848e9c` | labels, secondary |
| `--accent` (yellow) | `#f0b90b` | `#f0b90b` | brand, LIVE dot, tab underline, selection |
| `--green` | `#0ecb81` | `#0ecb81` | up / positive basis |
| `--red` | `#f6465d` | `#f6465d` | down / negative |
| `--aave-purple` | `#8d7dff` | `#a99bff` | mega-menu icons, basis-curve widget accent |
| `--soft-purple` | `#f3f0ff` | `#1a1730` | mega-menu icon badge background |
| `--hover` | `#f7f8fa` | `#171d26` | row / button hover |
| `--shadow` | `0 1px 2px rgba(24,26,32,.05)` | `0 1px 2px rgba(0,0,0,.4)` | very light only |

Rules: borders are hairline and nearly invisible (`--hairline`); never use fully-saturated fills for large surfaces; status text stays flat with a small dot; chips/badges use a `color-mix(... 10-16%)` tint of the semantic color with matching text; light shadows only, never heavy drop shadows or gray-on-gray panels.

## Typography
- System stack: `-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, ...`.
- Base `13px`. Labels `10–11px` uppercase `letter-spacing .06em`. Titles `15px/700`.
- **Tabular numerals everywhere** (`font-variant-numeric: tabular-nums`).
- No font-weight above 700; no oversized headline numbers.
- Prices use adaptive precision (BTC 2dp → micro-caps 8dp). Basis in bps or % (toggle).

## Spacing & shape
- Grid gutter `16–18px` for workspace columns; table/list rows use `7–8px`.
- Ordinary content sections are **unframed**. They get a title row, whitespace, and
  at most one hairline divider.
- Repeated rows use thin separators, not cards. Detail statistic groups use
  table-like grid dividers so they read as data, not boxed tiles.
- Radius is small (`4–6px`) and used only for controls, popovers, drawers, dialogs,
  token badges, and heatmap tiles. Avoid pill shapes except where the platform
  convention demands it.
- Shadows are for overlays only: dropdowns, command palette, help modal, settings
  drawer. Page sections and table containers do not cast shadows.

## Tables
- `12px`, tabular numbers, right-aligned numerics, left-aligned symbol.
- Sticky header, uppercase `10px` muted labels, sortable (click to toggle dir).
- Row hover: `--hover`. Selected row: subtle yellow tint + 2px accent bar.
- Density: **comfortable** (7–8px rows) / **compact** (4px rows) toggle.
- Number-only color flash on change (green up / red down); never flash the row/box.
- Pagination: page numbers + page size (25/50/100/200).
- Market rows use separate columns for favorite, token icon, symbol, prices, basis,
  funding, age, score, status, and actions. Actions are icon buttons: copy and open.

## Buttons / chips / tabs
- Buttons: transparent text/icon controls with hover background; primary actions
  are the only filled controls. Do not give every button a border.
- Segmented control (`.seg`): quiet gray background, active segment =
  `color-mix(--accent 16%)`.
- Filter chips: compact text controls, radius `5px`, no border. Active = accent tint.
- Tabs / nav items: text tabs with underline only. The main tab bar hides decorative
  icons/numbers so it reads like a product navigation strip.
- Header nav items are compact text buttons with hover/focus dropdowns. Dropdown
  actions route to a tab, apply a filter, scroll to watchlist/methodology, or open
  the debug drawer. They never fetch data until their target tab becomes active.

## Token badges / icons
- Real CC0 coin icons (`spothq/cryptocurrency-icons`) served from `/static/icons/<base>.svg`.
- Symbol → base by stripping `USDT/USDC/BUSD/FDUSD`. If an icon exists, render a
  circular `<img>`; otherwise a **generated monogram** (first 2–3 letters, neutral
  soft-surface circle, muted text). No emojis.

## Charts
- Apache ECharts, transparent background, muted axis/grid, tabular tooltip.
- `dataZoom` (pan/zoom) on symbol charts; series: green (spot→perp / up), magenta
  (perp→spot), accent (funding). Charts lazy-load only when the Symbol tab is active.
- CDN failure degrades to tables/sparklines (guarded by `window.echarts`). Inline
  SVG sparklines need no library.
- Hidden tabs do not render charts. Funding and symbol charts are guarded by active
  tab checks; all other market panels render from cached rows and inline SVG only.

## Symbol Workspace
- Deep links: `/symbol/BTCUSDT` and `?symbol=BTCUSDT&tab=detail`.
- No giant raw dropdown. Symbols change through global search, ticker strip, radar
  row, watchlist, heatmap tile, or leaderboard row.
- Detail tabs: **Overview**, **Basis**, **Price**, **Funding**, **Spread**, **Quality**.
- Time windows: `5m`, `15m`, `1h`, `4h`, `24h`, `All`; `All` is still bounded to
  the most recent 5000 indexed rows.
- The left rail shows icon/title, search/copy/favorite actions, current stat cells,
  and recent extremes. The right side owns the chart plus latest-row context.

## Right rail
- The right rail is a continuous sidebar/list, not a stack of cards.
- Sections: watchlist, selected symbol, recently selected, strongest basis.
- Rows use icon, symbol, basis, funding, sparkline, and small status text/badge.
- Favorites and recent symbols persist in `localStorage`.

## Drawers / popovers
- Header dropdowns, ticker hover previews, command palette, help, and settings are the only framed floating surfaces.
- Floating surfaces use soft shadow, one hairline border, small radius, and Esc close behavior where appropriate.
- Tooltips are crisp, short, and available on hover/focus for bps, basis direction, funding, spread, age, score, LIVE/STALE, UTC, symbol count, cache ms, and API ms.

## Heatmap
- Original mosaic implementation. Tile size scales with current abs-basis/funding
  rank and color intensity follows selected mode.
- Controls: basis/funding/score color mode, 25/50/100 bps threshold, sort by abs basis,
  funding, score, or age. Clicking a tile opens the symbol workspace.

## Rendering discipline — no flicker (Sprint 4)
**A poll must never rebuild the DOM it is not changing.** This is a hard rule, not a
preference — full `innerHTML` rebuilds on every poll are what made the app flicker.

- **Radar table = keyed reconciliation.** Rows are keyed by symbol and kept as stable
  `<tr>` nodes (`tbody._nodes` Map). Each poll: reuse the node, update only the cells
  whose formatted value changed (`td._raw` cache), flash only the price cells that
  moved (green up / red down, once), and update semantic classes in place. New symbols
  build a node; departed symbols are removed. Rows never blank, icons never re-request.
- **Rank change = movement, not blink.** When sort/rank reorders the set, nodes are
  *moved* with `insertBefore` and glide to their new position via a FLIP transform
  (`.34s`) — Bitcoin sliding below Ethereum, not the whole list repainting.
- **Row reveal stagger** runs *only* when the result set changes (sort/filter/page/
  search), never on a steady poll; the `reveal` class is removed afterward so its
  fill-mode can't fight FLIP.
- **Everything else is change-gated.** `setHTMLIfChanged(el, html)` skips the DOM when
  the rendered string is identical; the activity feed rebuilds only when its event set
  changes (id signature), never to tick a timestamp. Widgets, tape, metric values, and
  spotlight update in place. Event handlers are bound once at build, not re-queried
  each poll.
- Verify with a `MutationObserver`: during steady polling, **zero `<tr>` are added or
  removed** (moves excepted); only cell text/class mutates.

## Typography hierarchy (Sprint 4)
Type scale in tokens: `--fs-hero 22 / --fs-title 15 / --fs-value 15 / --fs-body 12.5 /
--fs-label 11 / --fs-micro 10`. Three text weights: `--fw-med 500`, `--fw-semi 600`,
`--fw-bold 700`. **Not everything is gray.** `--text-strong (#0b0e11)` anchors the
product name, header nav, section titles, symbols, and headline values; `--text` for
table body; `--muted (#707a8a)` for labels only; colored deltas (green/red/basis)
reserved for financial meaning. Header icons are near-black and sharp, not faint dust.

## Token badges — never empty
Missing/broken icon files fall back to a **deterministic colored monogram** (hue hashed
from the symbol base), 2–4 crisp uppercase letters (QNT, DASH, NFP), high-contrast text
on a soft tinted disc. Real CC0 icons `<img onerror>` swap to the monogram if the file
404s. No empty circles, no gray holes, no emoji.

## Default screen organization (Sprint 4)
The homepage is a calm command center, not a data dump. Removed from the top: the
6-instrument ticker strip and the 13-block equal-metric statbar (both redundant with
the widgets + health popovers). Kept, in order: one slim header → slim live tape →
four compact market-health widgets → tabs → **What matters now** spotlight with the
reason → radar table → right rail (Market Activity, Watchlist, Selected Symbol).
The old lower always-on leaderboards are not part of the default Radar page; basis
leaders live in the table/right rail, funding extremes live in Funding, and raw cache
health/timeline lives in Data Quality. Detailed data health lives in the header health
popover, network-badge popover, and Data Quality, not scattered across the page.
Activity is deduped and rate-limited (no repeated cache-refresh or leader spam).

## Interaction / motion
**Minimal does not mean static.** The terminal must feel alive. **Motion must be
data-driven and purposeful** — it exists to show that data changed, to guide the
eye between states, and to make navigation feel physical. It is never decoration
for its own sake, never childish, and never blocks reading the numbers.

Principles: short, smooth, interruptible, and fully reducible under
`prefers-reduced-motion`. Motion is preferably CSS transition/animation driven; JS
is used only for value tweening (count-up), positioning the gliding underline/menu,
and the rolling data buffers behind the visual widgets — never a heavy per-tick DOM
rebuild.

Motion budget:
- Dropdown / mega-menu open-close: `140–220ms`.
- Drawer / sheet: `180–260ms`.
- Number flash: `500–900ms`; count-up tween ≈ `520ms`.
- Chart draw-on-load: `500–900ms` (ECharts default series animation).
- Hover transitions: `120–180ms`.
- The only continuous animations are the slim status pulse and the market tape
  marquee (both paused/disabled under reduced motion). No animation re-renders the
  whole table on every tick — only changed cells flash.

- Hover states subtle; focus rings visible (`box-shadow` accent).
- Keyboard: `/` search, `?` help, `Esc` close, `1–8` tabs, `D` theme.
- Command/search overlay supports typeahead, arrow keys, enter, mouse selection,
  and escape. Settings persist to `localStorage`.

### Reduced motion
- A global `@media (prefers-reduced-motion: reduce)` block collapses all
  animation/transition durations to ~0, stops the tape marquee (falls back to a
  scrollable strip), and stops the status/live pulse dots.
- JS honours it too: `animateInt()` and the headline swap skip the tween and set
  the final value immediately when reduced motion is requested.

### Shared mega-menu (Aave-style)
- Markets / Basis / Funding / Research open **one shared floating surface**
  (`#megaMenu`) that glides horizontally and cross-fades its content as the pointer
  moves between nav items — not a separate jumpy box per item.
- The surface is reparented onto `<body>` and positioned `fixed` from the nav
  item's viewport rect, so the header's `backdrop-filter` cannot trap its stacking
  or containing block. It clamps to the viewport, stays open while the pointer moves
  between nav and menu, and closes on outside click, `Esc`, or scroll.
- White surface, soft shadow, one hairline, `14px` radius, calm purple icon badges,
  short descriptions. No giant bordered child cards.

### Live market tape + rotating headline
- A slim tape under the ticker scrolls real phrases built from the current snapshot
  (symbol count, live/stale, cache/api ms, basis leaders, funding extremes, p95).
  It pauses on hover and each item is clickable to open that symbol.
- A rotating headline (`Scanning N Binance public spot/perp streams`, `Basis leader
  X at Y bps`, …) cross-fades every ~4.5s from real state. No hype, no trade calls.

### Animated numbers (metric strip)
- The metric strip updates **in place** (stable keyed nodes), not by re-writing
  `innerHTML` each poll. Integer counts (symbols/live/stale) count up with an eased
  tween; every value flashes green/red on change. Never flash the whole strip/box.

### Live activity feed
- The right rail carries a **Market Activity** feed generated purely on the client
  by diffing successive snapshots: new basis leader, session basis high, funding
  extreme, stale↔fresh transitions, cache-health changes, plus user actions
  (opened symbol, pinned favorite). Capped at 20; the newest row slides/fades in;
  rows are clickable. No extra backend scan — it reads the data already polled.

### Micro-visual widgets (Aave-style)
- 2–4 soft, near-borderless data widgets sit under the metric strip: a **Freshness
  ring** (live %), a **Basis-spread distribution curve** with a median marker, a
  **Funding-balance** diverging bar (pos vs neg), and a **Network pulse** heartbeat
  (rolling cache latency). They are SVG, driven by real polled state, and animate
  via CSS transitions on stroke-dashoffset / geometry. They never crowd the radar
  table and add no network calls.

### Gliding tab underline
- The workspace tab bar uses a single accent underline element that translates and
  resizes under the active tab (`.24s`), instead of toggling a static border.

### Network-health badge (wifi)
- A floating bottom-right pill with animated 4-bar signal strength graded from real
  latency + cache health (good/mid/bad → green/yellow/red), a live `Xms` readout,
  a hover popover (latency, cache, snapshot age, live/total, refresh/fail counts),
  and click-through to Data Quality. The top bar pulses only when healthy; silent
  under reduced motion.

### Market spotlight hero
- Top of the Radar tab: the strongest current basis dislocation, featured with a
  big flashing live price, abs-basis, inline Spot→Perp/Funding/Spread/Age stats,
  and a wide gradient area chart. Re-picks at most every ~6s; glows briefly on a new
  session basis high; click/Enter opens the full symbol page.

### Micro price format
- Sub-penny prices use Coinbase/Uniswap-style subscript zeros (`0.00000042` →
  `0.0₆42`); grouped/large numbers are untouched. Ticker sparklines use a soft
  gradient area fill (Coinbase/Pyth).

### Market-mood chip
- A small chip in the tape (`CALM / STEADY / ACTIVE`) that color-shifts from basis
  breadth + funding extremes.

### Symbol charts — TradingView-style tools
- Chart toolbar: Line/Area, MA off/SMA/EMA overlay on the primary series
  (client-side, 9-period), linear/log axis (log only when the series is strictly
  positive), and a fullscreen modal (button or `F`, `Esc` to close) that re-uses the
  same option builder. Crosshair axis-pointer with axis labels; dataZoom pan/zoom.
  Everything still guarded by `window.echarts`.

### Top-of-book / basis ladder (Backpack-style)
- Symbol Detail shows a spot band (bid→ask, green) and perp band (purple) on a
  shared price scale with animated mid ticks, making the basis gap visible directly
  from top-of-book. Honest about data: it uses best bid/ask only (no fake depth).

### "How basis works" flow (Base-style)
- Methodology has a soft 3-node flow (Spot book → Basis engine → Perp book) with
  animated dashed connectors — a diagram surface, not a card farm.

### More live motion
- Radar rows stagger-reveal only when the set changes (sort/filter/page/search),
  never on every poll; sorted header briefly bumps; the spotlight glows on new highs.

All of the above derive from the existing `/api/state-lite` poll (or the already
lazy-loaded detail history) — no new endpoints, fetches, or hidden polling.

## Status / empty states
- Header pill shows only **LIVE / STALE / SYNCING** (never a scary API RETRY wall).
- Failures go to a collapsible debug drawer; last-good data stays on screen.
- Skeleton shimmer only on true first load (no cached bootstrap yet).
- Empty states explain the warming state in one sentence and keep their footprint.

## Light/dark
- Toggle persists in `localStorage`; `system` option follows `prefers-color-scheme`.
- Light theme is near-white with clean gray borders, no bluish tint, minimal shadow.

## Banned patterns
- Do not render `metric-card`, `stat-card`, `kpi-card`, `ticker-card`, `dashboard-card`, `panel-card`, or `card-grid` as primary layout.
- Do not use boxed tab buttons, visible terminal/debug consoles, equal metric tile grids, or giant native symbol dropdowns.
- Do not show DB paths or debug dumps in the default product surface.
- Do not “fix” the UI by making borders transparent while keeping the same card farm. Flatten the structure first.
- Do not ship a flat, static white page with no life — but do not overcorrect into neon, childish effects, or infinite heavy animation either.
- Do not add motion that re-renders the whole table (or metric strip) every tick; update in place and flash only what changed.
- Do not add new hidden polling, browser-side FX calls, or per-widget fetches. The tape, headline, activity feed, and micro-widgets all derive from the existing `/api/state-lite` poll.
