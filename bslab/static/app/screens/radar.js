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
  { id: "fresh", label: "Fresh rows" },
  { id: "major", label: "Majors" },
  { id: "alts", label: "Alts" },
  { id: "fundpos", label: "Funding +" },
  { id: "fundneg", label: "Funding −" },
  { id: "25", label: "Basis > 25" },
  { id: "stale", label: "Stale cache" },
];

const SORTS = [
  { id: "basis", label: "Basis", sub: "largest gap", sort: "abs_basis", direction: "desc" },
  { id: "fundingHi", label: "Funding +", sub: "shorts paid", sort: "funding", direction: "desc" },
  { id: "fundingLo", label: "Funding -", sub: "longs paid", sort: "funding", direction: "asc" },
  { id: "spread", label: "Friction", sub: "widest books", sort: "spot_spread", direction: "desc" },
  { id: "score", label: "Score", sub: "signal rank", sort: "score", direction: "desc" },
  { id: "spot", label: "Price", sub: "highest spot", sort: "spot_mid", direction: "desc" },
];

const SORT_ALIASES = {
  abs_basis: "abs_basis_bps",
  funding: "funding_rate",
  spot_spread: "spot_spread_bps",
  score: "opportunity_score",
};

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
const num = (v, fallback = 0) => {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};
const countText = (n, noun) => `${Number(n || 0).toLocaleString()} ${noun}${Number(n || 0) === 1 ? "" : "s"}`;
const compactAge = (seconds) => seconds != null && isFinite(Number(seconds)) ? ago(seconds) : "warming";
const compactEmpty = (text) => h("div", { class: "radar-compact-empty" }, text);
const chipTone = (status) => status === "LIVE" || status === "OK" || status === "live"
  ? "live"
  : status === "STALE" || status === "stale"
    ? "stale"
    : "off";

export function renderRadar(root) {
  let filter = "all", sort = "abs_basis", direction = "desc";
  let page = 1, pages = 1, total = 0;
  let advanced = loadAdvanced();
  let coverage = null;
  let sparks = {};
  let tableSeq = 0;
  let tableRenderKey = "";
  let latestRows = [];
  let latestHealth = null;
  const rowMap = new Map();
  const cleanups = [];

  // ---- live tape (shared marquee component) ----
  const tape = buildTape();
  cleanups.push(tape.destroy);

  // ---- stat tiles (Coinbase/TradingView style market stats, but scoped to the radar universe) ----
  const tiles = {};
  function tile(key, label, ico, note) {
    const v = h("div", { class: "stat-v num" }, "—");
    const n = h("div", { class: "stat-note" }, note || "");
    const s = h("div", { class: "stat-spark" });
    tiles[key] = { v, n, s };
    return h("div", { class: "stat-tile radar-stat" },
      h("div", { class: "radar-stat-head" }, icon(ico, "radar-stat-icon"), h("div", { class: "stat-k" }, label)),
      v,
      n,
      s);
  }
  const statsWrap = h("div", { class: "stats radar-stats" },
    tile("live", "Exchange universe", "globe", "cached spot/perp markets"),
    tile("median", "Typical basis", "activity", "median absolute gap"),
    tile("p95", "Stress band", "barChart", "95th percentile gap"),
    tile("fund", "Funding extreme", "zap", "largest current rate"));

  function paintStats(lite) {
    const m = (lite && lite.metrics) || {};
    pushBuf(BUF.live, m.live_symbols);
    pushBuf(BUF.median, m.median_abs_basis_bps);
    pushBuf(BUF.p95, m.p95_abs_basis_bps);
    pushBuf(BUF.fund, (m.highest_funding_rate || 0) * 100);
    const total = m.total_symbols ?? m.latest_symbols_count;
    const live = Number(m.live_symbols || 0);
    const age = m.collector_age_seconds ?? m.freshest_update_age_seconds;
    const sourceNote = live > 0
      ? `${countText(live, "fresh row")} · public spot/perp feed`
      : total != null
        ? `snapshot stale · latest ${compactAge(age)}`
        : "source cache warming";
    setTile("live", total != null ? countText(total, "market") : "warming", BUF.live, sourceNote);
    setTile("median", m.median_abs_basis_bps != null ? fmtBps(m.median_abs_basis_bps) + " bps" : "warming", BUF.median);
    setTile("p95", m.p95_abs_basis_bps != null ? fmtBps(m.p95_abs_basis_bps) + " bps" : "warming", BUF.p95);
    setTile("fund", m.highest_funding_rate != null ? fmtFunding(m.highest_funding_rate) : "warming", BUF.fund);
    paintSourceChips(latestRows);
  }
  function setTile(k, text, buf, note) {
    tiles[k].v.textContent = text;
    if (note) tiles[k].n.textContent = note;
    if (buf.length >= 2) {
      const up = buf[buf.length - 1] >= buf[0];
      tiles[k].s.innerHTML = sparkline(buf, 150, 36, up ? "var(--up)" : "var(--down)");
    }
  }

  // ---- grouped microstructure boards ----
  const signalsWrap = h("div", { class: "signals" });
  const pulseWrap = h("div", { class: "radar-pulse-grid" });
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
    const byFunding = [...rows].sort((a, b) => Math.abs(num(b.funding_rate)) - Math.abs(num(a.funding_rate)));
    const byFriction = [...rows].sort((a, b) =>
      (num(b.spot_spread_bps) + num(b.futures_spread_bps)) - (num(a.spot_spread_bps) + num(a.futures_spread_bps)));
    const widen = (moverRows && moverRows.top_basis_widening) || [];
    const compress = (moverRows && moverRows.top_basis_compression) || [];
    mount(signalsWrap,
      mk("Basis outliers", "Sort table ›", byB, (r) => fmtBps(r.mid_spread_bps, true) + " bps", (r) => signClass(r.mid_spread_bps),
        () => { sort = "abs_basis"; direction = "desc"; page = 1; resetRows(); buildHead(); buildSortStrip(); loadTable(); }),
      mk("Funding skew", "Per 8h ›", byFunding, (r) => fmtFunding(r.funding_rate), (r) => signClass(r.funding_rate),
        () => { sort = "funding"; direction = "desc"; page = 1; resetRows(); buildHead(); buildSortStrip(); loadTable(); }),
      mk("Book friction", "Spot + perp ›", byFriction, (r) => fmtBps(num(r.spot_spread_bps) + num(r.futures_spread_bps)) + " bps", () => "muted",
        () => { sort = "spot_spread"; direction = "desc"; page = 1; resetRows(); buildHead(); buildSortStrip(); loadTable(); }),
      mk("15m basis tape", "Movers ›", [...widen.slice(0, 2), ...compress.slice(0, 2)],
        (r) => fmtBps(r.basis_change_bps, true) + " bps",
        (r) => num(r.basis_change_bps) >= 0 ? "up" : "down",
        () => navigate("/movers")));
  }

  function pulseCard(label, value, note, tone = "") {
    return h("div", { class: "radar-pulse-card " + tone },
      h("span", { class: "radar-pulse-k" }, label),
      h("b", { class: "radar-pulse-v num" }, value),
      h("span", { class: "radar-pulse-note" }, note));
  }

  function paintPulse(rows) {
    if (!rows.length) {
      mount(pulseWrap, compactEmpty("Microstructure cache is warming."));
      return;
    }
    const live = rows.filter((r) => r.status === "LIVE").length;
    const stale = rows.length - live;
    const activeBasis = rows.filter((r) => num(r.abs_basis_bps) >= 25).length;
    const stressBasis = rows.filter((r) => num(r.abs_basis_bps) >= 50).length;
    const posFunding = rows.filter((r) => num(r.funding_rate) > 0).length;
    const negFunding = rows.filter((r) => num(r.funding_rate) < 0).length;
    const wideBooks = rows.filter((r) => num(r.spot_spread_bps) + num(r.futures_spread_bps) >= 10).length;
    const medianAge = [...rows].map((r) => num(r.age_seconds, NaN)).filter(isFinite).sort((a, b) => a - b);
    const age = medianAge.length ? medianAge[Math.floor(medianAge.length / 2)] : null;
    mount(pulseWrap,
      pulseCard("Basis bands", `${activeBasis} active`, stressBasis ? `${stressBasis} above 50 bps` : "none above 50 bps", activeBasis ? "warn" : "ok"),
      pulseCard("Funding split", `${posFunding} positive · ${negFunding} negative`, "directional carry pressure", Math.abs(posFunding - negFunding) > rows.length * 0.3 ? "warn" : "ok"),
      pulseCard("Book friction", countText(wideBooks, "wide book"), "spot + perp spread >= 10 bps", wideBooks ? "warn" : "ok"),
      pulseCard("Freshness", live ? countText(live, "fresh row") : "stale snapshot", stale ? `${countText(stale, "cached row")} · median ${compactAge(age)}` : "all rows fresh", live ? "ok" : "stale"));
  }

  // ---- basis distribution (signed, clamped at p95) ----
  const distWrap = h("div", { class: "dist-chart" });
  function paintDistribution(rows) {
    const vals = rows.map((r) => Number(r.mid_spread_bps)).filter(isFinite);
    if (vals.length < 5) { mount(distWrap, compactEmpty("Basis distribution is warming.")); return; }
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
  const coverageLine = h("div", { class: "radar-scope radar-source-chips" });
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
    const liveState = live ? countText(live, "fresh row") : "stale snapshot";
    mount(subLine, `${countText(rows.length, "spot/perp market")} · ${liveState} · cache checked ${age != null ? ago(age) : "now"}`);
    paintCoverageLine(rows.length);
  }
  function paintCoverageLine(tracked = null) {
    paintSourceChips(tracked != null ? latestRows.slice(0, tracked) : latestRows);
  }
  function sourceChip(label, value, tone = "") {
    return h("span", { class: "radar-source-chip " + tone },
      h("span", { class: "radar-source-label" }, label),
      h("b", {}, value));
  }
  function paintSourceChips(rows = latestRows) {
    const lite = store.lite || {};
    const m = lite.metrics || {};
    const hlt = latestHealth || lite.health || {};
    const total = m.total_symbols ?? hlt.tracked_symbols ?? (rows && rows.length);
    const live = m.live_symbols ?? (rows || []).filter((r) => r.status === "LIVE").length;
    const stale = m.stale_symbols ?? (rows || []).filter((r) => r.status !== "LIVE").length;
    const age = m.collector_age_seconds ?? m.freshest_update_age_seconds ?? hlt.freshness_age_seconds;
    const healthStatus = hlt.status || (live ? "LIVE" : stale ? "STALE" : "warming");
    const coverageText = coverage && coverage.ok && coverage.common_count != null
      ? countText(coverage.common_count, `${coverage.quote || "USDT"} overlap`)
      : coverage && coverage.error
        ? "coverage check unavailable"
        : "coverage check warming";
    mount(coverageLine,
      sourceChip("Universe", total != null ? countText(total, "cached market") : "warming", chipTone(healthStatus)),
      sourceChip("Freshness", live ? countText(live, "fresh row") : `stale · ${compactAge(age)}`, live ? "live" : "stale"),
      sourceChip("Venue coverage", coverageText, coverage && coverage.ok ? "live" : "stale"),
      sourceChip("Integrity", "no synthetic pairs", "live"));
  }

  // ---- table ----
  const thead = h("thead");
  const tbody = h("tbody");
  const table = h("table", { class: "mkt" }, thead, tbody);
  const chips = h("div", { class: "chips" });
  const sortStrip = h("div", { class: "sort-strip radar-sort-strip" });
  const sortState = h("div", { class: "sort-state" }, "Sorted by basis");
  const colsBtn = h("button", { class: "mini-btn", onClick: openColsPopover }, icon("columns"), "Columns");
  const foot = h("div", { class: "table-foot" });

  function columns() {
    const cols = [
      { key: "star", label: "", cls: "l w-star" },
      { key: "idx", label: "#", cls: "l w-idx" },
      { key: "token", label: "Token", cls: "l", sort: "symbol" },
      { key: "venue", label: "Venues", cls: "l col-hide-sm" },
      { key: "chart", label: "Chart", cls: "l col-hide-xs" },
      { key: "spot", label: "Spot mid", sort: "spot_mid" },
    ];
    if (advanced.has("spot_bid")) cols.push({ key: "spot_bid", label: "Spot bid", sort: "spot_bid" });
    if (advanced.has("spot_ask")) cols.push({ key: "spot_ask", label: "Spot ask", sort: "spot_ask" });
    cols.push({ key: "perp", label: "Perp mid", sort: "perp_mid" });
    if (advanced.has("fut_bid")) cols.push({ key: "fut_bid", label: "Perp bid", sort: "perp_bid" });
    if (advanced.has("fut_ask")) cols.push({ key: "fut_ask", label: "Perp ask", sort: "perp_ask" });
    cols.push(
      { key: "basis", label: "Basis (" + basisUnit() + ")", sort: "abs_basis" },
      { key: "funding", label: "Funding", sort: "funding" },
      { key: "spread", label: "Friction", sort: "spot_spread", cls: "col-hide-sm" },
      { key: "age", label: "Age", sort: "age", cls: "col-hide-sm" },
      { key: "score", label: "Score", sort: "score", cls: "col-hide-sm" },
      { key: "status", label: "Status", cls: "col-hide-xs" },
      { key: "cta", label: "" });
    return cols;
  }

  function buildHead() {
    const tr = h("tr");
    for (const c of columns()) {
      const active = c.sort && sameSort(c.sort, sort);
      const th = h("th", { class: (c.cls || "") + (c.sort ? " sortable" : "") + (active ? " sorted" : "") });
      th.append(c.label);
      if (c.sort) {
        th.appendChild(h("span", { class: "sort-caret" }, active ? (direction === "desc" ? "▼" : "▲") : "▾"));
        th.addEventListener("click", () => {
          if (sameSort(sort, c.sort)) direction = direction === "desc" ? "asc" : "desc";
          else { sort = c.sort; direction = "desc"; }
          page = 1; resetRows(); buildHead(); buildSortStrip(); loadTable();
        });
      }
      tr.appendChild(th);
    }
    mount(thead, tr);
  }

  function canonicalSort(name) {
    return SORT_ALIASES[name] || name;
  }
  function sameSort(a, b) {
    return canonicalSort(a) === canonicalSort(b);
  }
  function sortLabel() {
    const s = SORTS.find((x) => sameSort(x.sort, sort) && x.direction === direction)
      || SORTS.find((x) => sameSort(x.sort, sort));
    return s ? `${s.label} ${direction === "asc" ? "low first" : "high first"}` : `${sort} ${direction}`;
  }
  function buildSortStrip() {
    mount(sortStrip, SORTS.map((s) => {
      const active = sameSort(s.sort, sort) && s.direction === direction;
      return h("button", { class: "sort-pill" + (active ? " active" : ""), onClick: () => {
        sort = s.sort;
        direction = s.direction;
        page = 1;
        resetRows();
        buildHead();
        buildSortStrip();
        loadTable();
      } },
        h("span", { class: "sort-pill-main" }, s.label),
        h("span", { class: "sort-pill-sub" }, s.sub));
    }));
    sortState.textContent = "Sorted by " + sortLabel();
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
      case "venue":
        mount(td, h("span", { class: "radar-venue-chip" }, h("b", {}, "1 venue"), h("span", {}, "spot/perp")));
        td.className = "l col-hide-sm"; break;
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

  function resetRows() {
    tbody.replaceChildren();
    rowMap.clear();
    tableRenderKey = "";
  }

  function syncRows(rows) {
    Array.from(tbody.children).forEach((tr) => {
      if (!tr._symbol) tr.remove();
    });
    if (!rows.length && !rowMap.size) {
      const msg = filter === "fresh"
        ? "No fresh rows in the current cache. Source health is summarized above."
        : "No markets match this filter.";
      mount(tbody, h("tr", {}, h("td", { colspan: columns().length, class: "l empty-state" }, msg)));
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
        resetRows();
        loadTable();
      } }, f.label)));
  }

  function paintFoot() {
    if (total === 0) {
      const label = filter === "fresh" ? "No fresh rows in the current cache" : "No rows for this filter";
      mount(foot, h("span", { class: "radar-foot-state" }, label));
      return;
    }
    const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(total, page * PAGE_SIZE);
    const pager = h("div", { class: "pager" });
    const mk = (label, p, opts = {}) => h("button", {
      class: opts.current ? "current" : "", disabled: opts.disabled,
      onClick: () => { if (!opts.disabled && !opts.current) { page = p; resetRows(); loadTable(); } },
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
        resetRows();
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
      const seq = ++tableSeq;
      const requestKey = [page, filter, sort, direction, Array.from(advanced).sort().join(",")].join("|");
      const res = await api.pages({ page, page_size: PAGE_SIZE, sort, direction, filter });
      if (seq !== tableSeq) return;
      page = res.page; pages = res.pages; total = res.total;
      sort = res.sort || sort;
      direction = res.direction || direction;
      latestHealth = res.health || latestHealth;
      paintSourceChips(latestRows);
      const renderKey = [page, filter, sort, direction, Array.from(advanced).sort().join(",")].join("|");
      if (renderKey !== tableRenderKey && renderKey !== requestKey) resetRows();
      tableRenderKey = renderKey;
      syncRows(res.rows || []);
      buildHead();
      buildSortStrip();
      paintFoot();
    } catch (e) { /* keep last good */ }
  }
  async function loadSignals() {
    try {
      const [res, mv] = await Promise.all([api.radar("all", 600), api.movers(15)]);
      moverRows = mv && mv.ok !== false ? mv : moverRows;
      const rows = res.rows || [];
      latestRows = rows;
      latestHealth = res.health || latestHealth;
      paintSignals(rows); paintPulse(rows); paintRegime(rows); paintSub(rows); paintDistribution(rows); paintSourceChips(rows);
    } catch (e) {}
  }
  async function loadCoverage() {
    try {
      coverage = await api.binanceCoverage();
      const tracked = store.lite && store.lite.metrics ? store.lite.metrics.total_symbols : total;
      paintCoverageLine(tracked);
      paintStats(store.lite);
    } catch (e) {
      coverage = { ok: false, error: e && e.message ? e.message : "request failed" };
      paintCoverageLine(total);
    }
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
  const page_ = h("div", { class: "page radar-page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Microstructure Radar"), subLine, coverageLine),
        regimePill),
      statsWrap,
      h("div", { class: "radar-top-grid" },
        h("section", { class: "radar-panel radar-panel-signals" },
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Microstructure leaders"),
            h("span", { class: "sec-note" }, "basis · funding · book friction · 15m movement")),
          signalsWrap),
        h("section", { class: "radar-panel radar-panel-pulse" },
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Market pulse"),
            h("span", { class: "sec-note" }, "compact health bands from the current cache")),
          pulseWrap)),
      h("section", { class: "radar-panel radar-panel-dist" },
        h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Basis distribution"),
          h("span", { class: "sec-note" }, "signed basis across cached markets · extremes trimmed for readability")),
        distWrap),
      h("section", { class: "radar-panel radar-panel-table" },
        h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Market screener"),
          h("span", { class: "sec-note" }, "spot/perp midpoints · funding · friction · freshness · basis in " + basisUnit())),
        h("div", { class: "radar-sort-head" }, sortStrip, sortState),
        h("div", { class: "table-tools" }, chips, h("div", { class: "spacer" }), colsBtn),
        h("div", { class: "table-scroll" }, table),
        foot)));

  mount(root, tape.el, page_);
  buildChips();
  buildHead();
  buildSortStrip();
  paintStats(store.lite);
  paintCoverageLine(store.lite && store.lite.metrics ? store.lite.metrics.total_symbols : null);
  cleanups.push(onLive((lite) => { paintStats(lite); paintCoverageLine(lite && lite.metrics ? lite.metrics.total_symbols : null); }));

  loadTable(); loadSignals(); loadSparks(); loadCoverage();
  const t1 = setInterval(loadTable, 4000);
  const t2 = setInterval(loadSignals, 8000);
  const t3 = setInterval(loadSparks, 12000);
  const t4 = setInterval(loadCoverage, 600000);
  cleanups.push(() => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); });

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
