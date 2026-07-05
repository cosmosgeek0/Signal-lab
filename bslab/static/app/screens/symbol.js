// Asset profile page. Exchange-native chart first, external metadata second.
// No fake history, no "NaN", no dead clickable surfaces.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon, starIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { linkTo, navigate, isStarred, toggleStar, getTheme, store } from "../lib/store.js";
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

const PRICE_WINDOWS = [
  ["1h", "1h"],
  ["24h", "1"],
  ["7d", "7"],
  ["30d", "30"],
  ["1y", "365"],
  ["5y", "1825"],
  ["all", "max"],
];
const LOCAL_WINDOWS = ["5m", "15m", "1h", "4h", "24h", "7d", "all"];
const PRICE_SERIES = [["price", "Price"], ["volume", "Volume"], ["mcap", "Market cap"]];
const PERIODS = [
  ["1 day", 24 * 3600 * 1000],
  ["1 week", 7 * 24 * 3600 * 1000],
  ["1 month", 30 * 24 * 3600 * 1000],
  ["6 months", 182 * 24 * 3600 * 1000],
  ["1 year", 365 * 24 * 3600 * 1000],
  ["5 years", 5 * 365 * 24 * 3600 * 1000],
  ["All time", null],
];

const WINDOW_MS = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  all: 24 * 60 * 60 * 1000,
};

const ABOUT = {
  BTC: "Bitcoin is the original decentralized digital asset. It settles transfers on a public blockchain, has a fixed supply schedule, and is widely used as the market's reserve crypto benchmark.",
  ETH: "Ethereum is a programmable blockchain used for smart contracts, DeFi, token issuance, stablecoins, NFTs, and settlement across many on-chain applications.",
  SOL: "Solana is a high-throughput blockchain focused on fast settlement, consumer applications, DeFi, and low-cost on-chain execution.",
  BNB: "BNB is the native asset associated with the BNB Chain ecosystem and Binance-linked utility, used across exchange, chain, and application activity.",
  XRP: "XRP is a digital asset used by the XRP Ledger, a payments-focused blockchain designed around fast settlement and low transaction costs.",
  DOGE: "Dogecoin is an early proof-of-work cryptocurrency known for simple transfers, high liquidity, and broad retail market recognition.",
  USDT: "Tether USDt is a dollar-referenced stablecoin used as a major settlement and quote asset across crypto venues.",
  USDC: "USD Coin is a dollar-referenced stablecoin commonly used for payments, DeFi liquidity, and exchange settlement.",
};

const SLUGS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "bnb",
  XRP: "xrp",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  XLM: "stellar",
  BCH: "bitcoin-cash",
  LTC: "litecoin",
  UNI: "uniswap",
  DOT: "polkadot",
  MATIC: "matic-network",
  USDT: "tether",
  USDC: "usd-coin",
};

const CMC_SLUGS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "bnb",
  XRP: "xrp",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  LINK: "chainlink",
  AVAX: "avalanche",
  XLM: "stellar",
  BCH: "bitcoin-cash",
  LTC: "litecoin",
  UNI: "uniswap",
  DOT: "polkadot-new",
  MATIC: "polygon",
  USDT: "tether",
  USDC: "usd-coin",
};

const chartSrcPref = () => { try { return localStorage.getItem("cg-chartsrc") || "native"; } catch (e) { return "native"; } };
const setChartSrcPref = (v) => { try { localStorage.setItem("cg-chartsrc", v); } catch (e) {} };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const safePct = (v, digits = 2) => num(v) == null ? "—" : fmtPct(v, digits);
const pctSigned = (v) => num(v) == null ? "—" : (Number(v) >= 0 ? "↗ " : "↘ ") + fmtPct(Number(v));
const byTime = (arr) => (arr || []).map(([t, v]) => ({ t: Number(t), v: Number(v) }))
  .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
const profileSlug = (base, id) => (id || SLUGS[base] || base.toLowerCase());
const cmcSlug = (base, id) => (CMC_SLUGS[base] || id || base.toLowerCase());

export function renderSymbol(root, symbol) {
  const params = new URLSearchParams(location.search);
  let tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  let win = "1h";
  let priceWin = "24h";
  let priceSeries = "price";
  let chartSrc = chartSrcPref();
  let history = [];
  let latest = null;
  let profile = null;
  let coin = null;
  let news = null;
  let extCache = {};
  let hadHistory = false;
  let resizeTimer = null;
  let extRetryTimer = null;

  const base = baseOf(symbol);
  const quote = quoteOf(symbol) || "USDT";
  const cleanSymbol = base + quote;
  const cleanups = [];

  const page = h("div", { class: "page asset-pro" },
    h("div", { class: "container page-wide asset-pro-wrap" }));
  const shell = page.querySelector(".asset-pro-wrap");
  mount(root, page);

  const starBtn = h("button", { class: "icon-btn asset-star", title: "Watch", onClick: () => { toggleStar(cleanSymbol); paintStar(); } });
  const titleIcon = h("div", { class: "asset-title-icon" }, tokenIcon(base, 120));
  const titleEl = h("h1", { class: "asset-title" }, base);
  const pairChip = h("button", { class: "asset-pair-chip", onClick: () => navigate(`/symbol/${cleanSymbol}`) },
    cleanSymbol, h("span", {}, "Crypto assets"));
  const liveChip = h("span", { class: "asset-live-chip" }, h("span", { class: "dot" }), "Connecting");
  const priceEl = h("span", { class: "asset-price headline-val num" }, "—");
  const quoteEl = h("span", { class: "asset-price-quote" }, quote);
  const changeEl = h("span", { class: "asset-change num" }, "—");
  const asOfEl = h("div", { class: "asset-asof" }, "Loading market data...");
  const heroStats = h("div", { class: "asset-hero-stats" });
  const tabBar = h("div", { class: "atabs asset-tabs", role: "tablist" });
  const chartModeSeg = h("div", { class: "seg asset-chart-mode" });
  const chartSourceSeg = h("div", { class: "seg asset-source-mode" });
  const windowSeg = h("div", { class: "win asset-windows" });
  const chartMeta = h("div", { class: "chart-meta" });
  const chartBody = h("div", { class: "chart-body asset-chart-body" });
  const returnStrip = h("div", { class: "asset-return-strip" });
  const marketContext = h("section", { class: "asset-market-context" });
  const sideRail = h("aside", { class: "asset-side" });
  const terminalRail = h("aside", { class: "asset-terminal-rail" });
  const chartShell = h("section", { class: "asset-chart-card chart-shell" },
    h("div", { class: "chart-head asset-chart-head" },
      chartModeSeg,
      chartSourceSeg,
      h("div", { class: "spacer" }),
      windowSeg),
    chartBody,
    h("div", { class: "asset-chart-foot" }, chartMeta),
    returnStrip);
  const terminalGrid = h("div", { class: "asset-terminal-grid" }, chartShell, terminalRail);
  const mainBody = h("div", { class: "asset-body" });

  mount(shell,
    h("a", { class: "back-link asset-back", href: "/", onClick: linkTo("/") }, icon("arrowLeft"), "Markets"),
    h("section", { class: "asset-shell asset-profile-shell" },
      h("div", { class: "asset-profile-head asset-hero" },
        h("div", { class: "asset-identity" },
          titleIcon,
          h("div", { class: "asset-profile-copy" },
            h("div", { class: "asset-breadcrumb" }, "Markets", h("span", {}, "/"), "Crypto", h("span", {}, "/"), base),
            h("div", { class: "asset-title-row" }, titleEl, starBtn),
            h("div", { class: "asset-chip-row" }, pairChip, liveChip))),
        h("div", { class: "asset-quote-block" },
          h("div", { class: "asset-source-stack" },
            h("button", { class: "source-pill", onClick: () => setTab("quality") }, "Sources"),
            h("a", { class: "source-pill", href: `https://www.coingecko.com/en/coins/${profileSlug(base)}`, target: "_blank", rel: "noopener noreferrer" }, "CoinGecko"),
            h("a", { class: "source-pill", href: `https://coinmarketcap.com/currencies/${cmcSlug(base)}/`, target: "_blank", rel: "noopener noreferrer" }, "CoinMarketCap"),
            h("a", { class: "source-pill", href: `https://www.tradingview.com/symbols/${base}USDT/`, target: "_blank", rel: "noopener noreferrer" }, "TradingView")),
          h("div", { class: "asset-price-row" },
            h("div", {}, h("div", {}, priceEl, quoteEl, changeEl), asOfEl))),
        heroStats),
      tabBar,
      h("main", { class: "asset-main asset-workbench" },
        marketContext,
        h("section", { class: "asset-chart-stage" }, chartShell),
        mainBody)));

  buildTabs();
  paintStar();
  paintSideRail();
  paintTerminal();
  paintHeroStats();
  paintMarketContext();
  paintBody(true);
  loadLatest();
  loadHistory(true);
  loadProfile();
  loadNews();

  const pollLatest = setInterval(loadLatest, 3000);
  const pollHistory = setInterval(() => { if (chartModeOf()) loadHistory(false); }, 30000);
  const pollProfile = setInterval(loadProfile, 120000);
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (chartModeOf() && chartSrc !== "tv") drawChart(false); }, 120);
  };
  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    clearInterval(pollLatest);
    clearInterval(pollHistory);
    clearInterval(pollProfile);
    clearTimeout(extRetryTimer);
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
  });
  return () => cleanups.forEach((c) => c());

  function chartModeOf() {
    return (TABS.find((t) => t.id === tab) || TABS[0]).chart;
  }

  function isPriceTab() {
    return chartModeOf() === "price";
  }

  function priceDays() {
    return (PRICE_WINDOWS.find(([label]) => label === priceWin) || PRICE_WINDOWS[1])[1];
  }

  function isStockProfile() {
    return !!(coin && coin.kind === "stock");
  }

  function paintStar() {
    starBtn.replaceChildren(starIcon(isStarred(cleanSymbol)));
  }

  function buildTabs() {
    mount(tabBar, TABS.map((t) =>
      h("button", {
        class: "atab" + (t.id === tab ? " on" : ""),
        role: "tab",
        onClick: () => setTab(t.id),
      }, t.label)));
  }

  function setTab(id) {
    tab = id;
    const url = new URL(location.href);
    url.searchParams.set("tab", id);
    try { window.history.replaceState({}, "", url.pathname + url.search); } catch (e) {}
    buildTabs();
    paintBody(true);
  }

  function paintHeadline() {
    const livePrice = latest ? num(latest.spot_mid) : null;
    const profilePrice = coin ? num(coin.price) : null;
    const chartPrice = latestExtPrice();
    const extMeta = latestExtMeta();
    const px = chartPrice ?? profilePrice ?? livePrice;
    if (px != null) countUp(priceEl, px, fmtPrice);
    quoteEl.textContent = quote === "USDT" || quote === "USDC" ? "USD" : quote;
    const changePct = coin && num(coin.chg24h) != null ? Number(coin.chg24h) : changeFromExt("1");
    const abs = coin && num(coin.price_change_24h) != null ? Number(coin.price_change_24h)
      : px != null && changePct != null ? px - px / (1 + changePct / 100) : null;
    changeEl.className = "asset-change num " + signClass(changePct);
    changeEl.textContent = changePct != null
      ? `${abs != null ? fmtPrice(abs) + " " : ""}${fmtPct(changePct)}`
      : "—";
    const sourceLabel = extMeta
      ? `${extMeta.provider || extMeta.source || "market"}${extMeta.interval ? " · " + extMeta.interval : ""}`
      : coin && coin.profile_source ? coin.profile_source
      : latest ? "local exchange snapshot"
      : "metadata loading";
    const pointCount = extMeta ? (Array.isArray(extMeta.prices) ? extMeta.prices.length : num(extMeta.raw_points)) : null;
    const age = extMeta ? `${pointCount || "market"} points`
      : latest ? `snapshot updated ${fmtAge(latest.age_seconds)} ago`
      : "server cache";
    asOfEl.textContent = `As of now · price from ${sourceLabel} · ${age}`;
    liveChip.className = "asset-live-chip " + (chartPrice != null || latest ? "ok" : "warn");
    liveChip.replaceChildren(h("span", { class: "dot" }), chartPrice != null ? "Exchange chart live" : latest ? "Live exchange pair" : "External profile only");
    paintHeroStats();
    paintMarketContext();
  }

  function statPill(label, value, cls = "") {
    return h("div", { class: "asset-stat-pair " + cls },
      h("span", {}, label),
      h("b", { class: "num" }, value == null || value === "" ? "—" : value));
  }

  function paintHeroStats() {
    const vol = coin && num(coin.volume) != null ? Number(coin.volume) : null;
    const mcap = coin && num(coin.mcap) != null ? Number(coin.mcap) : null;
    const supply = coin && num(coin.supply) != null ? Number(coin.supply) : null;
    const fdv = coin && num(coin.fdv) != null ? Number(coin.fdv) : null;
    const chg7 = coin && num(coin.chg7d) != null ? Number(coin.chg7d) : changeFromExt("7");
    const basis = latest && num(latest.mid_spread_bps) != null ? Number(latest.mid_spread_bps) : null;
    mount(heroStats,
      statPill("Rank", coin && coin.rank ? "#" + coin.rank : "—"),
      statPill("Market cap", fmtMoney(mcap)),
      statPill("24h volume", fmtMoney(vol)),
      statPill("7d", safePct(chg7), signClass(chg7)),
      statPill("Supply", supply != null ? `${fmtCompact(supply)} ${base}` : "—"),
      statPill("Basis", basis == null ? "—" : `${fmtBasisVal(basis, true)} ${basisUnit()}`, signClass(basis)),
      statPill("FDV", fmtMoney(fdv)),
      statPill("Venue", latest ? cleanSymbol : "profile"));
  }

  function contextRow(kind, primary, secondary, value, cls = "") {
    return h("div", { class: "asset-context-row" },
      h("div", { class: "asset-context-kind" }, kind),
      h("div", { class: "asset-context-copy" },
        h("b", {}, primary),
        h("span", {}, secondary || "—")),
      h("div", { class: "asset-context-value num " + cls }, value == null || value === "" ? "—" : value));
  }

  function paintMarketContext() {
    const px = latestExtPrice() ?? (coin && num(coin.price) != null ? Number(coin.price) : latest && num(latest.spot_mid));
    const vol = coin && num(coin.volume) != null ? Number(coin.volume) : null;
    const mcap = coin && num(coin.mcap) != null ? Number(coin.mcap) : null;
    const turnover = vol != null && mcap ? (vol / mcap) * 100 : null;
    const basis = latest && num(latest.mid_spread_bps) != null ? Number(latest.mid_spread_bps) : null;
    const funding = latest && num(latest.funding_rate) != null ? Number(latest.funding_rate) : null;
    const provider = latestExtMeta();
    mount(marketContext,
      h("div", { class: "asset-context-head" },
        h("div", {},
          h("span", {}, "Volume / exchange context"),
          h("b", {}, latest ? `${cleanSymbol} live venue + public profile data` : "Public profile data while local venue warms")),
        h("button", { class: "asset-context-action", type: "button", onClick: () => setTab("quality") }, "Data quality")),
      h("div", { class: "asset-context-list" },
        contextRow("Price", provider ? `${provider.provider || provider.source || "market"} chart` : coin && coin.profile_source ? coin.profile_source : "Latest snapshot", `Primary display in ${quote === "USDT" || quote === "USDC" ? "USD" : quote}`, px == null ? "—" : fmtPrice(px)),
        contextRow("Liquidity", "24h traded volume", turnover == null ? "Turnover unavailable" : `${turnover.toFixed(2)}% of market cap`, fmtMoney(vol)),
        contextRow("Exchange", latest ? "Spot/perp pair tracked" : "Local venue not tracked", latest ? `Spot ${fmtPrice(latest.spot_mid)} · Perp ${fmtPrice(latest.futures_mid)}` : "Chart remains source-backed", basis == null ? "—" : `${fmtBasisVal(basis, true)} ${basisUnit()}`, signClass(basis)),
        contextRow("Funding", "Perpetual funding / 8h", latest ? `Feed age ${fmtAge(latest.age_seconds)}` : "No local perp snapshot", funding == null ? "—" : fmtFunding(funding), signClass(funding))));
  }

  function paintTerminal() {
    mount(terminalRail,
      terminalBook(),
      terminalTicks(),
      terminalTicket());
  }

  function terminalPanel(title, body, cls = "") {
    return h("section", { class: "asset-terminal-panel " + cls },
      h("div", { class: "terminal-panel-head" },
        h("b", {}, title),
        h("span", {}, latest ? `updated ${fmtAge(latest.age_seconds)} ago` : "warming")),
      body);
  }

  function terminalBook() {
    if (!latest) {
      return terminalPanel("Book", h("div", { class: "terminal-empty" }, "Waiting for Binance top-of-book snapshot."), "terminal-book");
    }
    const mid = num(latest.spot_mid) || num(latest.futures_mid) || latestExtPrice();
    const rows = [
      { side: "ask", label: "Perp ask", px: num(latest.fut_ask), meta: "perp" },
      { side: "ask", label: "Spot ask", px: num(latest.spot_ask), meta: "spot" },
      { side: "mid", label: "Mid", px: mid, meta: `${fmtBasisVal(latest.mid_spread_bps, true)} ${basisUnit()}` },
      { side: "bid", label: "Spot bid", px: num(latest.spot_bid), meta: "spot" },
      { side: "bid", label: "Perp bid", px: num(latest.fut_bid), meta: "perp" },
    ].filter((r) => r.px != null);
    const maxEdge = Math.max(1, ...rows.map((r) => Math.abs((r.px || 0) - (mid || r.px || 0))));
    return terminalPanel("Book", h("div", { class: "terminal-book-table" },
      h("div", { class: "terminal-book-head" }, h("span", {}, "Price (USD)"), h("span", {}, "Feed"), h("span", {}, "Edge")),
      rows.map((r) => {
        const edge = mid != null ? r.px - mid : 0;
        const width = Math.max(12, Math.min(100, Math.abs(edge) / maxEdge * 100));
        return h("div", { class: "terminal-book-row " + r.side },
          h("span", { class: "book-bg", style: { "--w": width + "%" } }),
          h("span", { class: "num px" }, fmtPrice(r.px)),
          h("span", {}, r.meta),
          h("span", { class: "num" }, edge ? fmtBps((edge / r.px) * 10000) + " bps" : "mid"));
      }),
      h("div", { class: "terminal-book-foot" }, "Top book only · full depth is not stored by this app.")), "terminal-book");
  }

  function terminalTicks() {
    const rows = history.slice(-16).reverse();
    if (!rows.length) return terminalPanel("Tape", terminalMarketTape(), "terminal-trades");
    return terminalPanel("Tape", h("div", { class: "terminal-trade-list" },
      rows.map((r, i) => {
        const next = rows[i + 1];
        const px = num(r.spot_mid);
        const prev = next ? num(next.spot_mid) : null;
        const cls = prev == null || px == null ? "" : px >= prev ? "bid" : "ask";
        return h("div", { class: "terminal-trade-row " + cls },
          h("span", { class: "num" }, px == null ? "—" : fmtPrice(px)),
          h("span", { class: "num" }, fmtBasisVal(r.mid_spread_bps, true)),
          h("span", { class: "num" }, fmtTimeShort(r.ts_ms)));
      })), "terminal-trades");
  }

  function terminalMarketTape() {
    const rows = ((store.lite && store.lite.ticker) || []).filter((r) => r && r.symbol).slice(0, 16);
    if (!rows.length) return h("div", { class: "terminal-empty" }, "Recent ticks are warming from local history.");
    return h("div", { class: "terminal-trade-list" },
      rows.map((r) => h("button", { class: "terminal-trade-row " + signClass(r.mid_spread_bps), type: "button", onClick: () => navigate("/symbol/" + r.symbol) },
        h("span", { class: "num" }, fmtPrice(r.spot_mid)),
        h("span", { class: "num" }, fmtBasisVal(r.mid_spread_bps, true)),
        h("span", { class: "num" }, baseOf(r.symbol)))));
  }

  function terminalTicket() {
    const px = latestExtPrice() ?? (latest ? num(latest.spot_mid) : null);
    return h("section", { class: "asset-terminal-panel terminal-ticket" },
      h("div", { class: "ticket-switch" },
        h("button", { type: "button", class: "on", disabled: true }, "Buy"),
        h("button", { type: "button", disabled: true }, "Sell")),
      h("div", { class: "ticket-mode" },
        h("button", { type: "button", class: "on", disabled: true }, "Limit"),
        h("button", { type: "button", disabled: true }, "Market"),
        h("button", { type: "button", disabled: true }, "Conditional")),
      ticketField("Price", px == null ? "—" : fmtPrice(px), quote === "USDT" || quote === "USDC" ? "USD" : quote),
      ticketField("Quantity", "0", base),
      ticketField("Order value", "0", "USD"),
      h("button", { class: "ticket-disabled", type: "button", disabled: true }, "Read-only terminal"),
      h("a", { class: "ticket-link", href: `https://www.binance.com/en/trade/${base}_${quote}`, target: "_blank", rel: "noopener noreferrer" }, "Open Binance", icon("arrowUpRight")),
      h("a", { class: "ticket-link secondary", href: `https://www.tradingview.com/symbols/${base}USDT/`, target: "_blank", rel: "noopener noreferrer" }, "Open TradingView", icon("arrowUpRight")),
      h("div", { class: "ticket-note" }, "No keys, no orders, no account access. External links open real trading venues."));
  }

  function ticketField(label, value, unit) {
    return h("label", { class: "ticket-field" },
      h("span", {}, label),
      h("div", {}, h("input", { value, disabled: true }), h("b", {}, unit)));
  }

  function paintProfileHeader() {
    const name = coin && coin.name ? coin.name : base;
    titleIcon.replaceChildren(tokenIcon(base, 120));
    titleEl.replaceChildren(name);
    pairChip.replaceChildren(cleanSymbol, h("span", {}, isStockProfile() ? "Tokenized equity" : "Crypto assets"));
    const links = Array.from(document.querySelectorAll(".asset-source-stack a"));
    if (links[0]) links[0].href = `https://www.coingecko.com/en/coins/${profileSlug(base, coin && coin.id)}`;
    if (links[1]) links[1].href = `https://coinmarketcap.com/currencies/${cmcSlug(base, coin && coin.id)}/`;
  }

  function paintSideRail() {
    const about = ABOUT[base] || (coin && coin.name
      ? `${coin.name} is tracked as a market asset in this workspace. The page shows exchange-native price history when available and labels every secondary data source.`
      : `${base} is tracked as a market asset in this workspace. Secondary profile data appears only when a public source returns it.`);
    const lead = bestHeadline();
    mount(sideRail,
      h("section", { class: "asset-side-card about-card" },
        h("h2", {}, "About " + (coin && coin.name ? coin.name : base)),
        h("p", {}, about),
        h("div", { class: "asset-side-actions" },
          h("a", { href: `https://www.tradingview.com/symbols/${base}USDT/`, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "TradingView"),
          h("a", { href: coin && coin.id ? `https://www.coingecko.com/en/coins/${coin.id}` : `https://www.binance.com/en/trade/${base}_${quote}`, target: "_blank", rel: "noopener noreferrer" }, icon("external"), coin && coin.id ? "Profile" : "Exchange"))),
      h("section", { class: "asset-side-card now-card" },
        h("h2", {}, "Happening now"),
        lead
          ? h("a", { class: "now-link", href: lead.url || "#", target: "_blank", rel: "noopener noreferrer" },
              h("span", { class: "now-source" }, lead.domain || lead.source || "news"),
              h("b", {}, lead.title || lead.headline),
              h("span", {}, lead.time ? String(lead.time).replace("T", " ").replace("Z", " UTC") : "latest"))
          : h("div", { class: "muted" }, "Asset-specific headlines are loading. Market-wide news is available in the News tab.")),
      h("section", { class: "asset-side-card explore-card" },
        h("h2", {}, "Keep exploring"),
        h("p", {}, "Compare liquidity, price action, and derivative pressure against adjacent assets."),
        h("button", { class: "asset-primary", onClick: () => setTab("stats") }, "Explore stats")));
  }

  function buildChartControls() {
    if (!chartModeOf()) return;
    mount(chartModeSeg, isPriceTab()
      ? PRICE_SERIES.map(([id, label]) => h("button", { class: priceSeries === id ? "on" : "", onClick: () => { priceSeries = id; drawChart(true); } }, label))
      : [h("button", { class: "on" }, TABS.find((t) => t.id === tab)?.label || "Chart")]);

    const allowTv = isPriceTab() && !isStockProfile();
    chartSourceSeg.style.display = allowTv ? "" : "none";
    if (allowTv) {
      mount(chartSourceSeg,
        h("button", { class: chartSrc === "native" ? "on" : "", onClick: () => { chartSrc = "native"; setChartSrcPref("native"); drawChart(true); } }, "Chart"),
        h("button", { class: chartSrc === "tv" ? "on" : "", onClick: () => { chartSrc = "tv"; setChartSrcPref("tv"); drawChart(false); } }, "TradingView"));
    }

    mount(windowSeg, (isPriceTab() ? PRICE_WINDOWS : LOCAL_WINDOWS.map((w) => [w, w])).map(([label]) =>
      h("button", {
        class: (isPriceTab() ? priceWin === label : win === label) ? "on" : "",
        onClick: () => {
          if (isPriceTab()) {
            priceWin = label;
            loadExt(true);
          } else {
            win = label;
            hadHistory = false;
            loadHistory(true);
          }
          buildChartControls();
        },
      }, label)));
  }

  function localSeries() {
    const mode = chartModeOf();
    let fn;
    if (mode === "funding") fn = (r) => (num(r.funding_rate) || 0) * 100;
    else if (mode === "spread") fn = (r) => (num(r.spot_spread_bps) || 0) + (num(r.futures_spread_bps) || 0);
    else if (mode === "basis") fn = (r) => num(r.mid_spread_bps);
    else fn = (r) => num(r.spot_mid);
    const pts = history.map((r) => ({ t: Number(r.ts_ms), v: fn(r) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    if (pts.length >= 2 || !latest) return pts;
    const v = fn(latest);
    if (!Number.isFinite(v)) return pts;
    const end = Number(latest.ts_ms) || Date.now();
    const span = WINDOW_MS[win] || WINDOW_MS["1h"];
    return [{ t: end - span, v }, { t: end, v, snapshot: true }];
  }

  function localSourceLabel() {
    if (history.length >= 2) return `Binance local cache · ${history.length} raw pts · ${win}`;
    if (latest) return `Binance live snapshot · waiting for ${win} history`;
    return "Data unavailable";
  }

  function selectedExtSeries() {
    const data = extCache[priceDays()];
    if (!data) return null;
    const src = priceSeries === "volume" ? data.volumes : priceSeries === "mcap" ? data.mcaps : data.prices;
    return byTime(src);
  }

  function drawChart(animate = false) {
    if (!chartModeOf()) return;
    buildChartControls();
    if (isPriceTab() && chartSrc === "tv" && !isStockProfile()) {
      const theme = getTheme() === "dark" ? "dark" : "light";
      const tvSymbol = latest ? `BINANCE%3A${cleanSymbol}` : encodeURIComponent(base + "USD");
      mount(chartBody, h("iframe", {
        src: `https://s.tradingview.com/widgetembed/?symbol=${tvSymbol}&interval=60&theme=${theme}&style=1&locale=en&hidesidetoolbar=1&symboledit=0&saveimage=0&withdateranges=1`,
        style: { width: "100%", height: "500px", border: "0", display: "block" },
        loading: "lazy",
        allow: "fullscreen",
        title: "TradingView chart",
      }));
      chartMeta.textContent = "External chart · values not stored locally";
      paintReturns();
      return;
    }

    let series = isPriceTab() ? selectedExtSeries() : localSeries();
    const data = isPriceTab() ? extCache[priceDays()] : null;
    if (isPriceTab() && !data) {
      const fallback = localSeries();
      if (fallback.length >= 2) {
        series = fallback;
        chartMeta.textContent = "Binance local cache · external history loading";
      } else {
        mount(chartBody, h("div", { class: "chart-empty", style: { height: "500px" } }, "Loading exchange chart history..."));
        chartMeta.textContent = "Binance spot · requesting candles";
        paintReturns();
        return;
      }
    }
    if (isPriceTab() && data && (!series || series.length < 2)) {
      mount(chartBody, h("div", { class: "chart-empty", style: { height: "500px" } },
        priceSeries === "mcap"
          ? "Market-cap history is unavailable from the secondary source. Price and volume remain live."
          : "This chart series is unavailable right now."));
      chartMeta.textContent = `${data.provider || data.source || "market data"} · ${priceSeries} unavailable`;
      paintReturns();
      return;
    }
    if (!series || series.length < 2) {
      mount(chartBody, h("div", { class: "chart-empty", style: { height: "500px" } }, "No history in this window yet."));
      chartMeta.textContent = latest ? "Binance local cache · waiting for history" : "Data unavailable";
      paintReturns();
      return;
    }

    const first = series[0].v;
    const last = series[series.length - 1].v;
    const up = last >= first;
    const mode = chartModeOf();
    let color = up ? "var(--up)" : "var(--down)";
    let valueFmt = fmtPrice;
    let axisFmt = fmtPrice;
    let zeroLine = false;
    if (isPriceTab() && priceSeries === "volume") {
      valueFmt = fmtMoney; axisFmt = fmtMoney; color = "var(--accent)";
    } else if (isPriceTab() && priceSeries === "mcap") {
      valueFmt = fmtMoney; axisFmt = fmtMoney;
    } else if (mode === "funding") {
      valueFmt = (v) => v.toFixed(4) + "%"; axisFmt = (v) => v.toFixed(3) + "%"; zeroLine = true; color = last >= 0 ? "var(--up)" : "var(--down)";
    } else if (mode === "basis") {
      valueFmt = (v) => fmtBps(v, true) + " " + basisUnit(); axisFmt = (v) => fmtBps(v); zeroLine = true; color = last >= 0 ? "var(--up)" : "var(--down)";
    } else if (mode === "spread") {
      valueFmt = (v) => fmtBps(v) + " bps"; axisFmt = (v) => fmtBps(v); color = "var(--accent)";
    }
    const wide = isPriceTab() ? ["30d", "1y", "5y", "all"].includes(priceWin) : ["24h", "7d", "all"].includes(win);
    const timeFmt = wide ? (t) => {
      const d = new Date(t);
      const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
      return priceWin === "all" || priceWin === "5y" ? String(d.getUTCFullYear()) : `${m} ${d.getUTCDate()}`;
    } : fmtTimeShort;

    renderChart(chartBody, series, {
      color, valueFmt, axisFmt, zeroLine, timeFmt, tipTimeFmt: fmtDateTime,
      height: 500, dotted: true, animate,
    });
    if (isPriceTab()) {
      const provider = data ? (data.provider || data.source || "market data") : "Binance local cache";
      const secondary = data && data.secondary_source ? ` + ${data.secondary_source} market cap` : "";
      chartMeta.textContent = `${provider}${secondary} · ${data?.symbol || cleanSymbol} · ${data?.interval || priceWin} · ${data?.raw_points || series.length} raw pts`;
    } else {
      chartMeta.textContent = localSourceLabel();
    }
    paintReturns();
  }

  function paintReturns() {
    const series = byTime((extCache.max || extCache["365"] || extCache[priceDays()] || {}).prices);
    const livePct = coin && num(coin.chg24h) != null ? Number(coin.chg24h) : changeFromExt("1");
    const values = PERIODS.map(([label, ms]) => {
      let v = null;
      if (label === "1 day") v = livePct;
      else if (label === "1 week" && coin && num(coin.chg7d) != null) v = Number(coin.chg7d);
      else if (label === "1 month" && coin && num(coin.chg30d) != null) v = Number(coin.chg30d);
      else if (label === "1 year" && coin && num(coin.chg1y) != null) v = Number(coin.chg1y);
      else v = pctFromSeries(series, ms);
      return h("div", { class: "return-cell " + signClass(v) },
        h("span", {}, label),
        h("b", { class: "num" }, v == null ? "—" : fmtPct(v)));
    });
    mount(returnStrip, values);
  }

  function paintBody(animate = false) {
    buildChartControls();
    paintMarketContext();
    if (chartModeOf()) {
      mount(mainBody,
        panelGrid(tab === "overview"
          ? [panelAbout(), panelTradingInsights(), panelMarketStats()]
          : tab === "price"
            ? [panelPriceHistory(), panelMarketStats(), panelCompare()]
            : tab === "basis"
              ? [panelSnapshot(), panelLadder(), panelExtremes("basis")]
              : tab === "funding"
                ? [panelSnapshot(), panelExtremes("funding"), panelQuality()]
                : [panelSnapshot(), panelLadder(), panelQuality()]),
        tab === "overview" ? panelGrid([panelPerformance(), panelCompare(), panelPriceHistory()]) : null);
      loadExt(animate);
      drawChart(animate);
    } else if (tab === "stats") {
      mount(mainBody, panelGrid([panelTradingInsights(), panelMarketStats(), panelPerformance()]),
        panelGrid([panelSnapshot(), panelNetwork(), panelQuality()]));
    } else if (tab === "news") {
      mount(mainBody, panelGrid([panelNews()], "single"));
      if (!news) loadNews();
    } else {
      mount(mainBody, panelGrid([panelQuality(), panelSnapshot(), panelNetwork()]));
    }
    paintSideRail();
  }

  function panelGrid(cards, extra = "") {
    return h("div", { class: "asset-panels asset-info-grid " + extra }, cards);
  }

  function kv(k, v, cls = "") {
    return h("div", { class: "kv" },
      h("div", { class: "k" }, k),
      h("div", { class: "v num " + cls }, v == null || v === "" ? "—" : v));
  }

  function panelCard(title, kids, cls = "") {
    return h("section", { class: "apanel asset-panel-card " + cls }, h("h3", {}, title), kids);
  }

  function panelAbout() {
    const about = ABOUT[base] || (coin && coin.name
      ? `${coin.name} is tracked as a market asset in this workspace. The page shows exchange-native price history when available and labels every secondary data source.`
      : `${base} is tracked as a market asset in this workspace. Secondary profile data appears only when a public source returns it.`);
    return panelCard("About " + (coin && coin.name ? coin.name : base),
      h("div", { class: "asset-about-open" },
        h("p", {}, about),
        h("div", { class: "asset-reference-row" },
          h("a", { href: `https://www.coingecko.com/en/coins/${profileSlug(base, coin && coin.id)}`, target: "_blank", rel: "noopener noreferrer" }, "CoinGecko profile", icon("arrowUpRight")),
          h("a", { href: `https://coinmarketcap.com/currencies/${cmcSlug(base, coin && coin.id)}/`, target: "_blank", rel: "noopener noreferrer" }, "CoinMarketCap", icon("arrowUpRight")),
          h("a", { href: `https://www.tradingview.com/symbols/${base}USDT/`, target: "_blank", rel: "noopener noreferrer" }, "TradingView", icon("arrowUpRight")))));
  }

  function panelTradingInsights() {
    const chg24 = coin && num(coin.chg24h) != null ? Number(coin.chg24h) : changeFromExt("1");
    const chg7 = coin && num(coin.chg7d) != null ? Number(coin.chg7d) : changeFromExt("7");
    const vol = coin && num(coin.volume) != null ? Number(coin.volume) : null;
    const mcap = coin && num(coin.mcap) != null ? Number(coin.mcap) : null;
    const turnover = vol != null && mcap ? (vol / mcap) * 100 : null;
    const pressure = chg24 == null ? null : Math.max(0, Math.min(100, 50 + chg24 * 4));
    const gauge = h("div", { class: "asset-gauge", style: { "--gauge": `${pressure == null ? 50 : pressure}%` } },
      h("div", {},
        h("b", { class: "num " + signClass(chg24) }, safePct(chg24)),
        h("span", {}, "24h momentum")));
    return panelCard("Trading insights",
      h("div", { class: "asset-insight-grid" },
        gauge,
        kv("24h move", safePct(chg24), signClass(chg24)),
        kv("7d move", safePct(chg7), signClass(chg7)),
        kv("24h volume", fmtMoney(vol)),
        kv("Volume / mcap", turnover == null ? "—" : `${turnover.toFixed(2)}%`),
        kv("Rank", coin && coin.rank ? "#" + coin.rank : "—")));
  }

  function panelMarketStats() {
    return panelCard("Market stats", h("div", { class: "kv-grid" },
      kv("Market cap", fmtMoney(coin && coin.mcap)),
      kv("FDV", fmtMoney(coin && coin.fdv)),
      kv("Circ. supply", coin && coin.supply != null ? `${fmtCompact(coin.supply)} ${base}` : "—"),
      kv("Max supply", coin && coin.max_supply != null ? `${fmtCompact(coin.max_supply)} ${base}` : coin && coin.total_supply != null ? `${fmtCompact(coin.total_supply)} ${base}` : "—"),
      kv("Total supply", coin && coin.total_supply != null ? `${fmtCompact(coin.total_supply)} ${base}` : "—"),
      kv("24h volume", fmtMoney(coin && coin.volume))));
  }

  function panelPerformance() {
    return panelCard("Performance", h("div", { class: "kv-grid" },
      kv("1 hour", safePct(coin && coin.chg1h), signClass(coin && coin.chg1h)),
      kv("24 hours", safePct(coin && coin.chg24h), signClass(coin && coin.chg24h)),
      kv("7 days", safePct(coin && coin.chg7d), signClass(coin && coin.chg7d)),
      kv("30 days", safePct(coin && coin.chg30d), signClass(coin && coin.chg30d)),
      kv("200 days", safePct(coin && coin.chg200d), signClass(coin && coin.chg200d)),
      kv("1 year", safePct(coin && coin.chg1y), signClass(coin && coin.chg1y))));
  }

  function panelSnapshot() {
    const r = latest;
    return panelCard("Exchange snapshot", r ? h("div", { class: "kv-grid" },
      kv("Spot mid", fmtPrice(r.spot_mid)),
      kv("Perp mid", fmtPrice(r.futures_mid)),
      kv("Basis", `${fmtBasisVal(r.mid_spread_bps, true)} ${basisUnit()}`, signClass(r.mid_spread_bps)),
      kv("Funding / 8h", fmtFunding(r.funding_rate), signClass(r.funding_rate)),
      kv("Spot spread", `${fmtBps(r.spot_spread_bps)} bps`),
      kv("Perp spread", `${fmtBps(r.futures_spread_bps)} bps`),
      kv("Feed age", fmtAge(r.age_seconds)),
      kv("Score", fmtScore(r.opportunity_score)))
      : h("div", { class: "asset-empty" }, "This asset is not in the local Binance spot/perp radar yet. Price history can still come from the exchange or public profile source."));
  }

  function panelLadder() {
    const r = latest;
    if (!r) return panelCard("Order ladder", h("div", { class: "asset-empty" }, "No order book snapshot for this pair."));
    const row = (label, value, side, width) => h("div", { class: "ladder-row" },
      h("span", { class: "bar " + side, style: { width: width + "%" } }),
      h("span", { class: "k" }, label),
      h("span", { class: "v num" }, value));
    return panelCard("Order ladder", h("div", { class: "ladder" },
      row("Perp ask", fmtPrice(r.fut_ask), "ask", 62),
      row("Perp bid", fmtPrice(r.fut_bid), "ask", 45),
      h("div", { class: "ladder-mid" }, `${fmtBasisVal(r.mid_spread_bps, true)} ${basisUnit()} basis`),
      row("Spot ask", fmtPrice(r.spot_ask), "bid", 45),
      row("Spot bid", fmtPrice(r.spot_bid), "bid", 62)));
  }

  function panelExtremes(metric) {
    if (!history.length) return panelCard("Recent extremes", h("div", { class: "asset-empty" }, "No local history in this window."));
    let hiB = history[0], loB = history[0], hiF = history[0], loF = history[0];
    for (const r of history) {
      if ((num(r.mid_spread_bps) || 0) > (num(hiB.mid_spread_bps) || 0)) hiB = r;
      if ((num(r.mid_spread_bps) || 0) < (num(loB.mid_spread_bps) || 0)) loB = r;
      if ((num(r.funding_rate) || 0) > (num(hiF.funding_rate) || 0)) hiF = r;
      if ((num(r.funding_rate) || 0) < (num(loF.funding_rate) || 0)) loF = r;
    }
    const xrow = (k, ts, v, cls) => h("div", { class: "xrow" },
      h("div", {}, h("div", { class: "k" }, k), h("div", { class: "t num" }, fmtTimeShort(ts) + " UTC")),
      h("span", { class: "v num " + cls }, v));
    const rows = metric === "funding"
      ? [xrow("Peak funding", hiF.ts_ms, fmtFunding(hiF.funding_rate), "up"),
         xrow("Trough funding", loF.ts_ms, fmtFunding(loF.funding_rate), "down")]
      : [xrow("Widest basis", hiB.ts_ms, `${fmtBps(hiB.mid_spread_bps, true)} bps`, "up"),
         xrow("Deepest basis", loB.ts_ms, `${fmtBps(loB.mid_spread_bps, true)} bps`, "down"),
         xrow("Peak funding", hiF.ts_ms, fmtFunding(hiF.funding_rate), "up"),
         xrow("Trough funding", loF.ts_ms, fmtFunding(loF.funding_rate), "down")];
    return panelCard("Recent extremes", h("div", { class: "xlist" }, rows));
  }

  function panelPriceHistory() {
    const series = byTime((extCache[priceDays()] || {}).prices).slice(-12);
    if (series.length < 2) return panelCard("Price history", h("div", { class: "asset-empty" }, "Price history is loading from the chart provider."));
    return panelCard("Price history", h("div", { class: "xlist" }, series.slice().reverse().map((p, i, arr) => {
      const prev = arr[i + 1];
      const d = prev && prev.v ? ((p.v - prev.v) / prev.v) * 100 : null;
      return h("div", { class: "xrow" },
        h("div", {}, h("div", { class: "k num" }, fmtPrice(p.v)), h("div", { class: "t num" }, fmtDateTime(p.t))),
        h("span", { class: "v num " + signClass(d) }, d == null ? "—" : fmtPct(d)));
    })));
  }

  function panelCompare() {
    const rows = comparableRows().slice(0, 5);
    if (!rows.length) return panelCard("Compare with " + base, h("div", { class: "asset-empty" }, "Comparable live rows are unavailable."));
    return panelCard("Compare with " + base, h("div", { class: "compare-grid" }, rows.map((r) => {
      const b = baseOf(r.symbol);
      return h("button", { class: "compare-card", onClick: () => navigate(`/symbol/${r.symbol}`) },
        tokenIcon(b, 30),
        h("div", {}, h("b", {}, r.symbol), h("span", {}, b)),
        h("div", { class: "num" }, fmtPrice(r.spot_mid)),
        h("div", { class: "num " + signClass(r.mid_spread_bps) }, `${fmtBasisVal(r.mid_spread_bps, true)} ${basisUnit()}`));
    })));
  }

  function panelNetwork() {
    const rows = base === "BTC"
      ? [["Network", "Bitcoin"], ["Address", "Native BTC address"], ["Supply model", "21M max supply"], ["Contracts", "Not applicable"]]
      : base === "ETH"
        ? [["Network", "Ethereum"], ["Address", "Native ETH address"], ["Supply model", "Protocol issuance"], ["Contracts", "ERC-20 ecosystem"]]
        : [["Network", "Provider profile"], ["Address", "Not stored"], ["Contracts", "Not verified"], ["Source", coin && coin.id ? "CoinGecko profile" : "Unavailable"]];
    return panelCard("Network & addresses", h("div", { class: "xlist" }, rows.map(([k, v]) =>
      h("div", { class: "xrow" }, h("div", {}, h("div", { class: "k" }, k), h("div", { class: "t" }, v)), h("span", { class: "copy-dot" }, "·")))));
  }

  function panelNews() {
    if (!news) return panelCard("News", h("div", { class: "asset-empty" }, "Loading headlines..."), "wide");
    const items = relevantNews();
    if (!items.length) return panelCard("News", h("div", { class: "asset-empty" }, "No current headline matched this asset."), "wide");
    return panelCard("News", h("div", { class: "asset-news-list" }, items.slice(0, 12).map((it) =>
      h("a", { href: it.url || "#", target: "_blank", rel: "noopener noreferrer", class: "asset-news-row" },
        h("span", { class: "news-source" }, it.domain || it.source || "wire"),
        h("b", {}, it.title || it.headline || "Untitled headline"),
        h("span", {}, it.time ? String(it.time).replace("T", " ").replace("Z", " UTC") : "")))) , "wide");
  }

  function panelQuality() {
    const data = extCache[priceDays()];
    return panelCard("Data quality", h("div", { class: "kv-grid" },
      kv("Primary chart", data ? (data.provider || data.source || "market data") : "loading"),
      kv("Exchange pair", latest ? `${cleanSymbol} · live` : "not tracked", latest ? "up" : ""),
      kv("Chart status", data && data.status ? data.status : data ? "live" : "loading"),
      kv("Local history", String(history.length)),
      kv("Profile source", coin && coin.profile_source ? coin.profile_source : coin && coin.id ? "public profile" : "none"),
      kv("Secondary market cap", data && data.secondary_source ? data.secondary_source : "not required"),
      kv("Feed age", latest ? fmtAge(latest.age_seconds) : "—"),
      kv("No fake values", "enforced", "up")));
  }

  function comparableRows() {
    const live = (store.lite && store.lite.live) || [];
    const majors = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "LINK", "ADA", "HYPE", "ZEC"];
    return live.filter((r) => r && r.symbol && r.symbol !== cleanSymbol && majors.includes(baseOf(r.symbol)));
  }

  function bestHeadline() {
    return relevantNews()[0] || ((news && news.items || [])[0]);
  }

  function relevantNews() {
    const items = news && news.items ? news.items : [];
    const name = (coin && coin.name || base).toLowerCase();
    return items.filter((it) => {
      const t = String(it.title || it.headline || "").toLowerCase();
      const syms = (it.matched_symbols || it.symbols_hint || []).map((x) => String(x).toUpperCase());
      return syms.includes(base) || t.includes(base.toLowerCase()) || (name.length > 3 && t.includes(name));
    });
  }

  function pctFromSeries(series, ageMs) {
    if (!series || series.length < 2) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (!ageMs) return first.v ? ((last.v - first.v) / first.v) * 100 : null;
    const target = last.t - ageMs;
    let prev = first;
    for (const p of series) {
      if (p.t <= target) prev = p;
      else break;
    }
    return prev && prev.v ? ((last.v - prev.v) / prev.v) * 100 : null;
  }

  function changeFromExt(days) {
    const series = byTime((extCache[days] || {}).prices);
    return pctFromSeries(series, days === "1" ? 24 * 3600 * 1000 : null);
  }

  function latestExtPrice() {
    const keys = [priceDays(), "1", "365", "max"];
    for (const k of keys) {
      const pts = byTime((extCache[k] || {}).prices);
      if (pts.length) return pts[pts.length - 1].v;
    }
    return null;
  }

  function latestExtMeta() {
    const keys = [priceDays(), "1", "365", "max"];
    for (const k of keys) {
      const entry = extCache[k] || {};
      const pts = byTime(entry.prices);
      if (pts.length) return entry;
    }
    return null;
  }

  async function loadLatest() {
    try {
      const res = await api.symbol(cleanSymbol);
      profile = res;
      if (res && res.row) latest = res.row;
      paintHeadline();
      paintSideRail();
      paintTerminal();
    } catch (e) {}
  }

  async function loadHistory(animate = false) {
    try {
      const res = await api.history(cleanSymbol, win);
      history = res.rows || [];
      if (!hadHistory && history.length) { hadHistory = true; paintBody(false); }
      paintTerminal();
      if (!isPriceTab() || !extCache[priceDays()]) drawChart(animate);
    } catch (e) {}
  }

  async function loadExt(animate = false) {
    if (!isPriceTab()) return;
    const days = priceDays();
    if (extCache[days]) { drawChart(animate); return; }
    clearTimeout(extRetryTimer);
    try {
      const res = await api.coinHistory(base, days, cleanSymbol);
      if (res && res.status === "live" && (res.prices || []).length >= 2) {
        extCache[days] = {
          status: res.status,
          source: res.source,
          provider: res.provider,
          symbol: res.symbol,
          interval: res.interval,
          raw_points: res.raw_points,
          secondary_source: res.secondary_source,
          prices: res.prices || [],
          volumes: res.volumes || [],
          mcaps: res.mcaps || [],
        };
        if (!extCache.max && days !== "max") loadPeriodHistory();
      } else if (res) {
        extCache[days] = { status: res.status || "unavailable", source: res.source || "unavailable", prices: [], volumes: [], mcaps: [] };
      }
    } catch (e) {}
    drawChart(animate);
    paintHeadline();
    if (!extCache[days] || !extCache[days].prices || extCache[days].prices.length < 2) {
      extRetryTimer = setTimeout(() => { delete extCache[days]; loadExt(false); }, 12000);
    }
  }

  async function loadPeriodHistory() {
    try {
      const res = await api.coinHistory(base, "max", cleanSymbol);
      if (res && res.status === "live" && (res.prices || []).length >= 2) {
        extCache.max = {
          status: res.status, source: res.source, provider: res.provider,
          symbol: res.symbol, interval: res.interval, raw_points: res.raw_points,
          secondary_source: res.secondary_source, prices: res.prices || [], volumes: res.volumes || [], mcaps: res.mcaps || [],
        };
        paintReturns();
      }
    } catch (e) {}
  }

  async function loadProfile() {
    try {
      const p = await api.coinProfile(cleanSymbol);
      profile = p;
      if (p && p.coin) {
        coin = p.coin;
        paintProfileHeader();
      }
      paintHeadline();
      paintSideRail();
      paintHeroStats();
      paintMarketContext();
      paintBody(false);
    } catch (e) {}
  }

  async function loadNews() {
    try {
      news = await api.newsContext(60);
      paintSideRail();
      if (tab === "news") paintBody(false);
    } catch (e) {}
  }
}
