from __future__ import annotations


INDEX_HTML = r"""
<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CG Signal Lab</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23f0b90b'/%3E%3Ctext x='32' y='39' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='22' font-weight='700' fill='%230b0e11'%3ECG%3C/text%3E%3C/svg%3E">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    /* Light-first: :root IS the light theme (clean white, Binance/Figma-style). */
    :root, [data-theme="light"] {
      color-scheme: light;
      --bg: #ffffff;
      --bg-gutter: #f5f5f5;
      --surface: #ffffff;
      --surface-soft: #fafafa;
      --hairline: #eaecef;
      --hairline-soft: #f1f2f4;
      --bg2: var(--bg-gutter);
      --panel: var(--surface);
      --panel2: var(--surface-soft);
      --panel3: var(--bg-gutter);
      --line: var(--hairline);
      --line-strong: #e0e3e7;
      --line2: rgba(240, 185, 11, .38);
      --text-strong: #0b0e11;
      --text: #1e2329;
      --muted: #707a8a;
      --dim: #aeb4bd;
      /* type scale */
      --fs-hero: 22px; --fs-title: 15px; --fs-value: 15px; --fs-body: 12.5px; --fs-label: 11px; --fs-micro: 10px;
      --fw-bold: 700; --fw-semi: 600; --fw-med: 500;
      --green: #0ecb81;
      --red: #f6465d;
      --yellow: #f0b90b;
      --orange: #bd7d06;
      --blue: #2f6fe0;
      --cyan: #2f92a6;
      --magenta: #7c53c4;
      --aave-purple: #8d7dff;
      --soft-purple: #f3f0ff;
      --accent: #f0b90b;
      --hover: #f7f8fa;
      --shadow: 0 1px 2px rgba(24,26,32,.05);
      --shadow-lg: 0 8px 24px rgba(24,26,32,.10);
      --radius: 8px;
    }
    [data-theme="dark"] {
      color-scheme: dark;
      --bg: #0b0e11;
      --bg-gutter: #0e1217;
      --surface: #0b0e11;
      --surface-soft: #11161d;
      --hairline: #1e2329;
      --hairline-soft: #161a1f;
      --bg2: var(--bg-gutter);
      --panel: var(--surface);
      --panel2: var(--surface-soft);
      --panel3: #1a212b;
      --line: var(--hairline);
      --line-strong: #2f3742;
      --line2: rgba(240, 185, 11, .26);
      --text-strong: #f5f7fa;
      --text: #eaecef;
      --muted: #848e9c;
      --dim: #5e6673;
      --green: #0ecb81;
      --red: #f6465d;
      --yellow: #f0b90b;
      --orange: #f0a70b;
      --blue: #5b8def;
      --cyan: #4cc2d6;
      --magenta: #a878e8;
      --aave-purple: #a99bff;
      --soft-purple: #1a1730;
      --accent: #f0b90b;
      --hover: #171d26;
      --shadow: 0 1px 2px rgba(0,0,0,.4);
      --shadow-lg: 0 12px 32px rgba(0,0,0,.45);
      --radius: 8px;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--bg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, ui-sans-serif, system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
      font-size: 13px;
      letter-spacing: 0;
      -webkit-font-smoothing: antialiased;
    }
    body::before { display: none; }
    button, input, select { font: inherit; }
    button {
      cursor: pointer;
      border: 0;
      background: transparent;
      color: var(--text);
      border-radius: 5px;
      min-height: 32px;
      transition: background .12s ease, color .12s ease, border-color .12s ease;
    }
    button:hover { background: var(--hover); }
    button:focus-visible,
    .icon-btn:focus-visible,
    .tab-btn:focus-visible,
    .chip:focus-visible,
    .range-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
    }
    input, select {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      border-radius: 5px;
      padding: 7px 9px;
      outline: none;
      min-height: 32px;
    }
    input:focus, select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(74,168,255,.14); }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg) 94%, transparent);
    }
    .top-inner {
      width: min(1820px, calc(100vw - 22px));
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(210px, auto) minmax(520px, 1fr) auto;
      gap: 16px;
      align-items: center;
      padding: 8px 0;
    }
    .brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .logo {
      width: 30px; height: 30px;
      display: grid; place-items: center;
      border-radius: 7px;
      color: #1b1400;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: .02em;
      background: linear-gradient(135deg, var(--yellow), var(--orange));
    }
    h1 { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.1; letter-spacing: .01em; }
    .subtitle { color: var(--muted); margin-top: 3px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-width: 0;
      position: relative;
    }
    .nav-group { position: relative; }
    .nav-link {
      border: 0;
      background: transparent;
      color: var(--muted);
      min-height: 30px;
      padding: 6px 9px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 650;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .nav-link:hover,
    .nav-group:focus-within .nav-link,
    .nav-group:hover .nav-link {
      color: var(--text);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .nav-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      min-width: 204px;
      transform: translate(-50%, 6px);
      opacity: 0;
      pointer-events: none;
      z-index: 80;
      border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
      border-radius: 8px;
      background: color-mix(in srgb, var(--panel) 96%, var(--bg));
      box-shadow: var(--shadow-lg);
      padding: 6px;
      transition: opacity .16s ease, transform .16s ease;
    }
    .nav-group:hover .nav-menu,
    .nav-group:focus-within .nav-menu {
      opacity: 1;
      transform: translate(-50%, 0);
      pointer-events: auto;
    }
    .nav-menu::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: -9px;
      height: 9px;
    }
    .nav-action {
      width: 100%;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--text);
      min-height: 30px;
      padding: 7px 9px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      text-align: left;
    }
    .nav-action:hover,
    .nav-action:focus-visible {
      background: color-mix(in srgb, var(--blue) 10%, transparent);
      outline: none;
    }
    .nav-action span:last-child { color: var(--muted); font-size: 10px; }
    .status-row { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-wrap: nowrap; min-width: 0; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px;
      border: 0;
      background: transparent;
      color: var(--muted);
      border-radius: 5px;
      padding: 5px 6px;
      font-size: 12px;
      white-space: nowrap;
    }
    .pill strong { color: var(--text); font-weight: 600; }
    .status-pill {
      color: var(--green);
      background: transparent;
      font-weight: 700;
      letter-spacing: .01em;
    }
    .status-pill::before {
      content: "";
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 6px var(--green);
      animation: pulse 1.6s infinite;
    }
    .status-pill.stale, .status-pill.error {
      color: var(--red);
      background: transparent;
    }
    .status-pill.stale::before, .status-pill.error::before { background: var(--red); box-shadow: 0 0 6px var(--red); }
    .status-pill.warming, .status-pill.retry {
      color: var(--yellow);
      background: transparent;
    }
    .status-pill.warming::before, .status-pill.retry::before { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
    .icon-btn {
      width: 34px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      font-weight: 650;
      border: 0;
      background: transparent;
    }
    .ticker {
      border-top: 1px solid var(--line);
      background: var(--bg);
    }
    .ticker-track {
      width: min(1820px, calc(100vw - 22px));
      margin: 0 auto;
      display: flex;
      gap: 0;
      padding: 6px 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tick-item {
      flex: 0 0 auto;
      min-width: 176px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px 8px;
      border: 0;
      border-right: 1px solid var(--line);
      background: transparent;
      border-radius: 0;
      padding: 6px 14px 6px 0;
      margin-right: 14px;
      cursor: pointer;
    }
    .tick-item .sym { font-weight: 600; }
    .tick-item .price { color: var(--muted); font-size: 12px; }
    .tick-item .basis { font-weight: 650; text-align: right; }
    .shell {
      width: min(1820px, calc(100vw - 22px));
      margin: 14px auto 28px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 330px;
      gap: 18px;
      align-items: start;
    }
    .main { min-width: 0; }
    .rail { position: sticky; top: 112px; display: grid; gap: 16px; border-left: 1px solid var(--line); padding-left: 16px; }
    .plane, .workspace-plane, .rail-section {
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
    }
    .workspace-plane { min-width: 0; }
    .section-head {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      background: transparent;
    }
    /* crisp educational tooltips */
    [data-tip] { position: relative; }
    [data-tip]:hover::after,
    [data-tip]:focus-visible::after,
    [data-tip]:focus-within::after {
      content: attr(data-tip);
      position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
      background: var(--panel); color: var(--text); border: 1px solid var(--line);
      box-shadow: var(--shadow-lg); border-radius: 7px; padding: 7px 10px;
      font-size: 11px; font-weight: 500; line-height: 1.4; white-space: normal; width: max-content; max-width: 230px;
      text-transform: none; letter-spacing: 0; text-align: left; z-index: 140; pointer-events: none;
    }
    [data-tip]:hover::before,
    [data-tip]:focus-visible::before,
    [data-tip]:focus-within::before {
      content: ""; position: absolute; bottom: calc(100% + 3px); left: 50%; transform: translateX(-50%);
      border: 5px solid transparent; border-top-color: var(--line); z-index: 140; pointer-events: none;
    }
    .section-title { font-weight: 650; font-size: 14px; }
    .section-sub { color: var(--muted); font-size: 12px; }
    .overview {
      display: grid;
      grid-template-columns: repeat(12, minmax(92px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .metric {
      grid-column: span 2;
      border: 0;
      border-right: 1px solid var(--line);
      border-radius: 0;
      padding: 7px 12px 7px 0;
      background: transparent;
      min-height: 54px;
    }
    .metric .label { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
    .metric .value { margin-top: 6px; font-size: 15px; font-weight: 650; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .metric .hint { margin-top: 4px; color: var(--dim); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tabs { display: flex; gap: 2px; overflow-x: auto; margin-bottom: 12px; border-bottom: 1px solid var(--line); scrollbar-width: none; }
    .tab-btn {
      border: 0; background: transparent; border-radius: 0;
      padding: 9px 12px; color: var(--muted); font-weight: 600; font-size: 12.5px;
      white-space: nowrap; border-bottom: 2px solid transparent; min-height: 34px;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active { color: var(--text); border-bottom-color: var(--accent); background: transparent; }
    .tab-btn svg, .tab-btn .tab-no { display: none; }
    .chip, .range-btn {
      padding: 5px 10px; color: var(--muted); font-weight: 600; font-size: 12px; white-space: nowrap;
      background: transparent; border: 0; border-radius: 5px; min-height: 28px;
    }
    .chip:hover, .range-btn:hover { color: var(--text); background: var(--hover); }
    .chip.active, .range-btn.active {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--text);
    }
    .controls { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      gap: 8px;
      align-items: center;
    }
    .slider-wrap { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    input[type="range"] { accent-color: var(--green); width: 128px; min-height: auto; padding: 0; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .table-wrap { max-height: 674px; overflow: auto; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td {
      border-bottom: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
      padding: 7px 8px;
      text-align: right;
      white-space: nowrap;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: color-mix(in srgb, var(--panel2) 96%, var(--bg));
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: 10px;
      user-select: none;
      cursor: pointer;
    }
    th.sort-asc::after { content: " ↑"; color: var(--accent); font-weight: 700; }
    th.sort-desc::after { content: " ↓"; color: var(--accent); font-weight: 700; }
    th:first-child, td:first-child { text-align: left; }
    tbody tr { transition: background .16s ease, box-shadow .16s ease; }
    tbody tr:hover { background: var(--hover); }
    tbody tr.selected { background: color-mix(in srgb, var(--accent) 12%, var(--bg)); box-shadow: inset 2px 0 0 var(--accent); }
    .symbol-cell { display: flex; align-items: center; gap: 7px; min-width: 132px; }
    .symbol-cell.slim { min-width: 92px; }
    .fav-cell, .token-cell, .action-cell { text-align: center; }
    .token-cell { width: 42px; }
    .token {
      width: 22px; height: 22px; border-radius: 50%;
      display: inline-grid; place-items: center;
      color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .02em;
      background: var(--panel3);
      border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
      flex: 0 0 auto;
    }
    .token-img { width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: inline-block; vertical-align: middle; background: var(--panel3); }
    .sym { font-weight: 600; }
    .star {
      color: var(--dim);
      border: 0;
      background: transparent;
      width: 22px; min-height: 22px; padding: 0;
      font-size: 15px;
    }
    .star.on { color: var(--yellow); }
    .copy { font-size: 10px; padding: 2px 5px; min-height: 22px; color: var(--muted); }
    .row-actions { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; }
    .row-actions .icon-btn { width: 27px; min-height: 25px; border-radius: 5px; color: var(--muted); }
    .row-actions .icon-btn:hover { color: var(--text); background: var(--hover); }
    .mini-list { padding: 6px 0 8px; max-height: 458px; overflow: auto; }
    .mini-row {
      display: grid;
      grid-template-columns: 80px 1fr auto 48px auto;
      gap: 7px;
      align-items: center;
      padding: 8px 2px;
      border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
      font-size: 12px;
      cursor: pointer;
    }
    .mini-row:hover { background: var(--hover); }
    .mini-row .sym { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mini-sym { display: inline-flex; align-items: center; gap: 6px; }
    .mini-sym .token-img, .mini-sym .token { width: 16px; height: 16px; font-size: 8px; }
    .mini-row:last-child { border-bottom: 0; }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
      padding: 2px 5px;
      border: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .badge.live { background: color-mix(in srgb, var(--green) 10%, transparent); color: var(--green); }
    .badge.stale { background: color-mix(in srgb, var(--red) 10%, transparent); color: var(--red); }
    .badge.watch { background: color-mix(in srgb, var(--yellow) 13%, transparent); color: var(--yellow); }
    .badge.hot { background: color-mix(in srgb, var(--red) 13%, transparent); color: var(--red); }
    .pos { color: var(--green); }
    .neg { color: var(--red); }
    .yellow { color: var(--yellow); }
    .orange { color: var(--orange); }
    .blue { color: var(--blue); }
    .magenta { color: var(--magenta); }
    .muted { color: var(--muted); }
    .dim { color: var(--dim); }
    .basis-25 { color: var(--yellow); font-weight: 600; }
    .basis-50 { color: var(--orange); font-weight: 650; }
    .basis-100 { color: var(--red); font-weight: 700; }
    .flash-up { animation: flashUp .6s ease; }
    .flash-down { animation: flashDown .6s ease; }
    @keyframes flashUp { 0% { color: var(--green); } }
    @keyframes flashDown { 0% { color: var(--red); } }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
    .detail-grid { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 18px; }
    .detail-hero { padding: 12px 0; display: grid; gap: 10px; border-bottom: 1px solid var(--line); }
    .detail-title { display: flex; align-items: center; gap: 9px; min-width: 0; }
    .detail-title .token-img, .detail-title .token { width: 26px; height: 26px; font-size: 9px; }
    .detail-title strong { font-size: 18px; letter-spacing: .01em; }
    .detail-actions { display: flex; gap: 7px; flex-wrap: wrap; }
    .detail-actions button { min-height: 28px; padding: 4px 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; }
    .detail-tabs { display: flex; align-items: center; gap: 6px; overflow-x: auto; }
    .detail-tabs .range-btn { min-height: 28px; padding: 5px 9px; }
    .detail-content { border-top: 1px solid var(--line); padding: 10px 0; min-height: 86px; }
    .detail-content-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
    .detail-note { color: var(--muted); line-height: 1.55; font-size: 12px; }
    .latest-table { width: 100%; border-collapse: collapse; }
    .latest-table th, .latest-table td { padding: 6px 7px; font-size: 11px; }
    .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 0; border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
    .kv { border: 0; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); border-radius: 0; padding: 9px; background: transparent; }
    .kv span { display: block; color: var(--muted); text-transform: uppercase; font-size: 10px; letter-spacing: .07em; }
    .kv strong { display: block; margin-top: 5px; font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
    .chart { width: 100%; height: 390px; }
    .chart.sm { height: 240px; }
    .heatmap {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      grid-auto-rows: 78px;
      grid-auto-flow: dense;
      gap: 5px;
      padding: 10px 0;
      max-height: 720px;
      overflow: auto;
    }
    .tile {
      border: 0;
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      display: flex; flex-direction: column; justify-content: space-between;
      transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
    }
    .tile:hover { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
    .tile-head { display: flex; align-items: center; gap: 6px; overflow: hidden; }
    .tile-head .token-img, .tile-head .token { width: 15px; height: 15px; font-size: 8px; }
    .tile-head .sym { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tile .big { font-size: 16px; font-weight: 600; line-height: 1; }
    .tile-sub { display: flex; align-items: center; justify-content: space-between; font-size: 10px; }
    .empty { padding: 16px; color: var(--muted); font-size: 13px; }
    .chart-fallback { height: 100%; display: grid; place-items: center; border-top: 1px solid var(--line); }
    .error-drawer {
      display: none;
      width: min(1820px, calc(100vw - 22px));
      margin: 0 auto 8px;
      border: 1px solid color-mix(in srgb, var(--orange) 30%, var(--line));
      border-top: 0;
      background: var(--panel);
      border-radius: 0 0 8px 8px;
      padding: 10px 12px;
      color: var(--muted);
      font-size: 12px;
      max-height: 150px;
      overflow: auto;
    }
    .error-drawer.open { display: block; }
    .footer {
      color: var(--muted);
      font-size: 12px;
      text-align: center;
      padding: 20px 0 8px;
    }
    .footer a { color: var(--blue); text-decoration: none; }
    /* ---- premium terminal polish ---- */
    svg.ic { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
    .pill.mono strong { font-variant-numeric: tabular-nums; }
    .source-pill {
      color: var(--muted);
      background: transparent;
      font-size: 11px;
    }
    .health-pill {
      position: relative;
      color: var(--text);
      background: color-mix(in srgb, var(--surface-soft) 88%, var(--bg));
      border: 1px solid var(--hairline-soft);
    }
    .health-pill:hover { background: var(--hover); }
    .health-pop {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 248px;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      z-index: 145;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: var(--shadow-lg);
      padding: 10px 12px;
      transition: opacity .16s ease, transform .16s ease;
    }
    .health-pill:hover .health-pop,
    .health-pill:focus-visible .health-pop {
      opacity: 1;
      transform: translateY(0);
    }
    .health-pop .hp-title { font-size: 11px; font-weight: 700; color: var(--text-strong); margin-bottom: 4px; }
    .health-pop .hp-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--hairline-soft); color: var(--muted); font-size: 11px; }
    .health-pop .hp-row:last-child { border-bottom: 0; }
    .health-pop .hp-row strong { color: var(--text-strong); font-weight: 600; }
    .src-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent); flex: 0 0 auto; }
    .icon-btn.has-errors { color: var(--yellow); background: color-mix(in srgb, var(--yellow) 10%, transparent); }
    .seg {
      position: relative;
      display: inline-flex; border: 0; border-radius: 5px; overflow: hidden; background: var(--panel2);
      isolation: isolate;
    }
    .seg-thumb {
      position: absolute; top: 2px; bottom: 2px; left: 0; width: 0;
      z-index: 0; border-radius: 4px;
      background: color-mix(in srgb, var(--accent) 17%, transparent);
      transform: translateX(0);
      transition: transform .2s cubic-bezier(.32,.72,0,1), width .2s cubic-bezier(.32,.72,0,1);
      pointer-events: none;
    }
    .seg button {
      position: relative;
      z-index: 1;
      border: 0; border-radius: 0; min-height: 28px; padding: 4px 10px; font-size: 11px; font-weight: 650;
      color: var(--muted); background: transparent;
    }
    .seg button.active { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text); }
    .seg.ready button.active { background: transparent; }
    .seg button:disabled { opacity: .45; cursor: not-allowed; }
    .seg button + button { border-left: 1px solid color-mix(in srgb, var(--line) 55%, transparent); }
    .currency-seg { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .currency-seg .seg-thumb { display: none; }
    .currency-seg.ready button.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .pill svg.ic, .section-title svg.ic { opacity: .82; }
    .brand-ic { width: 17px; height: 17px; vertical-align: -3px; margin-right: 5px; }
    .tab-btn { display: inline-flex; align-items: center; gap: 6px; }
    .tab-btn .tab-no { opacity: .55; font-weight: 700; }
    .metric {
      position: relative;
      transition: transform .14s ease, border-color .14s ease, box-shadow .14s ease;
    }
    .metric::after { display: none; }
    .metric:hover { background: var(--hover); transform: none; box-shadow: none; }
    svg.spark { display: block; overflow: visible; }
    .spark-wrap { display: inline-flex; align-items: center; }
    .tick-item { grid-template-columns: 1fr auto; gap: 3px 10px; align-items: center; position: relative; }
    .tick-item:hover { background: var(--hover); }
    .tick-item .row1 { display: flex; align-items: center; gap: 7px; }
    .tick-item .row2 { display: flex; align-items: center; gap: 8px; grid-column: 1 / -1; justify-content: space-between; }
    .tick-item .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); flex: 0 0 auto; }
    .tick-item .dot.stale { background: var(--red); box-shadow: 0 0 8px var(--red); }
    .mini-row .spark-wrap { justify-self: end; }
    .help-mask {
      position: fixed; inset: 0; z-index: 200; display: none;
      background: rgba(3,6,11,.62); backdrop-filter: blur(5px);
      align-items: flex-start; justify-content: center; padding: 8vh 16px;
    }
    .help-mask.open { display: flex; }
    .ticker-popover {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      width: 260px;
      opacity: 0;
      transform: translateY(4px);
      pointer-events: none;
      z-index: 90;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      padding: 8px 10px;
      transition: opacity .14s ease, transform .14s ease;
    }
    .ticker-popover::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 18px;
      width: 10px;
      height: 10px;
      background: var(--panel);
      border-left: 1px solid var(--line);
      border-top: 1px solid var(--line);
      transform: rotate(45deg);
    }
    .tick-item:hover .ticker-popover,
    .tick-item:focus-within .ticker-popover {
      opacity: 1;
      transform: translateY(0);
    }
    .ticker-popover .pop-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 4px 0;
      color: var(--muted);
      font-size: 11px;
      border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent);
    }
    .ticker-popover .pop-row:last-child { border-bottom: 0; }
    .ticker-popover strong { color: var(--text); font-weight: 600; }
    .help-sheet {
      width: min(620px, 100%); border: 1px solid var(--line); border-radius: 10px;
      background: var(--panel); box-shadow: var(--shadow-lg);
      overflow: hidden;
    }
    .help-body { padding: 14px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 22px; }
    .help-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }
    kbd {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 800;
      border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 2px 7px;
      background: var(--panel2); color: var(--text); min-width: 20px; text-align: center;
    }
    .help-note { padding: 0 16px 16px; color: var(--muted); font-size: 12px; }
    /* ---- density ---- */
    [data-density="compact"] th, [data-density="compact"] td { padding-top: 3px; padding-bottom: 3px; }
    [data-density="compact"] .mini-row { padding: 4px 0; }
    [data-density="compact"] .metric { min-height: 58px; padding: 8px; }
    /* ---- right drawer (settings) ---- */
    .drawer-mask { position: fixed; inset: 0; z-index: 210; display: none; background: rgba(3,6,11,.5); backdrop-filter: blur(3px); }
    .drawer-mask.open { display: block; }
    .drawer {
      position: fixed; top: 0; right: 0; height: 100%; width: min(360px, 92vw); z-index: 220;
      background: var(--panel); border-left: 1px solid var(--line); box-shadow: var(--shadow-lg);
      transform: translateX(100%); transition: transform .2s ease; overflow: auto;
    }
    .drawer.open { transform: translateX(0); }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--line); }
    .drawer-body { padding: 14px; display: grid; gap: 15px; }
    .set-row { display: grid; gap: 7px; }
    .set-row > .set-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; }
    .set-row .seg { width: 100%; }
    .set-row .seg button { flex: 1; }
    .set-row .currency-seg button { min-height: 34px; }
    .link-btn { background: transparent; border: 0; color: var(--red); justify-content: flex-start; }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 18px;
      z-index: 260;
      transform: translate(-50%, 10px);
      opacity: 0;
      pointer-events: none;
      background: var(--text);
      color: var(--bg);
      border-radius: 7px;
      box-shadow: var(--shadow-lg);
      padding: 8px 11px;
      font-size: 12px;
      transition: opacity .16s ease, transform .16s ease;
    }
    .toast.open { opacity: 1; transform: translate(-50%, 0); }
    /* ---- command palette ---- */
    .cmd-mask { position: fixed; inset: 0; z-index: 230; display: none; background: rgba(3,6,11,.55); backdrop-filter: blur(4px); align-items: flex-start; justify-content: center; padding: 12vh 16px; }
    .cmd-mask.open { display: flex; }
    .cmd { width: min(560px, 100%); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow-lg); overflow: hidden; }
    .cmd input { width: 100%; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; padding: 13px 15px; font-size: 14px; }
    .cmd input:focus { box-shadow: none; }
    .cmd-list { max-height: 52vh; overflow: auto; }
    .cmd-item { display: flex; align-items: center; gap: 10px; padding: 9px 14px; cursor: pointer; border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent); font-size: 13px; }
    .cmd-item:last-child { border-bottom: 0; }
    .cmd-item.active, .cmd-item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .cmd-item .sp { margin-left: auto; color: var(--muted); font-size: 12px; }
    .cmd-kind { width: 34px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
    .cmd-empty { padding: 16px; color: var(--muted); font-size: 13px; }
    /* ---- pagination ---- */
    .pager { display: flex; align-items: center; gap: 6px; padding: 8px 0; border-top: 0; flex-wrap: wrap; }
    .pager button { min-height: 26px; padding: 2px 9px; font-size: 12px; color: var(--muted); }
    .pager button.active { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text); }
    .pager button:disabled { opacity: .4; cursor: default; }
    .pager .spacer { flex: 1; }
    .pager .pinfo { color: var(--muted); font-size: 12px; }
    #filterChips {
      justify-content: flex-start;
      gap: 2px;
      overflow-x: auto;
      flex-wrap: nowrap;
      scrollbar-width: none;
    }
    .toolbar {
      padding: 7px 0;
      border-bottom: 1px solid var(--hairline-soft);
    }
    .toolbar .slider-wrap { justify-content: flex-end; }
    table { min-width: 1320px; }
    th, td { font-size: var(--fs-body); font-variant-numeric: tabular-nums; }
    th { font-size: var(--fs-micro); }
    tbody tr { height: 38px; }
    /* ---- methodology / footer sections ---- */
    /* ---- de-boxed instrument stat bar (Binance-style, one surface not 12 cards) ---- */
    .statbar { display: flex; flex-wrap: wrap; row-gap: 4px; margin: 2px 0 14px; }
    .statbar .stat { padding: 3px 18px 3px 0; margin-right: 18px; border-right: 1px solid var(--line); }
    .statbar .stat:last-child { border-right: 0; margin-right: 0; }
    .statbar .stat .k { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .statbar .stat .v { margin-top: 4px; font-size: 14px; font-weight: 600; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .statbar .stat .s { margin-top: 2px; font-size: 10px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* flatten ticker into a dividered strip, not a row of bordered cards */
    .tick-item { border: 0; border-right: 1px solid var(--line); border-radius: 0; background: transparent; }
    .tick-item:hover { background: var(--hover); }
    .method { padding: 12px 0; font-size: 12px; color: var(--muted); line-height: 1.55; }
    .method b { color: var(--text); font-weight: 650; }
    .method .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 22px; }
    .section-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-top: 18px; padding-top: 2px; }
    .section-grid .plane { border-top: 1px solid var(--line); }
    .timeline { padding: 10px 0; display: grid; gap: 8px; }
    .timeline-row { display: grid; grid-template-columns: 9px 78px 1fr auto; gap: 10px; align-items: center; color: var(--muted); font-size: 12px; }
    .timeline-row::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px color-mix(in srgb, var(--green) 60%, transparent); }
    .timeline-row.warn::before { background: var(--yellow); box-shadow: 0 0 8px color-mix(in srgb, var(--yellow) 60%, transparent); }
    .timeline-row.bad::before { background: var(--red); box-shadow: 0 0 8px color-mix(in srgb, var(--red) 60%, transparent); }
    .foot-grid { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; justify-content: center; }
    @media (max-width: 1380px) {
      .shell { grid-template-columns: 1fr; }
      .rail { position: static; grid-template-columns: 1fr 1fr; border-left: 0; padding-left: 0; border-top: 1px solid var(--line); padding-top: 14px; }
      .overview { grid-template-columns: repeat(6, minmax(0,1fr)); }
      .metric { grid-column: span 1; }
      .top-inner { grid-template-columns: minmax(240px, auto) 1fr; }
      .top-nav { grid-column: 1 / -1; justify-content: flex-start; overflow-x: auto; padding-bottom: 2px; }
      .status-row { justify-content: flex-end; }
      .status-row { flex-wrap: wrap; }
      .section-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 860px) {
      .top-inner { grid-template-columns: 1fr; }
      .status-row { justify-content: flex-start; }
      .overview, .grid-2, .grid-3, .grid-4, .detail-grid, .rail { grid-template-columns: 1fr; }
      .top-nav { grid-column: auto; justify-content: flex-start; }
      .nav-menu { left: 0; transform: translate(0, 6px); }
      .nav-group:hover .nav-menu, .nav-group:focus-within .nav-menu { transform: translate(0, 0); }
      .section-grid, .detail-content-grid { grid-template-columns: 1fr; }
      .toolbar { grid-template-columns: 1fr; }
      .subtitle { white-space: normal; }
      h1 { font-size: 18px; }
      .tick-item { min-width: 158px; }
      .statbar .stat { flex: 1 1 120px; margin-right: 10px; padding-right: 10px; }
    }

    /* ============================================================
       MOTION LAYER — data-driven, purposeful, interruptible.
       Minimal does not mean static.
       ============================================================ */

    /* ---- shared Aave-style mega-menu (one gliding surface) ---- */
    .top-nav .nav-menu { display: none; }   /* retired: replaced by shared #megaMenu */
    #megaMenu {
      position: fixed;
      top: 96px;
      left: 0;
      z-index: 120;
      min-width: 260px;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      background: color-mix(in srgb, var(--panel) 97%, var(--bg));
      border: 1px solid color-mix(in srgb, var(--line) 74%, transparent);
      border-radius: 14px;
      box-shadow: var(--shadow-lg);
      padding: 12px;
      transition: transform .18s cubic-bezier(.32,.72,0,1), left .2s cubic-bezier(.32,.72,0,1),
                  top .2s cubic-bezier(.32,.72,0,1), width .2s cubic-bezier(.32,.72,0,1), opacity .16s ease;
      overflow: hidden;
    }
    #megaMenu.open { opacity: 1; transform: translateY(0); pointer-events: auto; }
    #megaMenu .mega-inner { display: grid; gap: 10px; }
    #megaMenu .mega-head { font-size: 10px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); padding: 0 6px; }
    .mega-item {
      display: grid; grid-template-columns: 26px 1fr; align-items: center; gap: 10px;
      width: 100%; text-align: left; padding: 8px 8px; border-radius: 9px; min-height: 42px;
      color: var(--text); background: transparent; border: 0;
    }
    .mega-item:hover, .mega-item:focus-visible { background: color-mix(in srgb, var(--aave-purple, #8d7dff) 12%, transparent); outline: none; }
    .mega-item .mi-ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
      background: var(--soft-purple, #f3f0ff); color: var(--aave-purple, #7c53c4); }
    [data-theme="dark"] .mega-item .mi-ic { background: color-mix(in srgb, var(--magenta) 18%, transparent); color: var(--magenta); }
    .mega-item .mi-ic svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .mega-item .mi-t { font-size: 12.5px; font-weight: 600; line-height: 1.2; }
    .mega-item .mi-d { font-size: 11px; color: var(--muted); margin-top: 1px; }
    .nav-link .nav-caret { width: 12px; height: 12px; opacity: .55; transition: transform .16s ease; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .nav-group.active-menu .nav-link .nav-caret { transform: rotate(180deg); }
    .nav-group.active-menu > .nav-link { color: var(--text); background: color-mix(in srgb, var(--accent) 12%, transparent); }

    /* ---- moving market tape (live phrases) ---- */
    .tape {
      border-top: 1px solid var(--line);
      background: color-mix(in srgb, var(--surface-soft) 70%, var(--bg));
      overflow: hidden;
      position: relative;
    }
    .tape-inner {
      width: min(1820px, calc(100vw - 22px));
      margin: 0 auto;
      display: flex; align-items: center; gap: 10px;
      padding: 0 0;
    }
    .tape-label {
      flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
      color: var(--muted); padding: 6px 12px 6px 2px; border-right: 1px solid var(--line);
    }
    .tape-label .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 1.6s infinite; }
    .tape-viewport { flex: 1 1 auto; overflow: hidden; position: relative; -webkit-mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent); mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent); }
    .tape-track { display: inline-flex; align-items: center; white-space: nowrap; will-change: transform; animation: tape-scroll 60s linear infinite; }
    .tape-viewport:hover .tape-track { animation-play-state: paused; }
    @keyframes tape-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .tape-item {
      display: inline-flex; align-items: center; gap: 7px; padding: 6px 16px;
      font-size: 11.5px; color: var(--muted); cursor: pointer; border-right: 1px solid var(--hairline-soft);
    }
    .tape-item:hover { color: var(--text); }
    .tape-item .ti-sym { font-weight: 650; color: var(--text); }
    .tape-item .ti-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); flex: 0 0 auto; }

    /* ---- rotating dynamic headline ---- */
    .headline { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
    .headline .hl-text { transition: opacity .4s ease, transform .4s ease; }
    .headline.swap .hl-text { opacity: 0; transform: translateY(-4px); }
    .headline .hl-spark { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 7px var(--accent); flex: 0 0 auto; }

    /* ---- gliding tab underline ---- */
    .tabs { position: relative; }
    .tab-btn.active { border-bottom-color: transparent; }
    .tab-underline {
      position: absolute; bottom: -1px; left: 0; height: 2px; width: 0;
      background: var(--accent); border-radius: 2px 2px 0 0;
      transform: translateX(0);
      transition: transform .24s cubic-bezier(.32,.72,0,1), width .24s cubic-bezier(.32,.72,0,1);
      pointer-events: none;
    }

    /* ---- animated numbers (count-up + flash on the metric strip) ---- */
    .statbar .stat .v.flash-up { animation: statFlashUp .8s ease; }
    .statbar .stat .v.flash-down { animation: statFlashDown .8s ease; }
    @keyframes statFlashUp { 0% { color: var(--green); } 60% { color: var(--green); } }
    @keyframes statFlashDown { 0% { color: var(--red); } 60% { color: var(--red); } }

    /* ---- Aave-style micro-visual widgets ---- */
    .widgets {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;
      margin: 2px 0 16px;
    }
    .widget {
      background: color-mix(in srgb, var(--surface-soft) 82%, var(--bg));
      border: 1px solid var(--hairline-soft);
      border-radius: 16px; padding: 12px 14px;
      display: grid; grid-template-columns: auto 1fr; gap: 10px 12px; align-items: center;
      min-height: 84px; transition: box-shadow .16s ease, transform .16s ease;
    }
    .widget:hover { box-shadow: var(--shadow); }
    .widget .w-label { grid-column: 2; font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); align-self: end; }
    .widget .w-value { grid-column: 2; font-size: 18px; font-weight: 600; line-height: 1; align-self: start; }
    .widget .w-sub { grid-column: 2; font-size: 10.5px; color: var(--dim); }
    .widget .w-vis { grid-row: 1 / span 3; grid-column: 1; width: 56px; height: 56px; display: grid; place-items: center; }
    .widget .w-vis.wide { width: 92px; }
    .widget svg .ring-track { stroke: var(--hairline); fill: none; }
    .widget svg .ring-val { fill: none; stroke-linecap: round; transition: stroke-dashoffset .7s cubic-bezier(.32,.72,0,1), stroke .3s ease; }
    .widget svg .bar-pos, .widget svg .bar-neg { transition: width .6s cubic-bezier(.32,.72,0,1), x .6s cubic-bezier(.32,.72,0,1); }
    .widget svg .curve-line { fill: none; stroke: var(--aave-purple, #8d7dff); stroke-width: 1.6; vector-effect: non-scaling-stroke; transition: stroke-dashoffset .8s ease; }
    .widget svg .curve-fill { fill: color-mix(in srgb, var(--aave-purple, #8d7dff) 14%, transparent); stroke: none; }
    .widget svg .curve-marker { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 2 2; }
    .widget svg .pulse-line { fill: none; stroke: var(--green); stroke-width: 1.6; vector-effect: non-scaling-stroke; }

    /* ---- live activity feed ---- */
    .feed { padding: 6px 0 4px; display: grid; gap: 2px; }
    .feed-row {
      display: grid; grid-template-columns: 8px 1fr auto; gap: 9px; align-items: baseline;
      padding: 7px 2px; border-bottom: 1px solid var(--hairline-soft);
      font-size: 12px; cursor: pointer; color: var(--muted);
    }
    .feed-row:last-child { border-bottom: 0; }
    .feed-row:hover { background: var(--hover); }
    .feed-row.enter { animation: feedIn .42s cubic-bezier(.32,.72,0,1); }
    @keyframes feedIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    .feed-row::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--muted); align-self: center; }
    .feed-row.up::before { background: var(--green); box-shadow: 0 0 6px color-mix(in srgb, var(--green) 60%, transparent); }
    .feed-row.down::before { background: var(--red); box-shadow: 0 0 6px color-mix(in srgb, var(--red) 60%, transparent); }
    .feed-row.warn::before { background: var(--yellow); box-shadow: 0 0 6px color-mix(in srgb, var(--yellow) 60%, transparent); }
    .feed-row.info::before { background: var(--blue); }
    .feed-row .fr-main { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .feed-row .fr-main b { color: var(--text); font-weight: 600; }
    .feed-row .fr-time { color: var(--dim); font-size: 10.5px; white-space: nowrap; }

    @media (max-width: 1380px) { .widgets { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (max-width: 860px) {
      .widgets { grid-template-columns: 1fr; }
      .tape-label { padding-left: 2px; }
      #megaMenu { min-width: 220px; }
    }

    /* ---- Coinbase/Uniswap-style subscript-zero micro prices ---- */
    sub.subz { font-size: .72em; vertical-align: -0.18em; opacity: .8; font-variant-numeric: normal; padding: 0 .5px; }

    /* ---- live market-mood chip ---- */
    .mood-chip {
      display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto;
      font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
      padding: 2px 8px; border-radius: 999px; transition: background .4s ease, color .4s ease;
    }
    .mood-chip::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; }
    .mood-chip[data-mood="calm"] { background: color-mix(in srgb, var(--blue) 12%, transparent); color: var(--blue); }
    .mood-chip[data-mood="warm"] { background: color-mix(in srgb, var(--yellow) 18%, transparent); color: var(--orange); }
    .mood-chip[data-mood="hot"]  { background: color-mix(in srgb, var(--red) 14%, transparent); color: var(--red); }

    /* ---- floating network-health wifi badge ---- */
    .net-badge {
      position: fixed; right: 18px; bottom: 18px; z-index: 205;
      display: inline-flex; align-items: center; gap: 9px;
      padding: 8px 13px 8px 11px; border-radius: 999px; min-height: 0;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--hairline);
      box-shadow: var(--shadow-lg); cursor: pointer;
      transition: border-color .16s ease, transform .16s ease;
    }
    .net-badge:hover { border-color: var(--line-strong); transform: translateY(-1px); }
    .net-bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 16px; }
    .net-bars i { width: 3px; border-radius: 1px; background: var(--dim); transition: background .35s ease; }
    .net-bars i:nth-child(1) { height: 5px; } .net-bars i:nth-child(2) { height: 9px; }
    .net-bars i:nth-child(3) { height: 13px; } .net-bars i:nth-child(4) { height: 16px; }
    .net-badge[data-net="good"] .net-bars i { background: var(--green); }
    .net-badge[data-net="good"] .net-bars i:nth-child(4) { animation: netpulse 1.5s ease-in-out infinite; }
    .net-badge[data-net="mid"] .net-bars i:nth-child(-n+3) { background: var(--yellow); }
    .net-badge[data-net="bad"] .net-bars i:nth-child(1) { background: var(--red); }
    @keyframes netpulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
    .net-badge .net-txt { display: flex; flex-direction: column; line-height: 1.05; text-align: left; }
    .net-badge .net-txt strong { font-size: 12px; font-weight: 650; }
    .net-badge .net-txt > span { font-size: 8.5px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
    .net-pop {
      position: absolute; bottom: calc(100% + 10px); right: 0; width: 236px;
      opacity: 0; transform: translateY(6px); pointer-events: none;
      transition: opacity .16s ease, transform .16s ease;
      background: var(--panel); border: 1px solid var(--line); border-radius: 11px;
      box-shadow: var(--shadow-lg); padding: 10px 12px;
    }
    .net-badge:hover .net-pop { opacity: 1; transform: translateY(0); }
    .net-pop .np-title { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
    .net-pop .np-row { display: flex; justify-content: space-between; gap: 14px; font-size: 11px; padding: 4px 0; color: var(--muted); border-bottom: 1px solid var(--hairline-soft); }
    .net-pop .np-row:last-child { border-bottom: 0; }
    .net-pop .np-row strong { color: var(--text); font-weight: 600; }
    @media (max-width: 860px) { .net-badge { right: 12px; bottom: 12px; } }

    /* ---- TradingView-style chart toolbar + fullscreen ---- */
    .chart-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 0 4px; flex-wrap: wrap; }
    .chart-toolbar .chart-tool-sp { flex: 1 1 auto; }
    .chart-toolbar .range-btn { min-height: 28px; padding: 5px 9px; }
    .chart-fs-mask {
      position: fixed; inset: 0; z-index: 240; display: none;
      background: rgba(3,6,11,.55); backdrop-filter: blur(4px);
      align-items: center; justify-content: center; padding: 4vh 3vw;
    }
    .chart-fs-mask.open { display: flex; }
    .chart-fs {
      width: min(1400px, 100%); height: min(84vh, 900px);
      background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
      box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden;
    }
    .chart-fs-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); }
    .chart-fs-box { flex: 1 1 auto; min-height: 0; }

    /* ---- Base-style "how basis works" flow diagram ---- */
    .flow { display: flex; align-items: stretch; gap: 0; flex-wrap: wrap; padding: 6px 0 16px; }
    .flow-node {
      flex: 1 1 150px; display: grid; gap: 3px; padding: 12px 14px;
      background: color-mix(in srgb, var(--surface-soft) 82%, var(--bg));
      border: 1px solid var(--hairline-soft); border-radius: 14px; min-width: 130px;
    }
    .flow-node.accent { border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 8%, var(--surface-soft)); }
    .flow-node b { font-size: 13px; }
    .flow-node .fn-ic { width: 22px; height: 22px; border-radius: 7px; display: inline-grid; place-items: center; margin-bottom: 3px; }
    .flow-node .fn-ic.green { background: color-mix(in srgb, var(--green) 16%, transparent); }
    .flow-node .fn-ic.magenta { background: color-mix(in srgb, var(--magenta) 16%, transparent); }
    .flow-node .fn-ic.accent { background: color-mix(in srgb, var(--accent) 20%, transparent); }
    .flow-node .fn-ic svg { width: 13px; height: 13px; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .flow-node .fn-ic.green svg { stroke: var(--green); } .flow-node .fn-ic.magenta svg { stroke: var(--magenta); } .flow-node .fn-ic.accent svg { stroke: var(--orange); }
    .flow-link { flex: 0 0 74px; align-self: center; position: relative; height: 22px; display: grid; place-items: center; }
    .flow-link::before {
      content: ""; position: absolute; left: 4px; right: 4px; top: 50%; height: 2px; transform: translateY(-50%);
      background: repeating-linear-gradient(90deg, var(--line-strong) 0 5px, transparent 5px 11px);
      background-size: 22px 2px; animation: flowDash 1.1s linear infinite;
    }
    @keyframes flowDash { to { background-position-x: 22px; } }
    .flow-link .fl-label { position: relative; font-size: 9px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); background: var(--bg); padding: 1px 5px; border-radius: 4px; }
    @media (max-width: 760px) { .flow-link { flex-basis: 100%; height: 30px; transform: rotate(90deg); } }

    /* ---- staggered radar row reveal on re-sort / filter / page ---- */
    @keyframes rowIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
    tbody.reveal tr { animation: rowIn .38s both; animation-delay: calc(var(--i, 0) * 13ms); }
    @keyframes spotGlow { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); } 100% { box-shadow: 0 0 0 10px transparent; } }
    .spotlight.glow { animation: spotGlow 1.1s ease; }
    @keyframes thBump { 0% { color: var(--accent); } 100% { color: var(--muted); } }
    th.just-sorted { animation: thBump .5s ease; }

    /* ---- Backpack-style top-of-book / basis ladder ---- */
    .book-viz { padding: 12px 0; display: grid; gap: 12px; }
    .bv-row { display: grid; grid-template-columns: 48px 1fr auto; gap: 10px; align-items: center; }
    .bv-label { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
    .bv-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
    .bv-dot.spot { background: var(--green); } .bv-dot.perp { background: var(--magenta); }
    .bv-track { position: relative; height: 14px; background: var(--surface-soft); border: 1px solid var(--hairline-soft); border-radius: 7px; overflow: hidden; }
    .bv-band { position: absolute; top: 0; bottom: 0; border-radius: 4px; transition: left .45s cubic-bezier(.32,.72,0,1), width .45s cubic-bezier(.32,.72,0,1); }
    .bv-band.spot { background: color-mix(in srgb, var(--green) 34%, transparent); }
    .bv-band.perp { background: color-mix(in srgb, var(--magenta) 34%, transparent); }
    .bv-mid { position: absolute; top: -1px; bottom: -1px; width: 2px; background: var(--green); transition: left .45s cubic-bezier(.32,.72,0,1); }
    .bv-mid.perp { background: var(--magenta); }
    .bv-val { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .bv-gap { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--muted); padding-top: 4px; border-top: 1px solid var(--hairline-soft); flex-wrap: wrap; }
    .bv-gap strong { font-size: 13px; }

    /* ---- Coinbase/TradingView-style market spotlight hero ---- */
    .spotlight {
      display: grid; grid-template-columns: auto auto 1fr auto; gap: 22px; align-items: center;
      background: color-mix(in srgb, var(--surface-soft) 82%, var(--bg));
      border: 1px solid var(--hairline-soft); border-radius: 16px;
      padding: 14px 20px; margin-bottom: 14px; cursor: pointer;
      transition: box-shadow .16s ease, transform .16s ease;
    }
    .spotlight:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
    .spot-id { display: flex; align-items: center; gap: 11px; }
    .spot-id .token-img, .spot-id .token { width: 34px; height: 34px; font-size: 11px; }
    .spot-sym { font-size: 16px; font-weight: 700; line-height: 1.1; }
    .spot-pair { font-size: 11px; }
    .spot-eyebrow { font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--aave-purple, #8d7dff); margin-bottom: 2px; }
    .spot-px .spot-big { font-size: 23px; font-weight: 700; line-height: 1; }
    .spot-chg { font-size: 12px; margin-top: 6px; }
    .spot-stats { display: flex; gap: 26px; justify-content: flex-end; }
    .spot-stats .ss { display: flex; flex-direction: column; gap: 3px; }
    .spot-stats .ss-k { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .spot-stats .ss-v { font-size: 14px; font-weight: 600; }
    .spot-chart { width: 200px; height: 56px; }
    .spot-chart .spark-wrap, .spot-chart svg { width: 100%; height: 100%; }
    @media (max-width: 1200px) { .spot-stats { display: none; } }
    @media (max-width: 980px) { .spotlight { grid-template-columns: auto 1fr; } .spot-chart { display: none; } }

    /* ---- TradingView / Backpack-inspired research desk ---- */
    .desk-shell { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(320px, .72fr); gap: 12px; }
    .desk-main, .desk-side { display: grid; gap: 12px; min-width: 0; }
    .desk-hero {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: start;
      padding: 15px 16px; border: 1px solid var(--line); border-radius: 16px;
      background:
        radial-gradient(circle at 86% 15%, color-mix(in srgb, var(--cyan) 20%, transparent), transparent 34%),
        linear-gradient(135deg, color-mix(in srgb, var(--surface-soft) 86%, var(--bg)), var(--panel));
      overflow: hidden; position: relative;
    }
    .desk-hero::after {
      content: ""; position: absolute; inset: auto -8% -50% 42%; height: 128px;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 22%, transparent), transparent);
      transform: rotate(-8deg); opacity: .55; pointer-events: none;
    }
    .desk-title { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .desk-title .token-img, .desk-title .token { width: 38px; height: 38px; font-size: 12px; }
    .desk-title b { display: block; font-size: 21px; line-height: 1.04; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .desk-kicker { font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
    .desk-price { font-size: 28px; font-weight: 720; line-height: 1; margin-top: 14px; font-variant-numeric: tabular-nums; }
    .desk-sub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; font-size: 12px; }
    .desk-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; position: relative; z-index: 1; }
    .desk-action {
      min-height: 32px; padding: 7px 11px; border-radius: 999px;
      background: color-mix(in srgb, var(--panel) 72%, transparent);
      border: 1px solid var(--hairline); color: var(--text);
    }
    .desk-action:hover { border-color: var(--line-strong); transform: translateY(-1px); }
    .desk-action.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
    .desk-card {
      border: 1px solid var(--line); border-radius: 16px; background: var(--panel);
      box-shadow: var(--shadow); overflow: hidden; min-width: 0;
    }
    .desk-card .section-head { padding: 12px 14px 0; }
    .desk-chart { height: 396px; min-height: 320px; }
    .desk-chart-fallback { height: 396px; display: grid; place-items: center; padding: 22px; text-align: center; color: var(--muted); }
    .desk-strip {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
      border-top: 1px solid var(--hairline-soft); background: var(--surface-soft);
    }
    .desk-mini { padding: 12px 14px; border-right: 1px solid var(--hairline-soft); min-width: 0; }
    .desk-mini:last-child { border-right: 0; }
    .desk-mini span { display: block; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
    .desk-mini strong { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .desk-lane { padding: 10px 0; overflow: hidden; border-top: 1px solid var(--hairline-soft); background: color-mix(in srgb, var(--surface-soft) 72%, transparent); }
    .desk-lane-track { display: inline-flex; gap: 8px; padding-left: 12px; white-space: nowrap; will-change: transform; animation: deskLane 38s linear infinite; }
    .desk-lane:hover .desk-lane-track { animation-play-state: paused; }
    .desk-chip {
      display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--hairline-soft); background: var(--panel); font-size: 11px; cursor: pointer;
    }
    .desk-chip:hover { border-color: var(--line-strong); }
    .desk-chip .token-img, .desk-chip .token { width: 18px; height: 18px; font-size: 7px; }
    @keyframes deskLane { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .desk-depth { display: grid; gap: 7px; padding: 12px 14px 14px; }
    .depth-row { display: grid; grid-template-columns: 72px 1fr 78px; gap: 10px; align-items: center; font-size: 12px; }
    .depth-label { color: var(--muted); font-weight: 650; }
    .depth-track { position: relative; height: 20px; border-radius: 6px; background: var(--surface-soft); overflow: hidden; border: 1px solid var(--hairline-soft); }
    .depth-fill { position: absolute; inset: 0 auto 0 0; width: var(--w, 50%); border-radius: 4px; transition: width .45s cubic-bezier(.32,.72,0,1); }
    .depth-fill.bid { background: color-mix(in srgb, var(--green) 34%, transparent); }
    .depth-fill.ask { background: color-mix(in srgb, var(--red) 28%, transparent); }
    .depth-fill.perp { background: color-mix(in srgb, var(--magenta) 30%, transparent); }
    .depth-price { text-align: right; font-variant-numeric: tabular-nums; font-weight: 650; }
    .desk-print-list { display: grid; gap: 2px; padding: 8px 10px 12px; }
    .desk-print {
      display: grid; grid-template-columns: minmax(92px,1.2fr) .72fr .72fr auto; gap: 9px; align-items: center;
      padding: 8px 6px; border-bottom: 1px solid var(--hairline-soft); font-size: 12px; cursor: pointer;
    }
    .desk-print:last-child { border-bottom: 0; }
    .desk-print:hover { background: var(--hover); }
    .desk-print .mini-sym { min-width: 0; }
    .desk-console {
      padding: 12px 14px; display: grid; gap: 10px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--surface-soft) 72%, transparent), transparent);
    }
    .desk-console-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--muted); }
    .desk-console-row strong { color: var(--text); font-variant-numeric: tabular-nums; }
    .desk-noise {
      position: relative; height: 76px; border-radius: 12px; overflow: hidden;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--green) 18%, transparent), transparent 36%, color-mix(in srgb, var(--magenta) 16%, transparent)),
        repeating-linear-gradient(90deg, transparent 0 11px, color-mix(in srgb, var(--line) 65%, transparent) 11px 12px);
      border: 1px solid var(--hairline-soft);
    }
    .desk-noise::before, .desk-noise::after {
      content: ""; position: absolute; top: 50%; left: -8%; width: 116%; height: 2px;
      background: linear-gradient(90deg, transparent, var(--green), var(--accent), transparent);
      animation: deskSweep 3.2s ease-in-out infinite; opacity: .7;
    }
    .desk-noise::after { top: 64%; animation-delay: -1.2s; background: linear-gradient(90deg, transparent, var(--magenta), var(--cyan), transparent); }
    @keyframes deskSweep { 0% { transform: translateX(-12%) scaleX(.8); opacity: .18; } 50% { opacity: .78; } 100% { transform: translateX(12%) scaleX(1.05); opacity: .18; } }
    @media (max-width: 1240px) { .desk-shell { grid-template-columns: 1fr; } .desk-side { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 860px) {
      .desk-hero, .desk-side { grid-template-columns: 1fr; }
      .desk-actions { justify-content: flex-start; }
      .desk-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .desk-mini:nth-child(2n) { border-right: 0; }
      .desk-chart, .desk-chart-fallback { height: 330px; }
      .desk-print { grid-template-columns: minmax(90px,1fr) .75fr auto; }
      .desk-print .hide-sm { display: none; }
    }

    /* ============================================================
       SPRINT 4 — TYPOGRAPHY HIERARCHY, CONTRAST, CRISP MONOGRAMS.
       Black/near-black anchors, muted secondary, colored deltas only.
       ============================================================ */
    /* product identity */
    h1 { font-size: 16px; font-weight: var(--fw-bold); color: var(--text-strong); letter-spacing: -0.01em; }
    .logo { font-weight: 800; }
    /* header nav — crisp, near-black, not gray dust */
    .nav-link { color: var(--text); font-weight: var(--fw-med); font-size: 12.5px; }
    .nav-link:hover, .nav-group.active-menu > .nav-link { color: var(--text-strong); }
    .nav-link .nav-caret { opacity: .5; }
    /* header icons — sharp and visible, not faint */
    .status-row .icon-btn { color: var(--text); }
    .status-row .icon-btn svg { stroke-width: 2; opacity: 1; }
    .status-row .icon-btn:hover { color: var(--text-strong); background: var(--hover); }
    .status-row .pill { color: var(--muted); font-size: var(--fs-label); }
    .status-row .pill strong { color: var(--text-strong); font-weight: var(--fw-semi); }
    /* section titles — clear, near-black */
    .section-title { font-size: var(--fs-title); font-weight: var(--fw-semi); color: var(--text-strong); letter-spacing: -0.005em; }
    .section-sub { font-size: var(--fs-label); color: var(--muted); }
    /* table header — clearer */
    th { color: var(--muted); font-weight: var(--fw-semi); font-size: 10.5px; }
    td { color: var(--text); }
    td .sym { color: var(--text-strong); font-weight: var(--fw-semi); }
    /* important numbers get weight; labels stay muted */
    .spot-big, .detail-title strong, .kv strong, .widget .w-value { color: var(--text-strong); }
    .metric .value { color: var(--text-strong); font-weight: var(--fw-semi); }

    /* crisp deterministic monogram badges — never empty, never gray noise */
    .token.mono {
      background: hsl(var(--h, 210) 78% 90%);
      color: hsl(var(--h, 210) 62% 28%);
      border: 0; font-weight: 800; font-size: 8.5px; letter-spacing: .01em;
    }
    [data-theme="dark"] .token.mono {
      background: hsl(var(--h, 210) 40% 24%);
      color: hsl(var(--h, 210) 78% 76%);
    }
    .token-img { object-fit: contain; }

    /* ---- prefers-reduced-motion: keep meaning, drop movement ---- */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .001ms !important;
        scroll-behavior: auto !important;
      }
      .tape-track { animation: none !important; transform: none !important; }
      .tape-viewport { overflow-x: auto; scrollbar-width: none; }
      .status-pill::before, .tape-label .live-dot, .net-bars i, .flow-link::before, .desk-lane-track, .desk-noise::before, .desk-noise::after { animation: none !important; }
    }
    [data-motion="reduced"] *, [data-motion="reduced"] *::before, [data-motion="reduced"] *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
      scroll-behavior: auto !important;
    }
    [data-motion="reduced"] .tape-track { animation: none !important; transform: none !important; }
    [data-motion="reduced"] .tape-viewport { overflow-x: auto; scrollbar-width: none; }
    [data-motion="reduced"] .status-pill::before, [data-motion="reduced"] .tape-label .live-dot, [data-motion="reduced"] .desk-lane-track, [data-motion="reduced"] .desk-noise::before, [data-motion="reduced"] .desk-noise::after { animation: none !important; }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="top-inner">
      <div class="brand">
        <div class="logo">CG</div>
        <div>
          <h1>CG Signal Lab</h1>
        </div>
      </div>
      <nav class="top-nav" id="topNav" aria-label="Primary navigation">
        <div class="nav-group"><button class="nav-link" data-nav-tab="radar" data-menu="markets" aria-haspopup="true">Markets<svg class="nav-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></div>
        <div class="nav-group"><button class="nav-link" data-nav-tab="radar" data-menu="basis" aria-haspopup="true">Basis<svg class="nav-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></div>
        <div class="nav-group"><button class="nav-link" data-nav-tab="funding" data-menu="funding" aria-haspopup="true">Funding<svg class="nav-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></div>
        <div class="nav-group"><button class="nav-link" data-nav-tab="movers">Movers</button></div>
        <div class="nav-group"><button class="nav-link" data-nav-tab="heatmap">Heatmap</button></div>
        <div class="nav-group"><button class="nav-link" data-nav-tab="radar" data-nav-filter="all">Screener</button></div>
        <div class="nav-group"><button class="nav-link" data-nav-action="watchlist">Watchlist</button></div>
        <div class="nav-group"><button class="nav-link" data-nav-tab="quality" data-menu="research" aria-haspopup="true">Research<svg class="nav-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></div>
        <div id="megaMenu" role="menu" aria-label="Navigation menu"></div>
      </nav>
      <div class="status-row">
        <span class="pill source-pill" data-tip="Data source: public Binance market WebSocket streams only. No account keys."><span class="src-dot"></span>Binance Public</span>
        <span id="statusPill" class="pill status-pill warming" data-tip="LIVE means the latest public-data snapshot is fresh. STALE means the latest row is older than the age gate.">SYNCING</span>
        <span class="pill mono" data-tip="Coordinated Universal Time for comparing stream and cache timestamps."><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><strong id="utcClock">--:--:--</strong> UTC</span>
        <button id="healthPill" class="pill health-pill" type="button" title="Open Data Quality"><svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Data <strong id="symbolCount">0</strong><div id="healthPop" class="health-pop"></div></button>
        <button id="searchBtn" class="icon-btn" title="Search ( / )"><svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button>
        <button id="errorToggle" class="icon-btn" title="API status &amp; recent errors"><svg class="ic" viewBox="0 0 24 24"><path d="M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg></button>
        <button id="themeToggle" class="icon-btn" title="Toggle theme ( D )"></button>
        <button id="settingsBtn" class="icon-btn" title="Settings"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.8 7.8 0 0 0-2.6-1.5L14 0h-4l-.5 2.6A7.8 7.8 0 0 0 6.9 4l-2.3-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.8 7.8 0 0 0 2.6 1.5L10 24h4l.5-2.6a7.8 7.8 0 0 0 2.6-1.5l2.3 1 2-3.4z"/></svg></button>
        <button id="helpBtn" class="icon-btn" title="Keyboard shortcuts ( ? )"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><path d="M12 17h.01"/></svg></button>
      </div>
    </div>
    <div class="tape">
      <div class="tape-inner">
        <span class="tape-label" data-tip="A live headline generated from the current public-data snapshot. It rotates as the market state changes."><span class="live-dot"></span><span class="mood-chip" id="moodChip" data-mood="calm" data-tip="Overall market mood derived from basis breadth and funding extremes across tracked symbols.">CALM</span><span class="headline" id="headline"><span class="hl-text" id="headlineText">Scanning Binance public spot/perp streams</span></span></span>
        <div class="tape-viewport"><div class="tape-track" id="tapeTrack"></div></div>
      </div>
    </div>
    <div id="errorDrawer" class="error-drawer"></div>
  </header>

  <main class="shell">
    <section class="main">
      <section id="widgets" class="widgets" aria-label="Live market visuals"></section>
      <nav id="tabs" class="tabs">
        <button class="tab-btn" data-tab="radar"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/></svg><span class="tab-no">1</span> Radar</button>
        <button class="tab-btn" data-tab="opps"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span class="tab-no">2</span> Opportunities</button>
        <button class="tab-btn" data-tab="funding"><svg class="ic" viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg><span class="tab-no">3</span> Funding</button>
        <button class="tab-btn" data-tab="movers"><svg class="ic" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 7-7"/><path d="M17 7h4v4"/></svg><span class="tab-no">4</span> Movers</button>
        <button class="tab-btn" data-tab="heatmap"><svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span class="tab-no">5</span> Heatmap</button>
        <button class="tab-btn" data-tab="detail"><svg class="ic" viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 15l4-4 4 3 6-7"/></svg><span class="tab-no">6</span> Symbol Detail</button>
        <button class="tab-btn" data-tab="quality"><svg class="ic" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg><span class="tab-no">7</span> Data Quality</button>
        <button class="tab-btn" data-tab="pulse"><svg class="ic" viewBox="0 0 24 24"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg><span class="tab-no">8</span> Futures Pulse</button>
        <span class="tab-underline" id="tabUnderline"></span>
      </nav>

      <section id="tab-radar" class="tab-panel">
        <div id="spotlight" class="spotlight" role="button" tabindex="0" data-tip="The strongest basis dislocation right now. Click to open its full symbol page."></div>
        <div class="workspace-plane">
          <div class="section-head">
            <div>
              <div class="section-title">Live Basis Radar</div>
              <div class="section-sub">Sortable latest rows from SQLite. Click a row for symbol detail.</div>
            </div>
            <div class="controls">
              <span class="pill muted" style="border:1px solid var(--hairline);border-radius:5px;padding:5px 9px" data-tip="Prices are shown in USDT/USD from Binance public streams. INR, EUR, GBP, and JPY arrive after a cached FX feed is added — no fake client-side conversions.">USDT/USD <span class="dim">· FX soon</span></span>
              <span class="seg" id="unitToggle" data-tip="bps means basis points. 100 bps = 1%."><button data-unit="bps">bps</button><button data-unit="pct">%</button></span>
              <input id="search" placeholder="Search symbol  /" autocomplete="off">
              <span class="seg" id="rowLimitSeg" data-tip="Rows per page. Pagination prevents rendering the whole market list."><button data-size="25">25</button><button data-size="50">50</button><button data-size="100">100</button><button data-size="200">200</button></span>
            </div>
          </div>
          <div class="section-head toolbar">
            <div class="controls" id="filterChips">
              <button class="chip" data-filter="all">All</button>
              <button class="chip" data-filter="spot">Spot->Perp</button>
              <button class="chip" data-filter="perp">Perp->Spot</button>
              <button class="chip" data-filter="fundpos">Funding+</button>
              <button class="chip" data-filter="fundneg">Funding-</button>
              <button class="chip" data-filter="25">25+ bps</button>
              <button class="chip" data-filter="50">50+ bps</button>
              <button class="chip" data-filter="100">100+ bps</button>
              <button class="chip" data-filter="fresh">Fresh</button>
              <button class="chip" data-filter="stale">Stale</button>
              <button class="chip" data-filter="major">Majors</button>
              <button class="chip" data-filter="alts">Alts</button>
              <button class="chip" data-filter="wide">Wide spread</button>
              <button class="chip" data-filter="tight">Tight spread</button>
            </div>
            <div class="slider-wrap">Min bps <input id="threshold" type="range" min="0" max="150" step="1"><strong id="thresholdLabel">0</strong></div>
          </div>
          <div id="radarScroll" class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="fav-cell" title="Favorite">★</th>
                  <th class="token-cell" title="Token icon">token</th>
                  <th data-sort="symbol">symbol</th>
                  <th data-sort="spot_bid">spot bid</th>
                  <th data-sort="spot_ask">spot ask</th>
                  <th data-sort="spot_mid">spot mid</th>
                  <th data-sort="fut_bid">fut bid</th>
                  <th data-sort="fut_ask">fut ask</th>
                  <th data-sort="futures_mid">fut mid</th>
                  <th data-sort="spot_spread_bps" data-tip="Spot spread is best ask minus best bid, measured in basis points.">spot spr</th>
                  <th data-sort="futures_spread_bps" data-tip="Perpetual spread is best ask minus best bid, measured in basis points.">fut spr</th>
                  <th data-sort="spot_to_perp_bps" data-tip="Buy spot at ask and sell perpetual at bid. 100 bps = 1%. Research signal only.">spot-&gt;perp</th>
                  <th data-sort="perp_to_spot_bps" data-tip="Buy perpetual at ask and sell spot at bid. Requires inventory or borrow in real markets; research signal only.">perp-&gt;spot</th>
                  <th data-sort="abs_basis_bps" data-tip="Maximum absolute basis across both directions, shown in bps or percent.">abs basis</th>
                  <th data-sort="funding_rate" data-tip="USD-M perpetual funding rate from Binance public mark-price streams.">funding</th>
                  <th data-sort="age_seconds" data-tip="Age of the latest public-data snapshot for this symbol.">age</th>
                  <th data-sort="opportunity_score" data-tip="Ranking signal combining basis size, spread quality, and freshness. Not trading advice.">score</th>
                  <th data-sort="status" data-tip="LIVE means fresh. STALE means the latest row is older than the configured age gate.">status</th>
                  <th class="action-cell">actions</th>
                </tr>
              </thead>
              <tbody id="liveRows"><tr><td colspan="19" class="empty">Waiting for collector snapshots...</td></tr></tbody>
            </table>
          </div>
          <div id="radarPager" class="pager"></div>
        </div>
      </section>

      <section id="tab-opps" class="tab-panel">
        <div class="grid-4">
          <div class="plane"><div class="section-head"><div class="section-title">Top Spot->Perp</div></div><div id="spotOpps" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Top Perp->Spot</div></div><div id="perpOpps" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Positive Funding</div></div><div id="fundPos" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Negative Funding</div></div><div id="fundNeg" class="mini-list"></div></div>
        </div>
        <div class="grid-2" style="margin-top:12px">
          <div class="plane"><div class="section-head"><div><div class="section-title">Hot Basis Expansion</div><div class="section-sub">15m history when available</div></div></div><div id="basisExpansion" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Research Note</div></div><div class="empty">Signals are public-data research only. No account access, order entry, execution routing, or trading automation exists in this app.</div></div>
        </div>
      </section>

      <section id="tab-funding" class="tab-panel">
        <div class="grid-2">
          <div class="plane"><div class="section-head"><div class="section-title">Positive Funding Leaderboard</div></div><div id="fundingPositive" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Negative Funding Leaderboard</div></div><div id="fundingNegative" class="mini-list"></div></div>
        </div>
        <div class="grid-2" style="margin-top:12px">
          <div class="plane"><div class="section-head"><div class="section-title">Funding Distribution</div></div><div id="fundingChart" class="chart sm"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Funding Change</div><div class="section-sub">15m when history exists</div></div><div id="fundingChanges" class="mini-list"></div></div>
        </div>
      </section>

      <section id="tab-movers" class="tab-panel">
        <div class="plane">
          <div class="section-head">
            <div><div class="section-title">Market Movers</div><div class="section-sub">Spot, futures, basis, and funding changes from stored snapshots.</div></div>
            <div class="controls" id="moverRanges">
              <button class="range-btn" data-minutes="1">1m</button>
              <button class="range-btn" data-minutes="5">5m</button>
              <button class="range-btn" data-minutes="15">15m</button>
              <button class="range-btn" data-minutes="60">60m</button>
            </div>
          </div>
          <div class="grid-4" style="padding:12px 0 0">
            <div class="plane"><div class="section-head"><div class="section-title">Spot Up</div></div><div id="spotUp" class="mini-list"></div></div>
            <div class="plane"><div class="section-head"><div class="section-title">Spot Down</div></div><div id="spotDown" class="mini-list"></div></div>
            <div class="plane"><div class="section-head"><div class="section-title">Basis Expanders</div></div><div id="basisWide" class="mini-list"></div></div>
            <div class="plane"><div class="section-head"><div class="section-title">Basis Compressors</div></div><div id="basisCompress" class="mini-list"></div></div>
          </div>
        </div>
      </section>

      <section id="tab-heatmap" class="tab-panel">
        <div class="plane">
          <div class="section-head">
            <div><div class="section-title">Basis / Funding Heatmap</div><div class="section-sub">Tile intensity follows selected view.</div></div>
            <div class="controls">
              <button id="heatBasis" class="range-btn active">Basis</button>
              <button id="heatFunding" class="range-btn">Funding</button>
              <button id="heatScore" class="range-btn">Score</button>
              <span class="seg" id="heatThresholds" title="Minimum absolute basis threshold"><button data-heat-threshold="0">All</button><button data-heat-threshold="25">25</button><button data-heat-threshold="50">50</button><button data-heat-threshold="100">100</button></span>
              <select id="heatSort" title="Heatmap sort">
                <option value="abs_basis_bps">Abs basis</option>
                <option value="funding_rate">Funding</option>
                <option value="opportunity_score">Score</option>
                <option value="age_seconds">Age</option>
              </select>
            </div>
          </div>
          <div id="heatmap" class="heatmap"></div>
        </div>
      </section>

      <section id="tab-detail" class="tab-panel">
        <div class="detail-grid">
          <div class="plane">
            <div class="section-head"><div><div class="section-title">Instrument</div><div class="section-sub">Deep linkable selected symbol</div></div><button id="detailBack" class="icon-btn" title="Back to markets"><svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button></div>
            <div class="detail-hero">
              <div class="detail-title" id="detailSymbol">--</div>
              <div class="detail-actions">
                <button id="detailSearch" title="Search another symbol"><svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Search</button>
                <button id="detailCopy" title="Copy selected symbol"><svg class="ic" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>Copy</button>
                <button id="detailStar" class="star" title="Favorite selected symbol">☆</button>
              </div>
              <div class="detail-note">Use search or any table, heatmap, or watchlist row to change the selected instrument. No raw symbol dropdown is rendered.</div>
            </div>
            <div id="detailKvs" class="kv-grid"></div>
            <div class="section-head"><div><div class="section-title">Book &amp; basis</div><div class="section-sub">Top-of-book spot vs perp</div></div></div>
            <div id="detailBook" class="book-viz"></div>
            <div class="section-head"><div><div class="section-title">Recent Extremes</div><div class="section-sub">Current row and loaded history</div></div></div>
            <div id="detailExtremes" class="mini-list"></div>
          </div>
          <div class="plane">
            <div class="section-head">
              <div class="detail-tabs" id="symbolTabs">
                <button class="range-btn" data-symbol-tab="overview">Overview</button>
                <button class="range-btn" data-symbol-tab="basis">Basis</button>
                <button class="range-btn" data-symbol-tab="price">Price</button>
                <button class="range-btn" data-symbol-tab="funding">Funding</button>
                <button class="range-btn" data-symbol-tab="spread">Spread</button>
                <button class="range-btn" data-symbol-tab="quality">Quality</button>
              </div>
              <div class="controls" id="historyRanges">
                <button class="range-btn" data-window="5m">5m</button>
                <button class="range-btn" data-window="15m">15m</button>
                <button class="range-btn" data-window="1h">1h</button>
                <button class="range-btn" data-window="4h">4h</button>
                <button class="range-btn" data-window="24h">24h</button>
                <button class="range-btn" data-window="7d">7D</button>
                <button class="range-btn" data-window="all">All</button>
              </div>
            </div>
            <div class="chart-toolbar" id="chartTools">
              <span class="seg" id="chartType" data-tip="Line or filled-area rendering."><button data-ctype="line">Line</button><button data-ctype="area">Area</button></span>
              <span class="seg" id="chartMA" data-tip="Overlay a moving average on the primary series."><button data-ma="off">MA off</button><button data-ma="ma">SMA</button><button data-ma="ema">EMA</button></span>
              <span class="seg" id="chartScale" data-tip="Linear or log price axis (log only applies to positive price series)."><button data-scale="linear">Lin</button><button data-scale="log">Log</button></span>
              <span class="chart-tool-sp"></span>
              <button id="chartFs" class="range-btn" title="Expand chart (F)"><svg class="ic" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg></button>
            </div>
            <div id="detailChart" class="chart"></div>
            <div id="detailTabContent" class="detail-content"></div>
          </div>
        </div>
      </section>

      <section id="tab-desk" class="tab-panel">
        <div class="desk-shell">
          <div class="desk-main">
            <div class="desk-hero" id="deskHero">
              <div>
                <div class="desk-kicker">Research desk · public snapshot</div>
                <div class="desk-title" id="deskTitle"><span class="token">--</span><div><b>Desk warming</b><span class="muted">select any symbol</span></div></div>
                <div class="desk-price" id="deskPrice">--</div>
                <div class="desk-sub" id="deskSub"><span class="muted">Waiting for cached rows.</span></div>
              </div>
              <div class="desk-actions">
                <button id="deskDetail" class="desk-action primary" title="Open selected symbol detail"><svg class="ic" viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>Detail</button>
                <button id="deskPin" class="desk-action" title="Pin selected symbol"><svg class="ic" viewBox="0 0 24 24"><path d="M12 17.8 5.8 21l1.2-6.9L2 9.2l6.9-1L12 2l3.1 6.2 6.9 1-5 4.9L18.2 21z"/></svg>Pin</button>
                <button id="deskCycle" class="desk-action" title="Jump to the strongest basis symbol"><svg class="ic" viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>Cycle</button>
                <button id="deskQuality" class="desk-action" title="Open network and DB quality"><svg class="ic" viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>Health</button>
              </div>
            </div>
            <div class="desk-card">
              <div class="section-head"><div><div class="section-title">Price, Basis &amp; Funding Chart</div><div class="section-sub">Loads selected-symbol history only while Desk is visible</div></div><span class="pill muted" data-tip="This is a research chart built from the existing SQLite/cache API, not an embedded third-party chart.">canvas chart</span></div>
              <div id="deskChart" class="desk-chart"></div>
              <div class="desk-strip" id="deskStrip"></div>
              <div class="desk-lane"><div id="deskLane" class="desk-lane-track"></div></div>
            </div>
          </div>
          <aside class="desk-side">
            <div class="desk-card">
              <div class="section-head"><div><div class="section-title">Book Lens</div><div class="section-sub">Best bid / ask snapshot, not full exchange depth</div></div></div>
              <div id="deskDepth" class="desk-depth"></div>
            </div>
            <div class="desk-card">
              <div class="section-head"><div><div class="section-title">Basis Prints</div><div class="section-sub">Latest cached symbols by dislocation</div></div></div>
              <div id="deskPrints" class="desk-print-list"></div>
            </div>
            <div class="desk-card">
              <div class="section-head"><div><div class="section-title">Control Console</div><div class="section-sub">Fast moves without rendering hidden pages</div></div></div>
              <div class="desk-console" id="deskConsole"></div>
            </div>
          </aside>
        </div>
      </section>

      <section id="tab-quality" class="tab-panel">
        <div id="qualityGrid" class="statbar"></div>
        <div class="grid-2">
          <div class="plane"><div class="section-head"><div class="section-title">Selftest</div><button id="runSelftest">Run</button></div><div id="selftestBox" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div class="section-title">Debug Links</div></div><div class="empty"><a class="blue" href="/api/debug" target="_blank">/api/debug</a><br><a class="blue" href="/api/selftest" target="_blank">/api/selftest</a><br><span class="muted">Use scripts/web_debug.py for CLI DB inspection.</span></div></div>
        </div>
        <section id="qualityTimelineSection" class="plane section" style="margin-top:18px">
          <div class="section-head"><div><div class="section-title">Data Quality Timeline</div><div class="section-sub">Latest cache and collector events from the in-memory state</div></div></div>
          <div id="qualityTimeline" class="timeline"></div>
        </section>
      </section>

      <section id="tab-pulse" class="tab-panel">
        <div class="grid-2">
          <div class="plane"><div class="section-head"><div><div class="section-title">Market Regime</div><div class="section-sub">Derived from SQLite live rows</div></div></div><div id="regimeBox" class="mini-list"></div></div>
          <div class="plane"><div class="section-head"><div><div class="section-title">Optional Futures Enrichment</div><div class="section-sub">Public Binance REST, cached conservatively</div></div><button id="refreshEnrichment">Refresh</button></div><div id="enrichmentBox" class="mini-list"></div></div>
        </div>
      </section>

      <section id="methodology" class="plane section" style="margin-top:18px">
        <div class="section-head"><div><div class="section-title">Methodology — what this measures</div><div class="section-sub">Public Binance spot + USD-M perpetual data only</div></div></div>
        <div class="flow" aria-label="How basis is measured">
          <div class="flow-node"><span class="fn-ic green"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span><b>Spot book</b><span class="muted">best bid / ask from public spot streams</span></div>
          <div class="flow-link"><span class="fl-label">bid / ask</span></div>
          <div class="flow-node accent"><span class="fn-ic accent"><svg viewBox="0 0 24 24"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg></span><b>Basis engine</b><span class="muted">abs basis · spread · funding · score</span></div>
          <div class="flow-link"><span class="fl-label">executable gap</span></div>
          <div class="flow-node"><span class="fn-ic magenta"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span><b>Perp book</b><span class="muted">best bid / ask from USD-M perp streams</span></div>
        </div>
        <div class="method">
          <div class="cols">
            <div><b>Basis</b> is the gap between spot and perpetual, in basis points. <b>100 bps = 1%</b>. Toggle bps/% anytime.</div>
            <div><b>spot→perp</b>: buy spot at ask, sell perp at bid — the executable-ish long-basis gap.</div>
            <div><b>perp→spot</b>: buy perp at ask, sell spot at bid — needs spot inventory/borrow, signal only.</div>
            <div><b>Funding</b> is the USD-M perpetual funding rate from the public mark-price stream, shown as a percent.</div>
            <div><b>Age</b> is how long since the latest snapshot for a symbol. <b>LIVE</b> ≤ 15s, else <b>STALE</b>; <b>SYNCING</b> while warming.</div>
            <div><b>Score</b> ranks abs basis + spread quality + freshness. Research only — no execution or account access.</div>
          </div>
        </div>
      </section>
      <footer class="footer">
        <div class="foot-grid">
          <span>Public market data only</span><span class="dim">·</span>
          <span>No API keys</span><span class="dim">·</span>
          <span>No trading</span><span class="dim">·</span>
          <span>Binance public streams</span><span class="dim">·</span>
          <span id="footCache" class="muted">cache --</span><span class="dim">·</span>
          <span>Charts by <a href="https://echarts.apache.org/" target="_blank">Apache ECharts</a> · Icons <a href="https://github.com/spothq/cryptocurrency-icons" target="_blank">CC0</a></span>
        </div>
      </footer>
    </section>

    <aside class="rail">
      <section class="rail-section"><div class="section-head"><div><div class="section-title">Market Activity</div><div class="section-sub">Live events from the public-data stream</div></div><span class="live-dot" style="width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 1.6s infinite"></span></div><div id="activityFeed" class="feed"></div></section>
      <section class="rail-section"><div class="section-head"><div><div class="section-title">Watchlist</div><div class="section-sub">Pinned, majors, strongest basis</div></div></div><div id="watchlist" class="mini-list"></div></section>
      <section class="rail-section"><div class="section-head"><div><div class="section-title">Selected Symbol</div><div class="section-sub">Current context, recent picks, strongest basis</div></div></div><div id="contextBox" class="mini-list"></div></section>
    </aside>
  </main>

  <div id="helpMask" class="help-mask">
    <div class="help-sheet">
      <div class="section-head">
        <div class="section-title"><svg class="ic" viewBox="0 0 24 24" style="vertical-align:-3px;margin-right:6px"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>Keyboard &amp; usage</div>
        <button id="helpClose" class="icon-btn" title="Close ( Esc )"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="help-body">
        <div class="help-row"><span>Focus search</span><kbd>/</kbd></div>
        <div class="help-row"><span>Toggle theme</span><kbd>D</kbd></div>
        <div class="help-row"><span>Radar</span><kbd>1</kbd></div>
        <div class="help-row"><span>Opportunities</span><kbd>2</kbd></div>
        <div class="help-row"><span>Funding</span><kbd>3</kbd></div>
        <div class="help-row"><span>Movers</span><kbd>4</kbd></div>
        <div class="help-row"><span>Heatmap</span><kbd>5</kbd></div>
        <div class="help-row"><span>Symbol detail</span><kbd>6</kbd></div>
        <div class="help-row"><span>Data quality</span><kbd>7</kbd></div>
        <div class="help-row"><span>Futures pulse</span><kbd>8</kbd></div>
        <div class="help-row"><span>Fullscreen detail chart</span><kbd>F</kbd></div>
        <div class="help-row"><span>This help</span><kbd>?</kbd></div>
        <div class="help-row"><span>Close overlay</span><kbd>Esc</kbd></div>
      </div>
      <div class="help-note">Public Binance spot + USD-M perpetual data only. No API keys, no account access, no order entry, no trading. Click any row, tile, or watchlist item to focus a symbol; click the star to pin a watchlist. Tables, search, filters, theme, and selection survive every refresh.</div>
    </div>
  </div>

  <div id="cmdMask" class="cmd-mask">
    <div class="cmd">
      <input id="cmdInput" type="text" placeholder="Search symbol — type to filter, Enter to open" autocomplete="off" spellcheck="false">
      <div id="cmdList" class="cmd-list"></div>
    </div>
  </div>

  <div id="drawerMask" class="drawer-mask"></div>
  <aside id="settingsDrawer" class="drawer">
    <div class="drawer-head">
      <div class="section-title"><svg class="ic" viewBox="0 0 24 24" style="vertical-align:-3px;margin-right:6px"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.8 7.8 0 0 0-2.6-1.5L14 0h-4l-.5 2.6A7.8 7.8 0 0 0 6.9 4l-2.3-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.8 7.8 0 0 0 2.6 1.5L10 24h4l.5-2.6a7.8 7.8 0 0 0 2.6-1.5l2.3 1 2-3.4z"/></svg>Settings</div>
      <button id="settingsClose" class="icon-btn" title="Close ( Esc )"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="drawer-body">
      <div class="set-row"><span class="set-label">Theme</span><span class="seg" id="setTheme"><button data-theme="system">System</button><button data-theme="light">Light</button><button data-theme="dark">Dark</button></span></div>
      <div class="set-row"><span class="set-label">Basis units</span><span class="seg" id="setUnit"><button data-unit="bps">bps</button><button data-unit="pct">%</button></span></div>
      <div class="set-row"><span class="set-label">Density</span><span class="seg" id="setDensity"><button data-density="comfortable">Comfortable</button><button data-density="compact">Compact</button></span></div>
      <div class="set-row"><span class="set-label">Refresh speed</span><span class="seg" id="setRefresh"><button data-refresh="1500">1.5s</button><button data-refresh="3000">3s</button><button data-refresh="5000">5s</button></span></div>
      <div class="set-row"><span class="set-label">Rows per page</span><span class="seg" id="setPageSize"><button data-size="25">25</button><button data-size="50">50</button><button data-size="100">100</button><button data-size="200">200</button></span></div>
      <div class="set-row"><span class="set-label">Default chart window</span><span class="seg" id="setWindow"><button data-window="15m">15m</button><button data-window="1h">1h</button><button data-window="4h">4h</button><button data-window="24h">24h</button><button data-window="7d">7D</button></span></div>
      <div class="set-row"><span class="set-label">Motion</span><span class="seg" id="setMotion"><button data-motion="full">Full</button><button data-motion="reduced">Reduced</button></span></div>
      <div class="set-row"><span class="set-label">Currency display</span><span class="seg currency-seg" id="setCurrency"><button data-currency="usdt">USDT/USD active</button><button data-currency="inr" disabled title="Coming after a cached FX feed is added">INR soon</button><button data-currency="eur" disabled title="Coming after a cached FX feed is added">EUR soon</button><button data-currency="gbp" disabled title="Coming after a cached FX feed is added">GBP soon</button><button data-currency="jpy" disabled title="Coming after a cached FX feed is added">JPY soon</button></span></div>
      <div class="set-row"><button id="resetPrefs" class="link-btn">Reset all preferences</button></div>
      <div class="help-note" style="padding:4px 0 0">Preferences are stored locally in your browser. No account, no server-side state.</div>
    </div>
  </aside>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <button id="netBadge" class="net-badge" title="Network health — click for data quality" aria-label="Network health">
    <span class="net-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="net-txt"><strong id="netMs">--</strong><span id="netState">link</span></span>
    <div class="net-pop" id="netPop"></div>
  </button>
  <div id="chartFsMask" class="chart-fs-mask">
    <div class="chart-fs">
      <div class="chart-fs-head">
        <span class="section-title" id="chartFsTitle">Chart</span>
        <button id="chartFsClose" class="icon-btn" title="Close ( Esc )"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div id="chartFsBox" class="chart-fs-box"></div>
    </div>
  </div>

  <script>window.__BOOTSTRAP_STATE__ = "__CG_BOOTSTRAP_JSON__"; window.__CG_ICONS__ = "__CG_ICONS__";</script>
  <script>
    const MAJORS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"];
    const FETCH_TIMEOUT_MS = 9000;
    const STATE_TIMEOUT_MS = 8000;
    const POLL_MS = 1500;
    const state = {
      summary: null,
      live: null,
      rows: [],
      symbols: [],
      ticker: null,
      watchlist: null,
      opportunities: null,
      funding: null,
      movers: null,
      heatmap: null,
      history: [],
      enrichment: null,
      regime: null,
      selftest: null,
      health: null,
      cacheMetrics: null,
      tab: localStorage.getItem("cg.tab") || "radar",
      search: localStorage.getItem("cg.search") || "",
      theme: localStorage.getItem("cg.theme") || "light",
      selectedSymbol: localStorage.getItem("cg.selectedSymbol") || "BTCUSDT",
      filter: localStorage.getItem("cg.filter") || "all",
      threshold: Number(localStorage.getItem("cg.threshold") || "0"),
      pinned: JSON.parse(localStorage.getItem("cg.pinned") || "[]"),
      recent: JSON.parse(localStorage.getItem("cg.recent") || "[]"),
      chart: localStorage.getItem("cg.chart") || "basis",
      symbolTab: localStorage.getItem("cg.symbolTab") || "overview",
      historyMinutes: Number(localStorage.getItem("cg.historyMinutes") || "60"),
      moverMinutes: Number(localStorage.getItem("cg.moverMinutes") || "5"),
      heatMode: localStorage.getItem("cg.heatMode") || "basis",
      heatThreshold: Number(localStorage.getItem("cg.heatThreshold") || "0"),
      heatSort: localStorage.getItem("cg.heatSort") || "abs_basis_bps",
      basisUnit: localStorage.getItem("cg.basisUnit") || "bps",
      themeMode: localStorage.getItem("cg.themeMode") || "light",
      density: localStorage.getItem("cg.density") || "comfortable",
      refreshMs: Number(localStorage.getItem("cg.refreshMs") || "1500"),
      pageSize: Number(localStorage.getItem("cg.pageSize") || "50"),
      chartWindow: localStorage.getItem("cg.chartWindow") || "1h",
      chartType: localStorage.getItem("cg.chartType") || "area",
      chartMA: localStorage.getItem("cg.chartMA") || "off",
      chartScale: localStorage.getItem("cg.chartScale") || "linear",
      motionMode: localStorage.getItem("cg.motionMode") || "full",
      currencyMode: localStorage.getItem("cg.currencyMode") || "usdt",
      page: 1,
      radarMeta: null,
      cmdResults: [],
      cmdIndex: 0,
      pollTimer: null,
      sortKey: "abs_basis_bps",
      sortDir: -1,
      lastGood: {},
      previous: new Map(),
      spark: new Map(),
      errors: [],
      activity: [],
      pulseBuf: [],
      pollFailures: {},
      retryCount: 0,
      consecutiveFailures: 0,
      lastLatencyMs: null,
      lastPollTime: "--",
      refreshing: false,
      enrichmentAt: 0,
    };
    const $ = (id) => document.getElementById(id);
    // Anti-flicker: only touch the DOM when the rendered value actually changed.
    function setHTMLIfChanged(el, html) { if (!el) return false; if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; }
    function setTextIfChanged(el, text) { if (!el) return false; text = String(text ?? ""); if (el.textContent !== text) { el.textContent = text; return true; } return false; }
    function setClassIfChanged(el, cls) { if (!el) return false; if (el.className !== cls) { el.className = cls; return true; } return false; }
    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    const fmt = (n, d=2) => n === null || n === undefined || Number.isNaN(Number(n)) ? "--" : Number(n).toLocaleString(undefined, {maximumFractionDigits:d});
    const fixed = (n, d=2) => n === null || n === undefined || Number.isNaN(Number(n)) ? "--" : Number(n).toFixed(d);
    const bps = (n) => fixed(n, 2);
    const basisFmt = (v) => (v === null || v === undefined || Number.isNaN(Number(v))) ? "--" : (state.basisUnit === "pct" ? `${(Number(v) / 100).toFixed(4)}%` : Number(v).toFixed(2));
    const pct = (n) => n === null || n === undefined || Number.isNaN(Number(n)) ? "--" : `${(Number(n) * 100).toFixed(4)}%`;
    const pctPlain = (n) => n === null || n === undefined || Number.isNaN(Number(n)) ? "--" : `${Number(n).toFixed(3)}%`;
    const seconds = (n) => {
      if (n === null || n === undefined || Number.isNaN(Number(n))) return "--";
      const s = Number(n);
      if (s < 1) return `${s.toFixed(1)}s`;
      if (s < 60) return `${Math.round(s)}s`;
      if (s < 3600) return `${Math.round(s / 60)}m`;
      return `${Math.round(s / 3600)}h`;
    };
    const ICON_SET = new Set((Array.isArray(window.__CG_ICONS__) ? window.__CG_ICONS__ : []).map(s => String(s).toUpperCase()));
    const iconBase = (symbol) => String(symbol || "").toUpperCase().replace(/(USDT|USDC|BUSD|FDUSD|USD)$/, "");
    const tokenLetters = (symbol) => { const b = iconBase(symbol) || "TKN"; return b.length <= 4 ? b : b.slice(0, 3); };
    function hashHue(s) { let h = 0; s = String(s || ""); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
    // Missing/broken icon files fall back to a crisp colored monogram — never an empty circle.
    window.cgIconFallback = function (img) { const s = document.createElement("span"); s.className = "token mono"; s.style.setProperty("--h", img.dataset.hue); s.setAttribute("aria-hidden", "true"); s.textContent = img.dataset.letters; img.replaceWith(s); };
    function tokenIcon(symbol) {
      const base = iconBase(symbol), letters = tokenLetters(symbol), hue = hashHue(base || symbol);
      if (ICON_SET.has(base)) return `<img class="token-img" data-hue="${hue}" data-letters="${esc(letters)}" src="/static/icons/${base.toLowerCase()}.svg" alt="" loading="lazy" width="20" height="20" onerror="cgIconFallback(this)">`;
      return `<span class="token mono" style="--h:${hue}" aria-hidden="true">${esc(letters)}</span>`;
    }
    function priceDecimals(n) { const a = Math.abs(Number(n) || 0); if (!a) return 2; if (a >= 1000) return 2; if (a >= 100) return 3; if (a >= 1) return 4; if (a >= 0.01) return 6; return 8; }
    // Coinbase/Uniswap/TradingView-style micro price: 0.00000042 -> 0.0<sub>5</sub>42
    function subZeros(s) {
      if (typeof s !== "string") s = String(s);
      const m = s.match(/^(-?)(\d+)\.(0{3,})(\d+)$/);
      if (!m) return s;
      return `${m[1]}${m[2]}.0<sub class="subz">${m[3].length}</sub>${m[4]}`;
    }
    const price = (n) => subZeros(fmt(n, priceDecimals(n)));
    const ICONS = {
      sun: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
      moon: '<svg class="ic" viewBox="0 0 24 24"><path d="M21 12.8A8 8 0 1 1 11.2 3 6 6 0 0 0 21 12.8z"/></svg>',
    };
    function pushSpark(rows) {
      const cap = 48;
      for (const r of rows || []) {
        const mid = Number(r.spot_mid) || Number(r.futures_mid) || 0;
        if (!mid) continue;
        const buf = state.spark.get(r.symbol) || [];
        if (buf.length && buf[buf.length - 1] === mid) continue;
        buf.push(mid);
        if (buf.length > cap) buf.shift();
        state.spark.set(r.symbol, buf);
      }
    }
    function sparkline(symbol, w=66, h=18, area=false) {
      const buf = state.spark.get(symbol) || [];
      if (buf.length < 2) return `<span class="spark-wrap"><svg class="spark" width="${w}" height="${h}"></svg></span>`;
      const min = Math.min(...buf), max = Math.max(...buf), span = (max - min) || 1;
      const pts = buf.map((v, i) => `${((i / (buf.length - 1)) * w).toFixed(1)},${(h - 1 - ((v - min) / span) * (h - 2)).toFixed(1)}`).join(" ");
      const up = buf[buf.length - 1] >= buf[0];
      const col = up ? "var(--green)" : "var(--red)";
      const last = pts.split(" ").pop().split(",");
      const areaEl = area ? `<polygon points="0,${h} ${pts} ${w},${h}" fill="${col}" fill-opacity="0.13" stroke="none"/>` : "";
      return `<span class="spark-wrap"><svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${areaEl}<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="1.6" fill="${col}"/></svg></span>`;
    }
    function basisClass(v) { const n = Math.abs(Number(v) || 0); if (n >= 100) return "basis-100"; if (n >= 50) return "basis-50"; if (n >= 25) return "basis-25"; return Number(v) >= 0 ? "pos" : "neg"; }
    function fundingClass(v) { const n = Number(v) || 0; return n > 0 ? "yellow" : n < 0 ? "magenta" : "muted"; }
    function badge(row) { if (!row || row.status !== "LIVE") return `<span class="badge stale">STALE</span>`; if (row.abs_basis_bps >= 100) return `<span class="badge hot">HOT</span>`; if (row.abs_basis_bps >= 25) return `<span class="badge watch">WATCH</span>`; return `<span class="badge live">LIVE</span>`; }
    function metric(label, value, hint="", cls="") { return `<div class="stat"><div class="k">${esc(label)}</div><div class="v ${cls}">${value}</div><div class="s">${esc(hint)}</div></div>`; }
    function savePinned() { localStorage.setItem("cg.pinned", JSON.stringify(state.pinned)); }
    function saveRecent() { localStorage.setItem("cg.recent", JSON.stringify(state.recent)); }
    function isPinned(symbol) { return state.pinned.includes(symbol); }
    function togglePin(symbol) { if (!symbol) return; const adding = !isPinned(symbol); state.pinned = adding ? [symbol, ...state.pinned].slice(0, 48) : state.pinned.filter(s => s !== symbol); savePinned(); if (adding && typeof pushActivity === "function") pushActivity("info", `Pinned <b>${esc(symbol)}</b> to watchlist`, symbol); renderAll(); }
    let toastTimer = null;
    function showToast(message) {
      const el = $("toast"); if (!el) return;
      el.textContent = message;
      el.classList.add("open");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove("open"), 1200);
    }
    function copySymbol(symbol) {
      const clean = cleanSymbol(symbol);
      if (!clean) return;
      navigator.clipboard?.writeText(clean);
      showToast(`Copied ${clean}`);
    }
    function cleanSymbol(symbol) { return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
    function updateDeepLink() {
      const params = new URLSearchParams(location.search);
      if (state.selectedSymbol) params.set("symbol", state.selectedSymbol);
      let nextPath = location.pathname.replace(/^\/symbol\/[^/?#]+/, "/");
      if (state.tab === "detail" && state.selectedSymbol) {
        params.set("tab", state.symbolTab || "overview");
        params.set("window", state.chartWindow);
        nextPath = `/symbol/${state.selectedSymbol}`;
      } else {
        params.set("tab", state.tab);
        params.delete("window");
      }
      history.replaceState(null, "", `${nextPath}?${params.toString()}`);
    }
    function selectSymbol(symbol) {
      const clean = cleanSymbol(symbol);
      if (!clean) return;
      state.selectedSymbol = clean;
      state.history = [];
      state.recent = [clean, ...state.recent.filter(s => s !== clean)].slice(0, 10);
      localStorage.setItem("cg.selectedSymbol", clean);
      saveRecent();
      if (typeof pushActivity === "function") pushActivity("info", `Opened <b>${esc(clean)}</b> detail`, clean);
      setTab("detail");
      loadHistory();
      renderAll();
    }
    function flash(symbol, key, value) {
      const id = `${symbol}:${key}`;
      const old = state.previous.get(id);
      state.previous.set(id, value);
      if (old === undefined || Math.abs(Number(old) - Number(value)) <= 0.0000001) return "";
      return Number(value) > Number(old) ? "flash-up" : "flash-down";
    }
    function resolvedTheme() {
      if (state.themeMode === "system") return (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
      return state.themeMode === "light" ? "light" : "dark";
    }
    function applyTheme() {
      state.theme = resolvedTheme();
      document.documentElement.dataset.theme = state.theme;
      document.documentElement.dataset.density = state.density;
      document.documentElement.dataset.motion = state.motionMode;
      $("themeToggle").innerHTML = state.theme === "dark" ? ICONS.sun : ICONS.moon;
    }
    function syncSettingsUI() {
      const set = (sel, attr, val) => document.querySelectorAll(sel + " button").forEach(b => b.classList.toggle("active", b.dataset[attr] === String(val)));
      set("#setTheme", "theme", state.themeMode);
      set("#setUnit", "unit", state.basisUnit);
      set("#setDensity", "density", state.density);
      set("#setRefresh", "refresh", state.refreshMs);
      set("#setPageSize", "size", state.pageSize);
      set("#setWindow", "window", state.chartWindow);
      set("#setMotion", "motion", state.motionMode);
      set("#setCurrency", "currency", state.currencyMode);
      syncSegThumbs();
    }
    function setPoll(ms) {
      state.refreshMs = ms; localStorage.setItem("cg.refreshMs", ms);
      if (state.pollTimer) clearInterval(state.pollTimer);
      state.pollTimer = setInterval(poll, state.refreshMs);
    }
    async function fetchJSON(url, timeoutMs=FETCH_TIMEOUT_MS) {
      const started = performance.now();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      let response;
      try {
        response = await Promise.race([fetch(url, {cache: "no-store"}), timeout]);
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      data.client_latency_ms = performance.now() - started;
      return data;
    }
    function useful(name, data) {
      if (!data || data.ok === false) return false;
      if (["live","ticker","watchlist","heatmap"].includes(name)) return (data.rows || []).length > 0 || !state.lastGood[name];
      if (name === "symbols") return (data.symbols || []).length > 0 || !state.lastGood[name];
      if (name === "summary") return Number(data.metrics?.total_symbols || 0) > 0 || !state.lastGood[name];
      return true;
    }
    async function load(name, url, timeout=FETCH_TIMEOUT_MS) {
      try {
        const data = await fetchJSON(url, timeout);
        state.pollFailures[name] = false;
        state.lastLatencyMs = data.client_latency_ms;
        if (useful(name, data)) state.lastGood[name] = data;
        return data;
      } catch (err) {
        state.pollFailures[name] = true;
        state.retryCount += 1;
        state.errors.unshift(`${new Date().toLocaleTimeString()} ${name}: ${err.message || err}`);
        state.errors = state.errors.slice(0, 12);
        return state.lastGood[name] || null;
      }
    }
    function liveAge(health) {
      // Tick the collector age client-side between polls for a live feel.
      if (health?.latest_ts_ms) return Math.max(0, (Date.now() - Number(health.latest_ts_ms)) / 1000);
      return health?.freshness_age_seconds;
    }
    function renderStatus(health, degraded=false) {
      // Calm status: LIVE / STALE / SYNCING only. Failures never show a scary
      // banner on the main page — details live in the debug drawer.
      const age = liveAge(health);
      const raw = health?.status || "DB WARMING";
      let label = "SYNCING", cls = "warming";
      if (raw === "DB ERROR") { label = "STALE"; cls = "error"; }
      else if (raw === "LIVE" && age != null && age <= 20) { label = "LIVE"; cls = ""; }
      else if (raw === "LIVE" || raw === "STALE") { label = "STALE"; cls = "stale"; }
      else { label = "SYNCING"; cls = "warming"; }
      // Prolonged core-poll failures: show SYNCING (reconnecting), not a red wall.
      if (degraded && cls !== "error") { label = "SYNCING"; cls = "warming"; }
      const pill = $("statusPill");
      setTextIfChanged(pill, label);
      setClassIfChanged(pill, "pill status-pill " + cls);
      const ageEl = $("collectorAge"); if (ageEl) setTextIfChanged(ageEl, seconds(age));
      const symEl = $("symbolCount"); if (symEl) setTextIfChanged(symEl, health?.tracked_symbols ?? 0);
      const cm = state.cacheMetrics;
      const latEl = $("latency");
      if (latEl) { const latency = state.lastLatencyMs == null ? "--" : `${state.lastLatencyMs.toFixed(0)}ms`; setTextIfChanged(latEl, cm && cm.last_refresh_ms != null ? `${latency} · cache ${Math.round(cm.last_refresh_ms)}ms` : latency); }
      $("errorToggle").classList.toggle("has-errors", state.errors.length > 0);
      setHTMLIfChanged($("errorDrawer"), state.errors.length ? state.errors.map(esc).join("<br>") : "No recent errors. Last-good data stays on screen during transient hiccups.");
    }
    function prefersReducedMotion() { return state.motionMode === "reduced" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
    function syncSegThumb(seg) {
      if (!seg) return;
      let thumb = seg.querySelector(".seg-thumb");
      if (!thumb) {
        thumb = document.createElement("span");
        thumb.className = "seg-thumb";
        thumb.setAttribute("aria-hidden", "true");
        seg.prepend(thumb);
      }
      const active = seg.querySelector("button.active") || seg.querySelector("button:not(:disabled)");
      if (!active || !seg.offsetWidth || !active.offsetWidth) return;
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.transform = `translateX(${active.offsetLeft}px)`;
      seg.classList.add("ready");
    }
    function syncSegThumbs() { requestAnimationFrame(() => document.querySelectorAll(".seg").forEach(syncSegThumb)); }
    function flashDir(prev, next) {
      if (!Number.isFinite(Number(prev)) || !Number.isFinite(Number(next))) return "";
      const a = Number(prev), b = Number(next);
      if (b > a + 1e-7) return "flash-up";
      if (b < a - 1e-7) return "flash-down";
      return "";
    }
    function animateInt(el, from, to, ms = 520) {
      to = Number(to); from = Number.isFinite(Number(from)) ? Number(from) : to;
      if (from === to || prefersReducedMotion()) { el.textContent = String(to); return; }
      const start = performance.now(), diff = to - from;
      if (el._raf) cancelAnimationFrame(el._raf);
      const step = (now) => {
        const p = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(from + diff * e));
        if (p < 1) el._raf = requestAnimationFrame(step); else { el.textContent = String(to); el._raf = 0; }
      };
      el._raf = requestAnimationFrame(step);
    }
    function ovDefs() {
      const m = state.summary?.metrics || {};
      const h = state.health || state.summary?.health || state.live?.health || {};
      const cm = state.cacheMetrics || {};
      return [
        {k:"total", label:"Total symbols", val:String(m.total_symbols ?? h.tracked_symbols ?? 0), hint:"distinct in DB", cls:"", num:Number(m.total_symbols ?? h.tracked_symbols ?? 0), count:true},
        {k:"live", label:"Live symbols", val:String(m.live_symbols ?? h.live_symbols ?? 0), hint:"fresh rows", cls:"pos", num:Number(m.live_symbols ?? h.live_symbols ?? 0), count:true},
        {k:"stale", label:"Stale symbols", val:String(m.stale_symbols ?? h.stale_symbol_count ?? 0), hint:"age gated", cls:(m.stale_symbols || 0) ? "neg" : "pos", num:Number(m.stale_symbols ?? h.stale_symbol_count ?? 0), count:true},
        {k:"maxsp", label:"Max spot->perp", val:basisFmt(m.max_spot_to_perp_bps), hint:"bps", cls:basisClass(m.max_spot_to_perp_bps), num:Number(m.max_spot_to_perp_bps)},
        {k:"maxps", label:"Max perp->spot", val:basisFmt(m.max_perp_to_spot_bps), hint:"bps", cls:basisClass(m.max_perp_to_spot_bps), num:Number(m.max_perp_to_spot_bps)},
        {k:"hifund", label:"Highest funding", val:pct(m.highest_funding_rate), hint:"public mark stream", cls:fundingClass(m.highest_funding_rate), num:Number(m.highest_funding_rate)},
        {k:"lofund", label:"Lowest funding", val:pct(m.lowest_funding_rate), hint:"public mark stream", cls:fundingClass(m.lowest_funding_rate), num:Number(m.lowest_funding_rate)},
        {k:"med", label:"Median abs basis", val:basisFmt(m.median_abs_basis_bps), hint:"bps", cls:"", num:Number(m.median_abs_basis_bps)},
        {k:"p95", label:"P95 abs basis", val:basisFmt(m.p95_abs_basis_bps), hint:"bps", cls:basisClass(m.p95_abs_basis_bps), num:Number(m.p95_abs_basis_bps)},
        {k:"buckets", label:"25 / 50 / 100", val:`${m.symbols_above_25_bps ?? 0} / ${m.symbols_above_50_bps ?? 0} / ${m.symbols_above_100_bps ?? 0}`, hint:"symbol counts", cls:""},
        {k:"dbupd", label:"DB update", val:(h.latest_update_utc || "--"), hint:seconds(h.freshness_age_seconds), cls:""},
        {k:"cache", label:"Cache refresh", val:(cm.last_refresh_ms != null ? `${Math.round(cm.last_refresh_ms)}ms` : "--"), hint:`age ${seconds(cm.cache_age_seconds)}`, cls:"", num:Number(cm.last_refresh_ms)},
        {k:"api", label:"API latency", val:(state.lastLatencyMs == null ? "--" : `${state.lastLatencyMs.toFixed(0)}ms`), hint:"/api/state-lite", cls:"", num:Number(state.lastLatencyMs)},
      ];
    }
    function renderOverview() {
      const host = $("overview");
      if (!host) return;   // metric statbar retired in Sprint 4 (health lives in widgets + net badge)
      const defs = ovDefs();
      if (host.childElementCount !== defs.length) {
        host.innerHTML = defs.map(d => `<div class="stat" data-skey="${d.k}"><div class="k">${esc(d.label)}</div><div class="v ${d.cls || ""}">${esc(d.val)}</div><div class="s">${esc(d.hint)}</div></div>`).join("");
        defs.forEach(d => { const v = host.querySelector(`.stat[data-skey="${d.k}"] .v`); if (v) { v.dataset.raw = d.val; v.dataset.num = Number.isFinite(d.num) ? String(d.num) : ""; if (d.count) v.dataset.cur = String(d.num); } });
        return;
      }
      defs.forEach(d => {
        const stat = host.querySelector(`.stat[data-skey="${d.k}"]`); if (!stat) return;
        const v = stat.querySelector(".v"), s = stat.querySelector(".s");
        if (s && s.textContent !== (d.hint || "")) s.textContent = d.hint || "";
        if (v.dataset.raw !== d.val) {
          const dir = flashDir(Number(v.dataset.num), d.num);
          if (d.count && Number.isFinite(d.num)) { animateInt(v, Number(v.dataset.cur), d.num); v.dataset.cur = String(d.num); }
          else v.textContent = d.val;
          v.dataset.raw = d.val;
          if (dir) { v.classList.remove("flash-up", "flash-down"); void v.offsetWidth; v.classList.add(dir); }
        }
        if (Number.isFinite(d.num)) v.dataset.num = String(d.num);
        const up = v.classList.contains("flash-up"), down = v.classList.contains("flash-down");
        v.className = "v " + (d.cls || "") + (up ? " flash-up" : "") + (down ? " flash-down" : "");
      });
    }
    function renderTicker() {
      if (!$("tickerTrack")) return;   // ticker strip retired in Sprint 4 (declutter)
      const rows = state.ticker?.rows || [];
      if (!rows.length) { $("tickerTrack").innerHTML = `<div class="tick-item"><span class="muted">Ticker warming...</span></div>`; return; }
      $("tickerTrack").innerHTML = rows.map(r => {
        const live = r.status === "LIVE";
        return `<div class="tick-item" data-symbol="${esc(r.symbol)}" title="${esc(r.symbol)} · abs basis ${basisFmt(r.abs_basis_bps)} bps">
          <div class="row1"><span class="dot ${live ? "" : "stale"}"></span>${tokenIcon(r.symbol)}<span class="sym">${esc(r.symbol)}</span></div>
          <span class="basis ${basisClass(r.abs_basis_bps)} ${flash(r.symbol, "ticker_basis", r.abs_basis_bps)}">${basisFmt(r.abs_basis_bps)}</span>
          <div class="row2"><span class="price ${flash(r.symbol, "ticker_price", r.spot_mid)}">${price(r.spot_mid)}</span><span class="${fundingClass(r.funding_rate)}">${pct(r.funding_rate)}</span>${sparkline(r.symbol, 66, 18, true)}</div>
          <div class="ticker-popover" role="tooltip">
            <div class="pop-row"><span>Spot bid / ask</span><strong>${price(r.spot_bid)} / ${price(r.spot_ask)}</strong></div>
            <div class="pop-row"><span>Perp bid / ask</span><strong>${price(r.fut_bid)} / ${price(r.fut_ask)}</strong></div>
            <div class="pop-row"><span>Basis</span><strong class="${basisClass(r.abs_basis_bps)}">${basisFmt(r.abs_basis_bps)}</strong></div>
            <div class="pop-row"><span>Funding</span><strong class="${fundingClass(r.funding_rate)}">${pct(r.funding_rate)}</strong></div>
            <div class="pop-row"><span>Age / spread</span><strong>${seconds(r.age_seconds)} / ${bps((Number(r.spot_spread_bps) || 0) + (Number(r.futures_spread_bps) || 0))}</strong></div>
          </div>
        </div>`;
      }).join("");
      document.querySelectorAll(".tick-item[data-symbol]").forEach(el => el.onclick = () => selectSymbol(el.dataset.symbol));
    }
    function visibleRows() {
      // /api/pages/markets already filters + sorts + pages server-side; here we
      // only apply the client-side min-bps threshold slider to the page rows.
      let rows = state.rows || [];
      if (state.threshold > 0) rows = rows.filter(r => Number(r.abs_basis_bps || 0) >= state.threshold);
      return rows;
    }
    function renderPager() {
      const el = $("radarPager"); if (!el) return;
      const m = state.radarMeta || {page: 1, pages: 1, total: (state.rows || []).length, page_size: state.pageSize};
      const page = m.page, pages = m.pages;
      const win = 5, start = Math.max(1, page - Math.floor(win / 2)), end = Math.min(pages, start + win - 1);
      let btns = `<button data-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""}>‹</button>`;
      if (start > 1) btns += `<button data-page="1">1</button>${start > 2 ? '<span class="pinfo">…</span>' : ""}`;
      for (let p = start; p <= end; p++) btns += `<button data-page="${p}" class="${p === page ? "active" : ""}">${p}</button>`;
      if (end < pages) btns += `${end < pages - 1 ? '<span class="pinfo">…</span>' : ""}<button data-page="${pages}">${pages}</button>`;
      btns += `<button data-page="${Math.min(pages, page + 1)}" ${page >= pages ? "disabled" : ""}>›</button>`;
      const changed = setHTMLIfChanged(el, `${btns}<span class="spacer"></span><span class="pinfo">${m.total} symbols · page ${page}/${pages} · ${m.page_size}/page</span>`);
      if (changed) el.querySelectorAll("button[data-page]").forEach(b => b.onclick = () => { state.page = Number(b.dataset.page); loadRadar(); });
    }
    // Column spec drives keyed, in-place cell updates — no per-poll innerHTML rebuild.
    const RCOLS = [
      {c:"spot_bid", f:price, flash:1}, {c:"spot_ask", f:price, flash:1}, {c:"spot_mid", f:price, flash:1},
      {c:"fut_bid", f:price, flash:1}, {c:"fut_ask", f:price, flash:1}, {c:"futures_mid", f:price, flash:1},
      {c:"spot_spread_bps", f:bps}, {c:"futures_spread_bps", f:bps},
      {c:"spot_to_perp_bps", f:basisFmt, flash:1, cls:(v)=>basisClass(v)},
      {c:"perp_to_spot_bps", f:basisFmt, flash:1, cls:(v)=>basisClass(v)},
      {c:"abs_basis_bps", f:basisFmt, flash:1, cls:(v)=>basisClass(v)},
      {c:"funding_rate", f:pct, flash:1, cls:(v)=>fundingClass(v)},
      {c:"age_seconds", f:seconds, cls:(v,r)=>r.status==="LIVE"?"pos":"neg"},
      {c:"opportunity_score", f:bps},
    ];
    const COPY_SVG = `<svg class="ic" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>`;
    const OPEN_SVG = `<svg class="ic" viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>`;
    function buildRadarRow(r) {
      const sym = r.symbol, tr = document.createElement("tr");
      tr.dataset.symbol = sym;
      tr.innerHTML = `<td class="fav-cell"><button class="star" data-pin title="Add favorite">☆</button></td>`
        + `<td class="token-cell">${tokenIcon(sym)}</td>`
        + `<td><div class="symbol-cell slim"><span class="sym">${esc(sym)}</span></div></td>`
        + RCOLS.map(col => `<td data-c="${col.c}"></td>`).join("")
        + `<td data-c="status"></td>`
        + `<td class="action-cell"><span class="row-actions"><button class="icon-btn" data-copy title="Copy symbol">${COPY_SVG}</button><button class="icon-btn" data-open title="Open symbol detail">${OPEN_SVG}</button></span></td>`;
      tr.addEventListener("click", (e) => { if (e.target.closest("[data-pin]") || e.target.closest("[data-copy]") || e.target.closest("[data-open]")) return; selectSymbol(sym); });
      tr.querySelector("[data-pin]").addEventListener("click", (e) => { e.stopPropagation(); togglePin(sym); });
      tr.querySelector("[data-copy]").addEventListener("click", (e) => { e.stopPropagation(); copySymbol(sym); });
      tr.querySelector("[data-open]").addEventListener("click", (e) => { e.stopPropagation(); selectSymbol(sym); });
      return tr;
    }
    function updateRadarRow(tr, r) {
      const selected = r.symbol === state.selectedSymbol;
      if (tr.classList.contains("selected") !== selected) tr.classList.toggle("selected", selected);
      const star = tr.querySelector("[data-pin]"), pin = isPinned(r.symbol), ch = pin ? "★" : "☆";
      if (star.textContent !== ch) { star.textContent = ch; star.classList.toggle("on", pin); star.title = pin ? "Remove favorite" : "Add favorite"; }
      for (const col of RCOLS) {
        const td = tr.querySelector(`[data-c="${col.c}"]`); if (!td) continue;
        const raw = r[col.c], html = col.f(raw);
        if (td._raw !== html) {
          if (col.flash) { const dir = flashDir(td._n, raw); if (dir) { td.classList.remove("flash-up", "flash-down"); void td.offsetWidth; td.classList.add(dir); } }
          td.innerHTML = html; td._raw = html;
        }
        td._n = Number(raw);
        if (col.cls) { const cls = col.cls(raw, r) || "", up = td.classList.contains("flash-up"), down = td.classList.contains("flash-down"); td.className = cls + (up ? " flash-up" : "") + (down ? " flash-down" : ""); }
      }
      const stTd = tr.querySelector('[data-c="status"]'), b = badge(r);
      if (stTd._raw !== b) { stTd.innerHTML = b; stTd._raw = b; }
    }
    function radarViewSig() {
      return `${state.filter}|${state.page}|${state.pageSize}|${state.sortKey}|${state.sortDir}|${state.search}|${state.threshold}`;
    }
    function renderRadar() {
      const wrap = $("radarScroll"); if (!wrap) return;
      const scrollTop = wrap.scrollTop;
      const rows = visibleRows();
      renderPager();
      const tb = $("liveRows");
      const sig = radarViewSig();
      const setChanged = sig !== state._radarSig;
      if (!rows.length) {
        if (tb._mode !== "empty") { tb._nodes = new Map(); tb._mode = "empty"; }
        setHTMLIfChanged(tb, `<tr><td colspan="19" class="empty">No rows match current filters. Last-good data stays on screen during transient hiccups.</td></tr>`);
        state._radarSig = sig;
        return;
      }
      if (tb._mode !== "rows") { tb.innerHTML = ""; tb._nodes = new Map(); tb._mode = "rows"; }
      const nodes = tb._nodes;
      // FLIP: capture row positions before any reorder (only when not doing a reveal).
      const doFlip = !setChanged && !prefersReducedMotion();
      const firstTop = doFlip ? new Map() : null;
      if (doFlip) nodes.forEach((el, sym) => firstTop.set(sym, el.getBoundingClientRect().top));
      const seen = new Set(), ordered = [];
      for (const r of rows) {
        let tr = nodes.get(r.symbol);
        if (!tr) { tr = buildRadarRow(r); nodes.set(r.symbol, tr); }
        updateRadarRow(tr, r);
        ordered.push(tr); seen.add(r.symbol);
      }
      nodes.forEach((el, sym) => { if (!seen.has(sym)) { el.remove(); nodes.delete(sym); } });
      let reordered = false;
      for (let i = 0; i < ordered.length; i++) { if (tb.children[i] !== ordered[i]) { tb.insertBefore(ordered[i], tb.children[i] || null); reordered = true; } }
      if (setChanged) {
        ordered.forEach((tr, i) => tr.style.setProperty("--i", i));
        tb.classList.remove("reveal"); void tb.offsetWidth; tb.classList.add("reveal"); state._radarSig = sig;
        clearTimeout(state._revealTimer);
        state._revealTimer = setTimeout(() => tb.classList.remove("reveal"), 750);   // let FLIP own movement afterward
      } else if (doFlip && reordered) {
        // FLIP: rows that changed rank glide to their new position instead of jumping.
        for (const tr of ordered) {
          const first = firstTop.get(tr.dataset.symbol); if (first == null) continue;
          const dy = first - tr.getBoundingClientRect().top;
          if (Math.abs(dy) > 0.5) { tr.style.transition = "none"; tr.style.transform = `translateY(${dy}px)`; requestAnimationFrame(() => { tr.style.transition = "transform .34s cubic-bezier(.4,0,.2,1)"; tr.style.transform = ""; }); }
        }
      }
      wrap.scrollTop = scrollTop;
    }
    function miniRows(rows, mode="basis") {
      if (!rows || !rows.length) return `<div class="empty">Warming. Not enough rows yet.</div>`;
      return rows.slice(0, 30).map(r => {
        let val = basisFmt(r.spot_to_perp_bps ?? r.basis_change_bps ?? r.abs_basis_bps);
        let cls = basisClass(r.spot_to_perp_bps ?? r.basis_change_bps ?? r.abs_basis_bps);
        if (mode === "perp") { val = basisFmt(r.perp_to_spot_bps); cls = basisClass(r.perp_to_spot_bps); }
        if (mode === "fund") { val = pct(r.funding_rate); cls = fundingClass(r.funding_rate); }
        if (mode === "move") { val = pctPlain(r.spot_mid_change_pct); cls = Number(r.spot_mid_change_pct) >= 0 ? "pos" : "neg"; }
        let secondary, secCls;
        if (mode === "fund") { secondary = basisFmt(r.abs_basis_bps); secCls = basisClass(r.abs_basis_bps); }
        else if (r.funding_rate !== undefined) { secondary = pct(r.funding_rate); secCls = fundingClass(r.funding_rate); }
        else { secondary = basisFmt(r.basis_change_bps); secCls = "muted"; }
        return `<div class="mini-row" data-symbol="${esc(r.symbol)}"><span class="sym mini-sym">${tokenIcon(r.symbol)}<span>${esc(r.symbol)}</span></span><span class="${cls}">${val}</span><span class="${secCls}">${secondary}</span>${sparkline(r.symbol, 48, 16)}${r.status ? badge(r) : `<span class="badge watch">MOVE</span>`}</div>`;
      }).join("");
    }
    function attachMiniClicks() { document.querySelectorAll(".mini-row[data-symbol]").forEach(row => row.onclick = () => selectSymbol(row.dataset.symbol)); }
    function watchlistRows(cap=20) {
      const rows = state.rows || [];
      const by = state.bySymbol || new Map();
      const out = []; const seen = new Set();
      [...state.pinned, ...MAJORS].forEach(s => { const r = by.get(s); if (r && !seen.has(s)) { out.push(r); seen.add(s); } });
      for (const r of rows) { if (out.length >= cap) break; if (!seen.has(r.symbol)) { out.push(r); seen.add(r.symbol); } }
      return out;
    }
    function renderWatchlist() { if (setHTMLIfChanged($("watchlist"), miniRows(watchlistRows(), "basis"))) attachMiniClicks(); }
    function renderOpps() {
      const o = state.opportunities || state.summary || {};
      setHTMLIfChanged($("spotOpps"), miniRows(o.top_spot_to_perp, "spot"));
      setHTMLIfChanged($("perpOpps"), miniRows(o.top_perp_to_spot, "perp"));
      setHTMLIfChanged($("fundPos"), miniRows(o.funding_shorts_paid, "fund"));
      setHTMLIfChanged($("fundNeg"), miniRows(o.funding_longs_paid, "fund"));
      setHTMLIfChanged($("basisExpansion"), miniRows(o.basis_expansion, "basis"));
      attachMiniClicks();
    }
    function renderFunding() {
      const f = state.funding || {};
      setHTMLIfChanged($("fundingPositive"), miniRows(f.positive, "fund"));
      setHTMLIfChanged($("fundingNegative"), miniRows(f.negative, "fund"));
      setHTMLIfChanged($("fundingChanges"), miniRows(f.changes, "basis"));
      attachMiniClicks();
      const el = $("fundingChart");
      if (state.tab !== "funding" || !el) return;
      if (window.echarts) {
        const chart = echarts.getInstanceByDom(el) || echarts.init(el, null, {renderer: "canvas"});
        const bins = f.distribution || [];
        chart.setOption({backgroundColor:"transparent", grid:{left:38,right:12,top:20,bottom:28}, xAxis:{type:"category",data:bins.map(b=>`${b.from}`),axisLabel:{color:cssVar("--muted"),fontSize:10},axisLine:{lineStyle:{color:cssVar("--line")}}}, yAxis:{type:"value",axisLabel:{color:cssVar("--muted")},splitLine:{lineStyle:{color:cssVar("--line")}}}, series:[{type:"bar",data:bins.map(b=>b.count),itemStyle:{color:cssVar("--cyan") || "#4cc2d6"}}], tooltip:{}});
        chart.resize();
      } else {
        el.innerHTML = `<div class="chart-fallback"><div class="empty">Chart library unavailable. Funding tables remain active.</div></div>`;
      }
    }
    function renderMovers() {
      const m = state.movers || {};
      setHTMLIfChanged($("spotUp"), miniRows(m.top_spot_up, "move"));
      setHTMLIfChanged($("spotDown"), miniRows(m.top_spot_down, "move"));
      setHTMLIfChanged($("basisWide"), miniRows(m.top_basis_widening, "basis"));
      setHTMLIfChanged($("basisCompress"), miniRows(m.top_basis_compression, "basis"));
      attachMiniClicks();
    }
    function renderHeatmap() {
      let rows = (state.heatmap?.rows || state.rows || []).slice();
      if (state.heatThreshold > 0) rows = rows.filter(r => Math.abs(Number(r.abs_basis_bps) || 0) >= state.heatThreshold);
      const key = state.heatSort || (state.heatMode === "funding" ? "funding_rate" : "abs_basis_bps");
      rows.sort((a, b) => {
        if (key === "age_seconds") return (Number(a.age_seconds) || 0) - (Number(b.age_seconds) || 0);
        if (key === "funding_rate") return Math.abs(Number(b.funding_rate) || 0) - Math.abs(Number(a.funding_rate) || 0);
        return (Number(b[key]) || 0) - (Number(a[key]) || 0);
      });
      if (!rows.length) { $("heatmap").innerHTML = `<div class="empty">Heatmap warming.</div>`; return; }
      $("heatmap").innerHTML = rows.map(r => {
        const abs = Math.abs(r.abs_basis_bps || 0);
        const basis = Math.min(1, abs / 100);
        const funding = Math.min(1, Math.abs((r.funding_rate || 0) * 10000) / 10);
        const score = Math.min(1, Math.abs(Number(r.opportunity_score) || 0) / 100);
        const intensity = state.heatMode === "funding" ? funding : state.heatMode === "score" ? score : basis;
        // Original mosaic: bigger tiles for stronger basis, funding, or score.
        const rank = state.heatMode === "funding" ? funding * 100 : state.heatMode === "score" ? score * 100 : abs;
        const span = rank >= 50 ? "span 2" : "span 1";
        const neg = r.funding_rate < 0;
        const rgb = state.heatMode === "score" ? "240,185,11" : (state.heatMode === "funding" ? neg : (r.spot_to_perp_bps < 0)) ? "246,70,93" : "14,203,129";
        const primary = state.heatMode === "funding" ? pct(r.funding_rate) : state.heatMode === "score" ? bps(r.opportunity_score) : basisFmt(r.abs_basis_bps);
        const primaryCls = state.heatMode === "funding" ? fundingClass(r.funding_rate) : state.heatMode === "score" ? "yellow" : basisClass(r.abs_basis_bps);
        return `<div class="tile" data-symbol="${esc(r.symbol)}" style="grid-column:${span};grid-row:${rank >= 60 ? "span 2" : "span 1"};background:linear-gradient(155deg, rgba(${rgb},${0.06 + intensity * .34}), var(--panel));border-color:rgba(${rgb},${0.18 + intensity * .5})"><div class="tile-head">${tokenIcon(r.symbol)}<span class="sym">${esc(r.symbol)}</span></div><div class="big ${primaryCls}">${primary}</div><div class="tile-sub"><span class="${fundingClass(r.funding_rate)}">${pct(r.funding_rate)}</span><span class="muted">${seconds(r.age_seconds)}</span></div></div>`;
      }).join("");
      document.querySelectorAll(".tile[data-symbol]").forEach(tile => tile.onclick = () => selectSymbol(tile.dataset.symbol));
    }
    function renderSymbols() {
      const options = state.symbols.length ? state.symbols : [...(state.bySymbol ? state.bySymbol.keys() : [])].sort();
      const known = (state.bySymbol && state.bySymbol.has(state.selectedSymbol)) || options.includes(state.selectedSymbol);
      // Only fall back if the current symbol is genuinely unknown (not just off the current page).
      if (!known && options.length) state.selectedSymbol = options.includes("BTCUSDT") ? "BTCUSDT" : options[0];
    }
    function renderDetail() {
      const row = (state.bySymbol && state.bySymbol.get(state.selectedSymbol)) || state.rows.find(r => r.symbol === state.selectedSymbol);
      $("detailSymbol").innerHTML = `${tokenIcon(state.selectedSymbol)}<strong>${esc(state.selectedSymbol || "--")}</strong>`;
      $("detailStar").textContent = isPinned(state.selectedSymbol) ? "★" : "☆";
      $("detailStar").classList.toggle("on", isPinned(state.selectedSymbol));
      if (!row) {
        $("detailKvs").innerHTML = `<div class="empty">No current row for this symbol.</div>`;
        $("detailBook").innerHTML = "";
        $("detailExtremes").innerHTML = `<div class="empty">Select a live symbol from search, radar, heatmap, or watchlist.</div>`;
        $("detailTabContent").innerHTML = `<div class="detail-note">No current cache row is available for this symbol yet.</div>`;
        drawDetailChart();
        return;
      }
      if (row.symbol !== state.selectedSymbol) {
        state.selectedSymbol = row.symbol;
        state.history = [];
        localStorage.setItem("cg.selectedSymbol", row.symbol);
        loadHistory();
      }
      const cells = [
        ["Spot bid", price(row.spot_bid), ""], ["Spot ask", price(row.spot_ask), ""], ["Spot mid", price(row.spot_mid), ""], ["Spot spread", bps(row.spot_spread_bps), ""],
        ["Fut bid", price(row.fut_bid), ""], ["Fut ask", price(row.fut_ask), ""], ["Fut mid", price(row.futures_mid), ""], ["Fut spread", bps(row.futures_spread_bps), ""],
        ["Spot->Perp", basisFmt(row.spot_to_perp_bps), basisClass(row.spot_to_perp_bps)], ["Perp->Spot", basisFmt(row.perp_to_spot_bps), basisClass(row.perp_to_spot_bps)], ["Funding", pct(row.funding_rate), fundingClass(row.funding_rate)], ["Score", bps(row.opportunity_score), basisClass(row.opportunity_score)],
        ["Age", seconds(row.age_seconds), row.status === "LIVE" ? "pos" : "neg"], ["Status", row.status, row.status === "LIVE" ? "pos" : "neg"],
      ];
      $("detailKvs").innerHTML = cells.map(([k,v,c]) => `<div class="kv"><span>${esc(k)}</span><strong class="${c}">${esc(v)}</strong></div>`).join("");
      renderBookViz(row);
      const hist = state.history || [];
      const maxAbs = hist.length ? Math.max(...hist.map(r => Number(r.abs_basis_bps) || 0)) : Number(row.abs_basis_bps) || 0;
      const maxFunding = hist.length ? hist.reduce((a, b) => Math.abs(Number(a.funding_rate) || 0) >= Math.abs(Number(b.funding_rate) || 0) ? a : b, hist[0]) : row;
      $("detailExtremes").innerHTML = [
        `<div class="mini-row"><span class="sym">Max abs basis</span><span class="${basisClass(maxAbs)}">${basisFmt(maxAbs)}</span><span class="muted">${state.chartWindow}</span>${sparkline(row.symbol, 48, 16)}${badge(row)}</div>`,
        `<div class="mini-row"><span class="sym">Funding extreme</span><span class="${fundingClass(maxFunding.funding_rate)}">${pct(maxFunding.funding_rate)}</span><span class="muted">${maxFunding.ts_ms ? new Date(maxFunding.ts_ms).toLocaleTimeString() : "latest"}</span>${sparkline(row.symbol, 48, 16)}${badge(row)}</div>`,
        `<div class="mini-row"><span class="sym">Book spread</span><span>${bps((Number(row.spot_spread_bps) || 0) + (Number(row.futures_spread_bps) || 0))}</span><span class="muted">spot + perp</span><span></span>${badge(row)}</div>`,
      ].join("");
      renderDetailContent(row);
      drawDetailChart();
    }
    function renderBookViz(row) {
      const el = $("detailBook"); if (!el) return;
      const sb = Number(row.spot_bid), sa = Number(row.spot_ask), pb = Number(row.fut_bid), pa = Number(row.fut_ask);
      const sm = Number(row.spot_mid) || (sb + sa) / 2, pm = Number(row.futures_mid) || (pb + pa) / 2;
      const vals = [sb, sa, pb, pa].filter(v => Number.isFinite(v) && v > 0);
      if (vals.length < 4) { el.innerHTML = `<div class="empty" style="padding:8px 0">Book warming — waiting for both spot and perp quotes.</div>`; return; }
      const lo = Math.min(...vals), hi = Math.max(...vals), span = (hi - lo) || (hi * 0.001) || 1;
      const min = lo - span * 0.35, max = hi + span * 0.35, range = (max - min) || 1;
      const pos = v => Math.max(0, Math.min(100, (v - min) / range * 100));
      el.innerHTML = `
        <div class="bv-row"><div class="bv-label"><span class="bv-dot spot"></span>Spot</div>
          <div class="bv-track"><div class="bv-band spot" style="left:${pos(sb).toFixed(1)}%;width:${(pos(sa) - pos(sb)).toFixed(1)}%"></div><div class="bv-mid" style="left:${pos(sm).toFixed(1)}%"></div></div>
          <div class="bv-val">${price(sm)}</div></div>
        <div class="bv-row"><div class="bv-label"><span class="bv-dot perp"></span>Perp</div>
          <div class="bv-track"><div class="bv-band perp" style="left:${pos(pb).toFixed(1)}%;width:${(pos(pa) - pos(pb)).toFixed(1)}%"></div><div class="bv-mid perp" style="left:${pos(pm).toFixed(1)}%"></div></div>
          <div class="bv-val">${price(pm)}</div></div>
        <div class="bv-gap"><span>Basis</span><strong class="${basisClass(row.abs_basis_bps)}">${basisFmt(row.abs_basis_bps)} bps</strong><span class="muted">spread · spot ${bps(row.spot_spread_bps)} · perp ${bps(row.futures_spread_bps)}</span></div>`;
    }
    function detailChartMode() {
      if (state.symbolTab === "overview") return "basis";
      if (["basis", "price", "funding", "spread"].includes(state.symbolTab)) return state.symbolTab;
      return null;
    }
    function renderDetailContent(row) {
      const rows = (state.history || []).slice(-8).reverse();
      if (state.symbolTab === "quality") {
        $("detailTabContent").innerHTML = `<div class="detail-content-grid">
          <div class="kv"><span>Status</span><strong class="${row.status === "LIVE" ? "pos" : "neg"}">${esc(row.status)}</strong></div>
          <div class="kv"><span>Snapshot age</span><strong>${seconds(row.snapshot_age_seconds)}</strong></div>
          <div class="kv"><span>Feed age</span><strong>${seconds(row.feed_age_seconds)}</strong></div>
          <div class="kv"><span>Mark age</span><strong>${seconds(row.mark_age_sec)}</strong></div>
        </div><div class="detail-note" style="margin-top:10px">Quality is derived from the public stream ages, latest SQLite snapshot age, missing spot/futures books, and the cache refresh loop. The dashboard keeps last-good rows during transient DB locks.</div>`;
        return;
      }
      if (state.symbolTab === "overview") {
        $("detailTabContent").innerHTML = `<div class="detail-content-grid">
          <div class="kv"><span>Executable-ish gap</span><strong class="${basisClass(row.spot_to_perp_bps)}">${basisFmt(row.spot_to_perp_bps)}</strong></div>
          <div class="kv"><span>Reverse gap</span><strong class="${basisClass(row.perp_to_spot_bps)}">${basisFmt(row.perp_to_spot_bps)}</strong></div>
          <div class="kv"><span>Funding</span><strong class="${fundingClass(row.funding_rate)}">${pct(row.funding_rate)}</strong></div>
          <div class="kv"><span>Current score</span><strong>${bps(row.opportunity_score)}</strong></div>
        </div><div class="detail-note" style="margin-top:10px">The chart shows basis history for the selected window. Switch tabs for price, funding, spread, or quality diagnostics.</div>`;
        return;
      }
      $("detailTabContent").innerHTML = rows.length ? `<table class="latest-table"><thead><tr><th>time</th><th>spot mid</th><th>perp mid</th><th>abs basis</th><th>funding</th><th>age</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.ts_ms ? new Date(r.ts_ms).toLocaleTimeString() : "--"}</td><td>${price(r.spot_mid)}</td><td>${price(r.futures_mid)}</td><td class="${basisClass(r.abs_basis_bps)}">${basisFmt(r.abs_basis_bps)}</td><td class="${fundingClass(r.funding_rate)}">${pct(r.funding_rate)}</td><td>${seconds(r.age_seconds)}</td></tr>`).join("")}</tbody></table>` : `<div class="detail-note">History is warming for ${esc(state.selectedSymbol)} in the selected window.</div>`;
    }
    function movingAvg(arr, p) {
      return arr.map((_, i) => { if (i < p - 1) return null; let s = 0, n = 0; for (let j = i - p + 1; j <= i; j++) { const v = Number(arr[j]); if (Number.isFinite(v)) { s += v; n++; } } return n ? s / n : null; });
    }
    function expMovingAvg(arr, p) {
      const k = 2 / (p + 1); let prev = null;
      return arr.map(v => { v = Number(v); if (!Number.isFinite(v)) return prev; if (prev === null) { prev = v; return v; } prev = v * k + prev * (1 - k); return prev; });
    }
    function buildDetailOption(mode) {
      const rows = state.history || [];
      const labels = rows.map(r => new Date(r.ts_ms).toLocaleTimeString());
      let series = [];
      if (mode === "basis") series = [{name:"spot→perp", data:rows.map(r=>r.spot_to_perp_bps)}, {name:"perp→spot", data:rows.map(r=>r.perp_to_spot_bps)}];
      if (mode === "price") series = [{name:"spot mid", data:rows.map(r=>r.spot_mid)}, {name:"futures mid", data:rows.map(r=>r.futures_mid)}];
      if (mode === "funding") series = [{name:"funding %", data:rows.map(r=>r.funding_rate * 100)}];
      if (mode === "spread") series = [{name:"spot spread", data:rows.map(r=>r.spot_spread_bps)}, {name:"fut spread", data:rows.map(r=>r.futures_spread_bps)}];
      const colors = [cssVar("--green") || "#0ecb81", cssVar("--magenta") || "#a878e8", cssVar("--yellow") || "#f0b90b"];
      const area = state.chartType === "area";
      const out = series.map((s, i) => ({...s, type: "line", smooth: true, showSymbol: false, lineStyle: {width: 1.6}, itemStyle: {color: colors[i % colors.length]}, areaStyle: (area || series.length === 1) ? {opacity: area ? .16 : .08, color: colors[i % colors.length]} : undefined}));
      // Moving-average overlay on the primary series (TradingView-style).
      if (state.chartMA !== "off" && series[0]) {
        const base = series[0].data, p = 9;
        const ma = state.chartMA === "ema" ? expMovingAvg(base, p) : movingAvg(base, p);
        out.push({name: `${state.chartMA.toUpperCase()}(${p})`, type: "line", data: ma, smooth: true, showSymbol: false, connectNulls: true, lineStyle: {width: 1.3, type: "dashed", color: cssVar("--accent")}, itemStyle: {color: cssVar("--accent")}});
      }
      // Log scale is only valid for strictly-positive price series.
      const allPos = mode === "price" && rows.every(r => Number(r.spot_mid) > 0 && Number(r.futures_mid) > 0);
      const useLog = state.chartScale === "log" && allPos;
      return {
        backgroundColor: "transparent",
        animationDuration: 600,
        tooltip: {trigger: "axis", axisPointer: {type: "cross", label: {backgroundColor: cssVar("--text"), color: cssVar("--bg"), fontSize: 10}, lineStyle: {color: cssVar("--muted"), type: "dashed"}}, backgroundColor: cssVar("--panel"), borderColor: cssVar("--line"), textStyle: {color: cssVar("--text"), fontSize: 11}},
        legend: {textStyle: {color: cssVar("--muted")}, top: 4},
        grid: {left: 56, right: 18, top: 34, bottom: 56},
        xAxis: {type: "category", data: labels, boundaryGap: false, axisLabel: {color: cssVar("--muted"), fontSize: 10}, axisLine: {lineStyle: {color: cssVar("--line")}}, axisPointer: {label: {show: true, backgroundColor: cssVar("--text"), color: cssVar("--bg")}}},
        yAxis: {type: useLog ? "log" : "value", scale: true, axisLabel: {color: cssVar("--muted"), fontSize: 10}, splitLine: {lineStyle: {color: cssVar("--line")}}},
        dataZoom: [
          {type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true},
          {type: "slider", height: 16, bottom: 8, borderColor: "transparent", fillerColor: "rgba(240,185,11,.14)", handleStyle: {color: cssVar("--accent")}, textStyle: {color: cssVar("--muted"), fontSize: 9}},
        ],
        series: out,
      };
    }
    function drawDetailChart() {
      const el = $("detailChart");
      if (!el || state.tab !== "detail") return;
      const mode = detailChartMode();
      if (!mode) { el.innerHTML = `<div class="chart-fallback"><div class="empty">Quality tab uses diagnostics below instead of a chart.</div></div>`; return; }
      if (!window.echarts) { el.innerHTML = `<div class="chart-fallback"><div class="empty">Chart library unavailable. Latest symbol tables remain active.</div></div>`; return; }
      const chart = echarts.getInstanceByDom(el) || echarts.init(el, null, {renderer:"canvas"});
      chart.setOption(buildDetailOption(mode), true);
      chart.resize();
      if (state.chartFsOpen) drawFsChart();
    }
    let fsChart = null;
    function drawFsChart() {
      const box = $("chartFsBox"); if (!box || !window.echarts) return;
      const mode = detailChartMode() || "basis";
      fsChart = echarts.getInstanceByDom(box) || echarts.init(box, null, {renderer: "canvas"});
      fsChart.setOption(buildDetailOption(mode), true);
      fsChart.resize();
    }
    function openChartFs() {
      state.chartFsOpen = true;
      $("chartFsTitle").textContent = `${state.selectedSymbol} · ${(detailChartMode() || "basis")}`;
      $("chartFsMask").classList.add("open");
      requestAnimationFrame(drawFsChart);
    }
    function closeChartFs() {
      state.chartFsOpen = false;
      $("chartFsMask").classList.remove("open");
      if (fsChart) { fsChart.dispose(); fsChart = null; }
    }
    function marketRows() {
      const out = [], seen = new Set();
      const push = (rows) => (rows || []).forEach(r => { if (r?.symbol && !seen.has(r.symbol)) { seen.add(r.symbol); out.push(r); } });
      if (state.bySymbol) push([...state.bySymbol.values()]);
      push(state.rows); push(state.ticker?.rows); push(state.watchlist?.rows);
      return out;
    }
    function deskRow() {
      const by = state.bySymbol || new Map();
      const rows = marketRows();
      return by.get(state.selectedSymbol) || rows.find(r => r.symbol === state.selectedSymbol) || rows.slice().sort((a, b) => (Number(b.abs_basis_bps) || 0) - (Number(a.abs_basis_bps) || 0))[0] || null;
    }
    function focusDeskSymbol(symbol) {
      const clean = cleanSymbol(symbol);
      if (!clean) return;
      state.selectedSymbol = clean;
      state.history = [];
      state.recent = [clean, ...state.recent.filter(s => s !== clean)].slice(0, 10);
      localStorage.setItem("cg.selectedSymbol", clean);
      saveRecent();
      if (typeof pushActivity === "function") pushActivity("info", `Focused <b>${esc(clean)}</b> in Desk`, clean);
      loadHistory();
      renderAll();
    }
    function renderDesk() {
      const row = deskRow();
      const rows = marketRows().slice().sort((a, b) => (Number(b.abs_basis_bps) || 0) - (Number(a.abs_basis_bps) || 0));
      const title = $("deskTitle"), priceEl = $("deskPrice"), sub = $("deskSub"), strip = $("deskStrip"), depth = $("deskDepth"), prints = $("deskPrints"), lane = $("deskLane"), consoleEl = $("deskConsole");
      if (!title || !priceEl || !sub || !strip || !depth || !prints || !lane || !consoleEl) return;
      if (!row) {
        title.innerHTML = `<span class="token">--</span><div><b>Desk warming</b><span class="muted">Waiting for cached public snapshots</span></div>`;
        priceEl.textContent = "--";
        sub.innerHTML = `<span class="muted">No current rows yet. The app will keep last-good data once the collector has produced snapshots.</span>`;
        strip.innerHTML = `<div class="desk-mini"><span>Status</span><strong>Warming</strong></div><div class="desk-mini"><span>Network</span><strong>${state.lastLatencyMs == null ? "--" : `${Math.round(state.lastLatencyMs)}ms`}</strong></div><div class="desk-mini"><span>Cache</span><strong>${state.cacheMetrics?.last_refresh_ms == null ? "--" : `${Math.round(state.cacheMetrics.last_refresh_ms)}ms`}</strong></div><div class="desk-mini"><span>Rows</span><strong>${state.cacheMetrics?.row_count ?? "--"}</strong></div>`;
        depth.innerHTML = `<div class="empty">Book lens is waiting for spot and perpetual best bid/ask rows.</div>`;
        prints.innerHTML = `<div class="empty">Basis prints will appear when cached rows exist.</div>`;
        lane.innerHTML = `<span class="desk-chip">Market lane warming</span>`;
        consoleEl.innerHTML = `<div class="desk-noise"></div><div class="desk-console-row"><span>State</span><strong>${esc(state.health?.status || "DB WARMING")}</strong></div>`;
        drawDeskChart(null);
        return;
      }
      if (row.symbol !== state.selectedSymbol) {
        state.selectedSymbol = row.symbol;
        state.history = [];
        localStorage.setItem("cg.selectedSymbol", row.symbol);
        loadHistory();
      }
      title.innerHTML = `${tokenIcon(row.symbol)}<div><b>${esc(row.symbol)}</b><span class="muted">spot / USD-M perp</span></div>`;
      priceEl.innerHTML = price(row.spot_mid);
      sub.innerHTML = [
        `<span class="${basisClass(row.abs_basis_bps)}">${basisFmt(row.abs_basis_bps)} bps abs basis</span>`,
        `<span class="${fundingClass(row.funding_rate)}">funding ${pct(row.funding_rate)}</span>`,
        `<span class="${row.status === "LIVE" ? "pos" : "neg"}">${seconds(row.age_seconds)} snapshot</span>`,
        badge(row),
      ].join("");
      const spread = (Number(row.spot_spread_bps) || 0) + (Number(row.futures_spread_bps) || 0);
      strip.innerHTML = [
        ["Spot→Perp", basisFmt(row.spot_to_perp_bps), basisClass(row.spot_to_perp_bps)],
        ["Perp→Spot", basisFmt(row.perp_to_spot_bps), basisClass(row.perp_to_spot_bps)],
        ["Funding", pct(row.funding_rate), fundingClass(row.funding_rate)],
        ["Spread", `${bps(spread)} bps`, "muted"],
      ].map(([k, v, c]) => `<div class="desk-mini"><span>${k}</span><strong class="${c}">${v}</strong></div>`).join("");
      renderDeskDepth(row);
      const top = rows.slice(0, 12);
      prints.innerHTML = top.length ? top.map((r, i) => `<div class="desk-print" data-symbol="${esc(r.symbol)}"><span class="sym mini-sym">${tokenIcon(r.symbol)}<span>${esc(r.symbol)}</span></span><span class="${basisClass(r.abs_basis_bps)}">${basisFmt(r.abs_basis_bps)}</span><span class="hide-sm ${fundingClass(r.funding_rate)}">${pct(r.funding_rate)}</span><span class="${r.status === "LIVE" ? "pos" : "neg"}">${seconds(r.age_seconds)}</span></div>`).join("") : `<div class="empty">No basis prints yet.</div>`;
      const laneRows = [...top, ...top];
      lane.innerHTML = laneRows.length ? laneRows.map(r => `<button class="desk-chip" data-symbol="${esc(r.symbol)}">${tokenIcon(r.symbol)}<span>${esc(r.symbol)}</span><strong class="${basisClass(r.abs_basis_bps)}">${basisFmt(r.abs_basis_bps)}</strong></button>`).join("") : `<span class="desk-chip">Market lane warming</span>`;
      consoleEl.innerHTML = `
        <div class="desk-noise" aria-hidden="true"></div>
        <div class="desk-console-row"><span>Network</span><strong>${state.lastLatencyMs == null ? "--" : `${Math.round(state.lastLatencyMs)}ms`}</strong></div>
        <div class="desk-console-row"><span>Cache refresh</span><strong>${state.cacheMetrics?.last_refresh_ms == null ? "--" : `${Math.round(state.cacheMetrics.last_refresh_ms)}ms`}</strong></div>
        <div class="desk-console-row"><span>Tracked symbols</span><strong>${state.health?.tracked_symbols ?? rows.length}</strong></div>
        <div class="desk-console-row"><span>Research mode</span><strong>No orders · no keys</strong></div>
        <div class="desk-actions" style="justify-content:flex-start">
          <button class="desk-action" data-desk-action="heatmap">Heatmap</button>
          <button class="desk-action" data-desk-action="funding">Funding</button>
          <button class="desk-action" data-desk-action="quality">Quality</button>
        </div>`;
      const pin = $("deskPin"); if (pin) pin.classList.toggle("primary", isPinned(row.symbol));
      document.querySelectorAll("#deskPrints [data-symbol], #deskLane [data-symbol]").forEach(el => el.onclick = () => focusDeskSymbol(el.dataset.symbol));
      document.querySelectorAll("[data-desk-action]").forEach(el => el.onclick = () => setTab(el.dataset.deskAction));
      drawDeskChart(row);
    }
    function renderDeskDepth(row) {
      const el = $("deskDepth"); if (!el) return;
      const vals = [row.spot_bid, row.spot_ask, row.fut_bid, row.fut_ask].map(Number).filter(v => Number.isFinite(v) && v > 0);
      if (vals.length < 4) { el.innerHTML = `<div class="empty">Waiting for both spot and perp top-of-book quotes.</div>`; return; }
      const lo = Math.min(...vals), hi = Math.max(...vals), span = (hi - lo) || (hi * 0.001) || 1;
      const width = v => Math.max(8, Math.min(100, 16 + ((Number(v) - lo) / span) * 82));
      const rows = [
        ["Spot bid", row.spot_bid, "bid"],
        ["Spot ask", row.spot_ask, "ask"],
        ["Perp bid", row.fut_bid, "perp"],
        ["Perp ask", row.fut_ask, "ask"],
      ];
      el.innerHTML = rows.map(([label, v, cls]) => `<div class="depth-row"><span class="depth-label">${label}</span><span class="depth-track"><i class="depth-fill ${cls}" style="--w:${width(v).toFixed(1)}%"></i></span><span class="depth-price">${price(v)}</span></div>`).join("") +
        `<div class="detail-note">Bars are normalized from the four best bid/ask prices in the latest cached row.</div>`;
    }
    function buildDeskOption(row) {
      const rows = (state.history || []).filter(r => r && r.ts_ms);
      const labels = rows.map(r => new Date(r.ts_ms).toLocaleTimeString());
      const accent = cssVar("--accent") || "#f0b90b", green = cssVar("--green") || "#0ecb81", magenta = cssVar("--magenta") || "#a878e8", red = cssVar("--red") || "#f6465d";
      return {
        backgroundColor: "transparent",
        animationDuration: 650,
        tooltip: { trigger: "axis", axisPointer: { type: "cross", label: { backgroundColor: cssVar("--text"), color: cssVar("--bg"), fontSize: 10 } }, backgroundColor: cssVar("--panel"), borderColor: cssVar("--line"), textStyle: { color: cssVar("--text"), fontSize: 11 } },
        legend: { top: 4, textStyle: { color: cssVar("--muted"), fontSize: 10 } },
        grid: { left: 52, right: 58, top: 42, bottom: 58 },
        xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { color: cssVar("--muted"), fontSize: 10 }, axisLine: { lineStyle: { color: cssVar("--line") } } },
        yAxis: [
          { type: "value", scale: true, position: "right", axisLabel: { color: cssVar("--muted"), fontSize: 10 }, splitLine: { lineStyle: { color: cssVar("--line") } } },
          { type: "value", scale: true, position: "left", axisLabel: { color: cssVar("--muted"), fontSize: 10, formatter: "{value} bps" }, splitLine: { show: false } },
        ],
        dataZoom: [
          { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
          { type: "slider", height: 16, bottom: 16, borderColor: "transparent", fillerColor: "rgba(240,185,11,.14)", handleStyle: { color: accent }, textStyle: { color: cssVar("--muted"), fontSize: 9 } },
        ],
        series: [
          { name: "spot mid", type: "line", smooth: true, showSymbol: false, data: rows.map(r => r.spot_mid), lineStyle: { width: 1.7, color: green }, itemStyle: { color: green }, areaStyle: { opacity: .08, color: green } },
          { name: "perp mid", type: "line", smooth: true, showSymbol: false, data: rows.map(r => r.futures_mid), lineStyle: { width: 1.3, color: magenta }, itemStyle: { color: magenta } },
          { name: "abs basis", type: "line", yAxisIndex: 1, smooth: true, showSymbol: false, data: rows.map(r => r.abs_basis_bps), lineStyle: { width: 1.5, color: accent }, itemStyle: { color: accent }, areaStyle: { opacity: .14, color: accent } },
          { name: "funding x10k", type: "bar", yAxisIndex: 1, data: rows.map(r => (Number(r.funding_rate) || 0) * 10000), barWidth: 3, itemStyle: { color: red, opacity: .55 } },
        ],
      };
    }
    function drawDeskChart(row) {
      const el = $("deskChart"); if (!el || state.tab !== "desk") return;
      const rows = state.history || [];
      if (!row) { el.innerHTML = `<div class="desk-chart-fallback">Desk chart waiting for a selected live symbol.</div>`; return; }
      if (!window.echarts) { el.innerHTML = `<div class="desk-chart-fallback">Chart library unavailable. Desk metrics and tables remain active.</div>`; return; }
      if (rows.length < 2) {
        el.innerHTML = `<div class="desk-chart-fallback"><div>${sparkline(row.symbol, 260, 92, true)}<div style="margin-top:12px">History warming for ${esc(row.symbol)}. Current snapshot is still live below.</div></div></div>`;
        return;
      }
      const chart = echarts.getInstanceByDom(el) || echarts.init(el, null, {renderer:"canvas"});
      chart.setOption(buildDeskOption(row), true);
      chart.resize();
    }
    function renderQuality() {
      const h = state.health || state.summary?.health || state.live?.health || {};
      const cm = state.cacheMetrics || {};
      $("qualityGrid").innerHTML = [
        metric("DB exists", h.db_exists ? "yes" : "no", h.db_path || "--"),
        metric("Latest snapshot", h.latest_update_utc || "--", "UTC"),
        metric("Collector age", seconds(liveAge(h)), h.collector_status || "--"),
        metric("Total rows", cm.row_count != null ? fmt(cm.row_count, 0) : "--", "DB rowid"),
        metric("Recent rows", h.rows_recent_window ?? 0, `${h.recent_window_minutes || 60}m`),
        metric("Symbols tracked", h.tracked_symbols ?? 0, "distinct"),
        metric("Missing spot", h.missing_spot_count ?? 0, "latest rows"),
        metric("Missing futures", h.missing_futures_count ?? 0, "latest rows"),
        metric("Stale count", h.stale_symbol_count ?? 0, "latest rows", (h.stale_symbol_count || 0) ? "neg" : "pos"),
        metric("Cache refresh", cm.last_refresh_ms != null ? `${cm.last_refresh_ms}ms` : "--", `every ${cm.refresh_interval_sec ?? "--"}s`),
        metric("Cache age", seconds(cm.cache_age_seconds), `refreshes ${cm.refresh_count ?? 0}`),
        metric("Cache fails", cm.failed_refresh_count ?? 0, cm.last_error ? String(cm.last_error).slice(0, 40) : "none", (cm.failed_refresh_count || 0) ? "neg" : "pos"),
        metric("API status", h.api_status || "OK", `retries ${state.retryCount}`),
        metric("Client latency", state.lastLatencyMs == null ? "--" : `${state.lastLatencyMs.toFixed(0)}ms`, "browser->/api/state"),
        metric("Schema", h.schema_ok ? "ok" : "warming", (h.missing_columns || []).join(", ")),
      ].join("");
      $("selftestBox").innerHTML = state.selftest?.checks?.length ? state.selftest.checks.map(c => `<div class="mini-row"><span class="sym">${esc(c.name)}</span><span class="${c.ok ? "pos" : "neg"}">${c.ok ? "OK" : "FAIL"}</span><span class="muted">${esc(c.detail)}</span><span></span></div>`).join("") : `<div class="empty">Selftest has not been run in this browser session.</div>`;
    }
    function renderPulse() {
      const r = state.regime || {};
      $("regimeBox").innerHTML = `<div class="kv" style="margin:8px"><span>Regime</span><strong>${esc(r.regime || "UNKNOWN")}</strong></div>` + (r.signals || []).map(s => `<div class="mini-row"><span class="sym">${esc(s.label)}</span><span>${fmt(s.value, 3)}</span><span class="muted">${esc(s.text)}</span><span></span></div>`).join("");
      const rows = state.enrichment?.rows || [];
      $("enrichmentBox").innerHTML = rows.length ? rows.map(row => `<div class="mini-row" data-symbol="${esc(row.symbol)}"><span class="sym">${esc(row.symbol)}</span><span>${fmt(row.open_interest, 0)}</span><span class="${Number(row.price_change_pct_24h) >= 0 ? "pos" : "neg"}">${pctPlain(row.price_change_pct_24h)}</span><span class="${row.ok ? "pos" : "orange"}">${row.ok ? "OK" : "PART"}</span></div>`).join("") : `<div class="empty">Optional REST enrichment warming or unavailable. Core SQLite data is independent.</div>`;
      attachMiniClicks();
    }
    function renderResearchSections() {
      if (state.tab !== "quality") return;
      const rows = [...(state.bySymbol ? state.bySymbol.values() : state.rows || [])];
      const sortedBasis = rows.slice().sort((a, b) => (Number(b.abs_basis_bps) || 0) - (Number(a.abs_basis_bps) || 0));
      const fundingExtreme = rows.slice().sort((a, b) => Math.abs(Number(b.funding_rate) || 0) - Math.abs(Number(a.funding_rate) || 0));
      const stale = rows.filter(r => r.status !== "LIVE" || Number(r.age_seconds || 0) > 15).sort((a, b) => (Number(b.age_seconds) || 0) - (Number(a.age_seconds) || 0));
      const regime = state.regime || {};
      const h = state.health || {};
      const cm = state.cacheMetrics || {};
      setHTMLIfChanged($("marketRegimeSummary"), `<div class="kv" style="margin:8px"><span>Regime</span><strong>${esc(regime.regime || (h.status === "LIVE" ? "LIVE MARKET" : "SYNCING"))}</strong></div>` + (regime.signals || [
        {label: "Live symbols", value: h.live_symbols ?? 0, text: "fresh"},
        {label: "Stale symbols", value: h.stale_symbol_count ?? 0, text: "aged"},
      ]).slice(0, 5).map(s => `<div class="mini-row"><span class="sym">${esc(s.label)}</span><span>${fmt(s.value, 3)}</span><span class="muted">${esc(s.text || "")}</span><span></span>${badge({status:"LIVE", abs_basis_bps:0})}</div>`).join(""));
      setHTMLIfChanged($("wideBasisBoard"), miniRows(sortedBasis.slice(0, 12), "basis"));
      setHTMLIfChanged($("fundingExtremesBoard"), miniRows(fundingExtreme.slice(0, 12), "fund"));
      setHTMLIfChanged($("staleBoard"), stale.length ? miniRows(stale.slice(0, 12), "basis") : `<div class="empty">No stale symbols in the current cache snapshot.</div>`);
      setHTMLIfChanged($("qualityTimeline"), [
        `<div class="timeline-row ${h.status === "LIVE" ? "" : "warn"}"><span>${esc(state.lastPollTime || "--")}</span><span>Collector status</span><strong>${esc(h.status || "SYNCING")}</strong></div>`,
        `<div class="timeline-row ${Number(h.stale_symbol_count || 0) ? "warn" : ""}"><span>${seconds(liveAge(h))}</span><span>Latest DB snapshot age</span><strong>${esc(h.latest_update_utc || "--")}</strong></div>`,
        `<div class="timeline-row ${Number(cm.failed_refresh_count || 0) ? "bad" : ""}"><span>${seconds(cm.cache_age_seconds)}</span><span>Cache refresh loop</span><strong>${cm.last_refresh_ms != null ? `${cm.last_refresh_ms}ms` : "--"}</strong></div>`,
        `<div class="timeline-row ${state.consecutiveFailures ? "warn" : ""}"><span>${state.lastPollTime}</span><span>Browser state-lite poll</span><strong>${state.lastLatencyMs == null ? "--" : `${state.lastLatencyMs.toFixed(0)}ms`}</strong></div>`,
      ].join(""));
      attachMiniClicks();
    }
    function renderRailContext() {
      const by = state.bySymbol || new Map();
      const selected = by.get(state.selectedSymbol) || (state.rows || []).find(r => r.symbol === state.selectedSymbol);
      const leaders = (state.rows || [])
        .filter(r => r.symbol !== state.selectedSymbol)
        .slice()
        .sort((a, b) => (Number(b.abs_basis_bps) || 0) - (Number(a.abs_basis_bps) || 0))
        .slice(0, 8);
      const selectedHtml = selected
        ? `<div class="mini-row" data-symbol="${esc(selected.symbol)}"><span class="sym mini-sym">${tokenIcon(selected.symbol)}<span>${esc(selected.symbol)}</span></span><span class="${basisClass(selected.abs_basis_bps)}">${basisFmt(selected.abs_basis_bps)}</span><span class="${fundingClass(selected.funding_rate)}">${pct(selected.funding_rate)}</span>${sparkline(selected.symbol, 48, 16)}${badge(selected)}</div>`
        : `<div class="empty">Select a row, heatmap tile, watchlist item, or search result to focus the symbol workspace.</div>`;
      const feed = miniRows(leaders, "basis");
      const recentRows = state.recent
        .map(s => by.get(s) || (state.rows || []).find(r => r.symbol === s))
        .filter(Boolean)
        .slice(0, 5);
      const recentHtml = recentRows.length
        ? `<div class="section-sub" style="padding:10px 2px 2px">Recently selected</div>${miniRows(recentRows, "basis")}`
        : "";
      if (setHTMLIfChanged($("contextBox"), selectedHtml + recentHtml + `<div class="section-sub" style="padding:10px 2px 2px">Strongest basis now</div>` + feed)) attachMiniClicks();
    }
    function renderActiveTab() {
      switch (state.tab) {
        case "radar": renderRadar(); break;
        case "opps": renderOpps(); break;
        case "funding": renderFunding(); break;
        case "movers": renderMovers(); break;
        case "heatmap": renderHeatmap(); break;
        case "detail": renderSymbols(); renderDetail(); break;
        case "desk": renderDesk(); break;
        case "quality": renderQuality(); break;
        case "pulse": renderPulse(); break;
        default: renderRadar();
      }
    }
    function renderAll() {
      renderStatus(state.health || (state.summary || {}).health || (state.live || {}).health, state.consecutiveFailures >= 3);
      renderOverview(); renderTicker(); renderWatchlist(); renderResearchSections(); renderRailContext(); renderActiveTab();
      renderWidgets(); renderTape(); renderActivity(); renderNetBadge(); renderMood(); renderSpotlight();
      document.querySelectorAll(".chip").forEach(b => b.classList.toggle("active", b.dataset.filter === state.filter));
      document.querySelectorAll("#moverRanges .range-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.minutes) === state.moverMinutes));
      document.querySelectorAll("#historyRanges .range-btn").forEach(b => b.classList.toggle("active", b.dataset.window === state.chartWindow));
      document.querySelectorAll("#symbolTabs .range-btn").forEach(b => b.classList.toggle("active", b.dataset.symbolTab === state.symbolTab));
      document.querySelectorAll("#chartType button").forEach(b => b.classList.toggle("active", b.dataset.ctype === state.chartType));
      document.querySelectorAll("#chartMA button").forEach(b => b.classList.toggle("active", b.dataset.ma === state.chartMA));
      document.querySelectorAll("#chartScale button").forEach(b => b.classList.toggle("active", b.dataset.scale === state.chartScale));
      document.querySelectorAll("#heatThresholds button").forEach(b => b.classList.toggle("active", Number(b.dataset.heatThreshold) === state.heatThreshold));
      document.querySelectorAll("#unitToggle button").forEach(b => b.classList.toggle("active", b.dataset.unit === state.basisUnit));
      document.querySelectorAll("#rowLimitSeg button").forEach(b => b.classList.toggle("active", Number(b.dataset.size) === state.pageSize));
      document.querySelectorAll("th[data-sort]").forEach(th => {
        th.classList.toggle("sort-asc", th.dataset.sort === state.sortKey && state.sortDir === 1);
        th.classList.toggle("sort-desc", th.dataset.sort === state.sortKey && state.sortDir === -1);
      });
      $("heatBasis").classList.toggle("active", state.heatMode === "basis");
      $("heatFunding").classList.toggle("active", state.heatMode === "funding");
      $("heatScore").classList.toggle("active", state.heatMode === "score");
      $("heatSort").value = state.heatSort;
      $("threshold").value = state.threshold; $("thresholdLabel").textContent = state.threshold; if (document.activeElement !== $("search")) $("search").value = state.search;
      const fc = $("footCache"); if (fc && state.cacheMetrics) fc.textContent = `cache ${Math.round(state.cacheMetrics.last_refresh_ms || 0)}ms · ${state.cacheMetrics.refresh_count || 0} refreshes`;
      syncSegThumbs();
    }
    function setTab(tab) {
      state.tab = tab; localStorage.setItem("cg.tab", tab);
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tab}`));
      moveTabUnderline();
      updateDeepLink();
      renderAll();
      loadActiveTab();
    }
    function setSymbolTab(tab) {
      state.symbolTab = tab;
      state.chart = detailChartMode() || "basis";
      localStorage.setItem("cg.symbolTab", tab);
      localStorage.setItem("cg.chart", state.chart);
      updateDeepLink();
      renderDetail();
      renderAll();
    }
    function indexRows(rows) {
      if (!state.bySymbol) state.bySymbol = new Map();
      for (const r of rows || []) if (r && r.symbol) state.bySymbol.set(r.symbol, r);
    }
    function applyLite(d) {
      // Core poll payload: header + metric strip + ticker + 50-row radar preview.
      if (!d || d.ok === false) return false;
      if (d.health) state.health = d.health;
      if (d.cache) state.cacheMetrics = d.cache;
      state.summary = { ok: true, metrics: d.metrics || {}, health: d.health || state.health };
      if (Array.isArray(d.ticker) && (d.ticker.length || !state.ticker)) { state.ticker = { rows: d.ticker }; indexRows(d.ticker); pushSpark(d.ticker); }
      if (Array.isArray(d.radar_top)) {
        indexRows(d.radar_top); pushSpark(d.radar_top);
        // Only seed the radar table from the 50-row preview until the Radar tab
        // has pulled the full set (then /api/radar owns state.rows).
        if (!state.radarFull || state.tab !== "radar") state.rows = d.radar_top;
      }
      return true;
    }
    async function poll() {
      if (document.hidden) return;
      if (state.refreshing) return;          // skip this tick if the core poll is still running
      state.refreshing = true;
      try {
        const data = await fetchJSON("/api/state-lite", STATE_TIMEOUT_MS);
        state.lastLatencyMs = data.client_latency_ms;
        state.lastGood.lite = data;
        applyLite(data);
        detectActivity();
        const pv = Number.isFinite(Number(state.cacheMetrics?.last_refresh_ms)) ? Number(state.cacheMetrics.last_refresh_ms) : (state.lastLatencyMs || 0);
        (state.pulseBuf = state.pulseBuf || []).push(pv); if (state.pulseBuf.length > 46) state.pulseBuf.shift();
        state.consecutiveFailures = 0;
        state.lastPollTime = new Date().toLocaleTimeString();
      } catch (err) {
        // Keep last-good data on screen; surface failures only in the drawer.
        state.consecutiveFailures += 1;
        state.retryCount += 1;
        state.errors.unshift(`${new Date().toLocaleTimeString()} state-lite: ${err.message || err}`);
        state.errors = state.errors.slice(0, 12);
      } finally {
        state.refreshing = false;
      }
      requestAnimationFrame(renderAll);
    }
    const refresh = poll;
    async function guard(name, fn) {
      // Prevent overlapping fetches for the same endpoint.
      if (!state.inflight) state.inflight = new Set();
      if (state.inflight.has(name)) return;
      state.inflight.add(name);
      try { await fn(); } finally { state.inflight.delete(name); }
    }
    async function loadRadar() {
      return guard("radar", async () => {
        const dir = state.sortDir === 1 ? "asc" : "desc";
        const q = encodeURIComponent(state.search.trim());
        const url = `/api/pages/markets?page=${state.page}&page_size=${state.pageSize}&sort=${encodeURIComponent(state.sortKey)}&direction=${dir}&filter=${encodeURIComponent(state.filter)}&q=${q}`;
        const d = await load("radar", url, FETCH_TIMEOUT_MS);
        if (d && Array.isArray(d.rows)) {
          const sig = radarViewSig();
          if (!d.rows.length && (state.rows || []).length && state._loadedRadarSig === sig) {
            state.radarMeta = {page: d.page, pages: d.pages, total: d.total, page_size: d.page_size};
            renderPager();
            return;
          }
          state.rows = d.rows; state.radarFull = true;
          state._loadedRadarSig = sig;
          state.radarMeta = {page: d.page, pages: d.pages, total: d.total, page_size: d.page_size};
          indexRows(d.rows); pushSpark(d.rows); renderRadar(); renderWatchlist();
        }
      });
    }
    async function loadHeatmap() {
      return guard("heatmap", async () => {
        const requestMode = state.heatMode === "funding" ? "funding" : "basis";
        const d = await load("heatmap", `/api/heatmap?mode=${requestMode}&limit=400`, FETCH_TIMEOUT_MS);
        if (d && Array.isArray(d.rows)) { state.heatmap = { rows: d.rows }; indexRows(d.rows); renderHeatmap(); }
      });
    }
    async function loadFunding() {
      return guard("funding", async () => { const d = await load("funding", "/api/funding", FETCH_TIMEOUT_MS); if (d) { state.funding = d; renderFunding(); } });
    }
    async function loadOpps() {
      return guard("opps", async () => { const d = await load("opps", "/api/opportunities", FETCH_TIMEOUT_MS); if (d) { state.opportunities = d; renderOpps(); } });
    }
    async function loadRegime() {
      return guard("regime", async () => { const d = await load("regime", "/api/market-regime", FETCH_TIMEOUT_MS); if (d) { state.regime = d; renderPulse(); } });
    }
    async function loadSymbols() {
      if (state.symbols && state.symbols.length) return;
      const d = await load("symbols", "/api/symbols", FETCH_TIMEOUT_MS);
      if (d && Array.isArray(d.symbols)) { state.symbols = d.symbols; renderSymbols(); }
    }
    async function loadHistory() {
      if (!state.selectedSymbol) return;
      return guard("detail", async () => {
        const d = await load("history", `/api/symbol/${encodeURIComponent(state.selectedSymbol)}/history?window=${state.chartWindow}`, FETCH_TIMEOUT_MS);
        if (d && Array.isArray(d.rows) && (d.rows.length || !state.history.length)) state.history = d.rows;
        renderDetail();   // current stats come from the in-memory symbol index; chart from history
      });
    }
    async function loadMovers() {
      return guard("movers", async () => { const d = await load("movers", `/api/movers?minutes=${state.moverMinutes}`, FETCH_TIMEOUT_MS); if (d) { state.movers = d; renderMovers(); } });
    }
    async function loadEnrichment(force=false) {
      if (!force && Date.now() - state.enrichmentAt < 60000) return;
      state.enrichmentAt = Date.now();
      const symbols = encodeURIComponent([state.selectedSymbol, ...state.pinned, ...MAJORS].filter(Boolean).join(","));
      const data = await load("enrichment", `/api/enrichment?symbols=${symbols}&limit=12`, FETCH_TIMEOUT_MS);
      if (data) { state.enrichment = data; renderOverview(); renderPulse(); }
    }
    function loadActiveTab() {
      // Only the visible tab fetches its data. No hidden-tab polling.
      switch (state.tab) {
        case "radar": loadRadar(); break;
        case "opps": loadOpps(); break;
        case "funding": loadFunding(); break;
        case "movers": loadMovers(); break;
        case "heatmap": loadHeatmap(); break;
        case "detail": loadSymbols(); loadHistory(); break;
        case "desk": if (!state.radarFull) loadRadar(); loadHistory(); break;
        case "pulse": loadRegime(); loadEnrichment(false); break;
        default: break;   // quality uses the lite health + cache metrics
      }
    }
    async function runSelftest() {
      const data = await load("selftest", "/api/selftest", FETCH_TIMEOUT_MS);
      if (data) { state.selftest = data; renderQuality(); }
    }
    // ---- command palette (global symbol search) ----
    let cmdTimer = null;
    const COMMANDS = [
      {label:"Open Heatmap", hint:"Basis / funding mosaic", action:"heatmap", keys:"heatmap mosaic tiles"},
      {label:"Show Funding Extremes", hint:"Positive and negative funding", action:"funding", keys:"funding extremes rates"},
      {label:"Show Basis Radar", hint:"Main market table", action:"radar", keys:"radar markets basis table"},
      {label:"Data Quality", hint:"Freshness, cache, selftest", action:"quality", keys:"debug health cache api"},
      {label:"Expand Detail Chart", hint:"Fullscreen selected chart", action:"chartfs", keys:"fullscreen chart f"},
      {label:"Toggle Area Chart", hint:"Switch line / area", action:"area", keys:"chart area line"},
      {label:"Toggle SMA Overlay", hint:"Moving average on/off", action:"sma", keys:"sma ma moving average"},
      {label:"Methodology", hint:"bps, spread, funding", action:"methodology", keys:"bps explanation research"},
      {label:"Open Watchlist", hint:"Pinned and major symbols", action:"watchlist", keys:"favorites pinned majors"},
      {label:"Open Settings", hint:"Theme, motion, refresh", action:"settings", keys:"preferences controls drawer"},
      {label:"Toggle Dark", hint:"Switch theme", action:"theme", keys:"dark light theme"},
    ];
    function commandResults(q) {
      const clean = String(q || "").trim().toUpperCase();
      return COMMANDS
        .filter(c => !clean || `${c.label} ${c.hint} ${c.keys}`.toUpperCase().includes(clean))
        .slice(0, 8)
        .map(c => ({type:"command", ...c}));
    }
    function runCommand(action) {
      if (action === "heatmap") setTab("heatmap");
      else if (action === "funding") setTab("funding");
      else if (action === "radar") setTab("radar");
      else if (action === "desk") setTab("desk");
      else if (action === "quality") setTab("quality");
      else if (action === "chartfs") { if (state.tab !== "detail") setTab("detail"); setTimeout(openChartFs, 80); }
      else if (action === "area") { state.chartType = state.chartType === "area" ? "line" : "area"; localStorage.setItem("cg.chartType", state.chartType); drawDetailChart(); renderAll(); }
      else if (action === "sma") { state.chartMA = state.chartMA === "off" ? "ma" : "off"; localStorage.setItem("cg.chartMA", state.chartMA); drawDetailChart(); renderAll(); }
      else if (action === "methodology") $("methodology")?.scrollIntoView({behavior: "smooth", block: "start"});
      else if (action === "watchlist") document.querySelector(".rail")?.scrollIntoView({behavior: "smooth", block: "start"});
      else if (action === "settings") settingsOpen();
      else if (action === "theme") $("themeToggle").click();
    }
    function runCmdItem(item) {
      if (!item) return;
      cmdClose();
      if (item.type === "command") runCommand(item.action);
      else selectSymbol(item.symbol);
    }
    function cmdOpen() { $("cmdMask").classList.add("open"); const i = $("cmdInput"); i.value = ""; state.cmdIndex = 0; state.cmdResults = commandResults(""); renderCmd(state.cmdResults); i.focus(); cmdSearch(""); }
    function cmdClose() { $("cmdMask").classList.remove("open"); }
    function renderCmd(list) {
      const el = $("cmdList");
      if (!list.length) { el.innerHTML = `<div class="cmd-empty">Type a symbol name…</div>`; return; }
      el.innerHTML = list.map((r, i) => r.type === "command"
        ? `<div class="cmd-item ${i === state.cmdIndex ? "active" : ""}" data-idx="${i}"><span class="cmd-kind">CMD</span><span class="sym">${esc(r.label)}</span><span class="muted">${esc(r.hint)}</span></div>`
        : `<div class="cmd-item ${i === state.cmdIndex ? "active" : ""}" data-idx="${i}">${tokenIcon(r.symbol)}<span class="sym">${esc(r.symbol)}</span><span class="${basisClass(r.abs_basis_bps)}">${basisFmt(r.abs_basis_bps)}</span><span class="sp">${price(r.spot_mid)}</span></div>`
      ).join("");
      el.querySelectorAll(".cmd-item").forEach((it, i) => { it.onclick = () => runCmdItem(state.cmdResults[Number(it.dataset.idx)]); it.onmouseenter = () => { state.cmdIndex = i; }; });
    }
    async function cmdSearch(q) {
      const commands = commandResults(q);
      try {
        const d = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}&limit=25`, STATE_TIMEOUT_MS);
        const symbols = (d.results || []).map(r => ({type:"symbol", ...r}));
        state.cmdResults = [...commands, ...symbols].slice(0, 32); state.cmdIndex = 0; renderCmd(state.cmdResults);
      } catch (e) {
        state.cmdResults = commands; state.cmdIndex = 0; renderCmd(state.cmdResults);
      }
    }
    function cmdKey(e) {
      const n = state.cmdResults.length;
      if (!n && ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) { e.preventDefault(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); state.cmdIndex = Math.min(n - 1, state.cmdIndex + 1); renderCmd(state.cmdResults); }
      else if (e.key === "ArrowUp") { e.preventDefault(); state.cmdIndex = Math.max(0, state.cmdIndex - 1); renderCmd(state.cmdResults); }
      else if (e.key === "Enter") { runCmdItem(state.cmdResults[state.cmdIndex]); }
      else if (e.key === "Escape") { cmdClose(); }
    }
    // ---- settings drawer ----
    function settingsOpen() { syncSettingsUI(); $("drawerMask").classList.add("open"); $("settingsDrawer").classList.add("open"); syncSegThumbs(); }
    function settingsClose() { $("drawerMask").classList.remove("open"); $("settingsDrawer").classList.remove("open"); }
    function resetPrefs() {
      Object.keys(localStorage).filter(k => k.startsWith("cg.")).forEach(k => localStorage.removeItem(k));
      location.reload();
    }
    function setHelp(open) { $("helpMask").classList.toggle("open", open); }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { cmdClose(); settingsClose(); setHelp(false); closeMega(); closeChartFs(); if (document.activeElement === $("search")) $("search").blur(); return; }
      if (["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase() === "f" && state.tab === "detail") { e.preventDefault(); state.chartFsOpen ? closeChartFs() : openChartFs(); return; }
      if (e.key === "?") { e.preventDefault(); setHelp(!$("helpMask").classList.contains("open")); return; }
      if (e.key === "/") { e.preventDefault(); cmdOpen(); return; }
      if (e.key.toLowerCase() === "d") { e.preventDefault(); $("themeToggle").click(); }
      const tabs = {"1":"radar","2":"opps","3":"funding","4":"movers","5":"heatmap","6":"detail","7":"quality","8":"pulse"};
      if (tabs[e.key]) { e.preventDefault(); setTab(tabs[e.key]); }
    });
    $("themeToggle").onclick = () => { state.themeMode = resolvedTheme() === "dark" ? "light" : "dark"; localStorage.setItem("cg.themeMode", state.themeMode); applyTheme(); syncSettingsUI(); renderAll(); };
    $("errorToggle").onclick = () => $("errorDrawer").classList.toggle("open");
    $("helpBtn").onclick = () => setHelp(true);
    $("helpClose").onclick = () => setHelp(false);
    $("helpMask").onclick = (e) => { if (e.target === $("helpMask")) setHelp(false); };
    $("searchBtn").onclick = () => cmdOpen();
    $("healthPill").onclick = () => setTab("quality");
    $("settingsBtn").onclick = () => settingsOpen();
    $("settingsClose").onclick = () => settingsClose();
    $("drawerMask").onclick = () => settingsClose();
    $("cmdMask").onclick = (e) => { if (e.target === $("cmdMask")) cmdClose(); };
    $("cmdInput").oninput = (e) => { clearTimeout(cmdTimer); const v = e.target.value; cmdTimer = setTimeout(() => cmdSearch(v), 110); };
    $("cmdInput").onkeydown = cmdKey;
    $("search").oninput = (e) => { state.search = e.target.value; localStorage.setItem("cg.search", state.search); state.page = 1; clearTimeout(cmdTimer); cmdTimer = setTimeout(loadRadar, 140); };
    document.querySelectorAll("#rowLimitSeg button").forEach(b => b.onclick = () => { state.pageSize = Number(b.dataset.size); localStorage.setItem("cg.pageSize", state.pageSize); state.page = 1; syncSettingsUI(); renderAll(); loadRadar(); });
    document.querySelectorAll("#unitToggle button").forEach(btn => btn.onclick = () => { state.basisUnit = btn.dataset.unit; localStorage.setItem("cg.basisUnit", state.basisUnit); syncSettingsUI(); renderAll(); });
    $("threshold").oninput = (e) => { state.threshold = Number(e.target.value); localStorage.setItem("cg.threshold", state.threshold); $("thresholdLabel").textContent = state.threshold; renderRadar(); };
    $("detailSearch").onclick = cmdOpen;
    $("detailCopy").onclick = () => copySymbol(state.selectedSymbol);
    $("detailBack").onclick = () => setTab("radar");
    $("detailStar").onclick = () => togglePin(state.selectedSymbol);
    $("deskDetail").onclick = () => setTab("detail");
    $("deskPin").onclick = () => { togglePin(state.selectedSymbol); renderDesk(); };
    $("deskCycle").onclick = () => {
      const rows = marketRows().slice().sort((a, b) => (Number(b.abs_basis_bps) || 0) - (Number(a.abs_basis_bps) || 0));
      const next = rows.find(r => r.symbol !== state.selectedSymbol) || rows[0];
      if (next) focusDeskSymbol(next.symbol);
    };
    $("deskQuality").onclick = () => setTab("quality");
    $("runSelftest").onclick = runSelftest;
    $("refreshEnrichment").onclick = () => loadEnrichment(true);
    $("heatBasis").onclick = () => { state.heatMode = "basis"; localStorage.setItem("cg.heatMode", state.heatMode); renderHeatmap(); renderAll(); };
    $("heatFunding").onclick = () => { state.heatMode = "funding"; localStorage.setItem("cg.heatMode", state.heatMode); loadHeatmap(); renderAll(); };
    $("heatScore").onclick = () => { state.heatMode = "score"; localStorage.setItem("cg.heatMode", state.heatMode); renderHeatmap(); renderAll(); };
    document.querySelectorAll("#heatThresholds button").forEach(btn => btn.onclick = () => { state.heatThreshold = Number(btn.dataset.heatThreshold); localStorage.setItem("cg.heatThreshold", state.heatThreshold); renderHeatmap(); renderAll(); });
    $("heatSort").onchange = (e) => { state.heatSort = e.target.value; localStorage.setItem("cg.heatSort", state.heatSort); renderHeatmap(); };
    document.querySelectorAll(".tab-btn").forEach(btn => btn.onclick = () => setTab(btn.dataset.tab));
    function handleNav(el) {
      closeMega();
      const tab = el.dataset.navTab;
      const filter = el.dataset.navFilter;
      const action = el.dataset.navAction;
      if (filter) { state.filter = filter; localStorage.setItem("cg.filter", state.filter); state.page = 1; }
      if (tab) setTab(tab);
      if (tab === "radar" || filter) loadRadar();
      if (action === "watchlist") document.querySelector(".rail")?.scrollIntoView({behavior: "smooth", block: "start"});
      if (action === "debug") { setTab("quality"); $("errorDrawer").classList.add("open"); }
      if (action === "methodology") $("methodology")?.scrollIntoView({behavior: "smooth", block: "start"});
      renderAll();
    }
    document.querySelectorAll("[data-nav-tab], [data-nav-action]").forEach(el => el.onclick = () => handleNav(el));
    document.querySelectorAll(".chip").forEach(btn => btn.onclick = () => { state.filter = btn.dataset.filter; localStorage.setItem("cg.filter", state.filter); state.page = 1; loadRadar(); renderAll(); });
    document.querySelectorAll("th[data-sort]").forEach(th => th.onclick = () => { const key = th.dataset.sort; if (state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = key === "symbol" || key === "status" ? 1 : -1; } state.page = 1; th.classList.remove("just-sorted"); void th.offsetWidth; th.classList.add("just-sorted"); loadRadar(); });
    document.querySelectorAll("#moverRanges .range-btn").forEach(btn => btn.onclick = () => { state.moverMinutes = Number(btn.dataset.minutes); localStorage.setItem("cg.moverMinutes", state.moverMinutes); loadMovers(); renderAll(); });
    document.querySelectorAll("#historyRanges .range-btn").forEach(btn => btn.onclick = () => { state.chartWindow = btn.dataset.window; localStorage.setItem("cg.chartWindow", state.chartWindow); syncSettingsUI(); updateDeepLink(); loadHistory(); renderAll(); });
    document.querySelectorAll("#symbolTabs .range-btn").forEach(btn => btn.onclick = () => setSymbolTab(btn.dataset.symbolTab));
    document.querySelectorAll("#chartType button").forEach(b => b.onclick = () => { state.chartType = b.dataset.ctype; localStorage.setItem("cg.chartType", state.chartType); drawDetailChart(); renderAll(); });
    document.querySelectorAll("#chartMA button").forEach(b => b.onclick = () => { state.chartMA = b.dataset.ma; localStorage.setItem("cg.chartMA", state.chartMA); drawDetailChart(); renderAll(); });
    document.querySelectorAll("#chartScale button").forEach(b => b.onclick = () => { state.chartScale = b.dataset.scale; localStorage.setItem("cg.chartScale", state.chartScale); drawDetailChart(); renderAll(); });
    $("chartFs").onclick = openChartFs;
    $("chartFsClose").onclick = closeChartFs;
    $("chartFsMask").onclick = (e) => { if (e.target === $("chartFsMask")) closeChartFs(); };
    document.querySelectorAll("#setTheme button").forEach(b => b.onclick = () => { state.themeMode = b.dataset.theme; localStorage.setItem("cg.themeMode", state.themeMode); applyTheme(); syncSettingsUI(); renderAll(); });
    document.querySelectorAll("#setUnit button").forEach(b => b.onclick = () => { state.basisUnit = b.dataset.unit; localStorage.setItem("cg.basisUnit", state.basisUnit); syncSettingsUI(); renderAll(); });
    document.querySelectorAll("#setDensity button").forEach(b => b.onclick = () => { state.density = b.dataset.density; localStorage.setItem("cg.density", state.density); applyTheme(); syncSettingsUI(); });
    document.querySelectorAll("#setRefresh button").forEach(b => b.onclick = () => { setPoll(Number(b.dataset.refresh)); syncSettingsUI(); });
    document.querySelectorAll("#setPageSize button").forEach(b => b.onclick = () => { state.pageSize = Number(b.dataset.size); localStorage.setItem("cg.pageSize", state.pageSize); state.page = 1; syncSettingsUI(); renderAll(); loadRadar(); });
    document.querySelectorAll("#setWindow button").forEach(b => b.onclick = () => { state.chartWindow = b.dataset.window; localStorage.setItem("cg.chartWindow", state.chartWindow); syncSettingsUI(); if (state.tab === "detail") { updateDeepLink(); loadHistory(); } });
    document.querySelectorAll("#setMotion button").forEach(b => b.onclick = () => { state.motionMode = b.dataset.motion; localStorage.setItem("cg.motionMode", state.motionMode); applyTheme(); syncSettingsUI(); renderAll(); });
    document.querySelectorAll("#setCurrency button:not(:disabled)").forEach(b => b.onclick = () => { state.currencyMode = b.dataset.currency; localStorage.setItem("cg.currencyMode", state.currencyMode); syncSettingsUI(); showToast("USDT/USD stays active until a cached FX feed is added"); });
    $("resetPrefs").onclick = resetPrefs;
    if (window.matchMedia) matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (state.themeMode === "system") { applyTheme(); renderAll(); } });
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get("theme")) state.themeMode = urlParams.get("theme");
    const symbolTabsParam = new Set(["overview", "basis", "price", "funding", "spread", "quality"]);
    if (urlParams.get("tab")) {
      const requestedTab = urlParams.get("tab");
      if (symbolTabsParam.has(requestedTab)) { state.symbolTab = requestedTab; state.tab = "detail"; }
      else state.tab = requestedTab;
    }
    if (urlParams.get("window")) state.chartWindow = urlParams.get("window");
    if (urlParams.get("symbol")) state.selectedSymbol = urlParams.get("symbol").toUpperCase();
    const pathSymbol = location.pathname.match(/^\/symbol\/([A-Za-z0-9]+)/);
    if (pathSymbol) { state.selectedSymbol = cleanSymbol(pathSymbol[1]); state.tab = "detail"; }
    if (state.tab === "desk") state.tab = "radar";
    // ================= MOTION LAYER (data-driven) =================
    // ---- shared Aave-style mega-menu ----
    let megaHideTimer = null;
    const megaState = { open: false, name: null };
    const MEGA_ICONS = {
      grid:"M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
      star:"M12 3l2.6 5.3 5.8.8-4.2 4 1 5.8L12 19.9l-5.2 2.9 1-5.8-4.2-4 5.8-.8z",
      layers:"M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
      bookmark:"M6 3h12v18l-6-4-6 4z",
      activity:"M3 12h4l3 8 4-16 3 8h4",
      up:"M7 17 17 7M8 7h9v9",
      down:"M7 7l10 10M17 8v9H8",
      wide:"M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5",
      tight:"M8 3v5H3M21 8h-5V3M16 21v-5h5M3 16h5v5",
      ruler:"M4 8l4-4 12 12-4 4zM8 8l2 2M11 5l2 2",
      plus:"M12 5v14M5 12h14",
      minus:"M5 12h14",
      zap:"M13 2 3 14h7l-1 8 10-12h-7z",
      clock:"M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
      compare:"M6 9v6M18 9v6M6 15a3 3 0 0 0 3 3h6M18 9a3 3 0 0 0-3-3H9",
      book:"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 19H6",
      shield:"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z",
      terminal:"M4 5h16v14H4zM8 10l2 2-2 2M13 14h3",
      help:"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01",
      info:"M12 8h.01M11 12h1v5h1",
    };
    const megaIcon = (n) => `<svg viewBox="0 0 24 24"><path d="${MEGA_ICONS[n] || MEGA_ICONS.info}"/></svg>`;
    const MENU = {
      markets: { title: "Markets", items: [
        { ic:"grid", t:"Overview", d:"All tracked spot/perp symbols", tab:"radar", filter:"all" },
        { ic:"star", t:"Majors", d:"BTC · ETH · BNB · SOL · XRP · DOGE", tab:"radar", filter:"major" },
        { ic:"layers", t:"Alts", d:"Non-major opportunities", tab:"radar", filter:"alts" },
        { ic:"bookmark", t:"Favorites", d:"Your saved symbols", action:"watchlist" },
        { ic:"activity", t:"Recently active", d:"Symbols moving now", tab:"movers" },
      ]},
      basis: { title: "Basis", items: [
        { ic:"up", t:"Spot→Perp", d:"Executable positive basis", tab:"radar", filter:"spot" },
        { ic:"down", t:"Perp→Spot", d:"Reverse basis", tab:"radar", filter:"perp" },
        { ic:"wide", t:"Wide spread", d:"Large bid/ask spread", tab:"radar", filter:"wide" },
        { ic:"tight", t:"Tight spread", d:"Cleaner execution candidates", tab:"radar", filter:"tight" },
        { ic:"ruler", t:"25 / 50 / 100 bps", d:"Threshold screens", tab:"radar", filter:"50" },
      ]},
      funding: { title: "Funding", items: [
        { ic:"plus", t:"Positive funding", d:"Shorts pay longs", tab:"radar", filter:"fundpos" },
        { ic:"minus", t:"Negative funding", d:"Longs pay shorts", tab:"radar", filter:"fundneg" },
        { ic:"zap", t:"Funding extremes", d:"Highest absolute funding", tab:"funding" },
        { ic:"clock", t:"Funding history", d:"Windowed funding chart", tab:"funding" },
        { ic:"compare", t:"Funding vs basis", d:"Cross view", tab:"funding" },
      ]},
      research: { title: "Research", items: [
        { ic:"book", t:"Methodology", d:"How basis & funding are measured", action:"methodology" },
        { ic:"shield", t:"Data quality", d:"Freshness & health", tab:"quality" },
        { ic:"terminal", t:"Debug", d:"Safe JSON endpoints", action:"debug" },
        { ic:"help", t:"What is bps?", d:"100 bps = 1%", action:"methodology" },
        { ic:"info", t:"Public-data limits", d:"Research, not execution", action:"methodology" },
      ]},
    };
    function runMenuItem(it) {
      closeMega();
      if (it.filter) { state.filter = it.filter; localStorage.setItem("cg.filter", state.filter); state.page = 1; }
      if (it.tab) setTab(it.tab);
      if (it.tab === "radar" || it.filter) loadRadar();
      if (it.action === "watchlist") document.querySelector(".rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (it.action === "debug") { setTab("quality"); $("errorDrawer").classList.add("open"); }
      if (it.action === "methodology") $("methodology")?.scrollIntoView({ behavior: "smooth", block: "start" });
      renderAll();
    }
    function openMega(link) {
      const name = link.dataset.menu; if (!name || !MENU[name]) return;
      clearTimeout(megaHideTimer);
      const mm = $("megaMenu"); if (!mm) return;
      const cfg = MENU[name];
      mm.innerHTML = `<div class="mega-inner"><div class="mega-head">${esc(cfg.title)}</div>${cfg.items.map((it, i) => `<button class="mega-item" role="menuitem" data-mi="${i}"><span class="mi-ic">${megaIcon(it.ic)}</span><span><span class="mi-t">${esc(it.t)}</span><span class="mi-d">${esc(it.d)}</span></span></button>`).join("")}</div>`;
      mm.querySelectorAll(".mega-item").forEach(b => { b.onclick = () => runMenuItem(cfg.items[Number(b.dataset.mi)]); });
      // Positioned in viewport coords (menu lives on <body> to escape the header's
      // backdrop-filter containing block). Clamp so it never overflows the viewport.
      const lr = link.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - mm.offsetWidth - 10);
      mm.style.left = Math.min(maxLeft, Math.max(8, lr.left)) + "px";
      mm.style.top = (lr.bottom + 7) + "px";
      mm.classList.add("open");
      document.querySelectorAll(".nav-group").forEach(g => g.classList.remove("active-menu"));
      link.closest(".nav-group")?.classList.add("active-menu");
      megaState.open = true; megaState.name = name;
    }
    function closeMega() {
      const mm = $("megaMenu"); if (mm) mm.classList.remove("open");
      document.querySelectorAll(".nav-group").forEach(g => g.classList.remove("active-menu"));
      megaState.open = false;
    }
    function scheduleCloseMega() { clearTimeout(megaHideTimer); megaHideTimer = setTimeout(closeMega, 170); }

    // ---- gliding tab underline ----
    function moveTabUnderline() {
      const u = $("tabUnderline"), tabs = $("tabs"); if (!u || !tabs) return;
      const active = tabs.querySelector(".tab-btn.active");
      if (!active) { u.style.width = "0"; return; }
      u.style.width = active.offsetWidth + "px";
      u.style.transform = `translateX(${active.offsetLeft}px)`;
    }

    // ---- moving market tape (live phrases) ----
    function tapePhrases() {
      const m = state.summary?.metrics || {}, h = state.health || {}, cm = state.cacheMetrics || {};
      const rows = state.ticker?.rows || state.rows || [];
      const out = [];
      out.push({ text: `${h.tracked_symbols ?? rows.length ?? 0} symbols tracked` });
      out.push({ text: `${m.live_symbols ?? h.live_symbols ?? 0} live · ${m.stale_symbols ?? h.stale_symbol_count ?? 0} stale` });
      if (cm.last_refresh_ms != null) out.push({ text: `cache ${Math.round(cm.last_refresh_ms)}ms` });
      if (state.lastLatencyMs != null) out.push({ text: `api ${state.lastLatencyMs.toFixed(0)}ms` });
      rows.slice().sort((a, b) => (Math.abs(b.abs_basis_bps) || 0) - (Math.abs(a.abs_basis_bps) || 0)).slice(0, 6)
        .forEach(r => out.push({ sym: r.symbol, text: `basis ${basisFmt(r.abs_basis_bps)} bps`, cls: basisClass(r.abs_basis_bps) }));
      rows.slice().sort((a, b) => Math.abs(b.funding_rate || 0) - Math.abs(a.funding_rate || 0)).slice(0, 5)
        .forEach(r => out.push({ sym: r.symbol, text: `funding ${pct(r.funding_rate)}`, cls: fundingClass(r.funding_rate) }));
      if (m.p95_abs_basis_bps != null) out.push({ text: `p95 basis ${basisFmt(m.p95_abs_basis_bps)} bps` });
      return out;
    }
    function tapeItemHTML(p) {
      return `<span class="ti-dot"></span>${p.sym ? `<span class="ti-sym">${esc(p.sym)}</span>` : ""}<span class="${p.cls || "muted"}">${esc(p.text)}</span>`;
    }
    function renderTape() {
      const track = $("tapeTrack"); if (!track) return;
      const ph = tapePhrases(); if (!ph.length) return;
      const want = ph.length * 2;
      if (track.childElementCount !== want) {
        const html = ph.map(p => `<span class="tape-item" data-symbol="${esc(p.sym || "")}">${tapeItemHTML(p)}</span>`).join("");
        track.innerHTML = html + html;
        track.querySelectorAll(".tape-item[data-symbol]").forEach(el => { el.onclick = () => { if (el.dataset.symbol) selectSymbol(el.dataset.symbol); }; });
      } else {
        const items = track.querySelectorAll(".tape-item"), all = ph.concat(ph);
        items.forEach((el, i) => {
          const p = all[i]; if (!p) return;
          const sym = p.sym || "", html = tapeItemHTML(p);
          if (el.dataset.symbol !== sym) el.dataset.symbol = sym;
          setHTMLIfChanged(el, html);
        });
      }
    }

    // ---- rotating dynamic headline ----
    function headlinePhrases() {
      const m = state.summary?.metrics || {}, h = state.health || {};
      const rows = state.ticker?.rows || state.rows || [];
      const n = h.tracked_symbols ?? rows.length ?? 0, live = m.live_symbols ?? h.live_symbols ?? 0;
      const top = rows.slice().sort((a, b) => (Math.abs(b.abs_basis_bps) || 0) - (Math.abs(a.abs_basis_bps) || 0))[0];
      const arr = [`Scanning ${n} Binance public spot/perp streams`, `Freshness stable — ${live} live symbols`];
      if (top) arr.push(`Basis leader ${top.symbol} at ${basisFmt(top.abs_basis_bps)} bps`);
      if (m.symbols_above_50_bps) arr.push(`${m.symbols_above_50_bps} symbols above 50 bps basis`);
      arr.push("Funding extremes updating every refresh");
      return arr;
    }
    let hlIndex = 0;
    function rotateHeadline() {
      const el = $("headlineText"), host = $("headline"); if (!el || !host) return;
      const arr = headlinePhrases(); if (!arr.length) return;
      hlIndex = (hlIndex + 1) % arr.length;
      host.classList.add("swap");
      setTimeout(() => { el.textContent = arr[hlIndex]; host.classList.remove("swap"); }, prefersReducedMotion() ? 0 : 400);
    }

    // ---- live activity feed ----
    function pushActivity(kind, html, symbol) {
      state.activity = state.activity || [];
      const top = state.activity[0];
      if (top && top.html === html) { top.t = Date.now(); return; }   // collapse consecutive repeats
      state.actId = (state.actId || 0) + 1;
      state.activity.unshift({ id: state.actId, t: Date.now(), kind, html, symbol: symbol || null });
      state.activity = state.activity.slice(0, 18);
    }
    function detectActivity() {
      const rows = state.ticker?.rows || state.rows || []; if (!rows.length) return;
      state.actPrev = state.actPrev || {};
      const p = state.actPrev, ready = p.ready;
      const leader = rows.slice().sort((a, b) => (Math.abs(b.abs_basis_bps) || 0) - (Math.abs(a.abs_basis_bps) || 0))[0];
      const fund = rows.slice().sort((a, b) => Math.abs(b.funding_rate || 0) - Math.abs(a.funding_rate || 0))[0];
      const staleNow = new Set(rows.filter(r => r.status !== "LIVE").map(r => r.symbol));
      const cm = state.cacheMetrics || {}, cacheSlow = cm.last_refresh_ms != null && cm.last_refresh_ms > 80;
      const now = Date.now();
      if (ready) {
        // Rate-limit leader/funding churn so an oscillating market can't spam the feed.
        if (leader && p.leader && p.leader !== leader.symbol && now - (p.leaderAt || 0) > 9000) { pushActivity("up", `<b>${esc(leader.symbol)}</b> is the new basis leader · ${basisFmt(leader.abs_basis_bps)} bps`, leader.symbol); p.leaderAt = now; }
        if (leader) { const la = Math.abs(leader.abs_basis_bps) || 0; if (p.maxAbs != null && la > p.maxAbs + 6 && now - (p.highAt || 0) > 12000) { pushActivity("up", `New session basis high · <b>${esc(leader.symbol)}</b> ${basisFmt(leader.abs_basis_bps)} bps`, leader.symbol); p.highAt = now; const sp = $("spotlight"); if (sp && !prefersReducedMotion()) { sp.classList.remove("glow"); void sp.offsetWidth; sp.classList.add("glow"); } } }
        if (fund && p.fundSym !== fund.symbol && Math.abs(fund.funding_rate || 0) > 0.0004 && now - (p.fundAt || 0) > 12000) { pushActivity("warn", `Funding extreme · <b>${esc(fund.symbol)}</b> ${pct(fund.funding_rate)}`, fund.symbol); p.fundAt = now; }
        const prevStale = p.staleSet || new Set();
        staleNow.forEach(s => { if (!prevStale.has(s)) pushActivity("down", `<b>${esc(s)}</b> feed went stale`, s); });
        prevStale.forEach(s => { if (!staleNow.has(s)) pushActivity("up", `<b>${esc(s)}</b> feed is fresh again`, s); });
        // Cache-health noise stays OUT of the feed — it lives in the network badge popover.
      }
      if (leader) { p.leader = leader.symbol; p.maxAbs = Math.max(p.maxAbs || 0, Math.abs(leader.abs_basis_bps) || 0); }
      if (fund) p.fundSym = fund.symbol;
      p.staleSet = staleNow; p.cacheSlow = cacheSlow; p.ready = true;
    }
    function timeAgo(t) { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 5) return "now"; if (s < 60) return `${Math.round(s)}s`; if (s < 3600) return `${Math.round(s / 60)}m`; return `${Math.round(s / 3600)}h`; }
    function renderActivity() {
      const el = $("activityFeed"); if (!el) return;
      const list = state.activity || [];
      if (!list.length) { setHTMLIfChanged(el, `<div class="empty" style="padding:10px 2px">Watching the stream for basis, funding, and freshness events…</div>`); return; }
      // Only rebuild when the event set changes — never per-poll just to tick timestamps.
      const sig = list.map(a => a.id).join(",");
      if (sig === state._actSig) return;
      const firstPaint = state._actSig === undefined;
      const topId = list[0].id;
      el.innerHTML = list.map(a => `<div class="feed-row ${a.kind} ${a.id === topId && !firstPaint ? "enter" : ""}"${a.symbol ? ` data-symbol="${esc(a.symbol)}"` : ""}><span class="fr-main">${a.html}</span><span class="fr-time">${timeAgo(a.t)}</span></div>`).join("");
      el.querySelectorAll(".feed-row[data-symbol]").forEach(r => r.onclick = () => selectSymbol(r.dataset.symbol));
      state._actSig = sig;
    }

    // ---- Aave-style micro-visual widgets ----
    function renderWidgets() {
      const host = $("widgets"); if (!host) return;
      if (host.childElementCount !== 4) {
        host.innerHTML = `
          <div class="widget" data-w="fresh" data-tip="Share of tracked symbols with a fresh public-data snapshot.">
            <div class="w-vis"><svg viewBox="0 0 56 56"><circle class="ring-track" cx="28" cy="28" r="22" stroke-width="6"/><circle class="ring-val" cx="28" cy="28" r="22" stroke-width="6" transform="rotate(-90 28 28)"/></svg></div>
            <div class="w-label">Freshness</div><div class="w-value" data-v>--</div><div class="w-sub" data-s>live / total</div></div>
          <div class="widget" data-w="basis" data-tip="Distribution of absolute basis across current symbols, with the median marker.">
            <div class="w-vis wide"><svg viewBox="0 0 92 56" preserveAspectRatio="none"><path class="curve-fill"/><path class="curve-line"/><line class="curve-marker" x1="0" y1="4" x2="0" y2="52"/></svg></div>
            <div class="w-label">Basis spread</div><div class="w-value" data-v>--</div><div class="w-sub" data-s>median · p95</div></div>
          <div class="widget" data-w="fund" data-tip="Count of symbols paying positive vs negative funding right now.">
            <div class="w-vis"><svg viewBox="0 0 56 56"><line x1="28" y1="12" x2="28" y2="44" stroke="var(--hairline)" stroke-width="1"/><rect class="bar-pos" x="28" y="19" width="0" height="7" rx="2" fill="var(--green)"/><rect class="bar-neg" x="28" y="30" width="0" height="7" rx="2" fill="var(--magenta)"/></svg></div>
            <div class="w-label">Funding balance</div><div class="w-value" data-v>--</div><div class="w-sub" data-s>pos vs neg</div></div>
          <div class="widget" data-w="pulse" data-tip="Rolling cache-refresh latency heartbeat from the background cache loop.">
            <div class="w-vis wide"><svg viewBox="0 0 92 56" preserveAspectRatio="none"><polyline class="pulse-line" points=""/></svg></div>
            <div class="w-label">Network pulse</div><div class="w-value" data-v>--</div><div class="w-sub" data-s>cache · api</div></div>`;
      }
      const rows = (state.rows && state.rows.length ? state.rows : (state.ticker?.rows || []));
      const m = state.summary?.metrics || {}, h = state.health || {}, cm = state.cacheMetrics || {};
      // Freshness ring
      const total = rows.length || (h.tracked_symbols || 0);
      const live = rows.length ? rows.filter(r => r.status === "LIVE").length : (m.live_symbols || h.live_symbols || 0);
      const livePct = total ? live / total : 0;
      const fw = host.querySelector('[data-w="fresh"]');
      if (fw) {
        const C = 2 * Math.PI * 22, rv = fw.querySelector(".ring-val");
        rv.style.strokeDasharray = C.toFixed(1);
        rv.style.strokeDashoffset = (C * (1 - livePct)).toFixed(1);
        rv.style.stroke = livePct > 0.8 ? "var(--green)" : livePct > 0.5 ? "var(--yellow)" : "var(--red)";
        fw.querySelector("[data-v]").textContent = `${Math.round(livePct * 100)}%`;
        fw.querySelector("[data-s]").textContent = `${live} / ${total} live`;
      }
      // Basis distribution curve
      const abs = rows.map(r => Math.abs(Number(r.abs_basis_bps) || 0)).filter(v => v > 0).sort((a, b) => a - b);
      const bw = host.querySelector('[data-w="basis"]');
      if (bw) {
        const median = abs.length ? abs[Math.floor(abs.length / 2)] : Number(m.median_abs_basis_bps) || 0;
        const p95 = abs.length ? abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.95))] : Number(m.p95_abs_basis_bps) || 0;
        const maxX = Math.max(p95 * 1.15, 10), bins = 14, counts = new Array(bins).fill(0);
        abs.forEach(v => { counts[Math.min(bins - 1, Math.floor(v / maxX * bins))]++; });
        const maxC = Math.max(1, ...counts), W = 92, H = 56;
        const pts = counts.map((c, i) => [(i / (bins - 1)) * W, H - 4 - (c / maxC) * (H - 12)]);
        const line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} ` + pts.slice(1).map(p => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
        const fill = `M0 ${H} ` + pts.map(p => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + ` L ${W} ${H} Z`;
        bw.querySelector(".curve-line").setAttribute("d", line);
        bw.querySelector(".curve-fill").setAttribute("d", fill);
        const medX = (Math.min(median, maxX) / maxX * W).toFixed(1);
        const mk = bw.querySelector(".curve-marker"); mk.setAttribute("x1", medX); mk.setAttribute("x2", medX);
        bw.querySelector("[data-v]").textContent = `${basisFmt(median)} bps`;
        bw.querySelector("[data-s]").textContent = `median · p95 ${basisFmt(p95)}`;
      }
      // Funding balance
      const pos = rows.filter(r => Number(r.funding_rate) > 0).length, neg = rows.filter(r => Number(r.funding_rate) < 0).length;
      const fdw = host.querySelector('[data-w="fund"]');
      if (fdw) {
        const tot = pos + neg || 1, maxHalf = 22;
        const pl = (pos / tot) * maxHalf, nl = (neg / tot) * maxHalf;
        const bp = fdw.querySelector(".bar-pos"), bn = fdw.querySelector(".bar-neg");
        bp.setAttribute("width", pl.toFixed(1)); bp.setAttribute("x", "28");
        bn.setAttribute("width", nl.toFixed(1)); bn.setAttribute("x", (28 - nl).toFixed(1));
        fdw.querySelector("[data-v]").textContent = `${pos} / ${neg}`;
        fdw.querySelector("[data-s]").textContent = "pos vs neg funding";
      }
      // Network pulse
      const pw = host.querySelector('[data-w="pulse"]');
      if (pw) {
        const buf = state.pulseBuf && state.pulseBuf.length ? state.pulseBuf : [Number(cm.last_refresh_ms) || 0];
        const mn = Math.min(...buf), mx = Math.max(...buf), sp = (mx - mn) || 1, W = 92, H = 56;
        const pp = buf.map((val, i) => `${((i / Math.max(1, buf.length - 1)) * W).toFixed(1)},${(H - 4 - ((val - mn) / sp) * (H - 12)).toFixed(1)}`).join(" ");
        const pl = pw.querySelector(".pulse-line");
        pl.setAttribute("points", pp);
        const cms = Number(cm.last_refresh_ms);
        pl.style.stroke = Number.isFinite(cms) && cms > 80 ? "var(--yellow)" : "var(--green)";
        pw.querySelector("[data-v]").textContent = Number.isFinite(cms) ? `${Math.round(cms)}ms` : "--";
        pw.querySelector("[data-s]").textContent = `cache · api ${state.lastLatencyMs == null ? "--" : state.lastLatencyMs.toFixed(0) + "ms"}`;
      }
    }
    function spotlightReason(r) {
      const abs = Math.abs(Number(r.abs_basis_bps) || 0);
      const fund = Math.abs(Number(r.funding_rate) || 0);
      const spread = (Number(r.spot_spread_bps) || 0) + (Number(r.futures_spread_bps) || 0);
      if (abs >= 100) return "basis extreme";
      if (fund >= 0.0004) return "funding extreme";
      if (r.status === "LIVE" && spread <= 8) return "fresh quote · clean spread";
      return r.status === "LIVE" ? "fresh basis leader" : "leader needs freshness check";
    }
    // ---- market spotlight hero (featured top dislocation) ----
    function renderSpotlight() {
      const host = $("spotlight"); if (!host) return;
      const rows = (state.rows && state.rows.length ? state.rows : (state.ticker?.rows || []));
      if (!rows.length) return;
      // Feature the strongest abs-basis symbol; re-pick at most every ~6s to avoid jitter.
      if (!state.spotSym || Date.now() - (state.spotAt || 0) > 6000) {
        const leader = rows.slice().sort((a, b) => (Math.abs(b.abs_basis_bps) || 0) - (Math.abs(a.abs_basis_bps) || 0))[0];
        if (leader) { state.spotSym = leader.symbol; state.spotAt = Date.now(); }
      }
      const sym = state.spotSym;
      const r = (state.bySymbol && state.bySymbol.get(sym)) || rows.find(x => x.symbol === sym);
      if (!r) return;
      if (host.dataset.sym !== sym) {
        host.dataset.sym = sym;
        host.innerHTML = `
          <div class="spot-id">${tokenIcon(sym)}<div><div class="spot-eyebrow">What matters now</div><div class="spot-sym">${esc(sym)}</div><div class="spot-pair muted" data-slot="reason">spot · perp basis</div></div><span data-slot="badge"></span></div>
          <div class="spot-px"><div class="spot-big" data-slot="px">--</div><div class="spot-chg" data-slot="basis">--</div></div>
          <div class="spot-stats" data-slot="stats"></div>
          <div class="spot-chart" data-slot="chart"></div>`;
        host.onclick = () => selectSymbol(sym);
        host.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSymbol(sym); } };
      }
      const pxEl = host.querySelector('[data-slot="px"]');
      const newPx = price(r.spot_mid);
      if (pxEl.dataset.raw !== newPx) {
        const dir = flashDir(Number(pxEl.dataset.n), Number(r.spot_mid));
        pxEl.innerHTML = newPx; pxEl.dataset.raw = newPx; pxEl.dataset.n = String(r.spot_mid);
        if (dir) { pxEl.classList.remove("flash-up", "flash-down"); void pxEl.offsetWidth; pxEl.classList.add(dir); }
      }
      const basisEl = host.querySelector('[data-slot="basis"]');
      setClassIfChanged(basisEl, "spot-chg " + basisClass(r.abs_basis_bps));
      setTextIfChanged(basisEl, `${basisFmt(r.abs_basis_bps)} bps abs basis`);
      setTextIfChanged(host.querySelector('[data-slot="reason"]'), spotlightReason(r));
      setHTMLIfChanged(host.querySelector('[data-slot="badge"]'), badge(r));
      setHTMLIfChanged(host.querySelector('[data-slot="stats"]'), [
        ["Spot→Perp", basisFmt(r.spot_to_perp_bps), basisClass(r.spot_to_perp_bps)],
        ["Funding", pct(r.funding_rate), fundingClass(r.funding_rate)],
        ["Spread", bps((Number(r.spot_spread_bps) || 0) + (Number(r.futures_spread_bps) || 0)), "muted"],
        ["Age", seconds(r.age_seconds), r.status === "LIVE" ? "pos" : "neg"],
      ].map(([k, v, c]) => `<div class="ss"><span class="ss-k">${k}</span><span class="ss-v ${c}">${v}</span></div>`).join(""));
      setHTMLIfChanged(host.querySelector('[data-slot="chart"]'), sparkline(sym, 200, 56, true));
    }
    // ---- floating network-health wifi badge ----
    function renderNetBadge() {
      const b = $("netBadge"); if (!b) return;
      const lat = state.lastLatencyMs, cache = state.cacheMetrics?.last_refresh_ms, age = liveAge(state.health);
      const live = state.health?.status === "LIVE";
      let net = "bad";
      if (live && lat != null && lat < 300 && (cache == null || cache < 80)) net = "good";
      else if (lat != null && lat < 800) net = "mid";
      b.dataset.net = net;
      const ms = $("netMs"); if (ms) setHTMLIfChanged(ms, lat == null ? "--" : `${Math.round(lat)}<span style="font-size:9px;font-weight:500;color:var(--muted)">ms</span>`);
      const st = $("netState"); if (st) setTextIfChanged(st, net === "good" ? "live" : net === "mid" ? "slow" : "weak");
      const popHtml = `<div class="np-title">Network health</div>` + [
        ["Browser latency", lat == null ? "--" : `${Math.round(lat)} ms`],
        ["Cache refresh", cache == null ? "--" : `${Math.round(cache)} ms`],
        ["Snapshot age", seconds(age)],
        ["Live symbols", `${state.health?.live_symbols ?? 0} / ${state.health?.tracked_symbols ?? 0}`],
        ["Refreshes", `${state.cacheMetrics?.refresh_count ?? 0} · ${state.cacheMetrics?.failed_refresh_count ?? 0} fail`],
      ].map(([k, v]) => `<div class="np-row"><span>${k}</span><strong>${v}</strong></div>`).join("") + `<div class="np-row"><span>Action</span><strong class="blue">Open Data Quality →</strong></div>`;
      setHTMLIfChanged($("netPop"), popHtml);
      const hpHtml = `<div class="hp-title">Data health</div>` + [
        ["Source", "Binance public"],
        ["Browser", lat == null ? "--" : `${Math.round(lat)} ms`],
        ["Cache", cache == null ? "--" : `${Math.round(cache)} ms`],
        ["Age", seconds(age)],
        ["Live symbols", `${state.health?.live_symbols ?? 0} / ${state.health?.tracked_symbols ?? 0}`],
      ].map(([k, v]) => `<div class="hp-row"><span>${k}</span><strong>${v}</strong></div>`).join("");
      setHTMLIfChanged($("healthPop"), hpHtml);
    }
    // ---- live market-mood chip ----
    function renderMood() {
      const el = $("moodChip"); if (!el) return;
      const m = state.summary?.metrics || {};
      const wide = Number(m.symbols_above_50_bps || 0), hot = Number(m.symbols_above_100_bps || 0);
      const funding = Math.max(Math.abs(Number(m.highest_funding_rate || 0)), Math.abs(Number(m.lowest_funding_rate || 0)));
      let mood = "calm", label = "CALM";
      if (hot >= 3 || wide >= 12 || funding > 0.0006) { mood = "hot"; label = "ACTIVE"; }
      else if (wide >= 5 || funding > 0.0003) { mood = "warm"; label = "STEADY"; }
      if (el.dataset.mood !== mood) el.dataset.mood = mood;
      if (el.textContent !== label) el.textContent = label;
    }
    function initMotion() {
      const nb = $("netBadge"); if (nb) nb.onclick = () => { setTab("quality"); showToast("Opened Data Quality"); };
      // Reparent the mega-menu onto <body> so it escapes the header's
      // backdrop-filter (which would otherwise trap fixed positioning/stacking).
      const mm = $("megaMenu"); if (mm && mm.parentElement !== document.body) document.body.appendChild(mm);
      document.querySelectorAll(".nav-link[data-menu]").forEach(link => {
        link.addEventListener("mouseenter", () => openMega(link));
        link.addEventListener("focus", () => openMega(link));
      });
      document.querySelectorAll("#topNav .nav-link:not([data-menu])").forEach(link => link.addEventListener("mouseenter", scheduleCloseMega));
      const nav = $("topNav"); if (nav) nav.addEventListener("mouseleave", scheduleCloseMega);
      if (mm) { mm.addEventListener("mouseenter", () => clearTimeout(megaHideTimer)); mm.addEventListener("mouseleave", scheduleCloseMega); }
      document.addEventListener("click", (e) => { if (megaState.open && !e.target.closest("#topNav") && !e.target.closest("#megaMenu")) closeMega(); });
      window.addEventListener("scroll", () => { if (megaState.open) closeMega(); }, { passive: true });
      const arr = headlinePhrases(); if (arr.length) { const el = $("headlineText"); if (el) el.textContent = arr[0]; }
      setInterval(rotateHeadline, 4500);
      renderWidgets(); renderTape(); renderActivity(); moveTabUnderline();
      window.addEventListener("resize", () => { setTimeout(moveTabUnderline, 120); setTimeout(syncSegThumbs, 120); });
    }
    function tickClock() {
      const el = $("utcClock");
      if (el) el.textContent = new Date().toISOString().slice(11, 19);
    }
    applyTheme();
    syncSettingsUI();
    setTab(state.tab);
    $("heatBasis").classList.toggle("active", state.heatMode === "basis");
    $("heatFunding").classList.toggle("active", state.heatMode === "funding");
    $("heatScore").classList.toggle("active", state.heatMode === "score");
    // First paint from the embedded lite snapshot: no SYNCING screen if the cache has rows.
    try {
      const boot = window.__BOOTSTRAP_STATE__;
      if (boot && typeof boot === "object" && applyLite(boot)) { detectActivity(); renderAll(); }
    } catch (e) {}
    initMotion();
    tickClock();
    poll().then(() => loadActiveTab());
    setPoll(state.refreshMs);                   // core: /api/state-lite only (speed from settings)
    setInterval(() => { if (!document.hidden) loadActiveTab(); }, 4000);   // active tab, 4s
    setInterval(tickClock, 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { poll(); loadActiveTab(); } });
    window.addEventListener("resize", () => setTimeout(() => { renderAll(); if (state.chartFsOpen && fsChart) fsChart.resize(); }, 100));
  </script>
</body>
</html>
"""
