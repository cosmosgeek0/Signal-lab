// Derivatives Heatmap — liquidation first, then funding, open interest, RSI,
// and legacy radar metrics. CoinGlass is used as product reference only; exact
// multi-exchange historical liquidation heatmaps stay marked requires-key.

import { h, mount } from "../lib/dom.js";
import { tokenIcon, icon, brandColor } from "../lib/icons.js";
import { sparkline, sparkArea } from "../lib/chart.js";
import { api } from "../lib/api.js";
import { navigate } from "../lib/store.js";
import { baseOf, fmtPrice, fmtMoney, fmtPct, fmtBps, fmtFunding, fmtAge, fmtTimeShort } from "../lib/format.js";

const MODES = ["Treemap", "Tiles", "Mosaic", "Bubbles", "Strips"];
const API_WINDOWS = ["1h", "4h", "12h", "24h", "7d", "30d"];
const GATED_WINDOWS = ["90d", "1y"];
const WINDOWS = API_WINDOWS.concat(GATED_WINDOWS);

const METRIC_GROUPS = [
  { id: "liquidations", label: "Liquidations", ids: ["liquidation"] },
  { id: "rates", label: "Funding & OI", ids: ["funding", "open_interest", "long_short", "taker_flow", "rsi"] },
  { id: "tradfi", label: "TradFi perps", ids: ["tradfi_perps"] },
  { id: "defi", label: "DeFi breadth", ids: ["defi_tvl", "dex_volume", "fees", "stablecoins", "yields"] },
  { id: "defi_derivs", label: "DeFi derivatives", ids: ["defi_oi", "options_volume", "bridges"] },
  { id: "legacy", label: "Radar signals", ids: ["mcap", "score", "basis"] },
  { id: "providers", label: "Provider-gated", ids: ["providers"] },
];

const METRICS = {
  liquidation: {
    label: "Liquidations",
    signed: true,
    get: (r) => r.liq_value || 0,
    fmt: (v) => (Math.abs(v) > 0 ? fmtMoney(Math.abs(v)) : "$0"),
    legend: ["Short rekt", "Long rekt"],
    note: "Binance public liquidation stream",
  },
  funding: {
    label: "Funding",
    signed: true,
    get: (r) => r.funding_rate || 0,
    fmt: (v) => fmtFunding(v),
    legend: ["Negative", "Positive"],
    note: "Binance mark/funding public REST",
  },
  open_interest: {
    label: "Open interest",
    signed: false,
    get: (r) => r.oi_notional || 0,
    fmt: (v) => fmtMoney(v),
    legend: ["Small OI", "Large OI"],
    hue: [43, 126, 232],
    note: "Binance open interest public REST",
  },
  rsi: {
    label: "RSI",
    signed: true,
    get: (r) => (r.rsi_15m || 50) - 50,
    fmt: (_, r) => r.rsi_15m == null ? "—" : r.rsi_15m.toFixed(1),
    legend: ["Oversold", "Overbought"],
    note: "Computed from Binance 15m futures klines",
  },
  long_short: {
    label: "Long/short",
    signed: true,
    get: (r) => r.crowd_bias_pct || 0,
    fmt: (v, r) => `${(r.long_account_pct || 0).toFixed(1)}% long`,
    weight: (r) => Math.max(1, Math.abs(r.crowd_bias_pct || 0)),
    legend: ["Short crowding", "Long crowding"],
    note: "Binance global and top-trader long/short ratios",
  },
  taker_flow: {
    label: "Taker flow",
    signed: true,
    get: (r) => r.flow_bias_pct || 0,
    fmt: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}% buy bias`,
    weight: (r) => Math.max(1, (r.buy_volume || 0) + (r.sell_volume || 0)),
    legend: ["Sell pressure", "Buy pressure"],
    note: "Binance taker buy/sell volume",
  },
  tradfi_perps: {
    label: "TradFi perps",
    signed: true,
    get: (r) => r.price_change_pct_24h || 0,
    fmt: (v, r) => `${fmtPrice(r.last_price || 0)} · ${fmtPct(v)}`,
    weight: (r) => Math.max(1, r.quote_volume_24h || 0),
    legend: ["Down 24h", "Up 24h"],
    note: "Binance TRADIFI_PERPETUAL contracts, separated from crypto",
  },
  defi_tvl: {
    label: "Chain TVL",
    signed: false,
    get: (r) => r.tvl || 0,
    fmt: (v) => fmtMoney(v),
    weight: (r) => Math.max(1, r.tvl || 0),
    legend: ["Small TVL", "Large TVL"],
    hue: [43, 126, 232],
    note: "DeFiLlama chain TVL",
  },
  dex_volume: {
    label: "DEX volume",
    signed: true,
    get: (r) => r.change_1d_pct || 0,
    fmt: (_, r) => fmtMoney(r.total24h || 0),
    weight: (r) => Math.max(1, r.total24h || 0),
    legend: ["Volume falling", "Volume rising"],
    note: "DeFiLlama DEX volume",
  },
  fees: {
    label: "Fees",
    signed: true,
    get: (r) => r.change_1d_pct || 0,
    fmt: (_, r) => fmtMoney(r.total24h || 0),
    weight: (r) => Math.max(1, r.total24h || 0),
    legend: ["Fees falling", "Fees rising"],
    note: "DeFiLlama fees and revenue adapters",
  },
  yields: {
    label: "Yields",
    signed: false,
    get: (r) => r.apy || 0,
    fmt: (v) => `${v.toFixed(2)}% APY`,
    weight: (r) => Math.max(1, r.tvl || 0),
    legend: ["Lower APY", "Higher APY"],
    hue: [168, 85, 247],
    note: "DeFiLlama yield pools, outliers filtered",
  },
  stablecoins: {
    label: "Stablecoins",
    signed: false,
    get: (r) => r.supply || 0,
    fmt: (v, r) => `${fmtMoney(v)} · ${Number(r.price || 0).toFixed(4)}`,
    weight: (r) => Math.max(1, r.supply || 0),
    legend: ["Small supply", "Large supply"],
    hue: [16, 185, 129],
    note: "DeFiLlama stablecoin supply by asset",
  },
  defi_oi: {
    label: "DeFi OI",
    signed: true,
    get: (r) => r.change_1d_pct || 0,
    fmt: (_, r) => fmtMoney(r.total24h || r.total7d || r.total30d || r.total1y || 0),
    weight: (r) => Math.max(1, r.total24h || r.total7d || r.total30d || r.total1y || 0),
    legend: ["OI falling", "OI rising"],
    note: "DeFiLlama open-interest overview",
  },
  options_volume: {
    label: "Options",
    signed: true,
    get: (r) => r.change_1d_pct || 0,
    fmt: (_, r) => fmtMoney(r.total24h || r.total7d || r.total30d || r.total1y || 0),
    weight: (r) => Math.max(1, r.total24h || r.total7d || r.total30d || r.total1y || 0),
    legend: ["Volume falling", "Volume rising"],
    note: "DeFiLlama options overview",
  },
  bridges: {
    label: "Bridge flow",
    signed: true,
    get: (r) => r.change_1d_pct || 0,
    fmt: (_, r) => fmtMoney(r.total24h || r.total7d || r.total30d || r.total1y || 0),
    weight: (r) => Math.max(1, r.total24h || r.total7d || r.total30d || r.total1y || 0),
    legend: ["Flow falling", "Flow rising"],
    note: "DeFiLlama bridge aggregator volume",
  },
  providers: {
    label: "Provider map",
    signed: false,
    get: (r) => r.status === "requires_key" ? 1 : 0,
    fmt: (_, r) => r.status || "unknown",
    weight: () => 1,
    legend: ["Configured", "Requires key"],
    hue: [139, 92, 246],
    note: "Data surfaces that should be wired only with real credentials",
  },
  mcap: {
    label: "Market cap",
    signed: true,
    get: (r) => r.price_change_pct_24h || 0,
    fmt: (v, r) => r.quote_volume_24h ? fmtMoney(r.quote_volume_24h) : fmtPct(v),
    legend: ["Down 24h", "Up 24h"],
    note: "Fallback size uses futures quote volume when cap is not available",
  },
  score: {
    label: "Score",
    signed: false,
    get: (r) => r.score || 0,
    fmt: (v) => v ? v.toFixed(1) : "—",
    legend: ["Quiet", "Hot"],
    hue: [16, 164, 106],
    note: "Derived from funding, volume, OI and live radar score",
  },
  basis: {
    label: "Basis",
    signed: true,
    get: (r) => r.basis_bps || r.premium_bps || 0,
    fmt: (v) => fmtBps(v, true) + " bps",
    legend: ["Perp discount", "Perp rich"],
    note: "One metric, not the whole page",
  },
};

function treemapLayout(weights, W, H) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const scaled = weights.map((v) => Math.max(1, (v / total) * W * H));
  const rects = [];
  let x = 0, y = 0, w = W, h = H, row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, b) => a + b, 0) || 1;
    let m = 0;
    for (const v of r) m = Math.max(m, Math.max((side * side * v) / (s * s), (s * s) / (side * side * v)));
    return m;
  };
  const layoutRow = (r) => {
    const s = r.reduce((a, b) => a + b, 0) || 1;
    if (w >= h) {
      const rw = s / h;
      let ry = y;
      for (const v of r) { const rh = v / rw; rects.push({ x, y: ry, w: rw, h: rh }); ry += rh; }
      x += rw; w -= rw;
    } else {
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

const absScale = (vals) => {
  const sorted = vals.map((v) => Math.abs(v)).filter((v) => isFinite(v)).sort((a, b) => a - b);
  return Math.max(sorted[Math.floor(sorted.length * 0.86)] || 1, 1e-9);
};

const groupForMetric = (metric) => METRIC_GROUPS.find((g) => g.ids.includes(metric)) || METRIC_GROUPS[0];

function metricColor(row, metric, scale) {
  const m = METRICS[metric];
  const v = heatValue(row, metric);
  const t = Math.min(1, Math.abs(v) / scale);
  const hue = (m.signed || isLiquidationContext(row, metric)) ? (v >= 0 ? [0, 164, 104] : [244, 63, 94]) : (m.hue || [0, 164, 104]);
  const a = 0.16 + t * 0.78;
  return `linear-gradient(145deg, color-mix(in srgb, var(--hm-cell-base) 86%, rgba(${hue.join(",")},${0.16 + t * 0.1})), rgba(${hue.join(",")},${a}))`;
}

function textSign(v) {
  const n = Number(v);
  return n > 0 ? "up" : n < 0 ? "down" : "";
}

function isLiquidationContext(row, metric) {
  return metric === "liquidation" && row && row._liqFallback;
}

function heatValue(row, metric) {
  if (isLiquidationContext(row, metric)) return Number(row.price_change_pct_24h || 0);
  return METRICS[metric].get(row);
}

function heatValueLabel(row, metric) {
  if (isLiquidationContext(row, metric)) return fmtMoney(row.quote_volume_24h || 0);
  return metricValue(row, metric);
}

function heatTitle(row, metric) {
  const label = isLiquidationContext(row, metric) ? "24h perp volume" : METRICS[metric].label;
  return `${row.symbol} · ${label} · ${heatValueLabel(row, metric)}`;
}

function cellRows(payload, metric) {
  const market = ((payload.market || {}).rows || []).map((r) => normalizeMarketRow(r));
  const bySymbol = new Map(market.map((r) => [r.symbol, r]));
  const mergeSymbol = (r) => ({ ...(bySymbol.get(r.symbol) || {}), ...normalizeMarketRow(r) });
  if (metric === "liquidation") {
    const liq = ((payload.liquidations || {}).by_symbol || []).map((r) => normalizeLiquidationRow(r, market));
    if (liq.length) return liq;
    return market.slice(0, 140).map((r) => ({
      ...r,
      _liqFallback: true,
      liq_value: 0,
      liq_label: "no live liquidation events this session",
    }));
  }
  if (metric === "open_interest") {
    const oi = ((payload.open_interest || {}).rows || []).map((r) => ({ ...normalizeMarketRow(r), oi_notional: r.oi_notional || 0 }));
    return oi.length ? oi : market.slice(0, 42);
  }
  if (metric === "rsi") {
    const rsi = ((payload.rsi || {}).rows || []).map((r) => ({ ...normalizeMarketRow(r), rsi_15m: r.rsi_15m, price: r.price }));
    return rsi.length ? rsi : market.slice(0, 42).map((r) => ({ ...r, rsi_15m: null }));
  }
  if (metric === "long_short") {
    return ((payload.long_short || {}).rows || []).map(mergeSymbol);
  }
  if (metric === "taker_flow") {
    return ((payload.taker_flow || {}).rows || []).map(mergeSymbol);
  }
  if (metric === "tradfi_perps") {
    return (((payload.tradfi_perps || {}).rows || [])).map((r) => normalizeMarketRow({ ...r, _kind: "tradfi" }));
  }
  if (metric === "defi_tvl") {
    return (((payload.defi || {}).chains || [])).map((r) => normalizeDefiRow(r, "chain"));
  }
  if (metric === "dex_volume") {
    return (((payload.defi || {}).dexs || [])).map((r) => normalizeDefiRow(r, "dex"));
  }
  if (metric === "fees") {
    return (((payload.defi || {}).fees || [])).map((r) => normalizeDefiRow(r, "fees"));
  }
  if (metric === "yields") {
    return (((payload.defi || {}).yields || [])).map((r) => normalizeDefiRow(r, "yield"));
  }
  if (metric === "stablecoins") {
    return (((payload.defi || {}).stablecoins || [])).map((r) => normalizeDefiRow(r, "stablecoin"));
  }
  if (metric === "defi_oi") {
    return (((payload.defi || {}).open_interest || [])).map((r) => normalizeDefiRow(r, "open_interest"));
  }
  if (metric === "options_volume") {
    return (((payload.defi || {}).options || [])).map((r) => normalizeDefiRow(r, "options"));
  }
  if (metric === "bridges") {
    return (((payload.defi || {}).bridges || [])).map((r) => normalizeDefiRow(r, "bridge"));
  }
  if (metric === "providers") {
    return ((((payload.provider_map || {}).coinglass) || [])).map((r) => normalizeProviderRow(r));
  }
  return market;
}

function normalizeMarketRow(row) {
  const symbol = String(row.symbol || "").toUpperCase();
  const quoteVol = Number(row.quote_volume_24h || 0);
  const fund = Number(row.last_funding_rate ?? row.funding_rate ?? 0);
  const pct = Number(row.price_change_pct_24h || 0);
  const oi = Number(row.oi_notional || 0);
  const score =
    Number(row.opportunity_score || 0) ||
    Math.min(100, Math.abs(fund * 10000) * 4 + Math.abs(pct) * 2.2 + Math.log10(Math.max(10, quoteVol)) * 4 + Math.log10(Math.max(10, oi)) * 3);
  return {
    ...row,
    symbol,
    base: row.base || baseOf(symbol),
    last_price: Number(row.last_price || row.mark_price || row.price || 0),
    price_change_pct_24h: pct,
    quote_volume_24h: quoteVol,
    funding_rate: fund,
    basis_bps: Number(row.basis_bps || row.premium_bps || 0),
    score,
  };
}

function normalizeLiquidationRow(row, marketRows) {
  const market = marketRows.find((r) => r.symbol === row.symbol) || {};
  const long = Number(row.long || 0);
  const short = Number(row.short || 0);
  return {
    ...market,
    ...row,
    symbol: row.symbol,
    base: row.base || baseOf(row.symbol),
    liq_value: Math.max(long, short) === short ? -Number(row.value || 0) : Number(row.value || 0),
    long_liq: long,
    short_liq: short,
  };
}

function normalizeDefiRow(row, kind) {
  const symbol = String(row.symbol || row.name || kind || "").toUpperCase();
  return {
    ...row,
    _kind: kind,
    symbol,
    base: row.name || row.project || row.chain || symbol,
    quote_volume_24h: Number(row.total24h || row.tvl || 0),
    price_change_pct_24h: Number(row.change_1d_pct || row.apy_1d_pct || 0),
    source: row.source || "DeFiLlama public API",
  };
}

function normalizeProviderRow(row) {
  return {
    ...row,
    _kind: "provider",
    symbol: String(row.surface || row.name || "provider").toUpperCase(),
    base: row.surface || row.name || "Provider",
    quote_volume_24h: 1,
    price_change_pct_24h: 0,
  };
}

function rowWeight(row, metric) {
  if (isLiquidationContext(row, metric)) return Math.max(1, row.quote_volume_24h || 1);
  if (METRICS[metric].weight) return Math.max(1, METRICS[metric].weight(row));
  if (metric === "liquidation") return Math.max(1, Math.abs(row.liq_value || 0));
  if (metric === "open_interest") return Math.max(1, row.oi_notional || row.quote_volume_24h || 1);
  if (metric === "mcap") return Math.max(1, row.quote_volume_24h || Math.abs(row.price_change_pct_24h || 0));
  return Math.max(1, Math.abs(METRICS[metric].get(row)));
}

function metricValue(row, metric) {
  const m = METRICS[metric];
  return m.fmt(m.get(row), row);
}

function renderMiniLine(row, metric, w = 96, hgt = 28) {
  const seed = Math.abs((row.symbol || row.base || "X").split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const end = 1 + Number(row.price_change_pct_24h || 0) / 100;
  const vals = Array.from({ length: 28 }, (_, i) => {
    const drift = 1 + (end - 1) * (i / 27);
    return drift + Math.sin((i + seed) * 0.7) * 0.012 + Math.cos((i + seed) * 0.27) * 0.007;
  });
  const direction = isLiquidationContext(row, metric) ? row.price_change_pct_24h : row.liq_value;
  const color = metric === "liquidation" ? ((direction || 0) < 0 ? "var(--down)" : "var(--up)") : brandColor(row.symbol || row.base);
  return sparkline(vals, w, hgt, color);
}

function sourcePill(source) {
  const st = String(source.status || "").toLowerCase();
  const cls = st.includes("live") ? "live" : st.includes("key") ? "keyed" : st.includes("degraded") ? "warn" : "warm";
  return h("span", { class: "deriv-source-pill " + cls },
    h("span", { class: "dot" }),
    h("span", {}, source.name),
    h("b", {}, source.status || "warming"));
}

function sourceLine(sources, label = "Source state") {
  const items = Array.isArray(sources) ? sources : [];
  const live = items.filter((s) => /live/i.test(s.status || "")).length;
  const keyed = items.filter((s) => /key/i.test(s.status || "")).length;
  const warm = items.filter((s) => !/live|key/i.test(s.status || "")).length;
  const stream = items.find((s) => /liquidation stream/i.test(s.name || ""));
  const detail = [
    live ? `${live} live` : "",
    warm ? `${warm} warming` : "",
    keyed ? `${keyed} requires key` : "",
  ].filter(Boolean).join(" · ") || "checking";
  return h("div", { class: "deriv-source-line " + (warm ? "warm" : "live") },
    h("span", { class: "dot" }),
    h("b", {}, label),
    h("span", {}, detail),
    stream ? h("em", {}, stream.detail || stream.status || "") : null);
}

function heatNotice(title, detail, tone = "warm") {
  return h("div", { class: "deriv-heat-notice " + tone },
    h("span", { class: "dot" }),
    h("b", {}, title),
    h("span", {}, detail));
}

function rowIcon(row, size = 28) {
  if (row.logo) {
    return h("img", {
      class: "tok-ico protocol-logo",
      src: row.logo,
      width: size,
      height: size,
      loading: "lazy",
      alt: "",
      onError: (e) => {
        const fallback = tokenIcon(row.symbol || row.base, size);
        e.currentTarget.replaceWith(fallback);
      },
    });
  }
  return tokenIcon(row.symbol || row.base, size);
}

function openRow(row) {
  if (row.url) {
    window.open(row.url, "_blank", "noopener,noreferrer");
    return;
  }
  const symbol = String(row.symbol || "");
  if ((row._kind === "tradfi" || row.asset_class === "tradfi") && symbol) {
    window.open(`https://www.binance.com/en/futures/${encodeURIComponent(symbol)}`, "_blank", "noopener,noreferrer");
    return;
  }
  if (symbol.endsWith("USDT")) navigate("/symbol/" + symbol);
  else if (symbol && !row._kind) navigate("/symbol/" + symbol + "USDT");
}

function statCard(title, value, sub, tone, ico) {
  return h("div", { class: "deriv-stat " + (tone || "") },
    h("div", { class: "deriv-stat-top" }, icon(ico || "activity"), h("span", {}, title)),
    h("div", { class: "deriv-stat-value num" }, value),
    h("div", { class: "deriv-stat-sub" }, sub || ""));
}

export function renderHeatmap(root) {
  const params = new URLSearchParams(location.search);
  let metric = METRICS[params.get("metric")] ? params.get("metric") : "liquidation";
  let activeGroup = groupForMetric(metric).id;
  const pm = (params.get("mode") || "").toLowerCase();
  let mode = MODES.find((m) => m.toLowerCase() === pm) || "Treemap";
  let windowKey = API_WINDOWS.includes(params.get("window")) ? params.get("window") : "4h";
  let payload = null;
  let inFlight = false;
  const cleanups = [];

  const sub = h("div", { class: "page-sub" }, "loading derivatives feed...");
  const groupSeg = h("div", { class: "seg deriv-groups" });
  const modeSeg = h("div", { class: "seg deriv-mode" });
  const metricSeg = h("div", { class: "seg deriv-metrics" });
  const windowSeg = h("div", { class: "seg deriv-window" });
  const legend = h("div", { class: "heat-legend deriv-legend" });
  const summary = h("section", { class: "deriv-summary" });
  const surface = h("div", { class: "heat-surface deriv-surface" });
  const details = h("section", { class: "deriv-details" });

  const page = h("div", { class: "page deriv-page" },
    h("div", { class: "container page-wide" },
      h("div", { class: "page-head" },
        h("div", {},
          h("div", { class: "eyebrow live" }, h("span", { class: "dot" }), "Derivatives surface"),
          h("h1", { class: "page-title" }, "Derivatives heatmap"),
          sub),
        modeSeg),
      summary,
      h("section", { class: "heat-workbench deriv-workbench" },
        h("div", { class: "heat-tools deriv-tools" }, groupSeg, metricSeg, windowSeg, legend),
        surface),
      details));

  mount(root, page);
  buildControls();
  renderWarmupSurface();
  load();

  function buildControls() {
    const repaint = () => {
      buildControls();
      if (payload) paint();
      else renderWarmupSurface();
    };
    const active = METRIC_GROUPS.find((g) => g.id === activeGroup) || groupForMetric(metric);
    mount(groupSeg, METRIC_GROUPS.map((g) =>
      h("button", {
        class: g.id === active.id ? "on" : "",
        onClick: () => {
          activeGroup = g.id;
          if (!g.ids.includes(metric)) metric = g.ids[0];
          repaint();
        },
      }, g.label)));
    mount(modeSeg, MODES.map((m) =>
      h("button", { class: m === mode ? "on" : "", onClick: () => { mode = m; repaint(); } }, m)));
    mount(metricSeg, active.ids.map((id) => [id, METRICS[id]]).map(([id, m]) =>
      h("button", { class: id === metric ? "on" : "", onClick: () => { metric = id; repaint(); } }, m.label)));
    mount(windowSeg, WINDOWS.map((w) => {
      const gated = GATED_WINDOWS.includes(w);
      return h("button", {
        class: (w === windowKey ? "on " : "") + (gated ? "disabled" : ""),
        disabled: gated,
        title: gated ? "Requires a historical provider such as CoinGlass or licensed exchange history" : "",
        onClick: gated ? null : () => { windowKey = w; buildControls(); renderWarmupSurface(); load(); },
      }, w);
    }));
    renderLegend();
  }

  function renderLegend(rows = []) {
    const m = METRICS[metric];
    const fallback = metric === "liquidation" && rows.some((r) => r._liqFallback);
    const colorLabel = fallback ? "Color = 24h move" : `Color = ${m.label}`;
    const sizeLabel = fallback ? "Size = 24h perp volume" :
      metric === "liquidation" ? "Size = liquidation notional" :
      metric === "open_interest" ? "Size = open interest" :
      metric === "mcap" ? "Size = quote volume" :
      "Size = metric weight";
    const grad = fallback || m.signed
      ? "linear-gradient(90deg, rgb(244,63,94), rgba(226,232,240,.68), rgb(0,164,104))"
      : `linear-gradient(90deg, rgba(226,232,240,.86), rgb(${(m.hue || [0, 164, 104]).join(",")}))`;
    const left = fallback ? "Down" : m.legend[0];
    const right = fallback ? "Up" : m.legend[1];
    mount(legend,
      h("span", { class: "deriv-legend-key" }, h("b", {}, "Size"), h("span", {}, sizeLabel.replace("Size = ", ""))),
      h("span", { class: "deriv-legend-key color" }, h("b", {}, "Color"), h("span", {}, colorLabel.replace("Color = ", ""))),
      h("span", { class: "deriv-legend-scale" }, h("span", {}, left), h("span", { class: "heat-bar", style: { background: grad } }), h("span", {}, right)));
  }

  async function load() {
    if (inFlight) return;
    inFlight = true;
    try {
      const res = await api.derivatives(windowKey, 160);
      payload = res;
      paint();
    } catch (e) {
      mount(sub, "derivatives feed unavailable");
      mount(surface, heatNotice("Feed unavailable", "The derivatives endpoint did not return JSON. Check /api/derivatives.", "danger"));
      mount(details, "");
    } finally {
      inFlight = false;
    }
  }

  function renderWarmupSurface() {
    mount(sub, "Loading derivatives feed · heatmap waits for real rows");
    renderLegend();
    mount(summary, "");
    mount(surface, heatNotice("Sources warming", "Connecting to public derivatives feeds. Heatmap opens when real rows arrive."));
    mount(details, "");
  }

  function paint() {
    if (!payload) return;
    const rows = cellRows(payload, metric).slice(0, 140);
    const stream = payload.stream || {};
    const liquidations = payload.liquidations || {};
    const errors = (payload.errors || []).length;
    const fallback = metric === "liquidation" && rows.some((r) => r._liqFallback);
    mount(sub,
      fallback
        ? `${rows.length} contracts · size = 24h perp volume · color = 24h move · stream has ${liquidations.event_count || 0} events`
        : `${rows.length} symbols · ${METRICS[metric].label.toLowerCase()} · ${windowKey} · ` +
          `${stream.state || "warming"} stream` + (errors ? ` · ${errors} provider warnings` : ""));
    renderLegend(rows);
    renderSummary();
    renderSurface(rows);
    renderDetails(rows);
  }

  function renderSummary() {
    if (metric === "tradfi_perps") {
      const t = payload.tradfi_perps || {};
      const rows = (t.rows || []).map((r) => normalizeMarketRow({ ...r, _kind: "tradfi" }));
      const topVol = rows.slice().sort((a, b) => (b.quote_volume_24h || 0) - (a.quote_volume_24h || 0))[0];
      const topMove = rows.slice().sort((a, b) => Math.abs(b.price_change_pct_24h || 0) - Math.abs(a.price_change_pct_24h || 0))[0];
      mount(summary,
        h("div", { class: "deriv-summary-grid slim" },
          statCard("TradFi perps", String(t.count || rows.length), "separate Binance surface", "info", "barChart"),
          statCard("Equities", String(t.equities || 0), "not mixed into crypto", "info", "activity"),
          statCard("Commodities", String(t.commodities || 0), "gold and silver perps", "info", "database"),
          statCard("Top volume", topVol ? topVol.base : "warming", topVol ? fmtMoney(topVol.quote_volume_24h) : t.source, "up", "zap"),
          statCard("Largest move", topMove ? topMove.base : "warming", topMove ? fmtPct(topMove.price_change_pct_24h) : "24h", textSign(topMove && topMove.price_change_pct_24h), "gauge")),
        sourceLine((payload.sources || []).filter((s) => /tradfi|binance/i.test(s.name + " " + s.detail)), "TradFi source state"));
      return;
    }
    if (["defi_tvl", "dex_volume", "fees", "stablecoins", "yields", "defi_oi", "options_volume", "bridges"].includes(metric)) {
      const defi = payload.defi || {};
      const sum = defi.summary || {};
      mount(summary,
        h("div", { class: "deriv-summary-grid" },
          statCard("Chain TVL", fmtMoney(sum.chain_tvl || 0), "DeFiLlama chains", "info", "globe"),
          statCard("DEX volume", fmtMoney(sum.dex_volume_24h || 0), "24h", "up", "activity"),
          statCard("Stable supply", fmtMoney(sum.stablecoin_supply || 0), `${sum.stablecoin_assets || 0} assets`, "info", "database"),
          statCard("DeFi OI", fmtMoney(sum.open_interest_24h || 0), "DeFiLlama overview", "info", "barChart"),
          statCard("Yields", String(sum.yield_pools || 0), "eligible pools", "info", "gauge"),
          statCard("Status", defi.status || "warming", "public DeFiLlama APIs", defi.status === "live" ? "up" : "info", "zap")),
        sourceLine((payload.sources || []).filter((s) => /defi|llama/i.test(s.name + " " + s.detail)), "DeFi source state"));
      return;
    }
    if (metric === "providers") {
      const rows = ((payload.provider_map || {}).coinglass || []);
      mount(summary,
        h("div", { class: "deriv-summary-grid" },
          statCard("CoinGlass surfaces", String(rows.length), "provider-gated map", "info", "database"),
          statCard("Configured", "0", "no key exposed in frontend", "info", "zap"),
          statCard("Requires key", String(rows.filter((r) => r.status === "requires_key").length), "honest disabled state", "danger", "lock"),
          statCard("Timeframes", "1h - all", "only where provider supports it", "info", "barChart"),
          statCard("Policy", "No fake data", "wire after credentials", "up", "shield")),
        sourceLine((payload.sources || []).filter((s) => /coinglass/i.test(s.name + " " + s.detail)), "Provider source state"));
      return;
    }
    const l = payload.liquidations || {};
    const oiRows = (payload.open_interest || {}).rows || [];
    const topOi = oiRows[0];
    const fundRows = (payload.funding || {}).rows || [];
    const topFund = fundRows[0];
    const hasLiquidationEvents = (l.event_count || 0) > 0 || ((l.by_symbol || []).length > 0);
    if (metric === "liquidation" && !hasLiquidationEvents) {
      mount(summary,
        h("div", { class: "deriv-summary-grid" },
          statCard("Map sizing", "Volume", "24h USD-M quote volume", "info", "barChart"),
          statCard("Map color", "24h move", "green gainers · red losers", "up", "activity"),
          statCard("Stream events", "0", `live from server start · ${windowKey}`, "info", "zap"),
          statCard("CoinGlass history", "Locked", "requires key; no fake backfill", "danger", "lock"),
          statCard("Top open interest", topOi ? fmtMoney(topOi.oi_notional) : "warming", topOi ? topOi.symbol : "Binance public REST", "info", "gauge")),
        sourceLine(payload.sources || [], "Derivatives source state"));
      return;
    }
    mount(summary,
      h("div", { class: "deriv-summary-grid" },
        statCard("Total liquidations", fmtMoney(l.total || 0), `${l.event_count || 0} live events in ${windowKey}`, "danger", "zap"),
        statCard("Long liquidations", fmtMoney(l.long || 0), "SELL force orders", "down", "activity"),
        statCard("Short liquidations", fmtMoney(l.short || 0), "BUY force orders", "up", "activity"),
        statCard("Top open interest", topOi ? fmtMoney(topOi.oi_notional) : "warming", topOi ? topOi.symbol : "Binance public REST", "info", "barChart"),
        statCard("Highest funding", topFund ? fmtFunding(topFund.funding_rate) : "warming", topFund ? topFund.symbol : "Binance public REST", textSign(topFund && topFund.funding_rate), "gauge")),
      sourceLine(payload.sources || [], "Derivatives source state"));
  }

  function renderSurface(rows) {
    const vals = rows.map((r) => heatValue(r, metric));
    const scale = absScale(vals);
    if (mode === "Treemap") return renderTreemap(rows, scale);
    if (mode === "Tiles") return renderTiles(rows, scale);
    if (mode === "Mosaic") return renderMosaic(rows, scale);
    if (mode === "Bubbles") return renderBubbles(rows, scale);
    return renderStrips(rows, scale);
  }

  function renderTreemap(rows, scale) {
    const top = rows.slice(0, 96);
    const weights = top.map((r) => rowWeight(r, metric));
    const rects = treemapLayout(weights, 100, 62);
    mount(surface, h("div", { class: "treemap-wrap deriv-treemap" }, top.map((r, i) => {
      const rc = rects[i] || { x: 0, y: 0, w: 0, h: 0 };
      const area = rc.w * rc.h;
      const big = area > 42;
      const mid = area > 14;
      const fs = Math.min(56, Math.max(12, Math.sqrt(area) * 1.45));
      const val = heatValueLabel(r, metric);
      const v = heatValue(r, metric);
      return h("button", {
        class: "tm-cell deriv-cell " + textSign(v) + (r._liqFallback ? " context" : ""),
        title: heatTitle(r, metric),
        style: {
          left: rc.x + "%", top: (rc.y / 62 * 100) + "%",
          width: rc.w + "%", height: (rc.h / 62 * 100) + "%",
          background: metricColor(r, metric, scale),
        },
        onClick: () => openRow(r),
      },
        mid ? h("span", { class: "tm-brand" },
          rowIcon(r, Math.round(Math.max(20, Math.min(38, fs * .62)))),
          h("span", { class: "tm-sym", style: { fontSize: fs.toFixed(1) + "px" } }, r.base)) : null,
        big ? h("span", { class: "tm-val num", style: { fontSize: Math.max(11, fs * .36).toFixed(1) + "px" } }, val) : null,
        big && metric !== "open_interest" ? h("span", { class: "tm-chg num" }, fmtPct(r.price_change_pct_24h || 0)) : null);
    })));
  }

  function renderTiles(rows, scale) {
    mount(surface, h("div", { class: "heat-grid deriv-grid" }, rows.slice(0, 96).map((r) => {
      const v = heatValue(r, metric);
      return h("button", { class: "tile deriv-tile " + textSign(v), style: { background: metricColor(r, metric, scale) }, onClick: () => openRow(r) },
        h("div", { class: "t-head" },
          rowIcon(r, 30),
          h("div", {}, h("div", { class: "t-sym" }, r.base), h("div", { class: "t-base" }, r.symbol))),
        h("div", { class: "deriv-spark", html: renderMiniLine(r, metric, 130, 34) }),
        h("div", { class: "tile-bottom" },
          h("span", { class: "t-val num" }, heatValueLabel(r, metric)),
          h("span", { class: "t-fund " + textSign(r.price_change_pct_24h) }, fmtPct(r.price_change_pct_24h || 0))));
    })));
  }

  function renderMosaic(rows, scale) {
    mount(surface, h("div", { class: "mosaic-grid deriv-mosaic" }, rows.slice(0, 96).map((r, i) => {
      const size = i < 5 ? "xl" : i < 18 ? "lg" : i < 42 ? "md" : "sm";
      const v = heatValue(r, metric);
      return h("button", { class: "tile mosaic-" + size + " deriv-tile " + textSign(v), style: { background: metricColor(r, metric, scale) }, onClick: () => openRow(r) },
        h("div", { class: "t-head" }, rowIcon(r, size === "sm" ? 20 : 30), h("div", {}, h("div", { class: "t-sym" }, r.base), size === "sm" ? null : h("div", { class: "t-base" }, r.symbol))),
        size === "sm" ? null : h("div", { class: "deriv-spark", html: renderMiniLine(r, metric, 150, 36) }),
        h("div", { class: "t-val num" }, heatValueLabel(r, metric)));
    })));
  }

  function renderBubbles(rows, scale) {
    mount(surface, h("div", { class: "bubble-wrap deriv-bubbles" }, rows.slice(0, 90).map((r) => {
      const v = heatValue(r, metric);
      const t = Math.min(1, rowWeight(r, metric) / absScale(rows.map((x) => rowWeight(x, metric))));
      const d = Math.round(48 + t * 128);
      const cls = v < 0 ? "short" : "long";
      return h("button", {
        class: "bubble deriv-bubble " + cls,
        style: { width: d + "px", height: d + "px" },
        title: `${r.symbol} · ${metricValue(r, metric)}`,
        onClick: () => openRow(r),
      },
        d > 58 ? rowIcon(r, Math.max(20, Math.min(42, Math.round(d * .25)))) : null,
        h("span", { class: "b-sym" }, r.base),
        d > 74 ? h("span", { class: "b-val num" }, heatValueLabel(r, metric)) : null);
    })));
  }

  function renderStrips(rows, scale) {
    const maxW = Math.max(...rows.slice(0, 60).map((r) => rowWeight(r, metric)), 1);
    mount(surface, h("div", { class: "strips deriv-strips" }, rows.slice(0, 60).map((r, i) => {
      const v = heatValue(r, metric);
      return h("button", { class: "strip-row deriv-strip " + textSign(v), onClick: () => openRow(r) },
        h("span", { class: "idx num" }, i + 1),
        rowIcon(r, 26),
        h("span", { class: "lb-name" }, r.base),
        h("div", { class: "strip-track" }, h("div", { class: "strip-bar", style: { width: (rowWeight(r, metric) / maxW) * 100 + "%", background: metricColor(r, metric, scale) } })),
        h("span", { class: "lb-val num strong" }, heatValueLabel(r, metric)));
    })));
  }

  function renderDetails(rows) {
    if (metric === "funding") return renderFundingDetails();
    if (metric === "open_interest") return renderOpenInterestDetails();
    if (metric === "rsi") return renderRsiDetails();
    if (metric === "long_short") return renderLongShortDetails();
    if (metric === "taker_flow") return renderTakerFlowDetails();
    if (metric === "tradfi_perps") return renderTradFiDetails(rows);
    if (["defi_tvl", "dex_volume", "fees", "stablecoins", "yields", "defi_oi", "options_volume", "bridges"].includes(metric)) return renderDefiDetails(rows);
    if (metric === "providers") return renderProviderDetails();
    if (metric === "mcap" || metric === "score" || metric === "basis") return mount(details, renderTopList(METRICS[metric].label + " watchlist", rows.slice(0, 24), METRICS[metric].note));
    return renderLiquidationDetails(rows);
  }

  function renderLiquidationDetails(rows) {
    const events = ((payload.liquidations || {}).events || []).slice(0, 24);
    const exchanges = payload.exchange_liquidations || [];
    if (!events.length && rows.some((r) => r._liqFallback)) {
      mount(details,
        h("section", { class: "deriv-panel wide deriv-liq-context" },
          h("div", { class: "sec-head" }, h("h2", {}, "Liquidation stream state"), h("span", {}, "no fake historical backfill")),
          heatNotice("No live force orders yet", "The map stays useful with real 24h perp volume and price-change color until liquidation events arrive.")),
        renderTopList("Perp volume context", rows.slice(0, 20), "Size = 24h quote volume; color = 24h move"));
      return;
    }
    mount(details,
      h("div", { class: "deriv-detail-grid" },
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Exchange liquidations"), h("span", {}, "Only real configured venues")),
          table(["Exchange", "Liquidations", "Long", "Short", "Status"], exchanges.map((e) => [
            e.exchange,
            e.liquidations == null ? "requires key" : fmtMoney(e.liquidations),
            e.long == null ? "—" : fmtMoney(e.long),
            e.short == null ? "—" : fmtMoney(e.short),
            e.status || e.source || "live",
          ]))),
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Real-time liquidations"), h("span", {}, events.length ? "latest force orders" : "waiting for stream")),
          events.length ? table(["Symbol", "Side", "Price", "Value", "Time"], events.map((e) => [
            e.symbol,
            e.direction === "long" ? "Long liquidated" : "Short liquidated",
            fmtPrice(e.price),
            fmtMoney(e.value),
            fmtTimeShort(e.ts_ms),
          ]), true) : h("div", { class: "deriv-empty" }, "No liquidation event has arrived since this server session started. Historical multi-exchange backfill needs CoinGlass API access."))),
      renderTopList("Liquidation watchlist", rows.slice(0, 16), "Live stream attaches liquidation values as they arrive"));
  }

  function renderFundingDetails() {
    const funding = payload.funding || {};
    const highs = funding.highest || [];
    const lows = funding.lowest || [];
    const rows = (funding.rows || []).slice(0, 36);
    mount(details,
      h("div", { class: "deriv-detail-grid compact" },
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Highest funding"), h("span", {}, "longs paying")),
          miniRank(highs, (r) => fmtFunding(r.funding_rate))),
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Lowest funding"), h("span", {}, "shorts paying")),
          miniRank(lows, (r) => fmtFunding(r.funding_rate)))),
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, "Funding rate matrix"), h("span", {}, "Binance public mark/funding")),
        table(["Symbol", "Mark", "Funding", "Premium", "Basis", "24h", "Volume"], rows.map((r) => [
          r.symbol,
          fmtPrice(r.mark_price || r.last_price),
          fmtFunding(r.funding_rate),
          fmtBps(r.premium_bps, true) + " bps",
          fmtBps(r.basis_bps, true) + " bps",
          fmtPct(r.price_change_pct_24h),
          fmtMoney(r.quote_volume_24h),
        ]), true)));
  }

  function renderOpenInterestDetails() {
    const oi = payload.open_interest || {};
    const hist = oi.history || [];
    const vals = hist.map((p) => p.open_interest_value || p.open_interest).filter((v) => v > 0);
    mount(details,
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, "Open interest & volume"), h("span", {}, `${oi.symbol || "BTCUSDT"} · public history`)),
        vals.length ? h("div", { class: "deriv-oi-chart", html: sparkArea(vals, 1120, 260, "#2b7de9", { dots: true, endDot: true }) }) :
          h("div", { class: "deriv-empty" }, "Open interest history is warming or unavailable from Binance right now."),
        table(["Symbol", "Open interest", "Notional", "Updated"], (oi.rows || []).slice(0, 32).map((r) => [
          r.symbol,
          Number(r.open_interest || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          fmtMoney(r.oi_notional),
          fmtTimeShort(r.time_ms),
        ]), true)));
  }

  function renderRsiDetails() {
    const rows = ((payload.rsi || {}).rows || []).slice(0, 42);
    mount(details,
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, "RSI heatmap table"), h("span", {}, "15m futures klines · RSI(14)")),
        rows.length ? table(["Symbol", "Price", "RSI", "State"], rows.map((r) => [
          r.symbol,
          fmtPrice(r.price),
          r.rsi_15m == null ? "—" : r.rsi_15m.toFixed(2),
          r.state || "neutral",
        ]), true) : h("div", { class: "deriv-empty" }, "RSI data is warming from Binance klines.")));
  }

  function renderLongShortDetails() {
    const ls = payload.long_short || {};
    const rows = (ls.rows || []).slice(0, 36);
    mount(details,
      h("div", { class: "deriv-detail-grid compact" },
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Most long crowding"), h("span", {}, ls.window_period || "public window")),
          rankRows(ls.most_long || [], (r) => `${(r.long_account_pct || 0).toFixed(1)}% long`, (r) => `ratio ${Number(r.global_ratio || 0).toFixed(2)}`, () => "up")),
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Most short crowding"), h("span", {}, "global accounts")),
          rankRows(ls.most_short || [], (r) => `${(r.short_account_pct || 0).toFixed(1)}% short`, (r) => `ratio ${Number(r.global_ratio || 0).toFixed(2)}`, () => "down"))),
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, "Long/short account ratios"), h("span", {}, ls.source || "Binance public ratios")),
        rows.length ? table(["Symbol", "Global", "Long", "Short", "Top acct", "Top pos", "Updated"], rows.map((r) => [
          r.symbol,
          Number(r.global_ratio || 0).toFixed(3),
          `${Number(r.long_account_pct || 0).toFixed(1)}%`,
          `${Number(r.short_account_pct || 0).toFixed(1)}%`,
          Number(r.top_account_ratio || 0).toFixed(3),
          Number(r.top_position_ratio || 0).toFixed(3),
          fmtTimeShort(r.time_ms),
        ]), true) : h("div", { class: "deriv-empty" }, "Long/short ratio data is warming from Binance public endpoints.")));
  }

  function renderTakerFlowDetails() {
    const flow = payload.taker_flow || {};
    const rows = (flow.rows || []).slice(0, 36);
    mount(details,
      h("div", { class: "deriv-detail-grid compact" },
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Buy pressure"), h("span", {}, flow.window_period || "public window")),
          rankRows(flow.buy_pressure || [], (r) => `${Number(r.flow_bias_pct || 0).toFixed(1)}% buy`, (r) => `buy/sell ${Number(r.buy_sell_ratio || 0).toFixed(2)}`, (r) => textSign(r.flow_bias_pct))),
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Sell pressure"), h("span", {}, "taker volume")),
          rankRows(flow.sell_pressure || [], (r) => `${Math.abs(Number(r.flow_bias_pct || 0)).toFixed(1)}% sell`, (r) => `buy/sell ${Number(r.buy_sell_ratio || 0).toFixed(2)}`, () => "down"))),
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, "Taker buy/sell volume"), h("span", {}, flow.source || "Binance public taker flow")),
        rows.length ? table(["Symbol", "Buy share", "Sell share", "Buy vol", "Sell vol", "Ratio", "Updated"], rows.map((r) => [
          r.symbol,
          `${Number(r.buy_share_pct || 0).toFixed(1)}%`,
          `${Number(r.sell_share_pct || 0).toFixed(1)}%`,
          Number(r.buy_volume || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          Number(r.sell_volume || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          Number(r.buy_sell_ratio || 0).toFixed(3),
          fmtTimeShort(r.time_ms),
        ]), true) : h("div", { class: "deriv-empty" }, "Taker flow is warming from Binance public endpoints.")));
  }

  function renderTradFiDetails(rows) {
    const byVolume = rows.slice().sort((a, b) => (b.quote_volume_24h || 0) - (a.quote_volume_24h || 0));
    const byMove = rows.slice().sort((a, b) => Math.abs(b.price_change_pct_24h || 0) - Math.abs(a.price_change_pct_24h || 0));
    mount(details,
      h("div", { class: "deriv-detail-grid" },
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Most active TradFi perps"), h("span", {}, "separate from crypto derivatives")),
          rankRows(byVolume, (r) => fmtMoney(r.quote_volume_24h || 0), (r) => `${r.underlying_type || "TRADIFI"} · ${fmtPct(r.price_change_pct_24h || 0)}`, (r) => textSign(r.price_change_pct_24h))),
        h("section", { class: "deriv-panel" },
          h("div", { class: "sec-head" }, h("h2", {}, "Largest 24h moves"), h("span", {}, "equity and commodity perps")),
          rankRows(byMove, (r) => fmtPct(r.price_change_pct_24h || 0), (r) => `${fmtPrice(r.last_price || 0)} · ${r.underlying_type || "TRADIFI"}`, (r) => textSign(r.price_change_pct_24h)))),
      renderTopList("TradFi perp contracts", rows.slice(0, 32), "These are Binance TRADIFI_PERPETUAL contracts. They are not counted inside crypto heatmaps."));
  }

  function renderDefiDetails(rows) {
    const defi = payload.defi || {};
    const sum = defi.summary || {};
    if (metric === "defi_tvl") {
      mount(details,
        h("div", { class: "deriv-summary-grid slim" },
          statCard("Tracked chain TVL", fmtMoney(sum.chain_tvl || 0), "DeFiLlama chains", "info", "globe"),
          statCard("DEX volume", fmtMoney(sum.dex_volume_24h || 0), "24h public adapter", "up", "activity"),
          statCard("Fees", fmtMoney(sum.fees_24h || 0), "24h public adapter", "info", "database"),
          statCard("Yield pools", String(sum.yield_pools || 0), "filtered non-outliers", "info", "gauge")),
        h("section", { class: "deriv-panel wide" },
          h("div", { class: "sec-head" }, h("h2", {}, "Chain TVL ranking"), h("span", {}, "click a row for DeFiLlama")),
          sourceRows(rows.slice(0, 40), (r) => fmtMoney(r.tvl), (r) => r.source || "DeFiLlama")));
      return;
    }
    if (metric === "yields") {
      mount(details,
        h("section", { class: "deriv-panel wide" },
          h("div", { class: "sec-head" }, h("h2", {}, "Yield pools"), h("span", {}, "TVL > $1M, outliers filtered")),
          sourceRows(rows.slice(0, 48), (r) => `${Number(r.apy || 0).toFixed(2)}% APY`, (r) => `${fmtMoney(r.tvl)} · ${r.chain || "chain"} · ${r.stablecoin ? "stable" : "variable"}`)));
      return;
    }
    if (metric === "stablecoins") {
      mount(details,
        h("section", { class: "deriv-panel wide" },
          h("div", { class: "sec-head" }, h("h2", {}, "Stablecoin supply board"), h("span", {}, "DeFiLlama stablecoins")),
          table(["Asset", "Supply", "Price", "Peg", "Mechanism", "Chains"], rows.slice(0, 60).map((r) => [
            r.symbol || r.name,
            fmtMoney(r.supply || 0),
            Number(r.price || 0).toFixed(4),
            r.peg_type || "—",
            r.peg_mechanism || "—",
            String((r.chains || []).length || "—"),
          ]), false)));
      return;
    }
    if (metric === "defi_oi" || metric === "options_volume" || metric === "bridges") {
      const labels = {
        defi_oi: ["Open-interest leaders", "DeFiLlama open-interest overview", sum.open_interest_24h, sum.open_interest_7d, sum.open_interest_30d, sum.open_interest_1y],
        options_volume: ["Options volume leaders", "DeFiLlama options overview", sum.options_24h, sum.options_7d, sum.options_30d, sum.options_1y],
        bridges: ["Bridge aggregator flow", "DeFiLlama bridge aggregators", sum.bridges_24h, sum.bridges_7d, sum.bridges_30d, sum.bridges_1y],
      }[metric];
      mount(details,
        h("div", { class: "deriv-summary-grid slim" },
          statCard("24h", fmtMoney(labels[2] || 0), labels[1], "info", "database"),
          statCard("7d", fmtMoney(labels[3] || 0), "larger timeframe", "info", "barChart"),
          statCard("30d", fmtMoney(labels[4] || 0), "larger timeframe", "info", "activity"),
          statCard("1y", fmtMoney(labels[5] || 0), "where provider reports it", "info", "gauge")),
        h("section", { class: "deriv-panel wide" },
          h("div", { class: "sec-head" }, h("h2", {}, labels[0]), h("span", {}, "click a row for DeFiLlama")),
          sourceRows(rows.slice(0, 48), (r) => fmtMoney(r.total24h || r.total7d || r.total30d || r.total1y || 0), (r) => `${fmtMoney(r.total7d || 0)} 7d · ${fmtMoney(r.total30d || 0)} 30d · ${fmtMoney(r.total1y || 0)} 1y`)));
      return;
    }
    const title = metric === "fees" ? "Fees and revenue leaders" : "DEX volume leaders";
    const subtitle = metric === "fees" ? "DeFiLlama fees adapters" : "DeFiLlama DEX adapters";
    const totals = metric === "fees"
      ? [sum.fees_24h, sum.fees_7d, sum.fees_30d, sum.fees_1y]
      : [sum.dex_volume_24h, sum.dex_volume_7d, sum.dex_volume_30d, sum.dex_volume_1y];
    mount(details,
      h("div", { class: "deriv-summary-grid slim" },
        statCard("24h", fmtMoney(totals[0] || 0), subtitle, "info", "database"),
        statCard("7d", fmtMoney(totals[1] || 0), "larger timeframe", "info", "barChart"),
        statCard("30d", fmtMoney(totals[2] || 0), "larger timeframe", "info", "activity"),
        statCard("1y", fmtMoney(totals[3] || 0), "where provider reports it", "info", "gauge")),
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, title), h("span", {}, "click a row for DeFiLlama")),
        sourceRows(rows.slice(0, 48), (r) => fmtMoney(r.total24h || 0), (r) => `${fmtPct(r.change_1d_pct || 0)} 1d · ${fmtMoney(r.total7d || 0)} 7d · ${fmtMoney(r.total30d || 0)} 30d`)));
  }

  function renderProviderDetails() {
    const rows = ((payload.provider_map || {}).coinglass || []).map(normalizeProviderRow);
    mount(details,
      h("section", { class: "deriv-panel wide" },
        h("div", { class: "sec-head" }, h("h2", {}, "Provider-gated surfaces"), h("span", {}, "visible, disabled until credentials exist")),
        h("div", { class: "provider-card-grid" }, rows.map((r) =>
          h("button", { class: "provider-card", onClick: () => openRow(r) },
            h("div", { class: "provider-card-top" }, icon("database"), h("b", {}, r.surface), h("span", {}, r.status)),
            h("h3", {}, r.name),
            h("p", {}, r.detail),
            h("div", { class: "provider-timeframes" }, (r.timeframes || []).map((t) => h("span", {}, t))))))));
  }

  function renderTopList(title, rows, note) {
    const items = rows.map((r, i) => h("button", { class: "deriv-row", onClick: () => openRow(r) },
      h("span", { class: "idx num" }, i + 1),
      rowIcon(r, 28),
      h("span", { class: "name" }, r.base, h("small", {}, r.symbol)),
      h("span", { class: "num strong" }, heatValueLabel(r, metric)),
      h("span", { class: textSign(r.price_change_pct_24h) }, fmtPct(r.price_change_pct_24h || 0))));
    return h("section", { class: "deriv-panel wide" },
      h("div", { class: "sec-head" }, h("h2", {}, title), h("span", {}, note)),
      h("div", { class: "deriv-row-list" }, items));
  }

  function rankRows(rows, valueFn, subFn, classFn) {
    return h("div", { class: "mini-rank" }, rows.slice(0, 8).map((r) =>
      h("button", { class: "mini-rank-row", onClick: () => openRow(r) },
        rowIcon(r, 24),
        h("span", {}, r.base || baseOf(r.symbol), h("small", {}, subFn ? subFn(r) : r.symbol)),
        h("b", { class: classFn ? classFn(r) : "" }, valueFn(r)))));
  }

  function sourceRows(rows, valueFn, subFn) {
    return h("div", { class: "deriv-row-list source-row-list" }, rows.map((r, i) =>
      h("button", { class: "deriv-row source-row", onClick: () => openRow(r) },
        h("span", { class: "idx num" }, i + 1),
        rowIcon(r, 28),
        h("span", { class: "name" }, r.base || r.name || r.symbol, h("small", {}, subFn ? subFn(r) : r.source || "")),
        h("span", { class: "num strong" }, valueFn(r)),
        h("span", { class: "source-link-hint" }, r.url ? "Open" : ""))));
  }

  function miniRank(rows, fmt) {
    const items = rows.slice(0, 6).map((r) => h("button", { class: "mini-rank-row", onClick: () => navigate("/symbol/" + r.symbol) },
      tokenIcon(r.symbol, 24),
      h("span", {}, r.base || baseOf(r.symbol), h("small", {}, r.symbol)),
      h("b", { class: textSign(r.funding_rate) }, fmt(r))));
    return h("div", { class: "mini-rank" }, items);
  }

  function table(cols, rows, clickable = false) {
    return h("div", { class: "table-scroll deriv-table-scroll" },
      h("table", { class: "deriv-table" },
        h("thead", {}, h("tr", {}, cols.map((c) => h("th", {}, c)))),
        h("tbody", {}, rows.map((r) => {
          const sym = String(r[0] || "");
          return h("tr", { onClick: clickable && sym.includes("USDT") ? () => navigate("/symbol/" + sym) : null },
            r.map((c, i) => h("td", { class: i > 0 ? "num" : "" },
              i === 0 && sym.includes("USDT") ? h("span", { class: "symbol-cell" }, tokenIcon(sym, 22), h("span", {}, baseOf(sym), h("small", {}, sym))) : c)));
        }))));
  }

  const timer = setInterval(load, 15000);
  cleanups.push(() => clearInterval(timer));
  return () => cleanups.forEach((fn) => fn());
}
