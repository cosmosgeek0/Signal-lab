// Asset page — full asset profile with real market data.
// Price/Volume/Market-cap charts use REAL CoinGecko market_chart history for
// any coin (24h…all windows); Basis/Funding/Spread use local Binance history.
// Overview · Price · Basis · Funding · Spread · Market stats · News · Quality.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon, starIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { linkTo, isStarred, toggleStar, getTheme } from "../lib/store.js";
import {
  baseOf, quoteOf, fmtPrice, fmtMoney, fmtBps, fmtBasisVal, basisUnit, fmtFunding,
  fmtScore, fmtAge, fmtPct, signClass, fmtTimeShort, fmtDateTime, fmtCompact,
} from "../lib/format.js";
import { renderChart } from "../lib/chart.js";
import { countUp } from "../lib/motion.js";

const TABS = [
  { id: "overview", label: "Overview", chart: "price" },
  { id: "price", label: "Price", chart: "price" },
  { id: "basis", label: "Basis", chart: "basis" },
  { id: "funding", label: "Funding", chart: "funding" },
  { id: "spread", label: "Spread", chart: "spread" },
  { id: "stats", label: "Market stats", chart: null },
  { id: "news", label: "News", chart: null },
  { id: "quality", label: "Quality", chart: null },
];
const LOCAL_WINDOWS = ["5m", "15m", "1h", "4h", "24h", "7d", "all"];
const EXT_WINDOWS = [["24h", "1"], ["7d", "7"], ["30d", "30"], ["90d", "90"], ["1y", "365"], ["all", "max"]];
const PRICE_SERIES = [["price", "Price"], ["volume", "Volume"], ["mcap", "Mkt cap"]];

const chartSrcPref = () => { try { return localStorage.getItem("cg-chartsrc") || "native"; } catch (e) { return "native"; } };
const setChartSrcPref = (v) => { try { localStorage.setItem("cg-chartsrc", v); } catch (e) {} };

export function renderSymbol(root, symbol) {
  const params = new URLSearchParams(location.search);
  let tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  let win = "1h";              // local windows (basis/funding/spread + fallback)
  let extWin = "24h";          // external windows (real price history)
  let priceSeries = "price";   // price | volume | mcap
  let chartSrc = chartSrcPref(); // native | tv (TradingView widget)
  let history = [];            // local Binance rows
  let extCache = {};           // days -> {prices, volumes, mcaps}
  let latest = null;
  let coin = null;
  let news = null;
  const cleanups = [];
  const base = baseOf(symbol), quote = quoteOf(symbol) || "USDT";

  // ---- header ----
  const starBtn = h("button", { class: "icon-btn", title: "Watch", onClick: () => { toggleStar(symbol); paintStar(); } });
  const nameEl = h("div", { class: "detail-name" }, base);
  const subEl = h("div", { class: "detail-sub" }, `${base}/${quote} · Binance spot & USD-M perp`);
  const iconSlot = h("span", {}, tokenIcon(symbol, 48));
  const srcBadges = h("div", { class: "src-badges" });

  // ---- price-first headline ----
  const hlVal = h("span", { class: "headline-val num" }, "—");
  const hlUnit = h("span", { class: "headline-unit" }, quote);
  const hl24 = h("span", { class: "hl-chip num", style: { display: "none" } });
  const hlBasis = h("span", { class: "hl-chip num" });
  const hlFund = h("span", { class: "hl-chip muted-chip num" });
  const headline = h("div", { class: "headline" }, hlVal, hlUnit, hl24, hlBasis, hlFund);

  function paintHeadline() {
    const px = coin && coin.price != null ? Number(coin.price) : latest ? Number(latest.spot_mid) : null;
    if (px != null) countUp(hlVal, px, fmtPrice);
    if (coin && coin.chg24h != null) {
      hl24.style.display = "";
      hl24.className = "hl-chip num " + signClass(coin.chg24h);
      hl24.textContent = (coin.chg24h >= 0 ? "↗ " : "↘ ") + fmtPct(coin.chg24h) + " · 24h";
    }
    if (latest) {
      const b = Number(latest.mid_spread_bps || 0);
      hlBasis.className = "hl-chip num " + signClass(b);
      hlBasis.textContent = "basis " + fmtBasisVal(b, true) + " " + basisUnit();
      hlFund.textContent = fmtFunding(latest.funding_rate) + " funding";
    } else {
      hlBasis.textContent = coin && coin.kind === "stock" ? "tokenized equity" : "no Binance pair tracked";
      hlBasis.className = "hl-chip num muted-chip";
      hlFund.textContent = "";
    }
  }

  // ---- tabs ----
  const tabBar = h("div", { class: "atabs", role: "tablist" });
  function buildTabs() {
    mount(tabBar, TABS.map((t) =>
      h("button", { class: "atab" + (t.id === tab ? " on" : ""), role: "tab", onClick: () => setTab(t.id) }, t.label)));
  }
  function setTab(id) {
    tab = id;
    const url = new URL(location.href);
    url.searchParams.set("tab", id);
    try { window.history.replaceState({}, "", url.pathname + url.search); } catch (e) {}
    buildTabs();
    paintBody(true);
  }

  const chartModeOf = () => (TABS.find((t) => t.id === tab) || TABS[0]).chart;
  const isPriceTab = () => chartModeOf() === "price";
  const extAvailable = () => !!(coin && coin.id);
  const isStock = () => !!(coin && coin.kind === "stock");

  // ---- chart shell ----
  const winSeg = h("div", { class: "win" });
  const seriesSeg = h("div", { class: "seg", style: { display: "none" } });
  const srcSeg = h("div", { class: "seg", style: { display: "none" } });
  const chartMeta = h("div", { class: "chart-meta" });
  const chartBody = h("div", { class: "chart-body" });
  const chartShell = h("div", { class: "chart-shell" },
    h("div", { class: "chart-head" }, seriesSeg, srcSeg, chartMeta, h("div", { class: "spacer" }), winSeg),
    chartBody);

  function buildChartControls() {
    // windows
    if (isPriceTab() && extAvailable()) {
      mount(winSeg, EXT_WINDOWS.map(([label]) => h("button", { class: label === extWin ? "on" : "", onClick: () => {
        extWin = label; buildChartControls(); loadExt(true);
      } }, label)));
    } else {
      mount(winSeg, LOCAL_WINDOWS.map((w) => h("button", { class: w === win ? "on" : "", onClick: () => {
        win = w; hadHistory = false; buildChartControls(); loadHistory(true);
      } }, w)));
    }
    // price series picker (only with real external data)
    if (isPriceTab() && extAvailable() && chartSrc === "native") {
      seriesSeg.style.display = "";
      mount(seriesSeg, PRICE_SERIES.map(([id, label]) => h("button", { class: id === priceSeries ? "on" : "", onClick: () => {
        priceSeries = id; buildChartControls(); drawChart(true);
      } }, label)));
    } else seriesSeg.style.display = "none";
    // chart source toggle (native SVG vs TradingView widget). Tokenized stocks
    // stay native: their real history lives here; TV has no BINANCE pair.
    if (isStock() && chartSrc === "tv") chartSrc = "native";
    if (isPriceTab() && !isStock()) {
      srcSeg.style.display = "";
      mount(srcSeg,
        h("button", { class: chartSrc === "native" ? "on" : "", onClick: () => { chartSrc = "native"; setChartSrcPref("native"); buildChartControls(); drawChart(true); } }, "Chart"),
        h("button", { class: chartSrc === "tv" ? "on" : "", onClick: () => { chartSrc = "tv"; setChartSrcPref("tv"); buildChartControls(); drawChart(false); } }, "TradingView"));
    } else srcSeg.style.display = "none";
  }

  // ---- series ----
  function downsample(points, maxN) {
    const n = points.length;
    if (n <= maxN) return points;
    const bucket = n / maxN;
    const out = [];
    for (let i = 0; i < maxN; i++) {
      const s = Math.floor(i * bucket);
      const e = Math.max(s + 1, Math.min(n, Math.floor((i + 1) * bucket)));
      let tv = 0, vv = 0, c = 0;
      for (let j = s; j < e; j++) { tv += points[j].t; vv += points[j].v; c++; }
      if (c) out.push({ t: tv / c, v: vv / c });
    }
    out[out.length - 1] = points[n - 1];
    return out;
  }
  function localSeries() {
    const m = chartModeOf();
    let map;
    if (m === "price") map = (r) => r.spot_mid;
    else if (m === "funding") map = (r) => (r.funding_rate || 0) * 100;
    else if (m === "spread") map = (r) => (r.spot_spread_bps || 0) + (r.futures_spread_bps || 0);
    else map = (r) => r.mid_spread_bps || 0;
    const pts = history.map((r) => ({ t: r.ts_ms, v: Number(map(r)) })).filter((p) => isFinite(p.v) && p.t);
    return downsample(pts, 260);
  }
  function extSeries() {
    const days = (EXT_WINDOWS.find(([l]) => l === extWin) || EXT_WINDOWS[0])[1];
    const data = extCache[days];
    if (!data) return null;
    const src = priceSeries === "volume" ? data.volumes : priceSeries === "mcap" ? data.mcaps : data.prices;
    return (src || []).map(([t, v]) => ({ t, v: Number(v) })).filter((p) => isFinite(p.v));
  }

  function drawChart(animate = false) {
    if (!chartModeOf()) return;
    // TradingView widget mode (crypto pairs only — stocks stay native)
    if (isPriceTab() && chartSrc === "tv" && !isStock()) {
      const tvSymbol = latest ? "BINANCE%3A" + symbol : encodeURIComponent(base + "USD");
      const theme = getTheme() === "dark" ? "dark" : "light";
      mount(chartBody, h("iframe", {
        src: `https://s.tradingview.com/widgetembed/?symbol=${tvSymbol}&interval=60&theme=${theme}&style=1&locale=en&hidesidetoolbar=1&symboledit=0&saveimage=0&withdateranges=1`,
        style: { width: "100%", height: "460px", border: "0", display: "block" },
        loading: "lazy", allow: "fullscreen",
        title: "TradingView chart",
      }));
      mount(chartMeta, "TradingView widget · live · binance feed");
      return;
    }
    let useExt = isPriceTab() && extAvailable();
    let series = useExt ? (extSeries() || []) : localSeries();
    let extFellBack = false;
    if (useExt && !series.length) {
      // provider slow/rate-limited: fall back to local Binance history when the
      // pair is tracked; otherwise show an honest retrying state — NEVER stuck
      const localS = localSeries();
      if (localS.length >= 2) { series = localS; useExt = false; extFellBack = true; }
      else {
        mount(chartBody, h("div", { class: "chart-empty", style: { height: "430px" } },
          "History provider is rate-limited — retrying automatically…"));
        mount(chartMeta, "source: coingecko · retrying every 12s");
        return;
      }
    }
    const m = chartModeOf();
    const up = series.length >= 2 && series[series.length - 1].v >= series[0].v;
    winSeg.classList.remove("pos", "neg");
    winSeg.classList.add(up ? "pos" : "neg");
    const wide = useExt ? ["7d", "30d", "90d", "1y", "all"].includes(extWin) : ["24h", "7d", "all"].includes(win);
    const timeFmt = wide
      ? (t) => { const d = new Date(t); return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]} ${d.getUTCDate()}`; }
      : fmtTimeShort;
    let color = up ? "var(--up)" : "var(--down)";
    let valueFmt, axisFmt, zeroLine = false;
    if (m === "price") {
      if (priceSeries === "volume" && useExt) { valueFmt = (v) => fmtMoney(v); axisFmt = fmtMoney; color = "var(--muted)"; }
      else if (priceSeries === "mcap" && useExt) { valueFmt = (v) => fmtMoney(v); axisFmt = fmtMoney; }
      else { valueFmt = (v) => fmtPrice(v) + (useExt ? "" : " " + quote); axisFmt = fmtPrice; }
    }
    else if (m === "funding") { valueFmt = (v) => v.toFixed(4) + "%"; axisFmt = (v) => v.toFixed(3) + "%"; zeroLine = true; color = (series.at(-1)?.v ?? 0) >= 0 ? "var(--up)" : "var(--down)"; }
    else if (m === "spread") { valueFmt = (v) => fmtBps(v) + " bps"; axisFmt = (v) => fmtBps(v); color = "var(--muted)"; }
    else { valueFmt = (v) => fmtBps(v, true) + " bps"; axisFmt = (v) => fmtBps(v); zeroLine = true; color = (series.at(-1)?.v ?? 0) >= 0 ? "var(--up)" : "var(--down)"; }
    renderChart(chartBody, series, {
      color, valueFmt, axisFmt, zeroLine, timeFmt, tipTimeFmt: fmtDateTime,
      height: 430, dotted: true, animate,
    });
    if (useExt) {
      mount(chartMeta, h("span", { class: "num" },
        `source: coingecko · real market data · ${series.length} pts · ${extWin}`));
    } else if (extFellBack) {
      mount(chartMeta, h("span", { class: "num" },
        `external history rate-limited · showing binance local (${series.length} pts) · retrying`));
    } else {
      const raw = history.length;
      const last = latest ? fmtAge(latest.age_seconds) + " ago" : "—";
      mount(chartMeta, h("span", { class: "num" },
        raw ? `source: binance local · ${raw} raw pts → ${series.length} plotted · updated ${last}`
            : "no local history — Binance pair not tracked"));
    }
  }

  // ---- panels (unchanged content, honest states) ----
  const kv = (k, v, cls) => h("div", { class: "kv" },
    h("div", { class: "k" }, k), h("div", { class: "v num " + (cls || "") }, v));

  function panelMarketStats() {
    const grid = h("div", { class: "kv-grid" });
    if (!coin) mount(grid, h("div", { class: "muted" }, "External sources have no profile for this asset."));
    else mount(grid,
      kv("Market cap", fmtMoney(coin.mcap)), kv("24h volume", fmtMoney(coin.volume)),
      kv("Rank", "#" + (coin.rank ?? "—")),
      kv("Circulating", coin.supply != null ? fmtCompact(coin.supply) + " " + base : "—"),
      kv("ATH", fmtPrice(coin.ath)), kv("From ATH", coin.ath_change_pct != null ? fmtPct(coin.ath_change_pct) : "—", signClass(coin.ath_change_pct)));
    return h("section", { class: "apanel" }, h("h3", {}, "Market stats"), grid);
  }
  function panelPerformance() {
    const wrap = h("div", { class: "perf-chips" });
    const chip = (label, v) => h("div", { class: "perf-chip" },
      h("div", { class: "k" }, label),
      h("div", { class: "v num " + signClass(v) }, v != null ? (v >= 0 ? "↗ " : "↘ ") + fmtPct(v) : "—"));
    if (coin) mount(wrap, chip("1h", coin.chg1h), chip("24h", coin.chg24h), chip("7d", coin.chg7d), chip("30d", coin.chg30d));
    else mount(wrap, h("div", { class: "muted" }, "No external performance data."));
    return h("section", { class: "apanel" }, h("h3", {}, "Performance"), wrap);
  }
  function panelAbout() {
    const grid = h("div", { class: "kv-grid" });
    mount(grid,
      kv("Asset", coin ? coin.name : base),
      kv("24h range", coin && coin.low_24h != null ? fmtPrice(coin.low_24h) + " – " + fmtPrice(coin.high_24h) : "—"),
      kv("Total supply", coin && coin.total_supply != null ? fmtCompact(coin.total_supply) : "—"),
      kv("Source", coin ? "CoinGecko · cached" : "Binance only"));
    return h("section", { class: "apanel" }, h("h3", {}, "About " + base), grid);
  }
  function panelSnapshot() {
    const grid = h("div", { class: "kv-grid" });
    const r = latest;
    if (!r) mount(grid, h("div", { class: "muted" }, "No live Binance pair for this asset."));
    else mount(grid,
      kv("Spot mid", fmtPrice(r.spot_mid)), kv("Perp mid", fmtPrice(r.futures_mid)),
      kv("Basis", fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), signClass(r.mid_spread_bps)),
      kv("Funding / 8h", fmtFunding(r.funding_rate), signClass(r.funding_rate)),
      kv("Spot spread", fmtBps(r.spot_spread_bps) + " bps"), kv("Perp spread", fmtBps(r.futures_spread_bps) + " bps"),
      kv("Feed age", fmtAge(r.age_seconds)), kv("Score", fmtScore(r.opportunity_score)));
    return h("section", { class: "apanel" }, h("h3", {}, "Binance snapshot"), grid);
  }
  function panelLadder() {
    const wrap = h("div", { class: "ladder" });
    const r = latest;
    if (!r) mount(wrap, h("div", { class: "muted", style: { padding: "8px 0" } }, "No order data."));
    else {
      const lrow = (k, v, side, w) => h("div", { class: "ladder-row" },
        h("span", { class: "bar " + side, style: { width: w + "%" } }),
        h("span", { class: "k" }, k), h("span", { class: "v num" }, v));
      mount(wrap,
        lrow("Perp ask", fmtPrice(r.fut_ask), "ask", 58), lrow("Perp bid", fmtPrice(r.fut_bid), "ask", 40),
        h("div", { class: "ladder-mid" }, fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit() + " basis"),
        lrow("Spot ask", fmtPrice(r.spot_ask), "bid", 40), lrow("Spot bid", fmtPrice(r.spot_bid), "bid", 58));
    }
    return h("section", { class: "apanel" }, h("h3", {}, "Basis ladder"), wrap);
  }
  function panelExtremes(metric) {
    const wrap = h("div", { class: "xlist" });
    if (!history.length) mount(wrap, h("div", { class: "muted", style: { padding: "8px 0" } }, "No local history in this window."));
    else {
      let hiB = history[0], loB = history[0], hiF = history[0], loF = history[0];
      for (const r of history) {
        if ((r.mid_spread_bps || 0) > (hiB.mid_spread_bps || 0)) hiB = r;
        if ((r.mid_spread_bps || 0) < (loB.mid_spread_bps || 0)) loB = r;
        if ((r.funding_rate || 0) > (hiF.funding_rate || 0)) hiF = r;
        if ((r.funding_rate || 0) < (loF.funding_rate || 0)) loF = r;
      }
      const xrow = (k, ts, v, cls) => h("div", { class: "xrow" },
        h("div", {}, h("div", { class: "k" }, k), h("div", { class: "t num" }, fmtTimeShort(ts) + " UTC")),
        h("span", { class: "v num " + cls }, v));
      const rows = metric === "funding"
        ? [xrow("Peak funding", hiF.ts_ms, fmtFunding(hiF.funding_rate), "up"),
           xrow("Trough funding", loF.ts_ms, fmtFunding(loF.funding_rate), "down")]
        : [xrow("Widest basis", hiB.ts_ms, fmtBps(hiB.mid_spread_bps, true) + " bps", "up"),
           xrow("Deepest basis", loB.ts_ms, fmtBps(loB.mid_spread_bps, true) + " bps", "down"),
           xrow("Peak funding", hiF.ts_ms, fmtFunding(hiF.funding_rate), "up"),
           xrow("Trough funding", loF.ts_ms, fmtFunding(loF.funding_rate), "down")];
      mount(wrap, rows);
    }
    return h("section", { class: "apanel" }, h("h3", {}, "Recent extremes"), wrap);
  }
  function panelPriceHistory() {
    const wrap = h("div", { class: "xlist" });
    const days = (EXT_WINDOWS.find(([l]) => l === extWin) || EXT_WINDOWS[0])[1];
    const ext = extCache[days];
    const src = ext && ext.prices && ext.prices.length >= 2
      ? ext.prices.map(([t, v]) => ({ t, v }))
      : history.map((r) => ({ t: r.ts_ms, v: r.spot_mid })).filter((p) => p.v > 0);
    const pts = downsample(src, 12);
    if (pts.length < 2) mount(wrap, h("div", { class: "muted", style: { padding: "8px 0" } }, "Not enough points."));
    else mount(wrap, pts.slice().reverse().map((p, i, arr) => {
      const prev = arr[i + 1];
      const d = prev ? ((p.v - prev.v) / prev.v) * 100 : null;
      return h("div", { class: "xrow" },
        h("div", {}, h("div", { class: "k num" }, fmtPrice(p.v)), h("div", { class: "t num" }, fmtDateTime(p.t))),
        h("span", { class: "v num " + signClass(d) }, d != null ? fmtPct(d) : "—"));
    }));
    return h("section", { class: "apanel" }, h("h3", {}, "Price history"), wrap);
  }
  function panelNews() {
    const wrap = h("div", {});
    if (!news) mount(wrap, h("div", { class: "muted" }, "Loading headlines…"));
    else {
      const name = (coin && coin.name || base).toLowerCase();
      const rel = (news.items || []).filter((it) =>
        it.title.toLowerCase().includes(name) || it.title.toUpperCase().includes(base));
      const items = rel.length ? rel : (news.items || []);
      if (!items.length) {
        mount(wrap, h("div", { class: "ghost-tile" }, icon("info"),
          h("div", {},
            h("div", { class: "gt-title" }, "No headlines available"),
            h("div", { class: "gt-sub" }, "News sources: RSS (Cointelegraph, Decrypt) + GDELT — all retrying. Headlines are never fabricated.")),
          h("span", { class: "gt-badge" }, news.status || "unavailable")));
      } else {
        mount(wrap,
          rel.length ? null : h("div", { class: "sec-note", style: { marginBottom: "10px" } },
            "No " + base + "-specific headlines — showing market-wide news."),
          h("div", { class: "pulse-grid" }, items.slice(0, 8).map((it) =>
            h("a", { class: "pulse-card", href: it.url, target: "_blank", rel: "noopener noreferrer" },
              h("div", { class: "pc-title" }, it.title),
              h("div", { class: "pc-meta" }, h("span", {}, it.domain || "source"),
                h("span", { class: "num" }, it.time ? it.time.replace("T", " ").replace("Z", " UTC") : ""))))));
      }
    }
    return h("section", { class: "apanel", style: { borderLeft: "0", paddingLeft: "2px" } },
      h("h3", {}, "News · " + base), wrap);
  }
  function panelQuality() {
    const grid = h("div", { class: "kv-grid" });
    const r = latest;
    mount(grid,
      kv("Binance pair", r ? symbol + " · live" : "not tracked", r ? "up" : ""),
      kv("Feed age", r ? fmtAge(r.age_seconds) : "—"),
      kv("Snapshot age", r ? fmtAge(r.snapshot_age_seconds) : "—"),
      kv("Status", r ? r.status : "—", r && r.status === "LIVE" ? "up" : ""),
      kv("Combined spread", r ? fmtBps((r.spot_spread_bps || 0) + (r.futures_spread_bps || 0)) + " bps" : "—"),
      kv("Local history pts", String(history.length)),
      kv("External profile", coin ? "CoinGecko · cached" : "none"),
      kv("Real chart history", extAvailable() ? "coingecko market_chart" : "unavailable"));
    return h("section", { class: "apanel" }, h("h3", {}, "Data quality"), grid);
  }

  // ---- tab body ----
  const body = h("div", {});
  function paintBody(animateChart = false) {
    buildChartControls();
    const rows3 = (a, b, c) => h("div", { class: "asset-panels" }, a, b, c);
    if (chartModeOf()) {
      const below =
        tab === "basis" ? rows3(panelSnapshot(), panelLadder(), panelExtremes("basis"))
        : tab === "funding" ? rows3(panelSnapshot(), panelExtremes("funding"), panelQuality())
        : tab === "spread" ? rows3(panelSnapshot(), panelLadder(), panelQuality())
        : tab === "price" ? rows3(panelPriceHistory(), panelPerformance(), panelMarketStats())
        : rows3(panelMarketStats(), panelPerformance(), panelAbout()); // overview
      const extra = tab === "overview" ? rows3(panelSnapshot(), panelLadder(), panelExtremes("basis")) : null;
      mount(body, chartShell, below, extra);
      if (isPriceTab() && extAvailable()) loadExt(animateChart);
      else drawChart(animateChart);
    } else if (tab === "stats") {
      mount(body, rows3(panelMarketStats(), panelPerformance(), panelAbout()),
        rows3(panelSnapshot(), panelLadder(), panelQuality()));
    } else if (tab === "news") {
      mount(body, h("div", { class: "asset-panels", style: { gridTemplateColumns: "1fr" } }, panelNews()));
      if (!news) loadNews();
    } else if (tab === "quality") {
      mount(body, rows3(panelQuality(), panelSnapshot(), panelAbout()));
    }
  }

  // ---- assemble ----
  const page_ = h("div", { class: "page" },
    h("div", { class: "container page-wide" },
      h("a", { class: "back-link", href: "/", onClick: linkTo("/") }, icon("arrowLeft"), "Markets"),
      h("div", { class: "detail-top" },
        h("div", { class: "detail-id" }, iconSlot, h("div", {}, nameEl, subEl)),
        h("div", { class: "detail-head-actions" }, srcBadges, starBtn)),
      headline,
      tabBar,
      body));
  mount(root, page_);
  buildTabs(); paintStar(); paintBody(true);

  function paintStar() { starBtn.replaceChildren(starIcon(isStarred(symbol))); }
  function paintBadges(p) {
    const badges = [h("span", { class: "src-badge" + (p && p.row ? " ok" : "") }, "Binance " + (p && p.row ? "live" : "n/a"))];
    if (coin) badges.push(h("span", { class: "src-badge ok" }, "CoinGecko #" + (coin.rank ?? "—")));
    mount(srcBadges, badges);
  }
  function paintProfileHeader() {
    if (!coin) return;
    mount(iconSlot, tokenIcon(base, 48));
    mount(nameEl, coin.name, h("span", { class: "detail-ticker" }, base));
    if (coin.kind === "stock") hlUnit.textContent = "USD";
    mount(subEl, coin.kind === "stock"
      ? `${base} · tokenized equity — on-chain token tracking the listed company`
      : `${base}/${quote} · rank #${coin.rank ?? "—"} · Binance spot & USD-M perp`);
  }

  // ---- data ----
  async function loadLatest() {
    try {
      const res = await api.symbol(symbol);
      if (res && res.row) { latest = res.row; paintHeadline(); }
    } catch (e) {}
  }
  let hadHistory = false;
  async function loadHistory(animate = false) {
    try {
      const res = await api.history(symbol, win);
      history = res.rows || [];
      if (chartModeOf() && !(isPriceTab() && (extAvailable() || chartSrc === "tv"))) {
        drawChart(animate);
      }
      if (!hadHistory && history.length && chartModeOf()) { hadHistory = true; paintBody(false); }
    } catch (e) {}
  }
  let extRetryTimer = null;
  async function loadExt(animate = false) {
    const days = (EXT_WINDOWS.find(([l]) => l === extWin) || EXT_WINDOWS[0])[1];
    if (extCache[days]) { drawChart(animate); return; }
    clearTimeout(extRetryTimer);
    try {
      const res = await api.coinHistory(base, days);
      if (res && res.status === "live" && (res.prices || []).length >= 2) {
        extCache[days] = { prices: res.prices, volumes: res.volumes, mcaps: res.mcaps };
        // trending coins outside the top-100 have no list price — take the
        // real last chart point so the headline is never a dash
        if ((!coin || coin.price == null) && !latest) {
          const last = res.prices[res.prices.length - 1];
          if (last && isFinite(last[1])) countUp(hlVal, Number(last[1]), fmtPrice);
        }
      }
    } catch (e) {}
    drawChart(animate);
    if (!extCache[days] && isPriceTab() && chartSrc !== "tv") {
      extRetryTimer = setTimeout(() => loadExt(false), 12000);  // self-heal
    }
    if (tab === "price") paintBody(false); // price-history panel uses ext data
  }
  async function loadProfile() {
    try {
      const p = await api.coinProfile(symbol);
      const hadCoin = !!coin;
      if (p && p.coin) { coin = p.coin; paintProfileHeader(); paintHeadline(); }
      paintBadges(p);
      // first profile load unlocks real chart history → rebuild chart controls
      if (!hadCoin && coin && isPriceTab()) paintBody(true);
      else if (!hadCoin && coin) paintBody(false);
    } catch (e) {}
  }
  async function loadNews() {
    try { news = await api.newsContext(); if (tab === "news") paintBody(false); } catch (e) {}
  }

  loadLatest(); loadHistory(true); loadProfile();
  const t1 = setInterval(loadLatest, 3000);
  const t2 = setInterval(() => { if (chartModeOf()) loadHistory(false); }, 30000);
  const t3 = setInterval(loadProfile, 120000);
  let rz;
  const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { if (chartModeOf() && chartSrc !== "tv") drawChart(false); }, 120); };
  window.addEventListener("resize", onResize);
  cleanups.push(() => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearTimeout(extRetryTimer); window.removeEventListener("resize", onResize); });

  return () => cleanups.forEach((c) => c());
}
