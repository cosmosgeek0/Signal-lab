// Radar — the default screen, v2 "clean canvas".
// White page, no boxed cards: marquee tape, Coinbase-style stat tiles with
// live mini-charts, borderless signal columns, and an unboxed market table
// with colored per-row sparklines, ↗/↘ deltas and price-flash animations.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon, starIcon, brandColor, onIconsReady } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { store, onLive, navigate, isStarred, toggleStar, onWatch } from "../lib/store.js";
import {
  baseOf, fmtPrice, fmtBps, fmtBasisVal, basisUnit, fmtFunding, fmtScore, fmtAge, signClass, ago,
} from "../lib/format.js";
import { sparkline } from "../lib/chart.js";
import { buildTape } from "../ui/tape.js";

const PAGE_SIZE = 25;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "major", label: "Majors" },
  { id: "alts", label: "Alts" },
  { id: "fundpos", label: "Funding +" },
  { id: "fundneg", label: "Funding −" },
  { id: "25", label: "Basis ≥ 25" },
  { id: "stale", label: "Stale" },
];

const ADVANCED = [
  { key: "spot_bid", label: "Spot bid" },
  { key: "spot_ask", label: "Spot ask" },
  { key: "fut_bid", label: "Perp bid" },
  { key: "fut_ask", label: "Perp ask" },
];

const loadAdvanced = () => { try { return new Set(JSON.parse(localStorage.getItem("cg-cols") || "[]")); } catch (e) { return new Set(); } };
const saveAdvanced = (s) => { try { localStorage.setItem("cg-cols", JSON.stringify(Array.from(s))); } catch (e) {} };

// Rolling buffers for the stat tiles; module-level so they keep filling
// across navigation within a session.
const BUF = { live: [], median: [], p95: [], fund: [] };
const pushBuf = (a, v, cap = 160) => { const n = Number(v); if (isFinite(n)) { a.push(n); if (a.length > cap) a.shift(); } };

export function renderRadar(root) {
  let filter = "all", sort = "abs_basis", direction = "desc";
  let page = 1, pages = 1, total = 0;
  let advanced = loadAdvanced();
  let sparks = {};
  const rowMap = new Map();
  const cleanups = [];

  // ---- live tape (shared marquee component) ----
  const tape = buildTape();
  cleanups.push(tape.destroy);

  // ---- stat tiles (Coinbase "Market stats") ----
  const tiles = {};
  function tile(key, label) {
    const v = h("div", { class: "stat-v num" }, "—");
    const s = h("div", { class: "stat-spark" });
    tiles[key] = { v, s };
    return h("div", { class: "stat-tile" }, h("div", { class: "stat-k" }, label), v, s);
  }
  const statsWrap = h("div", { class: "stats" },
    tile("live", "Live coverage"),
    tile("median", "Median |basis|"),
    tile("p95", "P95 |basis|"),
    tile("fund", "Peak funding"));

  function paintStats(lite) {
    const m = (lite && lite.metrics) || {};
    pushBuf(BUF.live, m.live_symbols);
    pushBuf(BUF.median, m.median_abs_basis_bps);
    pushBuf(BUF.p95, m.p95_abs_basis_bps);
    pushBuf(BUF.fund, (m.highest_funding_rate || 0) * 100);
    setTile("live", m.live_symbols != null ? `${m.live_symbols} / ${m.total_symbols}` : "—", BUF.live);
    setTile("median", m.median_abs_basis_bps != null ? fmtBps(m.median_abs_basis_bps) + " bps" : "—", BUF.median);
    setTile("p95", m.p95_abs_basis_bps != null ? fmtBps(m.p95_abs_basis_bps) + " bps" : "—", BUF.p95);
    setTile("fund", m.highest_funding_rate != null ? fmtFunding(m.highest_funding_rate) : "—", BUF.fund);
  }
  function setTile(k, text, buf) {
    tiles[k].v.textContent = text;
    if (buf.length >= 2) {
      const up = buf[buf.length - 1] >= buf[0];
      tiles[k].s.innerHTML = sparkline(buf, 150, 36, up ? "var(--up)" : "var(--down)");
    }
  }

  // ---- basis-focused signal columns (funding lives on /funding) ----
  const signalsWrap = h("div", { class: "signals" });
  let moverRows = null;   // 15m basis movers
  function paintSignals(rows) {
    const openBasis = (sym) => navigate("/symbol/" + sym + "?tab=basis");
    const mk = (label, note, list, valFn, clsFn, onHead) =>
      h("div", { class: "sig" },
        h("div", { class: "sig-head", onClick: onHead },
          h("span", { class: "sig-label" }, label), h("span", { class: "sig-more" }, note)),
        (list || []).slice(0, 3).map((r) => h("div", { class: "sig-row", onClick: () => openBasis(r.symbol) },
          tokenIcon(r.symbol, 22),
          h("span", { class: "sig-name" }, baseOf(r.symbol)),
          h("span", { class: "sig-val num " + clsFn(r) }, valFn(r)))));
    const byB = [...rows].sort((a, b) => b.abs_basis_bps - a.abs_basis_bps);
    const byS = [...rows].sort((a, b) => b.opportunity_score - a.opportunity_score);
    const widen = (moverRows && moverRows.top_basis_widening) || [];
    const compress = (moverRows && moverRows.top_basis_compression) || [];
    mount(signalsWrap,
      mk("Widest basis", "Sort table ›", byB, (r) => fmtBps(r.mid_spread_bps, true) + " bps", (r) => signClass(r.mid_spread_bps),
        () => { sort = "abs_basis"; direction = "desc"; page = 1; buildHead(); loadTable(); }),
      mk("Widening · 15m", "Movers ›", widen, (r) => fmtBps(r.basis_change_bps, true) + " bps", () => "up",
        () => navigate("/movers")),
      mk("Compressing · 15m", "Movers ›", compress, (r) => fmtBps(r.basis_change_bps, true) + " bps", () => "down",
        () => navigate("/movers")),
      mk("Top score", "Sort table ›", byS, (r) => fmtScore(r.opportunity_score), () => "strong",
        () => { sort = "score"; direction = "desc"; page = 1; buildHead(); loadTable(); }));
  }

  // ---- basis distribution (signed, clamped at p95) ----
  const distWrap = h("div", { class: "dist-chart" });
  function paintDistribution(rows) {
    const vals = rows.map((r) => Number(r.mid_spread_bps)).filter(isFinite);
    if (vals.length < 5) { mount(distWrap, h("div", { class: "empty-state" }, "No data yet.")); return; }
    const abs = vals.map(Math.abs).sort((a, b) => a - b);
    const lim = Math.max(abs[Math.floor(abs.length * 0.95)] || 1, 5);
    const N = 18;
    const bins = Array.from({ length: N }, (_, i) => ({ from: -lim + (i * 2 * lim) / N, to: -lim + ((i + 1) * 2 * lim) / N, count: 0 }));
    for (const v of vals) {
      const idx = Math.max(0, Math.min(N - 1, Math.floor(((Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim)) * N)));
      bins[idx].count += 1;
    }
    const maxC = Math.max(...bins.map((b) => b.count), 1);
    mount(distWrap, h("div", { class: "dist-bars", style: { height: "130px" } },
      bins.map((b) => {
        const mid = (b.from + b.to) / 2;
        return h("div", { class: "dist-col", title: `${fmtBps(b.from)}…${fmtBps(b.to)} bps — ${b.count} symbols` },
          h("div", { class: "dist-bar " + (mid >= 0 ? "pos" : "neg"), style: { height: Math.max(3, (b.count / maxC) * 100) + "%" } }),
          h("div", { class: "dist-x num" }, fmtBps(mid)));
      })));
  }

  // ---- regime + sub line ----
  const regimePill = h("span", { class: "pill-regime" });
  const subLine = h("div", { class: "page-sub" }, "loading…");
  function paintRegime(rows) {
    const total_ = rows.length || 1;
    const pos = rows.filter((r) => r.funding_rate > 0).length;
    const neg = rows.filter((r) => r.funding_rate < 0).length;
    const hot = rows.filter((r) => r.abs_basis_bps >= 50).length;
    const elevated = rows.filter((r) => r.abs_basis_bps >= 25).length;
    const stale = rows.filter((r) => r.status !== "LIVE").length;
    let label, dot;
    if (stale / total_ > 0.5) { label = "Data stale"; dot = "dot-off"; }
    else if (hot >= 8 || elevated / total_ > 0.25) { label = "Basis active"; dot = "dot-stale"; }
    else if (Math.abs((pos - neg) / total_) > 0.35) { label = "Funding skewed"; dot = "dot-live"; }
    else { label = "Orderly"; dot = "dot-live"; }
    mount(regimePill, h("span", { class: "dot " + dot }), label);
  }
  function paintSub(rows) {
    const live = rows.filter((r) => r.status === "LIVE").length;
    const age = store.lite && store.lite.cache ? store.lite.cache.cache_age_seconds : null;
    mount(subLine, `${rows.length} symbols · ${live} live · updated ${age != null ? ago(age) : "now"}`);
  }

  // ---- table ----
  const thead = h("thead");
  const tbody = h("tbody");
  const table = h("table", { class: "mkt" }, thead, tbody);
  const chips = h("div", { class: "chips" });
  const colsBtn = h("button", { class: "mini-btn", onClick: openColsPopover }, icon("columns"), "Columns");
  const foot = h("div", { class: "table-foot" });

  function columns() {
    const cols = [
      { key: "star", label: "", cls: "l w-star" },
      { key: "idx", label: "#", cls: "l w-idx" },
      { key: "token", label: "Token", cls: "l", sort: "symbol" },
      { key: "chart", label: "Chart", cls: "l col-hide-xs" },
      { key: "spot", label: "Spot", sort: "spot_mid" },
    ];
    if (advanced.has("spot_bid")) cols.push({ key: "spot_bid", label: "Spot bid", sort: "spot_bid" });
    if (advanced.has("spot_ask")) cols.push({ key: "spot_ask", label: "Spot ask", sort: "spot_ask" });
    cols.push({ key: "perp", label: "Perp", sort: "perp_mid" });
    if (advanced.has("fut_bid")) cols.push({ key: "fut_bid", label: "Perp bid", sort: "perp_bid" });
    if (advanced.has("fut_ask")) cols.push({ key: "fut_ask", label: "Perp ask", sort: "perp_ask" });
    cols.push(
      { key: "basis", label: "Basis (" + basisUnit() + ")", sort: "abs_basis" },
      { key: "funding", label: "Funding", sort: "funding" },
      { key: "spread", label: "Spread", sort: "spot_spread", cls: "col-hide-sm" },
      { key: "age", label: "Age", sort: "age", cls: "col-hide-sm" },
      { key: "score", label: "Score", sort: "score", cls: "col-hide-sm" },
      { key: "status", label: "Status", cls: "col-hide-xs" },
      { key: "cta", label: "" });
    return cols;
  }

  function buildHead() {
    const tr = h("tr");
    for (const c of columns()) {
      const th = h("th", { class: (c.cls || "") + (c.sort ? " sortable" : "") + (c.sort === sort ? " sorted" : "") });
      th.append(c.label);
      if (c.sort) {
        th.appendChild(h("span", { class: "sort-caret" }, c.sort === sort ? (direction === "desc" ? "▼" : "▲") : "▾"));
        th.addEventListener("click", () => {
          if (sort === c.sort) direction = direction === "desc" ? "asc" : "desc";
          else { sort = c.sort; direction = "desc"; }
          page = 1; buildHead(); loadTable();
        });
      }
      tr.appendChild(th);
    }
    mount(thead, tr);
  }

  const STATIC_KEYS = new Set(["star", "token", "cta"]);

  // numeric cell with green/red flash when the value moves
  function flashNum(td, text, value, cls) {
    const prev = td._v;
    td.className = "num " + (cls || "");
    td.textContent = text;
    if (prev != null && isFinite(prev) && isFinite(value) && value !== prev) {
      td.classList.remove("cell-up", "cell-down");
      void td.offsetWidth; // restart the animation
      td.classList.add(value > prev ? "cell-up" : "cell-down");
    }
    td._v = value;
  }

  function fillCell(td, key, row, idx) {
    switch (key) {
      case "star": {
        const btn = h("button", { class: "star-btn", title: "Watch", onClick: (e) => {
          e.stopPropagation(); toggleStar(row.symbol); btn.replaceChildren(starIcon(isStarred(row.symbol)));
        } }, starIcon(isStarred(row.symbol)));
        mount(td, btn); td.className = "l w-star"; break;
      }
      case "idx": td.textContent = idx; td.className = "l idx w-idx"; break;
      case "token":
        mount(td, h("div", { class: "tok" }, tokenIcon(row.symbol, 32),
          h("div", { class: "tok-meta" },
            h("span", { class: "tok-name" }, baseOf(row.symbol)),
            h("span", { class: "tok-sub num" }, row.symbol))));
        td.className = "l"; break;
      case "chart": {
        td.className = "l col-hide-xs";
        const pts = sparks[row.symbol];
        const sig = pts && pts.length ? pts.length + ":" + pts[pts.length - 1][1] : "";
        if (td._k !== sig) {
          td._k = sig;
          const vals = (pts || []).map((p) => p[1]);
          td.innerHTML = `<span class="sparkbox">${sparkline(vals, 96, 32, brandColor(row.symbol))}</span>`;
        }
        break;
      }
      case "spot": flashNum(td, fmtPrice(row.spot_mid), Number(row.spot_mid), "val-strong"); break;
      case "perp": flashNum(td, fmtPrice(row.futures_mid), Number(row.futures_mid), "val-strong"); break;
      case "spot_bid": flashNum(td, fmtPrice(row.spot_bid), Number(row.spot_bid)); break;
      case "spot_ask": flashNum(td, fmtPrice(row.spot_ask), Number(row.spot_ask)); break;
      case "fut_bid": flashNum(td, fmtPrice(row.fut_bid), Number(row.fut_bid)); break;
      case "fut_ask": flashNum(td, fmtPrice(row.fut_ask), Number(row.fut_ask)); break;
      case "basis": {
        const b = Number(row.mid_spread_bps || 0);
        flashNum(td, (b >= 0 ? "↗ " : "↘ ") + fmtBasisVal(b, true), b, "cell-strong " + signClass(b));
        break;
      }
      case "funding": flashNum(td, fmtFunding(row.funding_rate), Number(row.funding_rate), signClass(row.funding_rate)); break;
      case "spread": {
        const sp = Number(row.spot_spread_bps || 0) + Number(row.futures_spread_bps || 0);
        td.className = "num col-hide-sm muted"; td.textContent = fmtBps(sp); break;
      }
      case "age": td.className = "num col-hide-sm muted"; td.textContent = fmtAge(row.age_seconds); break;
      case "score": td.className = "num col-hide-sm muted"; td.textContent = fmtScore(row.opportunity_score); break;
      case "status": {
        const cls = row.status === "LIVE" ? "dot-live" : row.status === "STALE" ? "dot-stale" : "dot-off";
        const label = row.status === "LIVE" ? "Live" : row.status === "STALE" ? "Stale" : row.status;
        mount(td, h("span", { class: "status-mini" }, h("span", { class: "dot " + cls }), label));
        td.className = "col-hide-xs"; break;
      }
      case "cta":
        mount(td, h("button", { class: "cta-pill", onClick: (e) => { e.stopPropagation(); navigate("/symbol/" + row.symbol + "?tab=basis"); } }, "View"));
        break;
    }
  }

  function buildRow(row, idx) {
    const tr = h("tr", { onClick: (e) => { if (!e.target.closest("button")) navigate("/symbol/" + row.symbol + "?tab=basis"); } });
    tr._cells = {};
    for (const c of columns()) {
      const td = h("td", { class: c.cls || "" });
      tr._cells[c.key] = td;
      fillCell(td, c.key, row, idx);
      tr.appendChild(td);
    }
    tr._symbol = row.symbol;
    return tr;
  }
  function updateRow(tr, row, idx) {
    for (const c of columns()) {
      const td = tr._cells[c.key];
      if (td && !STATIC_KEYS.has(c.key)) fillCell(td, c.key, row, idx);
    }
  }

  function syncRows(rows) {
    if (!rows.length && !rowMap.size) {
      mount(tbody, h("tr", {}, h("td", { colspan: columns().length, class: "l empty-state" }, "No symbols match this filter.")));
      return;
    }
    const seen = new Set();
    rows.forEach((row, i) => {
      const idx = (page - 1) * PAGE_SIZE + i + 1;
      let tr = rowMap.get(row.symbol);
      if (!tr) { tr = buildRow(row, idx); rowMap.set(row.symbol, tr); }
      else updateRow(tr, row, idx);
      tbody.appendChild(tr);
      seen.add(row.symbol);
    });
    for (const [sym, tr] of rowMap) if (!seen.has(sym)) { tr.remove(); rowMap.delete(sym); }
  }
  cleanups.push(onIconsReady(() => {
    for (const [, tr] of rowMap) {
      const td = tr._cells.token;
      const sym = tr._symbol;
      if (td && sym) fillCell(td, "token", { symbol: sym }, 0);
    }
  }));
  cleanups.push(onWatch(() => {
    for (const [sym, tr] of rowMap) {
      const cell = tr._cells.star;
      if (cell) { const btn = cell.querySelector(".star-btn"); if (btn) btn.replaceChildren(starIcon(isStarred(sym))); }
    }
  }));

  // ---- chips / foot / columns popover ----
  function buildChips() {
    mount(chips, FILTERS.map((f) =>
      h("button", { class: "chip" + (f.id === filter ? " active" : ""), onClick: () => {
        filter = f.id; page = 1; buildChips();
        rowMap.forEach((tr) => tr.remove()); rowMap.clear();
        loadTable();
      } }, f.label)));
  }

  function paintFoot() {
    const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(total, page * PAGE_SIZE);
    const pager = h("div", { class: "pager" });
    const mk = (label, p, opts = {}) => h("button", {
      class: opts.current ? "current" : "", disabled: opts.disabled,
      onClick: () => { if (!opts.disabled && !opts.current) { page = p; loadTable(); } },
    }, label);
    pager.appendChild(mk("‹", page - 1, { disabled: page <= 1 }));
    pageNumbers(page, pages).forEach((n) =>
      pager.appendChild(n === "…" ? h("span", { class: "muted", style: { padding: "0 5px" } }, "…") : mk(String(n), n, { current: n === page })));
    pager.appendChild(mk("›", page + 1, { disabled: page >= pages }));
    mount(foot, h("span", {}, `${start}–${end} of ${total}`), pager);
  }

  function openColsPopover() {
    const existing = document.querySelector(".cols-pop");
    if (existing) { existing.remove(); return; }
    const r = colsBtn.getBoundingClientRect();
    const pop = h("div", { class: "cols-pop", style: {
      position: "fixed", top: (r.bottom + 8) + "px", left: Math.max(12, r.right - 224) + "px", width: "216px",
      background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "14px",
      boxShadow: "var(--shadow-pop)", zIndex: "80", padding: "6px",
    } });
    pop.appendChild(h("div", { class: "cmd-group" }, "Advanced columns"));
    ADVANCED.forEach((a) => {
      const on = advanced.has(a.key);
      const sw = h("div", { class: "switch" + (on ? " on" : "") });
      pop.appendChild(h("div", { class: "toggle-row", style: { padding: "9px 11px" }, onClick: () => {
        if (advanced.has(a.key)) advanced.delete(a.key); else advanced.add(a.key);
        saveAdvanced(advanced); sw.classList.toggle("on");
        rowMap.forEach((tr) => tr.remove()); rowMap.clear();
        buildHead(); loadTable();
      } }, h("span", { class: "k", style: { fontSize: "13px" } }, a.label), sw));
    });
    const closer = (e) => { if (!pop.contains(e.target) && e.target !== colsBtn) { pop.remove(); document.removeEventListener("mousedown", closer); } };
    setTimeout(() => document.addEventListener("mousedown", closer), 0);
    document.body.appendChild(pop);
  }

  // ---- data loaders ----
  async function loadTable() {
    try {
      const res = await api.pages({ page, page_size: PAGE_SIZE, sort, direction, filter });
      page = res.page; pages = res.pages; total = res.total;
      syncRows(res.rows || []);
      paintFoot();
    } catch (e) { /* keep last good */ }
  }
  async function loadSignals() {
    try {
      const [res, mv] = await Promise.all([api.radar("all", 600), api.movers(15)]);
      moverRows = mv && mv.ok !== false ? mv : moverRows;
      const rows = res.rows || [];
      paintSignals(rows); paintRegime(rows); paintSub(rows); paintDistribution(rows);
    } catch (e) {}
  }
  async function loadSparks() {
    try {
      const res = await api.sparks();
      if (res && res.sparks) {
        sparks = res.sparks;
        for (const [, tr] of rowMap) {
          const td = tr._cells.chart;
          const sym = tr._symbol;
          if (td && sym) fillCell(td, "chart", { symbol: sym }, 0);
        }
      }
    } catch (e) {}
  }

  // ---- assemble ----
  const page_ = h("div", { class: "page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Radar"), subLine),
        regimePill),
      statsWrap,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Basis signals")),
      signalsWrap,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Basis distribution"),
        h("span", { class: "sec-note" }, "signed basis across the universe · clamped at p95")),
      distWrap,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Market"),
        h("span", { class: "sec-note" }, "spot vs USD-M perp · basis in " + basisUnit())),
      h("div", { class: "table-tools" }, chips, h("div", { class: "spacer" }), colsBtn),
      h("div", { class: "table-scroll" }, table),
      foot));

  mount(root, tape.el, page_);
  buildChips();
  buildHead();
  paintStats(store.lite);
  cleanups.push(onLive((lite) => { paintStats(lite); }));

  loadTable(); loadSignals(); loadSparks();
  const t1 = setInterval(loadTable, 4000);
  const t2 = setInterval(loadSignals, 8000);
  const t3 = setInterval(loadSparks, 12000);
  cleanups.push(() => { clearInterval(t1); clearInterval(t2); clearInterval(t3); });

  return () => cleanups.forEach((c) => c());
}

function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const lo = Math.max(2, page - 1), hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push("…");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 1) out.push("…");
  out.push(pages);
  return out;
}
