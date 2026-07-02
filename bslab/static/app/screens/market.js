// Market — the landing page, rebuilt as a true market overview.
// Order: global market cards (real external sources) → Majors → Crypto Market
// Prices (top-100 with tabs) → Market Pulse (news) → Basis & funding
// intelligence (Binance universe). Every panel is labeled with its source and
// degrades honestly when a source is down.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon, coinIcon, brandColor, onIconsReady } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { store, onLive, navigate, linkTo } from "../lib/store.js";
import { getSettings, onSettings } from "../lib/settings.js";
import {
  baseOf, fmtPrice, fmtMoney, fmtBps, fmtBasisVal, basisUnit, fmtFunding, fmtScore,
  fmtPct, signClass, fmtCompact, timeAgo,
} from "../lib/format.js";
import { sparkline, sparkArea } from "../lib/chart.js";
import { countUp } from "../lib/motion.js";
import { buildCoinsTape } from "../ui/tape.js";
import { attachPopover, popRow } from "../ui/popover.js";
import { openDetailSheet, sheetRow, sheetNote, sheetChart, sheetTitle } from "../ui/sheets.js";
import { openDataSheet } from "../ui/drawer.js";

// Card mini-charts use ONLY real history (7d aggregate mcap/dominance, F&G
// 30d, TVL 120d). Cards without an honest series show no line at all.

const TABS = [
  { id: "all", label: "All assets" },
  { id: "majors", label: "Majors" },
  { id: "stocks", label: "Stocks" },
  { id: "binance", label: "Binance-listed" },
  { id: "volume", label: "High volume" },
  { id: "gainers", label: "Top gainers" },
  { id: "losers", label: "Top losers" },
  { id: "basis", label: "Highest basis" },
  { id: "funding", label: "Highest funding" },
  { id: "stable", label: "Stablecoins" },
];
// Basis is Radar's specialty — on the Market page it only appears on the tabs
// where it IS the point (Binance-listed / basis / funding).
const BASIS_TABS = new Set(["binance", "basis", "funding"]);
const MAJOR_BASES = new Set(["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE"]);
const STABLE_BASES = new Set(["USDT", "USDC", "DAI", "FDUSD", "USDS", "USDE", "TUSD", "PYUSD", "USD1"]);

const px = (c) => (c && c.price_live != null ? c.price_live : c ? c.price : null);
const trendText = (v) => (Number(v) >= 0 ? "Rising" : "Falling");

// Clean signed move: arrow + tabular pct. No words, no pills — color carries
// the direction; a single 🔥 marks genuinely hot moves.
function moveValue(value, { hot = null } = {}) {
  if (value == null || !isFinite(Number(value))) return "—";
  const n = Number(value);
  return (n >= 0 ? "↗ " : "↘ ") + fmtPct(n) + (hot != null && n >= hot ? " 🔥" : "");
}

export function renderMarket(root) {
  let ov = null;           // /api/market-overview payload
  let sparks = {};         // binance local sparks
  let tab = "all";
  let showCount = 25;
  let news = null;
  const cleanups = [];
  const tape = buildCoinsTape();
  cleanups.push(tape.destroy);

  // Repaint governor: below-fold sections paint eagerly ONCE (so audits and
  // deep links always find real rows), then only repaint while on screen —
  // off-screen they just mark dirty and catch up when scrolled into view.
  // This is what keeps the 5s poll cheap on a long page.
  const lazyState = new Map();   // el -> { seen, painted, dirty }
  const io = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((ents) => {
        for (const e of ents) {
          const st = lazyState.get(e.target);
          if (!st) continue;
          st.seen = e.isIntersecting;
          if (st.seen && st.dirty) { const fn = st.dirty; st.dirty = null; fn(); }
        }
      }, { rootMargin: "280px 0px" })
    : null;
  cleanups.push(() => { if (io) io.disconnect(); });
  function lazyPaint(el, fn) {
    if (!io) { fn(); return; }
    let st = lazyState.get(el);
    if (!st) { st = { seen: false, painted: false, dirty: null }; lazyState.set(el, st); io.observe(el); }
    if (!st.painted || st.seen) { st.painted = true; st.dirty = null; fn(); }
    else st.dirty = fn;
  }

  // ---- market cards (every card opens a detail sheet — no dead clicks) ----
  const cards = {};
  function card(key, label) {
    const v = h("div", { class: "stat-v num" }, "—");
    const d = h("div", { class: "card-delta num" });
    const s = h("div", { class: "stat-spark" });
    const src = h("div", { class: "card-src", role: "button", title: "Source details",
      onClick: (e) => { e.stopPropagation(); openDataSheet(); } }, "—");
    cards[key] = { v, d, s, src };
    return h("div", {
      class: "stat-tile clickable", role: "button", tabindex: "0", "data-card": key,
      onClick: () => openCardDetail(key),
    }, h("div", { class: "stat-k" }, label), v, d, s, src);
  }

  function srcLine(status, source) {
    return sheetNote(`source: ${source || "—"} · ${status || "—"} · server-side cached`);
  }
  function domList(dom) {
    return Object.entries(dom || {}).map(([sym, pct]) =>
      h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + sym + "USDT") },
        h("span", { class: "lb-bar bid", style: { width: Math.min(76, pct * 1.3) + "%" } }),
        tokenIcon(sym, 22), h("span", { class: "lb-name" }, sym),
        h("span", { class: "lb-val num strong" }, Number(pct).toFixed(2) + "%")));
  }
  function coinList(coins, valFn, clsFn) {
    return coins.map((c) => h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")) },
      coinIcon(c, 22), h("span", { class: "lb-name" }, c.name),
      h("span", { class: "lb-val num " + (clsFn ? clsFn(c) : "strong") }, valFn(c))));
  }
  function openCardDetail(key) {
    if (!ov) return;
    const g = ov.global || {}, fg = ov.fear_greed || {}, st = ov.stablecoins || {}, df = ov.defi || {};
    const coins = (ov.top_coins && ov.top_coins.coins) || [];
    if (key === "uni") { navigate("/radar"); return; }
    const builders = {
      mcap: () => [
        sheetRow("Total market cap", fmtMoney(g.mcap_usd)),
        sheetRow("24h change", g.mcap_change_24h_pct != null ? fmtPct(g.mcap_change_24h_pct) : "—", signClass(g.mcap_change_24h_pct)),
        sheetRow("Active assets", fmtCompact(g.active_cryptocurrencies)),
        sheetTitle("Dominance"), ...domList(g.dominance),
        srcLine(g.status, g.source)],
      vol: () => [
        sheetRow("Global 24h volume", fmtMoney(g.volume_usd)),
        sheetRow("Vol / mcap", g.volume_usd && g.mcap_usd ? ((g.volume_usd / g.mcap_usd) * 100).toFixed(2) + "%" : "—"),
        sheetTitle("Top coins by volume"),
        ...coinList([...coins].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 8), (c) => fmtMoney(c.volume)),
        srcLine(g.status, g.source)],
      dom: () => [
        sheetRow("BTC dominance", g.btc_dominance != null ? g.btc_dominance.toFixed(2) + "%" : "—"),
        sheetRow("ETH dominance", g.eth_dominance != null ? g.eth_dominance.toFixed(2) + "%" : "—"),
        sheetTitle("Full dominance breakdown"), ...domList(g.dominance),
        srcLine(g.status, g.source)],
      dex: () => {
        const dx = ov.dex || {};
        return [
          sheetRow("DEX volume · 24h", fmtMoney(dx.total24h_usd)),
          sheetRow("1d change", dx.change_1d_pct != null ? fmtPct(dx.change_1d_pct) : "—", signClass(dx.change_1d_pct)),
          (dx.bars || []).length > 2 ? sheetChart(barsSvg((dx.bars || []).map((b) => b[1]), 340, 110), 110) : null,
          sheetNote("Aggregate spot volume across all decentralized exchanges — real daily bars."),
          srcLine(dx.status, "defillama")];
      },
      fng: () => [
        sheetRow("Fear & Greed", fg.value != null ? `${fg.value} · ${fg.label}` : "—",
          fg.value != null ? (fg.value <= 25 ? "down" : fg.value >= 75 ? "up" : "") : ""),
        (fg.history || []).length > 2
          ? sheetChart(sparkArea((fg.history || []).map((p) => p.value), 340, 110,
              fg.value <= 25 ? "var(--down)" : fg.value >= 75 ? "var(--up)" : "var(--accent)"), 110)
          : null,
        sheetRow("30d low", fg.history ? Math.min(...fg.history.map((p) => p.value)) : "—"),
        sheetRow("30d high", fg.history ? Math.max(...fg.history.map((p) => p.value)) : "—"),
        sheetNote("0–25 extreme fear · 25–45 fear · 45–55 neutral · 55–75 greed · 75–100 extreme greed."),
        srcLine(fg.status, "alternative.me")],
      stbl: () => [
        sheetRow("Stablecoin supply", fmtMoney(st.total_usd)),
        sheetRow("USDT share", st.usdt_share_pct != null ? st.usdt_share_pct.toFixed(2) + "%" : "—"),
        sheetRow("USDC share", st.usdc_share_pct != null ? st.usdc_share_pct.toFixed(2) + "%" : "—"),
        sheetTitle("Largest stablecoins"),
        ...(st.top || []).map((a) => sheetRow(a.symbol + " · " + a.name, fmtMoney(a.circulating_usd))),
        srcLine(st.status, "defillama")],
      tvl: () => [
        sheetRow("DeFi TVL", fmtMoney(df.tvl_usd)),
        (df.chart || []).length > 2 ? sheetChart(sparkArea(df.chart, 340, 110, "var(--up)"), 110) : null,
        sheetNote("Total value locked across DeFi protocols, last ~120 days."),
        srcLine(df.status, "defillama")],
    };
    const titles = {
      mcap: ["Global market cap", "globe"], vol: ["Global volume", "activity"],
      dom: ["Market dominance", "target"], dex: ["DEX volume", "activity"],
      fng: ["Fear & Greed", "gauge"], stbl: ["Stablecoins", "database"], tvl: ["DeFi TVL", "candles"],
    };
    const build = builders[key];
    const meta = titles[key] || ["Detail", "info"];
    if (build) openDetailSheet(meta[0], meta[1], () => build().filter(Boolean));
  }
  const cardsWrap = h("div", { class: "stats stats-4x2" },
    card("mcap", "Total market cap"), card("vol", "24h volume"),
    card("dom", "Dominance"), card("dex", "DEX volume"),
    card("fng", "Fear & Greed"), card("stbl", "Stablecoin supply"),
    card("tvl", "DeFi TVL"), card("uni", "Binance universe"));

  const summaryKicker = h("div", { class: "ms-kicker" }, icon("activity"), h("span", {}, "Crypto market cap"));
  const summaryValue = h("div", { class: "ms-value num" }, "—");
  const summaryDelta = h("div", { class: "ms-delta num" }, "Connecting");
  const summarySource = h("div", { class: "ms-source" }, "source: warming");
  const summaryChart = h("div", { class: "ms-chart" });
  const summaryRail = h("div", { class: "ms-rail" });
  const summaryPanel = h("section", {
    class: "market-summary",
    role: "button",
    tabindex: "0",
    onClick: () => openCardDetail("mcap"),
    onKeydown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCardDetail("mcap");
      }
    },
  },
    h("div", { class: "ms-main" },
      summaryKicker,
      h("div", { class: "ms-headline" }, summaryValue, summaryDelta),
      summaryChart,
      summarySource),
    summaryRail);

  const lensWrap = h("section", { class: "market-lens" });

  function sourceState(id) {
    return ((ov && ov.source_status) || []).find((s) => s.id === id) || {};
  }
  function statusWord(st) {
    const s = (st && st.status) || "unavailable";
    if (s === "live") return "live";
    if (s === "stale") return "stale";
    if (s === "requires_key") return "key required";
    if (s === "not_configured") return "not configured";
    return s;
  }
  function lensCell(label, value, sub, cls, ic, run, state = "live") {
    const disabled = typeof run !== "function";
    return h("button", {
      class: "lens-cell " + (cls || "") + (disabled ? " disabled" : ""),
      disabled,
      onClick: disabled ? null : run,
    },
      h("span", { class: "lens-ic" }, icon(ic || "activity")),
      h("span", { class: "lens-k" }, label),
      h("span", { class: "lens-v num" }, value || "—"),
      h("span", { class: "lens-sub" }, sub || ""),
      h("span", { class: "lens-state " + (state === "live" ? "ok" : state === "requires_key" || state === "not_configured" ? "muted" : "warn") },
        statusWord({ status: state })));
  }
  function paintLens() {
    if (!ov || binanceOnly()) { lensWrap.replaceChildren(); return; }
    const g = ov.global || {};
    const fg = ov.fear_greed || {};
    const dx = ov.dex || {};
    const df = ov.defi || {};
    const st = ov.stablecoins || {};
    const stocks = (ov.stocks && ov.stocks.items) || [];
    const newsItems = (news && news.items) || [];
    const topStock = [...stocks].sort((a, b) => Math.abs(b.chg24h || 0) - Math.abs(a.chg24h || 0))[0];
    const lead = newsItems[0];
    const cells = [
      lensCell("Crypto breadth", g.mcap_change_24h_pct != null ? `${trendText(g.mcap_change_24h_pct)} ${fmtPct(g.mcap_change_24h_pct)}` : "warming",
        g.mcap_usd != null ? `${fmtMoney(g.mcap_usd)} total cap` : "CoinGecko global", signClass(g.mcap_change_24h_pct), "globe", () => openCardDetail("mcap"), g.status),
      lensCell("Funding stress", (ov.funding_top || [])[0] ? `${baseOf(ov.funding_top[0].symbol)} ${fmtFunding(ov.funding_top[0].funding_rate)}` : "warming",
        "highest shorts-paying rate", "up", "zap", () => navigate("/funding"), "live"),
      lensCell("DEX impulse", dx.total24h_usd != null ? fmtMoney(dx.total24h_usd) : "warming",
        dx.change_1d_pct != null ? `${fmtPct(dx.change_1d_pct)} vs prior day` : "DefiLlama DEX volume", signClass(dx.change_1d_pct), "activity", () => openCardDetail("dex"), dx.status),
      lensCell("Stables float", st.total_usd != null ? fmtMoney(st.total_usd) : "warming",
        st.usdt_share_pct != null ? `USDT ${st.usdt_share_pct.toFixed(1)}% · USDC ${st.usdc_share_pct.toFixed(1)}%` : "DefiLlama stables", "", "database", () => openCardDetail("stbl"), st.status),
      lensCell("Tokenized equities", topStock ? `${topStock.base} ${fmtPct(topStock.chg24h)}` : (stocks.length ? `${stocks.length} wrappers` : "warming"),
        topStock ? `${topStock.name} · CoinGecko tokenized-stock` : "on-chain stock wrappers, not cash exchange quotes",
        topStock ? signClass(topStock.chg24h) : "", "columns", () => { tab = "stocks"; buildTabs(); paintPriceHead(); paintPrices(); stocksWrap.scrollIntoView({ behavior: "smooth", block: "start" }); }, (ov.stocks || {}).status),
      lensCell("News pulse", lead && lead.impact ? `${lead.impact} / 100` : "warming",
        lead ? `top story: ${(lead.tags || ["market"])[0]} · ${lead.domain}` : "RSS + GDELT + Lookonchain", "", "radar", () => newsRail.scrollIntoView({ behavior: "smooth", block: "start" }), (news && news.status) || "idle"),
      lensCell("DeFi TVL", df.tvl_usd != null ? fmtMoney(df.tvl_usd) : "warming",
        "DefiLlama chain/protocol TVL", "", "candles", () => openCardDetail("tvl"), df.status),
    ];
    mount(lensWrap,
      h("div", { class: "lens-head" },
        h("div", {}, h("h2", { class: "lens-title" }, "Market intelligence"), h("p", { class: "lens-copy" }, "Every tile is a live keyless source — nothing faked, nothing key-gated.")),
        h("button", { class: "mini-btn", onClick: () => openDataSheet() }, icon("database"), "Sources")),
      h("div", { class: "lens-grid" }, cells));
  }

  function summaryAction(label, value, sub, cls, ic, run) {
    return h("button", { class: "ms-action " + (cls || ""), onClick: (e) => { e.stopPropagation(); run(); } },
      h("span", { class: "ms-ic" }, icon(ic || "activity")),
      h("span", { class: "ms-label" }, label),
      h("span", { class: "ms-act-v num" }, value == null ? "—" : value),
      h("span", { class: "ms-act-sub" }, sub || ""));
  }

  function paintSummary() {
    if (!ov) return;
    const g = ov.global || {};
    const gh = ov.global_history || {};
    const fg = ov.fear_greed || {};
    const dx = ov.dex || {};
    const st = ov.stablecoins || {};
    const m = ov.metrics || {};
    summaryValue.textContent = fmtMoney(g.mcap_usd);
    const chg = Number(g.mcap_change_24h_pct);
    summaryDelta.textContent = isFinite(chg) ? `${trendText(chg)} ${fmtPct(chg)} in 24h` : "Waiting for global change";
    summaryDelta.className = "ms-delta num " + signClass(chg);
    summarySource.textContent = `source: ${g.source || "global context"} · ${g.status || "warming"} · click for dominance and breadth`;
    const series = gh.mcap || [];
    if (series.length > 6) {
      summaryChart.innerHTML = sparkArea(series, 760, 214, signClass(chg) === "down" ? "var(--down)" : "var(--up)", { dots: true, endDot: true });
    } else {
      summaryChart.innerHTML = `<div class="ms-empty">Global history is warming; live Binance basis remains available.</div>`;
    }
    const btcDom = g.btc_dominance != null ? "BTC " + Number(g.btc_dominance).toFixed(1) + "%" : "—";
    const ethDom = g.eth_dominance != null ? "ETH " + Number(g.eth_dominance).toFixed(1) + "%" : "";
    const fngCls = fg.value != null ? (fg.value <= 25 ? "down" : fg.value >= 75 ? "up" : "warn") : "";
    mount(summaryRail,
      summaryAction("Binance feed", `${m.live_symbols ?? 0}/${m.total_symbols ?? 0}`, "live pairs tracked locally", "up", "wifi", () => openDataSheet()),
      summaryAction("Dominance", btcDom, ethDom, "", "target", () => openCardDetail("dom")),
      summaryAction("DEX volume", fmtMoney(dx.total24h_usd), dx.change_1d_pct != null ? `${fmtPct(dx.change_1d_pct)} 24h` : "DefiLlama", signClass(dx.change_1d_pct), "activity", () => openCardDetail("dex")),
      summaryAction("Risk tone", fg.value != null ? `${fg.value} / 100` : "—", fg.label || "Fear & Greed", fngCls, "gauge", () => openCardDetail("fng")),
      summaryAction("Stables", fmtMoney(st.total_usd), st.usdt_share_pct != null ? `USDT ${st.usdt_share_pct.toFixed(1)}%` : "stablecoin supply", "", "database", () => openCardDetail("stbl")));
  }

  function setCard(key, value, fmt, { delta, deltaCls, spark, sparkColor, src, srcState } = {}) {
    const c = cards[key];
    if (value == null || !isFinite(Number(value))) {
      c.v.textContent = "—"; c.d.textContent = ""; c.s.innerHTML = "";
      c.src.textContent = src ? src + " · " + (srcState || "unavailable") : "source not configured";
      c.src.className = "card-src bad";
      return;
    }
    countUp(c.v, Number(value), fmt);
    c.d.textContent = delta || "";
    c.d.className = "card-delta num " + (deltaCls || "");
    if (spark && spark.length >= 6) {
      const up = spark[spark.length - 1] >= spark[0];
      // Coinbase-style dotted area + end marker — texture, not just a line
      c.s.innerHTML = sparkArea(spark, 150, 40, sparkColor || (up ? "var(--up)" : "var(--down)"), { dots: true, endDot: true });
    } else c.s.innerHTML = "";
    c.src.textContent = (src || "") + (srcState && srcState !== "live" ? " · " + srcState : "");
    c.src.className = "card-src" + (srcState === "live" ? " ok" : "");
  }

  function paintCards() {
    if (!ov) return;
    const g = ov.global || {};
    const gh = ov.global_history || {};
    const fg = ov.fear_greed || {};
    const st = ov.stablecoins || {};
    const df = ov.defi || {};
    const m = ov.metrics || {};
    if (g.mcap_usd != null) {
      const chg = Number(g.mcap_change_24h_pct);
      setCard("mcap", g.mcap_usd, fmtMoney, {
        delta: isFinite(chg) ? (chg >= 0 ? "↗ " : "↘ ") + fmtPct(chg) + " · 24h" : "",
        deltaCls: signClass(chg), spark: gh.mcap || [], src: g.source + (gh.mcap ? " · 7d" : ""), srcState: g.status });
      setCard("vol", g.volume_usd, fmtMoney, {
        delta: g.mcap_usd ? "vol/mcap " + ((g.volume_usd / g.mcap_usd) * 100).toFixed(1) + "%" : "",
        src: g.source, srcState: g.status });
      setCard("dom", g.btc_dominance, (v) => "BTC " + v.toFixed(1) + "%", {
        delta: g.eth_dominance != null ? "ETH " + g.eth_dominance.toFixed(1) + "%" : "",
        src: g.source, srcState: g.status });
      cards.dom.s.innerHTML = donutSvg([
        { label: "BTC", pct: g.btc_dominance || 0, color: "#F7931A" },
        { label: "ETH", pct: g.eth_dominance || 0, color: "#627EEA" },
        { label: "Others", pct: Math.max(0, 100 - (g.btc_dominance || 0) - (g.eth_dominance || 0)), color: "var(--line-strong)" }]);
    } else {
      setCard("mcap", null, null, { src: "coingecko/paprika", srcState: g.status });
      setCard("vol", null, null, { src: "coingecko/paprika", srcState: g.status });
      setCard("dom", null, null, { src: "coingecko/paprika", srcState: g.status });
    }
    const dx = ov.dex || {};
    if (dx.total24h_usd != null) {
      const dch = Number(dx.change_1d_pct);
      setCard("dex", dx.total24h_usd, fmtMoney, {
        delta: isFinite(dch) ? (dch >= 0 ? "↗ " : "↘ ") + fmtPct(dch) + " · 24h" : "",
        deltaCls: signClass(dch), src: "defillama · daily bars", srcState: dx.status });
      cards.dex.s.innerHTML = barsSvg((dx.bars || []).map((b) => b[1]));
    } else setCard("dex", null, null, { src: "defillama", srcState: dx.status });
    if (fg.value != null) {
      setCard("fng", fg.value, (v) => Math.round(v) + " · " + (fg.label || ""), {
        src: "alternative.me", srcState: fg.status });
      cards.fng.v.classList.add("fng-" + fngBand(fg.value));
      cards.fng.s.innerHTML = gaugeSvg(fg.value);
      cards.fng.d.textContent = fngBandLabel(fg.value) + " · 30d range " +
        Math.min(...(fg.history || [{value:fg.value}]).map((p) => p.value)) +
        "-" + Math.max(...(fg.history || [{value:fg.value}]).map((p) => p.value));
    } else setCard("fng", null, null, { src: "alternative.me", srcState: fg.status });
    if (st.total_usd != null) {
      setCard("stbl", st.total_usd, fmtMoney, { src: "defillama", srcState: st.status });
      const u = st.usdt_share_pct || 0, c = st.usdc_share_pct || 0;
      cards.stbl.s.innerHTML = shareBarSvg([
        { label: "USDT", pct: u, color: "#26A17B" },
        { label: "USDC", pct: c, color: "#2775CA" },
        { label: "Other", pct: Math.max(0, 100 - u - c), color: "var(--line-strong)" }]);
    } else setCard("stbl", null, null, { src: "defillama", srcState: st.status });
    if (df.tvl_usd != null) {
      setCard("tvl", df.tvl_usd, fmtMoney, { spark: df.chart || [], src: "defillama", srcState: df.status });
    } else setCard("tvl", null, null, { src: "defillama", srcState: df.status });
    setCard("uni", m.total_symbols, (v) => Math.round(v) + " pairs", {
      delta: `${m.live_symbols ?? "—"} live · open Radar ›`,
      src: "binance", srcState: "live" });
  }
  function fngBand(v) { return v <= 25 ? "fear" : v >= 75 ? "greed" : "mid"; }
  function fngBandLabel(v) { return v <= 25 ? "Risk-off" : v >= 75 ? "Euphoric" : "Balanced"; }
  // donut — composition at a glance (dominance), not another line
  function donutSvg(parts) {
    const cx = 27, cy = 26, r = 19, C = 2 * Math.PI * r;
    let off = C * 0.25; // start at 12 o'clock
    const segs = parts.map((p) => {
      const len = Math.max(0, p.pct) / 100 * C;
      const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="9" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>`;
      off -= len;
      return s;
    }).join("");
    const legend = parts.map((p, i) =>
      `<text x="58" y="${15 + i * 15}" font-size="10" fill="var(--muted)"><tspan fill="${p.color}">●</tspan> ${p.label} <tspan fill="var(--text)" font-weight="600">${p.pct.toFixed(1)}%</tspan></text>`).join("");
    return `<svg viewBox="0 0 150 52" style="width:100%;height:100%;display:block">${segs}${legend}</svg>`;
  }
  // daily volume bars, Pyth-style: thin quiet grey bars, the CURRENT day in
  // accent with a dot cap — history as texture, today as the signal
  function barsSvg(vals, W = 150, H = 46) {
    const v = (vals || []).filter((x) => isFinite(x)).slice(-28);
    if (v.length < 3) return "";
    const max = Math.max(...v) || 1;
    const bw = W / v.length;
    const barW = Math.max(1.4, Math.min(3, bw * 0.42));
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block">` +
      v.map((x, i) => {
        const bh = Math.max(2, (x / max) * (H - 8));
        const cx = i * bw + bw / 2;
        const last = i === v.length - 1;
        const fill = last ? "var(--accent)" : "var(--line-strong)";
        const cap = last ? `<circle cx="${cx.toFixed(1)}" cy="${(H - bh - 3).toFixed(1)}" r="2.3" fill="var(--accent)"/>` : "";
        return `<rect x="${(cx - barW / 2).toFixed(1)}" y="${(H - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(barW / 2).toFixed(1)}" fill="${fill}"/>` + cap;
      }).join("") + "</svg>";
  }
  // semicircle gauge (0-100): colored bands + needle — not another line chart
  function gaugeSvg(value) {
    const W = 150, H = 52, cx = 75, cy = 48, r = 40;
    const pol = (deg) => [cx + r * Math.cos(Math.PI * deg / 180), cy - r * Math.sin(Math.PI * deg / 180)];
    const seg = (a0, a1, color) => {
      const [x0, y0] = pol(a0), [x1, y1] = pol(a1);
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="butt" opacity=".85"/>`;
    };
    const bands = [["#e0414b",180,144],["#f0932b",144,108],["#c3c9d2",108,72],["#7cc47f",72,36],["#0a9b64",36,0]];
    const ang = 180 - Math.max(0, Math.min(100, value)) * 1.8;
    const [nx, ny] = pol(ang);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block">
      ${bands.map(([c,a0,a1]) => seg(a0,a1,c)).join("")}
      <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="3.4" fill="var(--text)"/></svg>`;
  }
  function shareBarSvg(parts) {
    const total = parts.reduce((a, p) => a + p.pct, 0) || 100;
    let cells = "", x = 0;
    for (const p of parts) {
      const w = (p.pct / total) * 100;
      cells += `<div style="width:${w}%;background:${p.color}" title="${p.label} ${p.pct.toFixed(1)}%"></div>`;
      x += w;
    }
    const legend = parts.map((p) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)">
        <span style="width:7px;height:7px;border-radius:2px;background:${p.color}"></span>${p.label} ${p.pct.toFixed(1)}%</span>`).join("");
    return `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:12px">${cells}</div>
      <div style="display:flex;gap:10px;margin-top:6px">${legend}</div>`;
  }
  function fngColor(v) { return v <= 25 ? "var(--down)" : v >= 75 ? "var(--up)" : "var(--accent)"; }

  // ---- majors ----
  const majorsWrap = h("div", { class: "mcards" });
  const majorCards = new Map();
  function paintMajors() {
    if (!ov) return;
    const coinsByBase = {};
    (ov.top_coins && ov.top_coins.coins || []).forEach((c) => { coinsByBase[c.base] = c; });
    for (const r of ov.majors || []) {
      const base = baseOf(r.symbol);
      const coin = coinsByBase[base];
      let card = majorCards.get(r.symbol);
      if (!card) {
        card = buildMajorCard(r, coin);
        majorCards.set(r.symbol, card);
        majorsWrap.appendChild(card.el);
      }
      countUp(card.px, Number(coin ? px(coin) : r.spot_mid), fmtPrice);
      if (coin && coin.chg24h != null) {
        card.chg.textContent = (coin.chg24h >= 0 ? "↗ " : "↘ ") + fmtPct(coin.chg24h) + " · 24h";
        card.chg.className = "mcard-chg num " + signClass(coin.chg24h);
      } else {
        card.chg.textContent = "";
        card.chg.className = "mcard-chg num";
      }
      const pts = sparks[r.symbol];
      const vals = (coin && coin.spark && coin.spark.length > 2) ? coin.spark
        : (pts && pts.length > 2 ? pts.map((p) => p[1]) : []);
      const sig = vals.length + ":" + vals[vals.length - 1];
      if (card._k !== sig && vals.length >= 2) {
        card._k = sig;
        card.chart.innerHTML = sparkArea(vals, 170, 52, brandColor(r.symbol));
      }
    }
  }
  function buildMajorCard(r, coin) {
    const px = h("div", { class: "mcard-px num" });
    const chg = h("div", { class: "mcard-chg num" });
    const chart = h("div", { class: "mcard-chart" });
    const el = h("div", { class: "mcard", onClick: () => navigate("/symbol/" + r.symbol) },
      h("div", { class: "mcard-head" }, tokenIcon(r.symbol, 30),
        h("div", {}, h("div", { class: "tok-name" }, coin ? coin.name : baseOf(r.symbol)),
          h("div", { class: "tok-sub" }, baseOf(r.symbol)))),
      px, chg, chart);
    attachPopover(el, () => majorPopover(r.symbol));
    return { el, px, chg, chart };
  }
  function majorPopover(symbol) {
    const r = (ov && ov.majors || []).find((x) => x.symbol === symbol);
    if (!r) return null;
    const pts = sparks[symbol] || [];
    return h("div", {},
      h("div", { class: "hp-head" }, tokenIcon(symbol, 22), h("b", {}, baseOf(symbol)), h("span", { class: "muted" }, symbol)),
      pts.length > 2 ? h("div", { class: "hp-chart", html: sparkArea(pts.map((p) => p[1]), 220, 44, brandColor(symbol)) }) : null,
      popRow("Spot", fmtPrice(r.spot_mid)),
      popRow("Basis", fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), signClass(r.mid_spread_bps)),
      popRow("Funding / 8h", fmtFunding(r.funding_rate), signClass(r.funding_rate)),
      h("div", { class: "hp-src" }, "binance · live — click to open"));
  }

  // ---- tokenized stocks (Uniswap-style cards; real on-chain equity prices) ----
  const stocksStrip = h("div", { class: "stock-strip" });
  const stocksNote = h("span", { class: "sec-note" });
  const stocksWrap = h("div", { style: { display: "none" } },
    h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Stocks · tokenized"), stocksNote),
    stocksStrip);
  const stockCards = new Map();
  function paintStocks() {
    const stq = (ov && ov.stocks) || {};
    const items = stq.items || [];
    if (binanceOnly() || !items.length) { stocksWrap.style.display = "none"; return; }
    stocksWrap.style.display = "";
    stocksNote.textContent = "real on-chain tokenized equities — price tracks the listed company · " + (stq.source || "");
    for (const s of items) {
      let sc = stockCards.get(s.base);
      if (!sc) {
        sc = buildStockCard(s);
        stockCards.set(s.base, sc);
        stocksStrip.appendChild(sc.el);
      }
      countUp(sc.px, s.price, fmtPrice);
      const up = (s.chg24h || 0) >= 0;
      sc.chg.replaceChildren();
      mount(sc.chg, s.chg24h != null ? moveValue(s.chg24h, { hot: 8 }) : "—");
      sc.chg.className = "sc-chg num " + signClass(s.chg24h);
      const vals = s.spark || [];
      const sig = vals.length + ":" + vals[vals.length - 1];
      if (sc._k !== sig && vals.length >= 2) {
        sc._k = sig;
        sc.spark.innerHTML = sparkArea(vals, 150, 34, up ? "var(--up)" : "var(--down)");
      }
    }
  }
  function buildStockCard(s) {
    // official company logo first (Parqet's keyless ticker CDN — crisp, real
    // brand marks), then the wrapper-token image, then the resolver
    const chain = [`https://assets.parqet.com/logos/symbol/${encodeURIComponent(s.base)}?format=png&size=64`];
    if (s.image) chain.push(s.image);
    const img = document.createElement("img");
    img.className = "tok-ico sc-logo"; img.width = 28; img.height = 28; img.alt = s.base;
    img.referrerPolicy = "no-referrer"; img.loading = "lazy";
    let ci = 0;
    img.addEventListener("error", () => {
      ci += 1;
      if (ci < chain.length) img.src = chain[ci];
      else img.replaceWith(tokenIcon(s.base, 28));
    });
    img.src = chain[0];
    const pxEl = h("div", { class: "sc-px num" });
    const chg = h("div", { class: "sc-chg num" });
    const spark = h("div", { class: "sc-spark" });
    const el = h("button", { class: "stock-card", title: s.wrapper || s.name, onClick: () => navigate("/symbol/" + s.base) },
      h("div", { class: "sc-head" }, img,
        h("div", { class: "tok-meta" }, h("span", { class: "tok-name" }, s.base), h("span", { class: "tok-sub" }, s.name))),
      pxEl, chg, spark);
    return { el, px: pxEl, chg, spark };
  }

  // ---- crypto market prices table (sortable, tab-aware columns) ----
  let sortKey = null;
  let sortDir = -1;               // -1 descending, +1 ascending
  const tabsWrap = h("div", { class: "chips" });
  const priceBody = h("tbody");
  const priceHead = h("tr");
  const priceNote = h("span", { class: "sec-note" });
  const priceTable = h("div", { class: "table-scroll" },
    h("table", { class: "mkt" }, h("thead", {}, priceHead), priceBody));

  function columns() {
    const cols = [
      { key: "rank", label: "#", cls: "l w-idx", sort: (c) => c.rank ?? 1e9 },
      { key: "token", label: "Token", cls: "l", sort: null },
      { key: "spark", label: "7d chart", cls: "l col-hide-xs", sort: null },
      { key: "price", label: "Price", cls: "", sort: (c) => px(c) ?? -1 },
      { key: "chg1h", label: "1h", cls: "col-hide-sm", sort: (c) => c.chg1h ?? -1e9 },
      { key: "chg24h", label: "24h", cls: "", sort: (c) => c.chg24h ?? -1e9 },
      { key: "chg7d", label: "7d", cls: "col-hide-sm", sort: (c) => c.chg7d ?? -1e9 },
      { key: "mcap", label: "Market cap", cls: "", sort: (c) => c.mcap ?? -1 },
      { key: "volume", label: "Volume", cls: "col-hide-sm", sort: (c) => (c.vol_live ?? c.volume) ?? -1 },
    ];
    if (BASIS_TABS.has(tab)) {
      cols.push({ key: "basis", label: "Basis", cls: "", sort: (c) => (c.binance ? Math.abs(c.binance.basis_bps || 0) : -1) });
    }
    cols.push({ key: "view", label: "", cls: "", sort: null });
    return cols;
  }

  function paintPriceHead() {
    mount(priceHead, columns().map((col) => {
      if (!col.sort) return h("th", { class: col.cls }, col.label);
      const active = sortKey === col.key;
      return h("th", {
        class: col.cls + " th-sort" + (active ? " th-on" : ""),
        role: "button", tabindex: "0", title: "Sort by " + (col.label || col.key),
        "aria-sort": active ? (sortDir > 0 ? "ascending" : "descending") : "none",
        onClick: () => {
          if (sortKey === col.key) { if (sortDir === -1) sortDir = 1; else { sortKey = null; sortDir = -1; } }
          else { sortKey = col.key; sortDir = -1; }
          paintPriceHead(); paintPrices();
        },
      }, col.label, h("span", { class: "th-car" }, active ? (sortDir > 0 ? "▲" : "▼") : "⇅"));
    }));
  }

  function buildTabs() {
    mount(tabsWrap, TABS.map((t) =>
      h("button", { class: "chip" + (t.id === tab ? " active" : ""), onClick: () => { tab = t.id; showCount = 25; buildTabs(); paintPriceHead(); paintPrices(); } }, t.label)));
  }

  function filteredCoins() {
    if (tab === "stocks") {
      return (((ov || {}).stocks || {}).items || []).map((s, i) => ({ ...s, rank: i + 1, kind: "stock" }));
    }
    const coins = (ov && ov.top_coins && ov.top_coins.coins) || [];
    switch (tab) {
      case "majors": return coins.filter((c) => MAJOR_BASES.has(c.base));
      case "binance": return coins.filter((c) => c.binance);
      case "volume": return [...coins].sort((a, b) => (b.volume || 0) - (a.volume || 0));
      case "gainers": return [...coins].filter((c) => c.chg24h != null).sort((a, b) => b.chg24h - a.chg24h);
      case "losers": return [...coins].filter((c) => c.chg24h != null).sort((a, b) => a.chg24h - b.chg24h);
      case "basis": return coins.filter((c) => c.binance).sort((a, b) => Math.abs(b.binance.basis_bps || 0) - Math.abs(a.binance.basis_bps || 0));
      case "funding": return coins.filter((c) => c.binance).sort((a, b) => Math.abs(b.binance.funding_rate || 0) - Math.abs(a.binance.funding_rate || 0));
      case "stable": return coins.filter((c) => STABLE_BASES.has(c.base));
      default: return coins;
    }
  }

  function sortedCoins() {
    const all = filteredCoins();
    const col = columns().find((c) => c.key === sortKey);
    if (!col || !col.sort) return all;
    return [...all].sort((a, b) => (Number(col.sort(b)) - Number(col.sort(a))) * (sortDir < 0 ? 1 : -1));
  }

  const lastPx = new Map();   // base -> last painted price (flash on change)
  function priceCell(c) {
    const cur = px(c);
    const td = h("td", { class: "num val-strong" }, fmtPrice(cur));
    const prev = lastPx.get(c.base);
    if (prev != null && cur != null && cur !== prev) {
      td.classList.add(cur > prev ? "flash-up" : "flash-down");
    }
    if (cur != null) lastPx.set(c.base, cur);
    return td;
  }

  function cellFor(col, c, i) {
    switch (col.key) {
      case "rank": return h("td", { class: "l idx w-idx" }, c.rank ?? i + 1);
      case "token": return h("td", { class: "l" }, h("div", { class: "tok" }, coinIcon(c, 32),
        h("div", { class: "tok-meta" }, h("span", { class: "tok-name" }, c.name),
          h("span", { class: "tok-sub num" }, c.base + (c.kind === "stock" ? " · stock" : "")))));
      case "spark": return h("td", { class: "l col-hide-xs", html: `<span class="sparkbox">${sparkline(c.spark || [], 96, 32, c.chg7d != null && c.chg7d < 0 ? "var(--down)" : "var(--up)")}</span>` });
      case "price": return priceCell(c);
      case "chg1h": return h("td", { class: "num col-hide-sm " + signClass(c.chg1h) }, c.chg1h != null ? fmtPct(c.chg1h) : "—");
      case "chg24h": return h("td", { class: "num " + signClass(c.chg24h) },
        c.chg24h != null ? moveValue(c.chg24h, { hot: 15 }) : "—");
      case "chg7d": return h("td", { class: "num col-hide-sm " + signClass(c.chg7d) }, c.chg7d != null ? fmtPct(c.chg7d) : "—");
      case "mcap": return h("td", { class: "num" }, fmtMoney(c.mcap));
      case "volume": return h("td", { class: "num col-hide-sm muted" }, fmtMoney(c.vol_live ?? c.volume));
      case "basis": return h("td", { class: "num " + (c.binance ? signClass(c.binance.basis_bps) : "faint") },
        c.binance ? fmtBasisVal(c.binance.basis_bps, true) : "—");
      case "view": return h("td", {}, h("button", { class: "cta-pill", onClick: (e) => { e.stopPropagation(); openCoin(c); } }, "View"));
      default: return h("td", {});
    }
  }

  function paintPrices() {
    if (!ov) return;
    const nCols = columns().length;
    const tc = ov.top_coins || {};
    if (tab !== "stocks" && (!tc.coins || !tc.coins.length)) {
      mount(priceBody, h("tr", {}, h("td", { colspan: nCols, class: "l empty-state" },
        tc.status === "unavailable"
          ? "External price sources unreachable — Binance-tracked pairs remain live in Radar."
          : "Loading top coins…")));
      priceNote.textContent = "source: " + (tc.status === "unavailable" ? "unavailable" : "—");
      return;
    }
    priceNote.textContent = tab === "stocks"
      ? "source: " + (((ov || {}).stocks || {}).source || "coingecko") + " · tokenized equities"
      : `source: ${tc.source} · ${tc.status} · ${(tc.coins || []).length} assets · live Binance prices where listed · click a column to sort`;
    const all = sortedCoins();
    if (!all.length) {
      mount(priceBody, h("tr", {}, h("td", { colspan: nCols, class: "l empty-state" }, "No assets in this view yet — source may still be warming up.")));
      return;
    }
    const rows = all.slice(0, showCount);
    mount(priceBody, rows.map((c, i) => {
      const tr = h("tr", { onClick: (e) => { if (!e.target.closest("button")) openCoin(c); } },
        ...columns().map((col) => cellFor(col, c, i)));
      attachPopover(tr, () => coinPopover(c));
      return tr;
    }));
    if (all.length > showCount) {
      priceBody.appendChild(h("tr", {}, h("td", { colspan: nCols, class: "l", style: { textAlign: "center", height: "56px" } },
        h("button", { class: "mini-btn", style: { margin: "0 auto" }, onClick: () => { showCount = Math.min(all.length, showCount + 50); paintPrices(); } },
          `Show more (${showCount} of ${all.length})`))));
    }
  }
  function openCoin(c) {
    navigate("/symbol/" + (c.binance ? c.binance.symbol : c.kind === "stock" ? c.base : c.base + "USDT"));
  }
  function coinPopover(c) {
    return h("div", {},
      h("div", { class: "hp-head" }, coinIcon(c, 22), h("b", {}, c.name), h("span", { class: "muted" }, "#" + (c.rank ?? "—"))),
      (c.spark || []).length > 2 ? h("div", { class: "hp-chart", html: sparkArea(c.spark, 220, 44, (c.chg7d || 0) < 0 ? "var(--down)" : "var(--up)") }) : null,
      popRow("Price", fmtPrice(px(c))),
      popRow("24h", c.chg24h != null ? fmtPct(c.chg24h) : "—", signClass(c.chg24h)),
      popRow("Market cap", fmtMoney(c.mcap)),
      c.binance ? popRow("Binance basis", fmtBasisVal(c.binance.basis_bps, true) + " " + basisUnit(), signClass(c.binance.basis_bps)) : null,
      h("div", { class: "hp-src" }, `${(ov.top_coins || {}).source || "—"} · 7d spark — click to open`));
  }

  // ---- live news rail (squawk wire + outlets; lanes, live pulse, chips) ----
  const newsRail = h("aside", { class: "news-rail", id: "sec-news" });
  let newsLane = "all";                  // all | squawk | macro | crypto
  let seenNewsKeys = new Set();          // entrance animation for new stories
  const timeRefs = [];                   // [{el, iso}] — self-updating "Xm ago"
  const newsKey = (it) => (it.title || "").toLowerCase().replace(/\W+/g, " ").slice(0, 90);
  const LANES = [
    ["all", "All"], ["squawk", "Squawk"], ["macro", "Macro"], ["crypto", "Crypto"],
  ];
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function favicon(domain) {
    const mark = h("span", { class: "nr-fav nr-fav-local", "aria-hidden": "true" },
      String(domain || "?").replace(/^www\./, "").slice(0, 1).toUpperCase());
    return mark;
  }
  const ageMin = (it) => (it && it.time ? (Date.now() - Date.parse(it.time)) / 60000 : null);
  function newBadge(it) {
    const m = ageMin(it);
    return m != null && m >= 0 && m < 30 ? h("span", { class: "nr-new" }, "NEW") : null;
  }
  // detect which tracked assets a headline is about → clickable chips
  function tickerChips(title) {
    const coins = (ov && ov.top_coins && ov.top_coins.coins) || [];
    const out = [];
    for (const c of coins.slice(0, 120)) {
      if (out.length >= 2) break;
      let hit = false;
      try {
        hit = (c.name && c.name.length > 3 && new RegExp("\\b" + escapeRe(c.name) + "\\b", "i").test(title))
          || (c.base && c.base.length >= 3 && new RegExp("\\b" + escapeRe(c.base) + "\\b").test(title));
      } catch (e) { hit = false; }
      if (hit) {
        out.push(h("button", {
          class: "nr-chip num",
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")); },
        }, coinIcon(c, 14), c.base));
      }
    }
    return out;
  }
  function newsMeta(it) {
    const t = h("span", { class: "num nr-time" }, timeAgo(it.time));
    if (it.time) timeRefs.push({ el: t, iso: it.time });
    return h("div", { class: "nr-meta" }, favicon(it.domain),
      t,
      h("span", { class: it.lane === "squawk" ? "nr-handle" : "" }, it.domain || "source"),
      it.lane && it.lane !== "crypto" ? h("span", { class: "nr-lane nr-lane-" + it.lane }, it.lane) : null,
      // high-impact stories get a quiet flag, not a cryptic code
      it.impact >= 70 ? h("span", { class: "nr-impact num", title: (it.reason || "impact score") + " · " + it.impact + "/100" }, "★") : null,
      newBadge(it));
  }
  function newsTags(it) {
    const tags = (it.tags || []).slice(0, 3);
    const syms = (it.matched_symbols || []).slice(0, 3);
    if (!tags.length && !syms.length) return null;
    return h("div", { class: "nr-tags" },
      tags.map((t) => h("span", { class: "nr-tag" }, t)),
      syms.map((s) => h("button", {
        class: "nr-chip nr-chip-tight num",
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); navigate("/symbol/" + s + "USDT"); },
      }, s)));
  }
  function newsCoverageStrip() {
    const cov = (news && news.coverage) || [];
    if (!cov.length) return null;
    const SHORT = { tree_news: "Squawk wire", rss: "Outlets ×17", lookonchain: "Lookonchain", news: "GDELT" };
    const preferred = ["tree_news", "rss", "lookonchain", "news"];   // keyless live feeds only
    const rows = preferred.map((id) => cov.find((c) => c.id === id)).filter(Boolean);
    return h("div", { class: "nr-coverage" }, rows.map((c) => {
      const st = c.status || "idle";
      return h("span", { class: "nr-cov " + st, title: (c.label || "") + (c.detail ? " — " + c.detail : "") },
        h("span", { class: "nr-cov-dot" }), SHORT[c.id] || c.label,
        h("b", {}, statusWord(c)));
    }));
  }
  function newsLaneStrip(items) {
    const counts = { all: items.length };
    items.forEach((it) => {
      const l = it.lane || "crypto";
      counts[l] = (counts[l] || 0) + 1;
    });
    return h("div", { class: "nr-sources" }, LANES.map(([id, label]) => {
      if (id !== "all" && !counts[id]) return null;
      return h("button", {
        class: "nr-source" + (newsLane === id ? " active" : ""),
        onClick: () => { newsLane = id; paintPulse(); },
      }, h("span", {}, label), h("span", { class: "num" }, counts[id] || 0));
    }).filter(Boolean));
  }
  function paintPulse() {
    if (binanceOnly()) { newsRail.replaceChildren(); return; }
    const items = (news && news.items) || [];
    if (newsLane !== "all" && !items.some((it) => (it.lane || "crypto") === newsLane)) newsLane = "all";
    const filtered = newsLane === "all" ? items : items.filter((it) => (it.lane || "crypto") === newsLane);
    const nSources = new Set(items.map((it) => it.domain || "source")).size;
    timeRefs.length = 0;
    const head = h("div", { class: "nr-head" },
      h("span", { class: "nr-live " + ((news && news.status) || "idle") }),
      h("h2", { class: "sec-title", style: { fontSize: "17px" } }, "Live news"),
      h("span", { class: "sec-note", style: { marginLeft: "auto" } },
        nSources ? `${filtered.length} headlines · ${nSources} sources` : "…"));
    if (!items.length) {
      mount(newsRail, head, newsCoverageStrip(), h("div", { class: "ghost-tile" }, icon("info"),
        h("div", {},
          h("div", { class: "gt-title" }, "Headlines loading"),
          h("div", { class: "gt-sub" }, "The squawk wire, RSS outlets, GDELT and Lookonchain are cached server-side and appear as they warm.")),
        h("span", { class: "gt-badge" }, (news && news.status) || "connecting")));
      return;
    }
    const isNew = (it) => seenNewsKeys.size > 0 && !seenNewsKeys.has(newsKey(it));
    const [lead, ...rest] = filtered;
    const leadEl = h("a", {
      class: "nr-lead" + (lead.lane === "squawk" ? " squawk" : "") + (isNew(lead) ? " nr-enter" : ""),
      href: lead.url, target: "_blank", rel: "noopener noreferrer" },
      newsMeta(lead),
      h("div", { class: "nr-lead-title" }, lead.title),
      newsTags(lead),
      h("div", { class: "nr-chips" }, tickerChips(lead.title)));
    mount(newsRail, head, newsCoverageStrip(), newsLaneStrip(items), leadEl,
      h("div", { class: "nr-list" }, rest.slice(0, 17).map((it) => {
        const chips = tickerChips(it.title);
        return h("a", {
          class: "nr-item" + (it.lane === "squawk" ? " squawk" : "") + (isNew(it) ? " nr-enter" : ""),
          href: it.url, target: "_blank", rel: "noopener noreferrer" },
          newsMeta(it),
          h("div", { class: "nr-title" }, it.title),
          newsTags(it),
          chips.length ? h("div", { class: "nr-chips" }, chips) : null);
      })));
    seenNewsKeys = new Set(items.map(newsKey));
  }

  // ---- basis & funding intelligence (Binance universe) ----
  const intelWrap = h("div", { class: "signals" });
  function paintIntel() {
    if (!ov) return;
    const byBase = {};
    (ov.top_coins && ov.top_coins.coins || []).forEach((c) => { byBase[c.base] = c; });
    const col = (label, path, list, valFn, clsFn) =>
      h("div", { class: "sig" },
        h("div", { class: "sig-head", onClick: () => navigate(path) },
          h("span", { class: "sig-label" }, label), h("span", { class: "sig-more" }, "Open ›")),
        (list || []).slice(0, 4).map((r) => {
          const b = baseOf(r.symbol);
          const row = h("div", { class: "sig-row", onClick: () => navigate("/symbol/" + r.symbol) },
            coinIcon(byBase[b] || { base: b }, 22),
            h("span", { class: "sig-name" }, b),
            h("span", { class: "sig-val num " + clsFn(r) }, valFn(r)));
          attachPopover(row, () => majorPopoverAny(r));
          return row;
        }));
    mount(intelWrap,
      col("Widest basis", "/radar", ov.top_basis, (r) => fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), (r) => signClass(r.mid_spread_bps)),
      col("Shorts paying", "/funding", ov.funding_top, (r) => fmtFunding(r.funding_rate), () => "up"),
      col("Longs paying", "/funding", ov.funding_bottom, (r) => fmtFunding(r.funding_rate), () => "down"),
      col("Top score", "/radar", ov.top_score, (r) => fmtScore(r.opportunity_score), () => "strong"));
  }
  function majorPopoverAny(r) {
    const pts = sparks[r.symbol] || [];
    return h("div", {},
      h("div", { class: "hp-head" }, tokenIcon(r.symbol, 22), h("b", {}, baseOf(r.symbol)), h("span", { class: "muted" }, r.symbol)),
      pts.length > 2 ? h("div", { class: "hp-chart", html: sparkArea(pts.map((p) => p[1]), 220, 44, brandColor(r.symbol)) }) : null,
      popRow("Spot", fmtPrice(r.spot_mid)),
      popRow("Basis", fmtBasisVal(r.mid_spread_bps, true) + " " + basisUnit(), signClass(r.mid_spread_bps)),
      popRow("Funding / 8h", fmtFunding(r.funding_rate), signClass(r.funding_rate)),
      popRow("Score", fmtScore(r.opportunity_score)),
      h("div", { class: "hp-src" }, "binance · live — click to open"));
  }

  // ---- page scaffold ----
  const subLine = h("div", { class: "page-sub" }, "loading…");
  const regimePill = h("span", { class: "pill-regime" });
  // ---- top movers today (external 24h data) ----
  const moversWrap = h("div", { class: "signals" });
  function paintTopMovers() {
    if (!ov) return;
    const coins = (ov.top_coins && ov.top_coins.coins || []).filter((c) => c.chg24h != null);
    if (!coins.length) { mount(moversWrap, h("div", { class: "empty-state" }, "External price source unavailable.")); return; }
    const col = (label, list, valFn, clsFn) =>
      h("div", { class: "sig" },
        h("div", { class: "sig-head" }, h("span", { class: "sig-label" }, label)),
        list.slice(0, 4).map((c) => {
          const row = h("div", { class: "sig-row", onClick: () => navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")) },
            coinIcon(c, 22),
            h("span", { class: "sig-name" }, c.name),
            h("span", { class: "sig-val num " + clsFn(c) }, valFn(c)));
          attachPopover(row, () => coinPopover(c));
          return row;
        }));
    const byUp = [...coins].sort((a, b) => b.chg24h - a.chg24h);
    const byVol = [...coins].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    mount(moversWrap,
      col("Top gainers · 24h", byUp, (c) => moveValue(c.chg24h, { hot: 10 }), () => "up"),
      col("Top losers · 24h", [...byUp].reverse(), (c) => moveValue(c.chg24h), () => "down"),
      col("Top volume", byVol, (c) => fmtMoney(c.vol_live ?? c.volume), () => "strong"),
      col("7d strength", [...coins].filter((c) => c.chg7d != null).sort((a, b) => b.chg7d - a.chg7d),
        (c) => moveValue(c.chg7d, { hot: 25 }), (c) => signClass(c.chg7d)));
  }

  // ---- trending (CoinGecko search trending) ----
  const trendingWrap = h("div", {});
  function paintTrending() {
    const tr = (ov && ov.trending) || {};
    if (binanceOnly() || !(tr.coins || []).length) { trendingWrap.replaceChildren(); return; }
    mount(trendingWrap,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Trending"),
        h("span", { class: "sec-note" }, "source: coingecko search")),
      h("div", { class: "trend-strip" }, tr.coins.map((c) => {
        const img = tokenIcon(c.base, 22);
        return h("button", { class: "trend-chip", onClick: () => navigate("/symbol/" + c.base + "USDT") },
          img, h("b", {}, c.base), h("span", { class: "muted" }, c.name),
          c.rank ? h("span", { class: "num faint" }, "#" + c.rank) : null);
      })));
  }

  // ---- world markets (US/EU/Asia/India indices · commodities · FX · rates) ----
  // Real Yahoo Finance intraday data, one bounded server-side call. This is
  // what makes the landing page a WORLD market surface, not a crypto-only one.
  let worldGroup = "us";
  const worldTabs = h("div", { class: "wm-tabs", role: "tablist" });
  const worldStrip = h("div", { class: "wm-strip" });
  const worldNote = h("span", { class: "sec-note" });
  const worldWrap = h("section", { class: "wm", id: "sec-world" },
    h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "World markets"), worldNote),
    worldTabs, worldStrip);
  const wmCards = new Map();

  function wmVal(it) {
    if (it.last == null || !isFinite(it.last)) return "—";
    if (it.group === "rates") return Number(it.last).toFixed(2) + "%";
    const digits = it.group === "fx" ? (it.last < 20 ? 4 : 2) : 2;
    return Number(it.last).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function openWorldDetail(it) {
    openDetailSheet(it.name, "globe", () => [
      (it.spark || []).length > 2
        ? sheetChart(sparkArea(it.spark, 340, 120, (it.chg_pct || 0) >= 0 ? "var(--up)" : "var(--down)", { dots: true, endDot: true }), 120)
        : null,
      sheetRow("Last", wmVal(it), signClass(it.chg_pct)),
      sheetRow("Change today", it.chg_pct != null ? fmtPct(it.chg_pct) : "—", signClass(it.chg_pct)),
      sheetRow("Previous close", it.prev_close != null ? Number(it.prev_close).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"),
      it.currency ? sheetRow("Currency", it.currency) : null,
      it.asof ? sheetRow("As of", new Date(it.asof * 1000).toUTCString().replace(" GMT", " UTC")) : null,
      sheetNote("Intraday session, 15-minute closes."),
      srcLine((ov.world || {}).status, "yahoo finance"),
    ].filter(Boolean));
  }
  function buildWmCard(it) {
    const pxEl = h("div", { class: "wm-px num" });
    const chg = h("div", { class: "wm-chg num" });
    const spark = h("div", { class: "wm-spark" });
    const name = h("div", { class: "wm-name" });
    if (it.group === "stocks") {   // real brand marks via Parqet's keyless CDN
      const img = document.createElement("img");
      img.className = "wm-logo"; img.width = 16; img.height = 16; img.alt = "";
      img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.remove(), { once: true });
      img.src = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(it.symbol)}?format=png&size=32`;
      name.appendChild(img);
    }
    name.appendChild(document.createTextNode(it.name));
    const el = h("button", { class: "wm-card", onClick: () => openWorldDetail(wmCards.get(it.symbol).it) },
      name, pxEl, chg, spark);
    return { el, px: pxEl, chg, spark, it };
  }
  function paintWorld() {
    if (binanceOnly()) { worldWrap.style.display = "none"; return; }
    worldWrap.style.display = "";
    const w = (ov && ov.world) || {};
    const groups = w.groups || [];
    if (!groups.length) {
      worldNote.textContent = "source: yahoo finance · " + (w.status || "warming");
      worldTabs.replaceChildren();
      mount(worldStrip, h("div", { class: "wm-ghost" },
        icon("globe"),
        h("span", {}, "Global indices, commodities, FX and yields are warming — the provider rate-limits new sessions; data appears automatically."),
        h("span", { class: "gt-badge" }, w.status || "connecting")));
      wmCards.clear();
      return;
    }
    if (!groups.some((g) => g.id === worldGroup)) worldGroup = groups[0].id;
    worldNote.textContent = `source: yahoo finance · ${w.status} · real intraday data`;
    mount(worldTabs, groups.map((g) =>
      h("button", {
        class: "chip" + (g.id === worldGroup ? " active" : ""), role: "tab",
        "aria-selected": g.id === worldGroup ? "true" : "false",
        onClick: () => { worldGroup = g.id; wmCards.clear(); paintWorld(); },
      }, g.label, h("span", { class: "chip-n num" }, g.items.length))));
    const items = (groups.find((g) => g.id === worldGroup) || {}).items || [];
    if (!wmCards.size) {
      worldStrip.replaceChildren();
      for (const it of items) {
        const card = buildWmCard(it);
        wmCards.set(it.symbol, card);
        worldStrip.appendChild(card.el);
      }
    }
    for (const it of items) {
      const card = wmCards.get(it.symbol);
      if (!card) continue;
      card.it = it;
      card.px.textContent = wmVal(it);
      card.chg.textContent = it.chg_pct != null ? moveValue(it.chg_pct) : "—";
      card.chg.className = "wm-chg num " + signClass(it.chg_pct);
      const vals = it.spark || [];
      const sig = vals.length + ":" + vals[vals.length - 1];
      if (card._k !== sig && vals.length > 2) {
        card._k = sig;
        card.spark.innerHTML = sparkline(vals, 92, 28, (it.chg_pct || 0) >= 0 ? "var(--up)" : "var(--down)");
      }
    }
  }

  const binanceOnly = () => getSettings().source === "binance";
  const extSections = h("div", {});   // external sections live here (source-gated)
  function buildExtSections() {
    cardsWrap.classList.toggle("binance-only", binanceOnly());
    summaryPanel.style.display = binanceOnly() ? "none" : "";
    if (binanceOnly()) {
      mount(extSections, h("div", { class: "ghost-tile", style: { margin: "18px 0" } },
        icon("database"),
        h("div", {},
          h("div", { class: "gt-title" }, "External market context hidden"),
          h("div", { class: "gt-sub" }, "Data source is set to “Binance public” only. Switch to “Combined” in the header source selector to see global market cap, top coins, news and more.")),
        h("span", { class: "gt-badge" }, "Binance only")));
      return;
    }
    mount(extSections,
      stocksWrap,
      h("div", { class: "sec-head", id: "sec-prices" }, h("h2", { class: "sec-title" }, "Crypto market prices"), priceNote),
      h("div", { class: "table-tools" }, tabsWrap),
      priceTable,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Top movers today"),
        h("span", { class: "sec-note" }, "source: coingecko + binance · 24h")),
      moversWrap);
    paintPulse();
  }

  const page_ = h("div", { class: "page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Markets"), subLine), regimePill),
      worldWrap,
      h("div", { class: "mkt-hero" },
        h("div", { class: "mkt-hero-main" },
          summaryPanel,
          lensWrap,
          cardsWrap,
          h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Majors")),
          majorsWrap,
          trendingWrap),
        newsRail),
      extSections,
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Basis & funding intelligence"),
        h("a", { class: "ghost-link", href: "/radar", onClick: linkTo("/radar") }, "Open full Radar ›")),
      intelWrap));

  mount(root, tape.el, page_);
  buildTabs();
  paintPriceHead();
  buildExtSections();
  paintWorld();
  paintPulse();
  // header nav deep links: /?sec=world|prices|news scrolls to the section
  const wantSec = new URLSearchParams(location.search).get("sec");
  if (wantSec) {
    setTimeout(() => {
      const target = document.getElementById("sec-" + wantSec);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }
  cleanups.push(onSettings((_, key) => {
    if (key === "source" || key === "*") { buildExtSections(); paintAll(); }
  }));
  cleanups.push(onIconsReady(() => paintAll()));
  function paintAll() {
    paintWorld(); paintSummary(); paintLens(); paintCards(); paintMajors(); paintHead();
    lazyPaint(stocksWrap, paintStocks);
    lazyPaint(priceTable, paintPrices);
    lazyPaint(intelWrap, paintIntel);
    lazyPaint(moversWrap, paintTopMovers);
    paintTrending(); paintPulse();
    if (ov && ov.top_coins) tape.update((ov.top_coins.coins || []).map((c) => ({ ...c, price: px(c) })));
  }

  function paintHead() {
    if (!ov) return;
    const g = ov.global || {};
    const m = ov.metrics || {};
    const bits = [];
    if (g.active_cryptocurrencies) bits.push(fmtCompact(g.active_cryptocurrencies) + " assets globally");
    bits.push(`${m.total_symbols ?? "—"} spot/perp pairs streamed live`);
    bits.push(g.status === "live" ? `global data: ${g.source}` : "global data: " + (g.status || "connecting…"));
    mount(subLine, bits.join(" · "));
    const regime = ov.regime || {};
    const label = regime.regime || "—";
    const dot = label === "ORDERLY" ? "dot-live" : label === "DATA STALE" ? "dot-off" : "dot-stale";
    mount(regimePill, h("span", { class: "dot " + dot }), label.charAt(0) + label.slice(1).toLowerCase());
  }

  // ---- loaders (all pause while the tab is hidden — nothing burns idle) ----
  async function loadOverview() {
    if (document.hidden) return;
    try {
      const res = await api.marketOverview();
      if (!res || res.ok === false) return;
      ov = res;
      paintAll();
    } catch (e) {}
  }
  async function loadSparks() {
    if (document.hidden) return;
    try {
      const res = await api.sparks();
      if (res && res.sparks) { sparks = res.sparks; paintMajors(); }
    } catch (e) {}
  }
  async function loadNews() {
    if (document.hidden) return;
    try { news = await api.newsContext(); paintPulse(); } catch (e) {}
  }

  loadSparks().then(loadOverview);
  loadNews();
  const t1 = setInterval(loadOverview, 5000);    // server TTLs protect providers; live prices tick
  const t2 = setInterval(loadSparks, 12000);
  const t3 = setInterval(loadNews, 25000);       // squawk wire refreshes server-side at 60s
  const t4 = setInterval(() => {                 // "3m ago" stays honest between polls
    for (const ref of timeRefs) ref.el.textContent = timeAgo(ref.iso);
  }, 20000);
  cleanups.push(() => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); });
  cleanups.push(onLive(() => {})); // tape handles itself; cards update via overview poll

  return () => cleanups.forEach((c) => c());
}
