// TradingView-style search modal: keyboard-first asset search + page jumps.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate, toggleTheme } from "../lib/store.js";
import { baseOf, fmtBps, fmtPct, fmtPrice, signClass } from "../lib/format.js";

let open = false;
let liveInput = null;

const RECENT_KEY = "cg-search-recents-v2";
const MAX_RECENTS = 6;

const CATEGORIES = [
  { id: "all", label: "All", ic: "search" },
  { id: "crypto", label: "Crypto", ic: "candles" },
  { id: "stocks", label: "Stocks", ic: "barChart" },
  { id: "indices", label: "Indices", ic: "activity" },
  { id: "pages", label: "Pages", ic: "globe" },
];

const PAGES = [
  { id: "page-global", category: "pages", name: "Global markets", sub: "Indices, stocks, FX, rates and crypto", path: "/", ic: "globe", terms: "market global overview world" },
  { id: "page-indices", category: "pages", name: "Indices", sub: "S&P 500, Nasdaq, Dow and world benchmarks", path: "/?sec=indices", ic: "activity", terms: "spx ndx dow dax nikkei indices" },
  { id: "page-crypto", category: "pages", name: "Crypto prices", sub: "Exchange-neutral crypto market lane", path: "/?sec=crypto", ic: "candles", terms: "coins tokens crypto prices" },
  { id: "page-us-stocks", category: "pages", name: "US stocks", sub: "Large-cap cash equities", path: "/?sec=us-stocks", ic: "barChart", terms: "aapl msft nvda stocks equities" },
  { id: "page-world-stocks", category: "pages", name: "World stocks", sub: "Global ADRs and international leaders", path: "/?sec=world-stocks", ic: "globe", terms: "world stocks tsm asml toyota" },
  { id: "page-radar", category: "pages", name: "Basis radar", sub: "Spot/perp scanner and basis table", path: "/radar", ic: "radar", terms: "basis radar scanner" },
  { id: "page-heatmap", category: "pages", name: "Heatmap", sub: "Market breadth, liquidation and score maps", path: "/heatmap", ic: "grid", terms: "heatmap liquidation breadth" },
  { id: "page-bubbles", category: "pages", name: "Bubbles", sub: "Animated movers for crypto and stocks", path: "/bubbles", ic: "target", terms: "bubbles movers animation" },
  { id: "page-funding", category: "pages", name: "Funding", sub: "Funding rates, open interest and spreads", path: "/funding", ic: "zap", terms: "funding open interest oi" },
  { id: "page-movers", category: "pages", name: "Movers", sub: "Gainers, losers and live movement boards", path: "/movers", ic: "trendingUp", terms: "movers gainers losers" },
  { id: "page-health", category: "pages", name: "Data health", sub: "Sources, cache and collector state", run: () => import("./drawer.js").then((m) => m.openDataSheet()), ic: "wifi", terms: "source health cache" },
  { id: "page-settings", category: "pages", name: "Preferences", sub: "Theme, currency, motion and units", run: () => import("./settings.js").then((m) => m.openSettingsSheet()), ic: "sliders", terms: "settings preferences currency theme" },
  { id: "page-theme", category: "pages", name: "Toggle theme", sub: "Switch light / dark", run: () => toggleTheme(), ic: "moon", terms: "theme dark light" },
];

const CORE_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT",
  "LINKUSDT", "TRXUSDT", "HYPEUSDT", "SUIUSDT", "UNIUSDT", "AAVEUSDT", "LTCUSDT", "XLMUSDT",
  "ZECUSDT", "XMRUSDT", "USDCUSDT", "USDTUSDT",
];

const LOGO_SLUGS = {
  "^GSPC": "indices/s-and-p-500",
  "^IXIC": "indices/nasdaq-100",
  "^DJI": "indices/dow-30",
  "^RUT": "indices/russell-2000",
  "^FTSE": "indices/uk-100",
  "^GDAXI": "indices/dax",
  "^FCHI": "indices/cac-40",
  "^STOXX50E": "indices/euro-stoxx-50",
  "^N225": "indices/nikkei-225",
  "^NSEI": "country/IN",
  "^BSESN": "country/IN",
  AAPL: "apple",
  MSFT: "microsoft",
  NVDA: "nvidia",
  GOOGL: "alphabet",
  GOOG: "alphabet",
  AMZN: "amazon",
  META: "meta-platforms",
  TSLA: "tesla",
  AVGO: "broadcom",
  JPM: "jpmorgan-chase",
  LLY: "eli-lilly",
  NFLX: "netflix",
  ORCL: "oracle",
  COST: "costco",
  WMT: "walmart",
  MA: "mastercard",
  V: "visa",
  UNH: "unitedhealth",
  HD: "home-depot",
  PG: "procter-and-gamble",
  JNJ: "johnson-and-johnson",
  XOM: "exxon-mobil",
  BAC: "bank-of-america",
  KO: "coca-cola",
  AMD: "amd",
  INTC: "intel",
  ADBE: "adobe",
  QCOM: "qualcomm",
  UBER: "uber",
  PLTR: "palantir",
  COIN: "coinbase",
  TSM: "taiwan-semiconductor",
  ASML: "asml",
  TM: "toyota",
  NVO: "novo-nordisk",
  SAP: "sap",
  BABA: "alibaba",
  SHEL: "shell",
  AZN: "astrazeneca",
  HSBC: "hsbc",
  SONY: "sony",
};

let cachedDefaultCrypto = null;
let cachedGlobalRows = null;

export function openCommand() {
  if (open) {
    if (liveInput) liveInput.focus();
    return;
  }
  open = true;

  let items = [];
  let sel = 0;
  let category = "all";
  let seq = 0;
  let debounce = null;
  let cryptoRows = cachedDefaultCrypto || [];
  let globalRows = cachedGlobalRows || [];
  let cryptoLoading = !cachedDefaultCrypto;
  let globalLoading = !cachedGlobalRows;

  const input = h("input", {
    class: "cmd-input",
    type: "text",
    placeholder: "Search BTC, NVIDIA, S&P 500 or a page",
    autocomplete: "off",
    spellcheck: "false",
  });
  liveInput = input;

  const count = h("span", { class: "cmd-count" }, "");
  const tabs = h("div", { class: "cmd-tabs", role: "tablist", "aria-label": "Search categories" });
  const list = h("div", { class: "cmd-list", role: "listbox" });
  const closeBtn = h("button", { class: "cmd-close", type: "button", title: "Close", onClick: () => close() }, icon("x"));
  const box = h("div", { class: "cmd cmd-search", role: "dialog", "aria-modal": "true", "aria-label": "Search" },
    h("div", { class: "cmd-searchbar" },
      h("div", { class: "cmd-input-shell" }, icon("search"), input),
      h("span", { class: "cmd-live-chip" }, h("i", {}), "Live"),
      closeBtn),
    tabs,
    list,
    h("div", { class: "cmd-foot cmd-search-foot" },
      h("span", {}, kbd("↑↓"), "select"),
      h("span", {}, kbd("↵"), "open"),
      h("span", {}, kbd("esc"), "close"),
      count));
  const overlay = h("div", { class: "overlay cmd-overlay", onMousedown: (e) => { if (e.target === overlay) close(); } }, box);

  function kbd(t) { return h("span", { class: "kbd" }, t); }

  function paintTabs() {
    mount(tabs, CATEGORIES.map((c, idx) => h("button", {
      class: "cmd-tab" + (category === c.id ? " on" : ""),
      type: "button",
      role: "tab",
      "aria-selected": category === c.id ? "true" : "false",
      title: `Alt+${idx + 1}`,
      onClick: () => setCategory(c.id),
    }, icon(c.ic), h("span", {}, c.label))));
  }

  function setCategory(next) {
    category = next;
    sel = 0;
    paintTabs();
    render();
    input.focus();
  }

  function shouldShow(row) {
    return category === "all" || row.category === category;
  }

  function queryText(row) {
    return [
      row.name, row.symbol, row.base, row.sub, row.terms, row.source, row.wordLogo,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function score(row, q) {
    if (!q) return row.rank || 50;
    const n = q.toLowerCase();
    const sym = String(row.symbol || row.base || "").toLowerCase();
    const name = String(row.name || "").toLowerCase();
    if (sym === n || name === n) return 0;
    if (sym.startsWith(n) || name.startsWith(n)) return 1;
    if (queryText(row).includes(n)) return 2;
    return 9;
  }

  function pageRows(q) {
    return PAGES
      .filter((p) => shouldShow(p) && (!q || score(p, q) < 9))
      .map((p, i) => ({ ...p, type: "page", rank: i + 30 }));
  }

  function assetRows(q) {
    const rows = [...cryptoRows, ...globalRows]
      .filter((r) => shouldShow(r) && (!q || score(r, q) < 9))
      .sort((a, b) => score(a, q) - score(b, q));
    return dedupeRows(rows).slice(0, q ? 18 : 12);
  }

  function render() {
    mount(list);
    paintTabs();
    const q = input.value.trim();
    const flat = [];
    const recent = q ? [] : readRecents().filter((r) => shouldShow(r)).slice(0, MAX_RECENTS);
    const assets = assetRows(q);
    const pages = pageRows(q).slice(0, q ? 8 : 6);

    if (recent.length) appendGroup("Recent", recent);
    if (assets.length) {
      if (category === "all") {
        appendGroup("Markets", assets);
      } else appendGroup(labelFor(category), assets);
    }
    if (pages.length) appendGroup("Pages", pages);
    if (!flat.length) {
      const loading = cryptoLoading || globalLoading;
      list.appendChild(h("div", { class: "cmd-empty" },
        loading ? "Loading live markets…" : q ? `No matches for "${q}"` : "Type to search"));
    }

    items = flat;
    sel = Math.min(sel, Math.max(0, items.length - 1));
    count.textContent = flat.length ? `${flat.length} results` : "";
    paintSel();

    function appendGroup(title, rows) {
      list.appendChild(h("div", { class: "cmd-group" }, title));
      rows.forEach((row) => {
        const i = flat.length;
        const el = rowEl(row, () => activate(i));
        list.appendChild(el);
        flat.push({ el, row });
      });
    }
  }

  function rowEl(row, run) {
    const meta = rowMeta(row);
    const right = rowRight(row);
    return h("button", {
      class: `cmd-item cmd-result cmd-${row.category || "page"}`,
      type: "button",
      role: "option",
      onClick: run,
    },
      rowLogo(row),
      h("div", { class: "cmd-copy" },
        h("div", { class: "c-name" }, row.name || row.base || row.symbol),
        h("div", { class: "c-sub" }, row.sub || meta)),
      h("div", { class: "cmd-meta" }, right, meta ? h("span", { class: "cmd-source" }, meta) : null));
  }

  function rowRight(row) {
    if (row.price != null && isFinite(Number(row.price))) {
      const chg = Number(row.change);
      return h("div", { class: "cmd-price" },
        h("b", { class: "num" }, fmtPrice(row.price)),
        isFinite(chg) ? h("span", { class: "num " + signClass(chg) }, fmtPct(chg)) : null);
    }
    if (row.basis != null && isFinite(Number(row.basis))) {
      return h("div", { class: "cmd-price" },
        h("b", { class: "num" }, fmtBps(row.basis)),
        h("span", {}, "bps"));
    }
    return h("div", { class: "cmd-price" }, h("b", {}, row.path || row.run ? "Open" : ""));
  }

  function rowMeta(row) {
    if (row.category === "crypto") return row.source || "spot/perp";
    if (row.category === "stocks") return row.source || "equities";
    if (row.category === "indices") return row.source || "indices";
    return row.path || "";
  }

  function paintSel() {
    items.forEach((it, i) => {
      it.el.classList.toggle("sel", i === sel);
      it.el.setAttribute("aria-selected", i === sel ? "true" : "false");
    });
    const cur = items[sel];
    if (cur) cur.el.scrollIntoView({ block: "nearest" });
  }

  function activate(i) {
    const it = items[i];
    if (!it) return;
    close();
    remember(it.row);
    if (it.row.run) it.row.run();
    else if (it.row.path) navigate(it.row.path);
  }

  function close() {
    clearTimeout(debounce);
    open = false;
    if (liveInput === input) liveInput = null;
    overlay.remove();
  }

  function search() {
    clearTimeout(debounce);
    const q = input.value.trim();
    const my = ++seq;
    sel = 0;
    if (!q) {
      cryptoRows = cachedDefaultCrypto || cryptoRows;
      render();
      loadDefaultCrypto();
      return;
    }
    cryptoRows = localCryptoRows(q);
    render();
    debounce = setTimeout(async () => {
      try {
        const r = await api.search(q, 18);
        if (my !== seq || !open) return;
        cryptoRows = uniqueCryptoRows([...(r && r.results || []), ...localCryptoRows(q)]);
      } catch (e) {
        if (my !== seq || !open) return;
        cryptoRows = localCryptoRows(q);
      }
      render();
    }, 85);
  }

  async function loadDefaultCrypto() {
    if (cachedDefaultCrypto && !cryptoLoading) return;
    cryptoLoading = true;
    render();
    try {
      const r = await api.search("", 12);
      if (!open) return;
      cachedDefaultCrypto = uniqueCryptoRows((r && r.results) || []);
      if (!input.value.trim()) cryptoRows = cachedDefaultCrypto;
    } catch (e) {
      if (!open) return;
      if (!cryptoRows.length) cryptoRows = localCryptoRows("");
    }
    cryptoLoading = false;
    render();
  }

  async function loadGlobalRows() {
    if (cachedGlobalRows && !globalLoading) return;
    globalLoading = true;
    render();
    try {
      const ov = await api.marketOverview();
      if (!open) return;
      cachedGlobalRows = normalizeMarketOverview(ov);
      globalRows = cachedGlobalRows;
    } catch (e) {
      if (!open) return;
      globalRows = cachedGlobalRows || [];
    }
    globalLoading = false;
    render();
  }

  input.addEventListener("input", search);
  overlay.addEventListener("keydown", (e) => {
    const k = e.key;
    if (e.altKey && /^[1-5]$/.test(k)) {
      e.preventDefault();
      setCategory(CATEGORIES[Number(k) - 1].id);
    } else if (k === "Escape") {
      e.preventDefault();
      close();
    } else if (k === "ArrowDown") {
      e.preventDefault();
      sel = Math.min(items.length - 1, sel + 1);
      paintSel();
    } else if (k === "ArrowUp") {
      e.preventDefault();
      sel = Math.max(0, sel - 1);
      paintSel();
    } else if (k === "Enter") {
      e.preventDefault();
      activate(sel);
    }
  });

  document.body.appendChild(overlay);
  paintTabs();
  render();
  input.focus();
  loadDefaultCrypto();
  loadGlobalRows();
}

function labelFor(id) {
  return (CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]).label;
}

function localCryptoRows(q, limit = 8) {
  const needle = String(q || "").trim().toUpperCase();
  return CORE_SYMBOLS
    .filter((s) => !needle || s.includes(needle) || baseOf(s).includes(needle))
    .slice(0, limit)
    .map((symbol, idx) => cryptoRow({ symbol, quick: true }, idx + 60));
}

function uniqueCryptoRows(rows) {
  const seen = new Set();
  return (rows || [])
    .map((r, idx) => cryptoRow(r, idx + 1))
    .filter((r) => {
      if (!r.symbol || seen.has(r.symbol)) return false;
      seen.add(r.symbol);
      return true;
    });
}

function cryptoRow(r, rank = 50) {
  const symbol = String(r && r.symbol || "").toUpperCase();
  const base = baseOf(symbol);
  return {
    id: `crypto-${symbol}`,
    type: "asset",
    category: "crypto",
    base,
    symbol,
    name: base,
    sub: `${symbol} · crypto`,
    price: finite(r && r.spot_mid),
    basis: finite(r && r.abs_basis_bps),
    source: r && r.quick ? "local universe" : "live basis",
    path: `/symbol/${symbol}`,
    rank,
  };
}

function normalizeMarketOverview(ov) {
  const out = [];
  const stocks = (((ov || {}).stocks || {}).items || []);
  stocks.forEach((s, idx) => {
    const base = String(s.base || s.wrapper_symbol || "").toUpperCase();
    if (!base) return;
    const wrapper = String(s.wrapper_symbol || base).toUpperCase();
    out.push({
      id: `stock-token-${base}`,
      type: "asset",
      category: "stocks",
      base,
      symbol: wrapper,
      name: s.name || base,
      sub: `${wrapper} · tokenized equity`,
      price: finite(s.price),
      change: finite(s.chg24h),
      image: s.image,
      source: ((ov || {}).stocks || {}).source || "coingecko",
      path: `/symbol/${wrapper}USDT`,
      rank: idx + 10,
    });
  });

  const groups = (((ov || {}).world || {}).groups || []);
  groups.forEach((g) => {
    const groupId = String(g.id || "");
    const cat = indexGroup(groupId) ? "indices" : stockGroup(groupId) ? "stocks" : "";
    if (!cat) return;
    (g.items || []).forEach((it, idx) => {
      const symbol = String(it.symbol || "").toUpperCase();
      if (!symbol) return;
      const base = cleanMarketSymbol(symbol);
      const isStock = cat === "stocks";
      out.push({
        id: `world-${symbol}`,
        type: "asset",
        category: cat,
        base,
        symbol,
        name: it.name || base,
        sub: `${g.label || (isStock ? "Stocks" : "Indices")} · Yahoo`,
        price: finite(it.last),
        change: finite(it.chg_pct),
        source: "yahoo finance",
        logoSlug: LOGO_SLUGS[symbol] || LOGO_SLUGS[base],
        wordLogo: indexWord(symbol, it.name || base),
        path: isStock
          ? (groupId === "world_stocks" ? "/?sec=world-stocks" : "/?sec=us-stocks")
          : "/?sec=indices",
        rank: idx + (isStock ? 26 : 18),
      });
    });
  });
  return dedupeRows(out);
}

function indexGroup(id) {
  return ["us", "europe", "asia", "india"].includes(id);
}

function stockGroup(id) {
  return ["stocks", "world_stocks"].includes(id);
}

function cleanMarketSymbol(symbol) {
  return String(symbol || "")
    .replace(/^\^/, "")
    .replace(/=F$/i, "")
    .replace(/=X$/i, "")
    .replace(/\.NYB$/i, "")
    .replace(/\.(SS|SZ)$/i, "")
    .toUpperCase();
}

function indexWord(symbol, name) {
  const s = String(symbol || "").toUpperCase();
  if (s === "^GSPC") return "S&P 500";
  if (s === "^IXIC") return "Nasdaq";
  if (s === "^DJI") return "Dow";
  if (s === "^RUT") return "Russell";
  if (s === "^N225") return "Nikkei";
  if (s === "^FTSE") return "FTSE";
  if (s === "^GDAXI") return "DAX";
  if (s === "^NSEI") return "Nifty";
  if (s === "^BSESN") return "Sensex";
  return String(name || cleanMarketSymbol(symbol)).slice(0, 10);
}

function dedupeRows(rows) {
  const seen = new Set();
  return (rows || []).filter((r) => {
    const k = `${r.category}:${r.symbol || r.base || r.id}`.toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function finite(v) {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function rowLogo(row) {
  if (row.category === "crypto") return tokenIcon(row.symbol || row.base, 28);
  if (row.image) return imgLogo(row.image, row.base || row.name);
  if (row.category === "stocks" && row.base) {
    const img = imgLogo(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(row.base)}?format=png&size=64`, row.base);
    img.addEventListener("error", () => img.replaceWith(wordLogo(row)), { once: true });
    return img;
  }
  if (row.logoSlug) {
    const img = imgLogo(`https://s3-symbol-logo.tradingview.com/${row.logoSlug}.svg`, row.name || row.base);
    img.addEventListener("error", () => img.replaceWith(wordLogo(row)), { once: true });
    return img;
  }
  if (row.ic) return icon(row.ic);
  return wordLogo(row);
}

function imgLogo(src, alt) {
  return h("img", {
    class: "cmd-logo-img",
    src,
    alt: alt || "",
    width: "28",
    height: "28",
    loading: "lazy",
    referrerpolicy: "no-referrer",
  });
}

function wordLogo(row) {
  const text = row.wordLogo || row.base || row.symbol || row.name || "";
  return h("span", { class: "cmd-word-logo" }, String(text).slice(0, 9));
}

function readRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(recentRow).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function recentRow(r) {
  if (!r || !r.path) return null;
  return {
    ...r,
    type: "recent",
    source: r.source || "recent",
    rank: 1,
  };
}

function remember(row) {
  if (!row || !row.path) return;
  const rec = {
    id: row.id,
    category: row.category,
    name: row.name,
    sub: row.sub,
    symbol: row.symbol,
    base: row.base,
    path: row.path,
    price: row.price,
    change: row.change,
    basis: row.basis,
    image: row.image,
    logoSlug: row.logoSlug,
    wordLogo: row.wordLogo,
    source: row.source,
  };
  const next = [rec, ...readRecents().filter((r) => r.path !== rec.path)].slice(0, MAX_RECENTS);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) {}
}

// Global hotkey wiring (called once from main).
export function wireCommandHotkey() {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "k") { e.preventDefault(); openCommand(); }
    else if (k === "/" && !isTyping(e.target)) { e.preventDefault(); openCommand(); }
  });
}

function isTyping(el) {
  const t = (el && el.tagName) || "";
  return t === "INPUT" || t === "TEXTAREA" || (el && el.isContentEditable);
}
