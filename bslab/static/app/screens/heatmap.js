// Heatmap — three visual modes (Tiles / Bubbles / Strips) over five metrics
// (Basis / Funding / Score / Freshness / Spread). Color stays disciplined:
// green/red for signed metrics, single-hue intensity for one-sided ones.

import { h, mount } from "../lib/dom.js";
import { tokenIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate } from "../lib/store.js";
import { baseOf, fmtPrice, fmtMoney, fmtPct, fmtBps, fmtFunding, fmtScore, fmtAge } from "../lib/format.js";

const METRICS = {
  mcap:    { label: "Market cap", signed: false, external: true,
             val: (r) => r._mcap || 0,
             fmt: (v) => fmtMoney(v), legend: ["Losing 24h", "Gaining 24h"] },
  basis:   { label: "Basis",     signed: true,  val: (r) => r.mid_spread_bps || 0, fmt: (v) => fmtBps(v, true), legend: ["Deep", "Rich"] },
  funding: { label: "Funding",   signed: true,  val: (r) => (r.funding_rate || 0) * 100, fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(4) + "%", legend: ["Longs paid", "Shorts paid"] },
  score:   { label: "Score",     signed: false, val: (r) => r.opportunity_score || 0, fmt: (v) => fmtScore(v), hue: [16, 164, 106], legend: ["Quiet", "Hot"] },
  age:     { label: "Freshness", signed: false, val: (r) => r.age_seconds || 0, fmt: (v) => fmtAge(v), hue: [229, 72, 77], legend: ["Fresh", "Stale"] },
  spread:  { label: "Spread",    signed: false, val: (r) => (r.spot_spread_bps || 0) + (r.futures_spread_bps || 0), fmt: (v) => fmtBps(v), hue: [229, 72, 77], legend: ["Tight", "Wide"] },
};
const MODES = ["Treemap", "Tiles", "Mosaic", "Bubbles", "Strips"];

// Squarified treemap layout: weights (desc) -> rects in a W×H box.
function treemapLayout(weights, W, H) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const scaled = weights.map((v) => (v / total) * W * H);
  const rects = [];
  let x = 0, y = 0, w = W, h = H, row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b, 0);
    let m = 0;
    for (const v of r) m = Math.max(m, Math.max((side * side * v) / (s * s), (s * s) / (side * side * v)));
    return m;
  };
  const layoutRow = (r) => {
    const s = r.reduce((a, b) => a + b, 0);
    if (w >= h) { // vertical strip on the left
      const rw = s / h;
      let ry = y;
      for (const v of r) { const rh = v / rw; rects.push({ x, y: ry, w: rw, h: rh }); ry += rh; }
      x += rw; w -= rw;
    } else {      // horizontal strip on top
      const rh = s / w;
      let rx = x;
      for (const v of r) { const rw = v / rh; rects.push({ x: rx, y, w: rw, h: rh }); rx += rw; }
      y += rh; h -= rh;
    }
  };
  for (const v of scaled) {
    const side = Math.min(w, h) || 1;
    if (row.length && worst(row.concat(v), side) > worst(row, side)) { layoutRow(row); row = [v]; }
    else row.push(v);
  }
  if (row.length) layoutRow(row);
  return rects;
}

export function renderHeatmap(root) {
  // deep-linkable: /heatmap?metric=funding&mode=bubbles
  const params = new URLSearchParams(location.search);
  let metric = METRICS[params.get("metric")] ? params.get("metric") : "basis";
  const pm = (params.get("mode") || "").toLowerCase();
  let mode = MODES.find((m) => m.toLowerCase() === pm) || "Tiles";
  let rows = [];
  const cleanups = [];

  const metricSeg = h("div", { class: "seg" });
  const modeSeg = h("div", { class: "seg" });
  const legend = h("div", { class: "heat-legend" });
  const surface = h("div", { class: "heat-surface" });
  const sub = h("div", { class: "page-sub" }, "loading…");

  const page_ = h("div", { class: "page" },
    h("div", { class: "container page-wide" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Heatmap"), sub), modeSeg),
      h("div", { class: "heat-tools" }, metricSeg, h("div", { style: { flex: "1" } }), legend),
      surface));

  mount(root, page_);
  buildSegs();

  function buildSegs() {
    mount(metricSeg, Object.entries(METRICS).map(([id, m]) =>
      h("button", { class: id === metric ? "on" : "", onClick: () => { metric = id; buildSegs(); paint(); } }, m.label)));
    mount(modeSeg, MODES.map((m) =>
      h("button", { class: m === mode ? "on" : "", onClick: () => { mode = m; buildSegs(); paint(); } }, m)));
    const M = METRICS[metric];
    const grad = M.signed
      ? "linear-gradient(90deg, rgb(229,72,77), #f2f3f5, rgb(16,164,106))"
      : `linear-gradient(90deg, #f2f3f5, rgb(${(M.hue || [16, 164, 106]).join(",")}))`;
    mount(legend, h("span", {}, M.legend[0]), h("span", { class: "heat-bar", style: { background: grad } }), h("span", {}, M.legend[1]));
  }

  function colorForRow(r, scale) {
    const M = METRICS[metric];
    if (M.external) {
      const chg = r._chg24h;
      if (chg == null) return "rgb(232,234,238)";
      const t = Math.min(1, Math.abs(chg) / 6);
      const hue = chg >= 0 ? [16, 164, 106] : [229, 72, 77];
      const mix = (c) => Math.round(246 + (c - 246) * (0.12 + t * 0.82));
      return `rgb(${mix(hue[0])},${mix(hue[1])},${mix(hue[2])})`;
    }
    return colorFor(M.val(r), scale);
  }
  function colorFor(v, scale) {
    const M = METRICS[metric];
    const t = Math.min(1, Math.abs(v) / scale);
    const hue = M.signed ? (v >= 0 ? [16, 164, 106] : [229, 72, 77]) : (M.hue || [16, 164, 106]);
    const mix = (c) => Math.round(246 + (c - 246) * (0.10 + t * 0.84));
    return `rgb(${mix(hue[0])},${mix(hue[1])},${mix(hue[2])})`;
  }

  function scaleOf(vals) {
    const abs = vals.map(Math.abs).sort((a, b) => a - b);
    return Math.max(abs[Math.floor(abs.length * 0.85)] || 1, 1e-9);
  }

  function paint() {
    const M = METRICS[metric];
    let pool = rows;
    if (M.external) {
      pool = rows.filter((r) => r._mcap > 0);
      if (!pool.length) {
        mount(sub, "market-cap metric needs the external source — unavailable right now");
        mount(surface, h("div", { class: "empty-state" }, "CoinGecko market caps unavailable."));
        return;
      }
    }
    const sorted = [...pool].sort((a, b) => Math.abs(M.val(b)) - Math.abs(M.val(a)));
    const vals = sorted.map(M.val);
    const scale = scaleOf(vals);
    mount(sub, `${sorted.length} symbols · ${M.label.toLowerCase()} · ${mode.toLowerCase()}`);

    if (mode === "Treemap") {
      const top = sorted.slice(0, 60).filter((r) => Math.abs(M.val(r)) > 0);
      const weights = top.map((r) => Math.abs(M.val(r)));
      const rects = treemapLayout(weights, 100, 62);
      mount(surface, h("div", { class: "treemap-wrap" }, top.map((r, i) => {
        const v = M.val(r);
        const rc = rects[i];
        const big = rc.w * rc.h > 40;      // enough area for value label
        const mid = rc.w * rc.h > 12;
        return h("div", {
          class: "tm-cell", title: `${r.symbol} · ${M.fmt(v)}`,
          style: {
            left: rc.x + "%", top: (rc.y / 62 * 100) + "%",
            width: rc.w + "%", height: (rc.h / 62 * 100) + "%",
            background: colorForRow(r, scale),
          },
          onClick: () => navigate("/symbol/" + r.symbol),
        },
          mid ? h("span", { class: "tm-sym" }, baseOf(r.symbol)) : null,
          big ? h("span", { class: "tm-val num" }, M.fmt(v)) : null);
      })));
    } else if (mode === "Mosaic") {
      const top = sorted.slice(0, 96);
      mount(surface, h("div", { class: "mosaic-grid" }, top.map((r, i) => {
        const v = M.val(r);
        const t = Math.min(1, Math.abs(v) / scale);
        const size = i < 6 ? "xl" : i < 18 ? "lg" : t > 0.35 ? "md" : "sm";
        return h("div", { class: "tile mosaic-" + size, style: { background: colorForRow(r, scale) },
          onClick: () => navigate("/symbol/" + r.symbol) },
          h("div", {},
            h("div", { class: "t-sym" }, baseOf(r.symbol)),
            size !== "sm" ? h("div", { class: "t-base num" }, fmtPrice(r.spot_mid)) : null),
          h("div", {},
            h("div", { class: "t-val" }, M.fmt(v)),
            size === "xl" || size === "lg" ? h("div", { class: "t-fund" }, M.external && r._chg24h != null ? fmtPct(r._chg24h) + " 24h" : fmtFunding(r.funding_rate) + " fund") : null));
      })));
    } else if (mode === "Bubbles") {
      mount(surface, h("div", { class: "bubble-wrap" }, sorted.slice(0, 90).map((r) => {
        const v = M.val(r);
        const t = Math.min(1, Math.abs(v) / scale);
        const d = Math.round(46 + t * 84);
        return h("div", {
          class: "bubble", title: `${r.symbol} · ${M.fmt(v)}`,
          style: { width: d + "px", height: d + "px", background: colorForRow(r, scale) },
          onClick: () => navigate("/symbol/" + r.symbol),
        },
          h("span", { class: "b-sym" }, baseOf(r.symbol)),
          d >= 74 ? h("span", { class: "b-val num" }, M.fmt(v)) : null);
      })));
    } else if (mode === "Strips") {
      const top = sorted.slice(0, 40);
      const maxV = Math.max(...top.map((r) => Math.abs(M.val(r))), 1e-9);
      mount(surface, h("div", { class: "strips" }, top.map((r, i) => {
        const v = M.val(r);
        return h("div", { class: "strip-row", onClick: () => navigate("/symbol/" + r.symbol) },
          h("span", { class: "idx num" }, i + 1),
          tokenIcon(r.symbol, 24),
          h("span", { class: "lb-name" }, baseOf(r.symbol)),
          h("div", { class: "strip-track" },
            h("div", { class: "strip-bar", style: { width: (Math.abs(v) / maxV) * 100 + "%", background: colorForRow(r, scale) } })),
          h("span", { class: "lb-val num strong" }, M.fmt(v)));
      })));
    } else {
      mount(surface, h("div", { class: "heat-grid" }, sorted.slice(0, 150).map((r) => {
        const v = M.val(r);
        return h("div", { class: "tile", style: { background: colorForRow(r, scale) }, onClick: () => navigate("/symbol/" + r.symbol) },
          h("div", {},
            h("div", { class: "t-sym" }, baseOf(r.symbol)),
            h("div", { class: "t-base num" }, fmtPrice(r.spot_mid))),
          h("div", {},
            h("div", { class: "t-val" }, M.fmt(v)),
            h("div", { class: "t-fund" }, metric === "funding" ? fmtBps(r.mid_spread_bps, true) + " bps basis" : fmtFunding(r.funding_rate) + " fund")));
      })));
    }
  }

  let mcapByBase = {};
  async function loadExternal() {
    try {
      const ov = await api.marketOverview();
      mcapByBase = {};
      for (const c of (ov && ov.top_coins && ov.top_coins.coins) || []) {
        mcapByBase[c.base] = { mcap: c.mcap, chg24h: c.chg24h };
      }
    } catch (e) {}
  }
  async function load() {
    try {
      const res = await api.radar("all", 300);
      rows = (res.rows || []).map((r) => {
        const b = baseOf(r.symbol);
        const x = mcapByBase[b];
        return { ...r, _mcap: x ? x.mcap : 0, _chg24h: x ? x.chg24h : null };
      });
      paint();
    } catch (e) {}
  }

  loadExternal().then(load);
  const t = setInterval(load, 6000);
  const tx = setInterval(loadExternal, 60000);
  cleanups.push(() => clearInterval(tx));
  cleanups.push(() => clearInterval(t));
  return () => cleanups.forEach((c) => c());
}
