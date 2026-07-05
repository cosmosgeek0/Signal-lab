// Funding — visual page: distribution chart, positive/negative leaderboards
// with proportional bars, and 15m funding change movers.

import { h, mount } from "../lib/dom.js";
import { tokenIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate, store } from "../lib/store.js";
import { baseOf, fmtFunding, fmtBps, fmtScore, fmtAge, signClass, fmtTimeShort, fmtDateTime } from "../lib/format.js";
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
  const histContext = h("div", { class: "fund-history-context" });
  const histChart = h("div", { class: "chart-body" });
  const histNote = h("span", { class: "sec-note" }, "24h · Binance USD-M mark stream");
  const subLine = h("div", { class: "page-sub" }, "loading…");
  const metaLine = h("div", { class: "fund-hero-meta" });
  const contextWrap = h("section", { class: "fund-context", "aria-label": "Funding market context" });
  const latestFundingBySymbol = new Map();
  const tickState = new Map();

  const page_ = h("div", { class: "page funding-page" },
    h("div", { class: "container fund-container" },
      h("div", { class: "page-head funding-hero" },
        h("div", { class: "fund-title-block" },
          h("div", { class: "fund-kicker" }, "Derivatives desk"),
          h("h1", { class: "page-title" }, "Funding"),
          subLine),
        metaLine),
      contextWrap,
      h("div", { class: "fund-section-head" },
        h("div", {}, h("span", {}, "Context"), h("b", {}, "Distribution and basis")),
        h("p", {}, "Rates, signed basis and opportunity pressure from public mark-stream rows.")),
      h("div", { class: "fund-top" },
        h("section", { class: "fund-panel" },
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Distribution"),
            h("span", { class: "sec-note" }, "per-8h funding across the universe")),
          distWrap),
        h("section", { class: "fund-panel" },
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Funding vs basis"),
            h("span", { class: "sec-note" }, "each dot is a symbol — click to open")),
          scatterWrap)),
      h("section", { class: "fund-panel fund-history" },
        h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Funding history"),
          histNote),
        h("div", { class: "table-tools" }, histChips),
        histContext,
        histChart),
      h("div", { class: "fund-section-head" },
        h("div", {}, h("span", {}, "Extremes"), h("b", {}, "Who pays now")),
        h("p", {}, "Ranked funding pressure, basis and 15m deltas for fast scan.")),
      h("div", { class: "fund-grid" },
        h("section", { class: "fund-panel" }, h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Shorts paying longs")), posWrap),
        h("section", { class: "fund-panel" }, h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Longs paying shorts")), negWrap),
        h("section", { class: "fund-panel" }, h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Biggest changes · 15m")), chgWrap))));

  mount(root, page_);

  // ---- funding history for a selected symbol ----
  let histChoices = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  function buildHistChips() {
    mount(histChips, histChoices.map((s) =>
      h("button", { class: "chip" + (s === histSymbol ? " active" : ""), onClick: () => {
        histSymbol = s; buildHistChips(); paintHistoryContext(); loadHistChart(true);
      } }, baseOf(s))));
    paintHistoryContext();
  }
  function rememberFundingRows(rows = []) {
    rows.forEach((r) => {
      if (r?.symbol && isFinite(r.funding_rate)) latestFundingBySymbol.set(r.symbol, r);
    });
    paintHistoryContext();
  }
  const signedBasisBps = (row) => Number(row?.mid_spread_bps ?? row?.last_abs_basis_bps ?? row?.abs_basis_bps ?? 0);
  function rowsFromPayload(payload = {}) {
    const bySymbol = new Map();
    for (const row of [...(payload.positive || []), ...(payload.negative || []), ...(payload.rows || [])]) {
      if (row?.symbol && Number.isFinite(Number(row.funding_rate))) bySymbol.set(row.symbol, row);
    }
    return [...bySymbol.values()];
  }
  function strongest(rows, fn) {
    return rows.reduce((best, row) => {
      if (!best) return row;
      return fn(row) > fn(best) ? row : best;
    }, null);
  }
  function tickClass(id, raw) {
    const next = Number(raw);
    const prev = tickState.get(id);
    if (Number.isFinite(next)) tickState.set(id, next);
    if (!Number.isFinite(next) || !Number.isFinite(prev) || Math.abs(next - prev) < 1e-12) return "";
    return next > prev ? " tick-up" : " tick-down";
  }
  function kpiCard(id, label, value, sub, raw, tone = "") {
    return h("div", { class: "fund-kpi " + tone },
      h("span", { class: "fund-kpi-k" }, label),
      h("b", { class: "fund-kpi-v num " + signClass(raw) + tickClass(id, raw) }, value),
      h("span", { class: "fund-kpi-sub" }, sub));
  }
  function paintHero(payload = {}) {
    const rows = rowsFromPayload(payload);
    const pos = rows.filter((r) => Number(r.funding_rate) > 0).length;
    const neg = rows.filter((r) => Number(r.funding_rate) < 0).length;
    const health = payload.health || {};
    const tracked = Number(health.tracked_symbols ?? rows.length);
    const live = Number(health.live_symbols ?? 0);
    const stale = Number(health.stale_symbol_count ?? Math.max(0, tracked - live));
    const age = Number(health.freshness_age_seconds);
    const status = String(health.status || (rows.length ? "snapshot" : "warming")).toLowerCase();
    mount(subLine, `${pos} positive · ${neg} negative · ${live > 0 ? `${live} live` : "stale snapshot"} · ${tracked || rows.length} tracked`);
    mount(metaLine,
      h("span", { class: "fund-live-led " + status }),
      h("span", { class: "fund-hero-chip strong" }, "Public USD-M mark stream"),
      h("span", { class: "fund-hero-chip" }, `${tracked || rows.length} tracked`),
      h("span", { class: "fund-hero-chip" }, `${stale || 0} stale`),
      h("span", { class: "fund-hero-chip " + status }, status.toUpperCase()),
      Number.isFinite(age) ? h("span", { class: "fund-hero-chip" }, `updated ${fmtAge(age)} ago`) : null);
  }
  function paintContext(payload = {}) {
    const rows = rowsFromPayload(payload);
    if (!rows.length) {
      mount(contextWrap, h("div", { class: "empty-state" }, "Funding context is warming."));
      return;
    }
    const pos = rows.filter((r) => Number(r.funding_rate) > 0);
    const neg = rows.filter((r) => Number(r.funding_rate) < 0);
    const avg = rows.reduce((sum, r) => sum + Number(r.funding_rate || 0), 0) / rows.length;
    const topPos = strongest(pos, (r) => Number(r.funding_rate));
    const topNeg = strongest(neg, (r) => Math.abs(Number(r.funding_rate)));
    const widest = strongest(rows, (r) => Math.abs(signedBasisBps(r)));
    const score = strongest(rows, (r) => Number(r.opportunity_score || 0));
    const health = payload.health || {};
    const tracked = Number(health.tracked_symbols ?? rows.length);
    const live = Number(health.live_symbols ?? 0);
    const status = String(health.status || "snapshot").toUpperCase();
    mount(contextWrap,
      h("div", { class: "fund-context-head" },
        h("span", {}, "OI-style context"),
        h("b", {}, "Funding pressure, signed basis and source freshness"),
        h("em", {}, "basis proxy · public feed only")),
      h("div", { class: "fund-kpis" },
        kpiCard("avg", "Average funding", fmtFunding(avg), `${pos.length} shorts-pay · ${neg.length} longs-pay`, avg, avg >= 0 ? "pos" : "neg"),
        kpiCard("top-pos", "Highest positive", topPos ? fmtFunding(topPos.funding_rate) : "—", topPos ? `${baseOf(topPos.symbol)} · ${fmtBps(signedBasisBps(topPos), true)} bps basis` : "warming", topPos?.funding_rate, "pos"),
        kpiCard("top-neg", "Deepest negative", topNeg ? fmtFunding(topNeg.funding_rate) : "—", topNeg ? `${baseOf(topNeg.symbol)} · ${fmtBps(signedBasisBps(topNeg), true)} bps basis` : "warming", topNeg?.funding_rate, "neg"),
        kpiCard("basis", "Basis pressure", widest ? `${fmtBps(signedBasisBps(widest), true)} bps` : "—", widest ? `${baseOf(widest.symbol)} · score ${fmtScore(widest.opportunity_score)}` : "warming", signedBasisBps(widest), signedBasisBps(widest) >= 0 ? "pos" : "neg"),
        kpiCard("score", "Opportunity max", score ? fmtScore(score.opportunity_score) : "—", score ? `${baseOf(score.symbol)} · ${fmtFunding(score.funding_rate)}` : "warming", score?.opportunity_score),
        kpiCard("health", "Source state", status, `${live}/${tracked || rows.length} live symbols`, live, live > 0 ? "pos" : "muted")));
  }
  function paintHistoryContext() {
    const row = latestFundingBySymbol.get(histSymbol);
    if (!row) {
      mount(histContext,
        h("div", { class: "fund-history-stat muted" }, h("span", {}, "Selected"), h("b", {}, baseOf(histSymbol)), h("small", {}, "waiting for current row")));
      return;
    }
    const basis = signedBasisBps(row);
    const payer = Number(row.funding_rate) >= 0 ? "shorts pay longs" : "longs pay shorts";
    mount(histContext,
      h("div", { class: "fund-history-stat" }, h("span", {}, "Selected"), h("b", {}, baseOf(histSymbol)), h("small", {}, payer)),
      h("div", { class: "fund-history-stat" }, h("span", {}, "Current funding"), h("b", { class: "num " + signClass(row.funding_rate) + tickClass("hist-funding:" + histSymbol, row.funding_rate) }, fmtFunding(row.funding_rate)), h("small", {}, "per interval")),
      h("div", { class: "fund-history-stat" }, h("span", {}, "Signed basis"), h("b", { class: "num " + signClass(basis) + tickClass("hist-basis:" + histSymbol, basis) }, `${fmtBps(basis, true)} bps`), h("small", {}, basis >= 0 ? "perp rich" : "spot rich")),
      h("div", { class: "fund-history-stat" }, h("span", {}, "Score"), h("b", { class: "num" }, fmtScore(row.opportunity_score)), h("small", {}, String(row.status || "snapshot").toLowerCase())));
  }
  function snapshotSeries(row) {
    if (!row || !isFinite(row.funding_rate)) return [];
    const t = Number(row.ts_ms) || Date.now();
    const v = row.funding_rate * 100;
    return [{ t: t - 24 * 60 * 60 * 1000, v }, { t, v }];
  }
  function drawFundingChart(series, animate, note) {
    const slim = series.length > 240 ? series.filter((_, i) => i % Math.ceil(series.length / 240) === 0) : series;
    renderChart(histChart, slim, {
      color: (slim.at(-1)?.v ?? 0) >= 0 ? "var(--up)" : "var(--down)",
      valueFmt: (v) => v.toFixed(4) + "%", axisFmt: (v) => v.toFixed(3) + "%",
      zeroLine: true, dotted: true, animate, height: 240,
      timeFmt: fmtTimeShort, tipTimeFmt: fmtDateTime,
    });
    if (note) mount(histNote, note);
  }
  async function loadHistChart(animate = false) {
    const fallback = snapshotSeries(latestFundingBySymbol.get(histSymbol));
    if (fallback.length) {
      drawFundingChart(fallback, animate, "current live funding snapshot · loading 24h history");
    }
    try {
      const res = await api.history(histSymbol, "24h");
      const pts = (res.rows || [])
        .map((r) => ({ t: r.ts_ms, v: (r.funding_rate || 0) * 100 }))
        .filter((p) => isFinite(p.v) && p.t);
      const source = pts.length === 1
        ? [{ t: pts[0].t - 24 * 60 * 60 * 1000, v: pts[0].v }, pts[0]]
        : pts;
      if (source.length >= 2) drawFundingChart(source, animate, "24h · Binance USD-M mark stream");
      else if (!fallback.length) mount(histChart, h("div", { class: "chart-empty", style: { height: "240px" } }, "No funding history in this window yet."));
    } catch (e) {
      if (!fallback.length) mount(histChart, h("div", { class: "chart-empty", style: { height: "240px" } }, "Funding history is warming."));
    }
  }

  // ---- scatter: x = signed basis bps, y = funding % ----
  function paintScatter(rows) {
    const pts = rows
      .map((r) => ({
        ...r,
        mid_spread_bps:
          isFinite(r.mid_spread_bps) ? r.mid_spread_bps
          : isFinite(r.last_abs_basis_bps) ? r.last_abs_basis_bps
          : 0,
      }))
      .filter((r) => isFinite(r.funding_rate));
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
        <text x="${pad}" y="${Y(0) - 7}" font-size="10.5" fill="var(--muted)" font-family="var(--font)">spot rich</text>
        <text x="${W - pad}" y="${Y(0) - 7}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="var(--font)">basis → rich (+${fmtBps(xm)} bps)</text>
        <text x="${X(0) + 7}" y="${pad - 2}" font-size="10.5" fill="var(--muted)" font-family="var(--font)">funding +${ym.toFixed(3)}%</text>
        <text x="${X(0) + 7}" y="${H - 12}" font-size="10.5" fill="var(--muted)" font-family="var(--font)">funding -${ym.toFixed(3)}%</text>
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
    const total = bins.reduce((sum, b) => sum + b.count, 0);
    mount(distWrap,
      h("div", { class: "dist-bars" },
        bins.map((b) => {
          const mid = (b.from + b.to) / 2;
          const hpct = Math.max(3, (b.count / maxC) * 100);
          return h("div", { class: "dist-col", title: `${b.from.toFixed(3)}% … ${b.to.toFixed(3)}% — ${b.count} symbols` },
            h("div", { class: "dist-bar " + (mid >= 0 ? "pos" : "neg"), style: { height: hpct + "%" } }),
            h("div", { class: "dist-x num" }, (mid >= 0 ? "+" : "") + mid.toFixed(2)));
        })),
      h("div", { class: "fund-dist-footer" },
        h("span", {}, "negative funding"),
        h("b", { class: "num" }, `${total} symbols`),
        h("span", {}, "positive funding")));
  }

  function distributionFromRows(rows) {
    const vals = rows.map((r) => r.funding_rate * 100).filter(Number.isFinite);
    if (!vals.length) return [];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const lo = Math.min(min, -0.001);
    const hi = Math.max(max, 0.001);
    const n = 16;
    const step = (hi - lo) / n || 0.001;
    const bins = Array.from({ length: n }, (_, i) => ({
      from: lo + i * step,
      to: lo + (i + 1) * step,
      count: 0,
    }));
    vals.forEach((v) => {
      const idx = Math.max(0, Math.min(n - 1, Math.floor((v - lo) / step)));
      bins[idx].count += 1;
    });
    return bins;
  }

  function stateLiteSeed() {
    const rows = ((store.lite && store.lite.ticker) || [])
      .filter((r) => r && r.symbol && Number.isFinite(Number(r.funding_rate)))
      .map((r) => ({ ...r, funding_rate: Number(r.funding_rate) }));
    if (!rows.length) return null;
    const positive = rows
      .filter((r) => r.funding_rate > 0)
      .sort((a, b) => b.funding_rate - a.funding_rate);
    const negative = rows
      .filter((r) => r.funding_rate < 0)
      .sort((a, b) => a.funding_rate - b.funding_rate);
    if (!positive.length && !negative.length) return null;
    return { positive, negative, changes: [], distribution: distributionFromRows(rows) };
  }

  function lbRow(r, valText, cls, barPct, barCls, rank = 0) {
    const basis = signedBasisBps(r);
    return h("div", { class: "lb-row fund-rank-row", onClick: () => navigate("/symbol/" + r.symbol + "?tab=funding") },
      h("span", { class: "lb-bar " + barCls, style: { width: barPct + "%" } }),
      h("span", { class: "lb-rank num" }, String(rank).padStart(2, "0")),
      tokenIcon(r.symbol, 24),
      h("span", { class: "lb-copy" },
        h("span", { class: "lb-name" }, baseOf(r.symbol)),
        h("span", { class: "lb-sub num" }, `${fmtBps(basis, true)} bps · score ${fmtScore(r.opportunity_score)}`)),
      h("span", { class: "lb-val num " + cls }, valText));
  }

  function paintBoards(payload) {
    const pos = (payload.positive || []).filter((r) => r.funding_rate > 0).slice(0, 10);
    const neg = (payload.negative || []).filter((r) => r.funding_rate < 0).slice(0, 10);
    const maxP = Math.max(...pos.map((r) => Math.abs(r.funding_rate)), 1e-9);
    const maxN = Math.max(...neg.map((r) => Math.abs(r.funding_rate)), 1e-9);
    mount(posWrap, pos.length ? pos.map((r, i) =>
      lbRow(r, fmtFunding(r.funding_rate), "up", (Math.abs(r.funding_rate) / maxP) * 70 + 6, "bid", i + 1)) :
      h("div", { class: "empty-state" }, "No positive funding right now."));
    mount(negWrap, neg.length ? neg.map((r, i) =>
      lbRow(r, fmtFunding(r.funding_rate), "down", (Math.abs(r.funding_rate) / maxN) * 70 + 6, "ask", i + 1)) :
      h("div", { class: "empty-state" }, "No negative funding right now."));
    const changes = (payload.changes || []).slice(0, 10);
    const maxC = Math.max(...changes.map((r) => Math.abs(r.funding_change || 0)), 1e-9);
    mount(chgWrap, changes.length ? changes.map((r, i) => {
      const d = (r.funding_change || 0) * 100;
      return h("div", { class: "lb-row fund-rank-row", onClick: () => navigate("/symbol/" + r.symbol + "?tab=funding") },
        h("span", { class: "lb-bar " + (d >= 0 ? "bid" : "ask"), style: { width: (Math.abs(r.funding_change || 0) / maxC) * 70 + 6 + "%" } }),
        h("span", { class: "lb-rank num" }, String(i + 1).padStart(2, "0")),
        tokenIcon(r.symbol, 24),
        h("span", { class: "lb-copy" },
          h("span", { class: "lb-name" }, baseOf(r.symbol)),
          h("span", { class: "lb-sub num" }, `${fmtFunding(r.funding_rate)} current`)),
        h("span", { class: "lb-val num " + (d >= 0 ? "up" : "down") }, (d >= 0 ? "↗ +" : "↘ ") + d.toFixed(4) + "%"));
    }) : h("div", { class: "empty-state" }, "No 15m funding deltas in the current snapshot."));
  }

  function paintSeed() {
    const seed = stateLiteSeed();
    if (!seed) return;
    paintHero(seed);
    paintContext(seed);
    paintDistribution(seed.distribution);
    paintBoards(seed);
    const rows = [...seed.positive, ...seed.negative];
    rememberFundingRows(rows);
    paintScatter(rows);
  }

  async function load() {
    try {
      const payload = await api.funding();
      if (!payload || payload.ok === false) return;
      paintHero(payload);
      paintContext(payload);
      paintDistribution(payload.distribution);
      paintBoards(payload);
      const pos = (payload.positive || []).filter((r) => r.funding_rate > 0);
      const neg = (payload.negative || []).filter((r) => r.funding_rate < 0);
      rememberFundingRows([...pos, ...neg]);
      paintScatter([...pos, ...neg]);
      // history selector: majors + current extremes
      const tops = [...pos.slice(0, 2), ...neg.slice(0, 2)].map((r) => r.symbol);
      const merged = [...new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", ...tops])].slice(0, 7);
      if (merged.join() !== histChoices.join()) { histChoices = merged; buildHistChips(); }
    } catch (e) {}
  }

  buildHistChips();
  paintSeed();
  load();
  loadScatter();
  loadHistChart(true);
  const t = setInterval(load, 6000);
  const t2 = setInterval(loadScatter, 10000);
  const t3 = setInterval(() => loadHistChart(false), 30000);
  cleanups.push(() => clearInterval(t3));
  cleanups.push(() => { clearInterval(t); clearInterval(t2); });
  return () => cleanups.forEach((c) => c());
}
