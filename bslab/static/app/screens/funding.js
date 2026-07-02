// Funding — visual page: distribution chart, positive/negative leaderboards
// with proportional bars, and 15m funding change movers.

import { h, mount } from "../lib/dom.js";
import { tokenIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate } from "../lib/store.js";
import { baseOf, fmtFunding, fmtBps, signClass, fmtTimeShort, fmtDateTime } from "../lib/format.js";
import { renderChart } from "../lib/chart.js";

export function renderFunding(root) {
  const cleanups = [];
  let histSymbol = "BTCUSDT";
  const distWrap = h("div", { class: "dist-chart" });
  const scatterWrap = h("div", { class: "scatter-wrap" });
  const posWrap = h("div", { class: "lb" });
  const negWrap = h("div", { class: "lb" });
  const chgWrap = h("div", { class: "lb" });
  const histChips = h("div", { class: "chips" });
  const histChart = h("div", { class: "chart-body" });
  const subLine = h("div", { class: "page-sub" }, "loading…");

  const page_ = h("div", { class: "page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Funding"), subLine), h("span")),
      h("div", { class: "fund-top" },
        h("section", {},
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Distribution"),
            h("span", { class: "sec-note" }, "per-8h funding across the universe")),
          distWrap),
        h("section", {},
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Funding vs basis"),
            h("span", { class: "sec-note" }, "each dot is a symbol — click to open")),
          scatterWrap)),
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Funding history"),
        h("span", { class: "sec-note" }, "24h · Binance USD-M mark stream")),
      h("div", { class: "table-tools" }, histChips),
      histChart,
      h("div", { class: "fund-grid" },
        h("section", {}, h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Shorts paying longs")), posWrap),
        h("section", {}, h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Longs paying shorts")), negWrap),
        h("section", {}, h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Biggest changes · 15m")), chgWrap))));

  mount(root, page_);

  // ---- funding history for a selected symbol ----
  let histChoices = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  function buildHistChips() {
    mount(histChips, histChoices.map((s) =>
      h("button", { class: "chip" + (s === histSymbol ? " active" : ""), onClick: () => {
        histSymbol = s; buildHistChips(); loadHistChart(true);
      } }, baseOf(s))));
  }
  async function loadHistChart(animate = false) {
    try {
      const res = await api.history(histSymbol, "24h");
      const pts = (res.rows || [])
        .map((r) => ({ t: r.ts_ms, v: (r.funding_rate || 0) * 100 }))
        .filter((p) => isFinite(p.v) && p.t);
      const slim = pts.length > 240 ? pts.filter((_, i) => i % Math.ceil(pts.length / 240) === 0) : pts;
      renderChart(histChart, slim, {
        color: (slim.at(-1)?.v ?? 0) >= 0 ? "var(--up)" : "var(--down)",
        valueFmt: (v) => v.toFixed(4) + "%", axisFmt: (v) => v.toFixed(3) + "%",
        zeroLine: true, dotted: true, animate, height: 240,
        timeFmt: fmtTimeShort, tipTimeFmt: fmtDateTime,
      });
    } catch (e) {}
  }

  // ---- scatter: x = signed basis bps, y = funding % ----
  function paintScatter(rows) {
    const pts = rows.filter((r) => isFinite(r.mid_spread_bps) && isFinite(r.funding_rate));
    if (pts.length < 3) { mount(scatterWrap, h("div", { class: "empty-state" }, "Not enough data yet.")); return; }
    const W = 560, H = 240, pad = 34;
    const xs = pts.map((r) => r.mid_spread_bps), ys = pts.map((r) => r.funding_rate * 100);
    const clamp = (arr) => { const s = arr.map(Math.abs).sort((a, b) => a - b); return Math.max(s[Math.floor(s.length * 0.95)] || 1, 1e-6); };
    const xm = clamp(xs), ym = clamp(ys);
    const X = (v) => pad + ((Math.max(-xm, Math.min(xm, v)) + xm) / (2 * xm)) * (W - pad * 2);
    const Y = (v) => (H - pad) - ((Math.max(-ym, Math.min(ym, v)) + ym) / (2 * ym)) * (H - pad * 2);
    let dots = "";
    for (const r of pts) {
      const x = X(r.mid_spread_bps), y = Y(r.funding_rate * 100);
      const col = r.funding_rate >= 0 ? "var(--up)" : "var(--down)";
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${col}" fill-opacity=".55" stroke="var(--bg)" stroke-width="1" data-sym="${r.symbol}"><title>${r.symbol} · ${fmtBps(r.mid_spread_bps, true)} bps · ${fmtFunding(r.funding_rate)}</title></circle>`;
    }
    const svg = h("div", {
      html: `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
        <line x1="${pad}" x2="${W - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line-strong)" stroke-width="1"/>
        <line x1="${X(0)}" x2="${X(0)}" y1="${pad - 12}" y2="${H - pad}" stroke="var(--line-strong)" stroke-width="1"/>
        <text x="${W - pad}" y="${Y(0) - 7}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="var(--font)">basis → rich (+${fmtBps(xm)} bps)</text>
        <text x="${X(0) + 7}" y="${pad - 2}" font-size="10.5" fill="var(--muted)" font-family="var(--font)">funding +${ym.toFixed(3)}%</text>
        ${dots}</svg>`,
    });
    svg.addEventListener("click", (e) => {
      const sym = e.target && e.target.dataset && e.target.dataset.sym;
      if (sym) navigate("/symbol/" + sym + "?tab=funding");
    });
    mount(scatterWrap, svg);
  }
  async function loadScatter() {
    try { const res = await api.radar("all", 300); paintScatter(res.rows || []); } catch (e) {}
  }

  function paintDistribution(bins) {
    if (!bins || !bins.length) { mount(distWrap, h("div", { class: "empty-state" }, "No data yet.")); return; }
    const maxC = Math.max(...bins.map((b) => b.count), 1);
    mount(distWrap, h("div", { class: "dist-bars" },
      bins.map((b) => {
        const mid = (b.from + b.to) / 2;
        const hpct = Math.max(3, (b.count / maxC) * 100);
        return h("div", { class: "dist-col", title: `${b.from.toFixed(3)}% … ${b.to.toFixed(3)}% — ${b.count} symbols` },
          h("div", { class: "dist-bar " + (mid >= 0 ? "pos" : "neg"), style: { height: hpct + "%" } }),
          h("div", { class: "dist-x num" }, (mid >= 0 ? "+" : "") + mid.toFixed(2)));
      })));
  }

  function lbRow(r, valText, cls, barPct, barCls) {
    return h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + r.symbol + "?tab=funding") },
      h("span", { class: "lb-bar " + barCls, style: { width: barPct + "%" } }),
      tokenIcon(r.symbol, 24),
      h("span", { class: "lb-name" }, baseOf(r.symbol)),
      h("span", { class: "lb-sub num" }, fmtBps(r.mid_spread_bps ?? r.last_abs_basis_bps ?? 0, true) + " bps"),
      h("span", { class: "lb-val num " + cls }, valText));
  }

  function paintBoards(payload) {
    const pos = (payload.positive || []).filter((r) => r.funding_rate > 0).slice(0, 10);
    const neg = (payload.negative || []).filter((r) => r.funding_rate < 0).slice(0, 10);
    const maxP = Math.max(...pos.map((r) => Math.abs(r.funding_rate)), 1e-9);
    const maxN = Math.max(...neg.map((r) => Math.abs(r.funding_rate)), 1e-9);
    mount(posWrap, pos.length ? pos.map((r) =>
      lbRow(r, fmtFunding(r.funding_rate), "up", (Math.abs(r.funding_rate) / maxP) * 70 + 6, "bid")) :
      h("div", { class: "empty-state" }, "No positive funding right now."));
    mount(negWrap, neg.length ? neg.map((r) =>
      lbRow(r, fmtFunding(r.funding_rate), "down", (Math.abs(r.funding_rate) / maxN) * 70 + 6, "ask")) :
      h("div", { class: "empty-state" }, "No negative funding right now."));
    const changes = (payload.changes || []).slice(0, 10);
    const maxC = Math.max(...changes.map((r) => Math.abs(r.funding_change || 0)), 1e-9);
    mount(chgWrap, changes.length ? changes.map((r) => {
      const d = (r.funding_change || 0) * 100;
      return h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + r.symbol + "?tab=funding") },
        h("span", { class: "lb-bar " + (d >= 0 ? "bid" : "ask"), style: { width: (Math.abs(r.funding_change || 0) / maxC) * 70 + 6 + "%" } }),
        tokenIcon(r.symbol, 24),
        h("span", { class: "lb-name" }, baseOf(r.symbol)),
        h("span", { class: "lb-val num " + (d >= 0 ? "up" : "down") }, (d >= 0 ? "↗ +" : "↘ ") + d.toFixed(4) + "%"));
    }) : h("div", { class: "empty-state" }, "No funding changes measured yet."));
  }

  async function load() {
    try {
      const payload = await api.funding();
      if (!payload || payload.ok === false) return;
      paintDistribution(payload.distribution);
      paintBoards(payload);
      const pos = (payload.positive || []).filter((r) => r.funding_rate > 0);
      const neg = (payload.negative || []).filter((r) => r.funding_rate < 0);
      // history selector: majors + current extremes
      const tops = [...pos.slice(0, 2), ...neg.slice(0, 2)].map((r) => r.symbol);
      const merged = [...new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", ...tops])].slice(0, 7);
      if (merged.join() !== histChoices.join()) { histChoices = merged; buildHistChips(); }
      mount(subLine, `${pos.length} symbols positive · ${neg.length} negative · Binance USD-M mark stream`);
    } catch (e) {}
  }

  load();
  loadScatter();
  buildHistChips();
  loadHistChart(true);
  const t = setInterval(load, 6000);
  const t2 = setInterval(loadScatter, 10000);
  const t3 = setInterval(() => loadHistChart(false), 30000);
  cleanups.push(() => clearInterval(t3));
  cleanups.push(() => { clearInterval(t); clearInterval(t2); });
  return () => cleanups.forEach((c) => c());
}
