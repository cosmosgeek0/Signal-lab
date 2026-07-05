// Header: brand · GLOBAL · CRYPTO · search · data health · currency · theme · preferences.

import { h } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { linkTo, navigate, onRoute, currentRoute, getTheme, toggleTheme, onTheme } from "../lib/store.js";
import { getSettings, setSetting, onSettings } from "../lib/settings.js";
import { openMenu, closeOpenMenu } from "./menu.js";
import { openSettingsSheet } from "./settings.js";
import { openDataSheet } from "./drawer.js";

// Radar-sweep mark: dark rounded square, concentric rings, gold sweep + ping.
const BRAND_MARK = `<svg viewBox="0 0 32 32" width="32" height="32" class="brand-mark">
  <defs><linearGradient id="cg-sweep" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f0b90b" stop-opacity=".85"/>
    <stop offset="1" stop-color="#f0b90b" stop-opacity="0"/>
  </linearGradient></defs>
  <rect width="32" height="32" rx="9" fill="#0b0e11"/>
  <circle cx="16" cy="16" r="10.6" fill="none" stroke="#2b313a" stroke-width="1.1"/>
  <circle cx="16" cy="16" r="6.2" fill="none" stroke="#2b313a" stroke-width="1.1"/>
  <path d="M16 16 L16 4.8 A11.2 11.2 0 0 1 25.9 10.7 Z" fill="url(#cg-sweep)"/>
  <line x1="16" y1="16" x2="24.4" y2="8.4" stroke="#f0b90b" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="21.4" cy="20.2" r="1.8" fill="#f0b90b"/>
  <circle cx="16" cy="16" r="1.5" fill="#e9edf3"/>
</svg>`;

const GLOBAL_MENU_ITEMS = [
  { id: "indices", path: "/?sec=indices", label: "Indices", ic: "activity", tone: "red", sub: "S&P, Nasdaq, Dow and world benchmarks" },
  { id: "us-stocks", path: "/?sec=us-stocks", label: "US stocks", ic: "barChart", tone: "green", sub: "Large-cap US equities and movers" },
  { id: "world-stocks", path: "/?sec=world-stocks", label: "World stocks", ic: "globe", tone: "cyan", sub: "Europe, Asia and global leaders" },
  { id: "futures", path: "/?sec=futures", label: "Futures & commodities", ic: "columns", tone: "orange", sub: "Metals, energy and index futures" },
  { id: "crypto", path: "/?sec=crypto", label: "Crypto", ic: "radar", tone: "gold", sub: "Digital assets as one clean global section" },
];
const CRYPTO_MENU_ITEMS = [
  { id: "prices", section: "crypto", path: "/?sec=crypto", label: "Prices", ic: "globe", tone: "gold", sub: "Coin prices, market cap and volume" },
  { id: "radar", section: "crypto", path: "/radar", label: "Basis radar", ic: "radar", tone: "purple", sub: "Spot/perp dislocations and coverage" },
  { id: "heatmap", section: "crypto", path: "/heatmap", label: "Heatmap", ic: "grid", tone: "cyan", sub: "Breadth, basis, funding and momentum" },
  { id: "bubbles", section: "crypto", path: "/bubbles", label: "Bubbles", ic: "target", tone: "blue", sub: "Animated market movers" },
  { id: "funding", section: "crypto", path: "/funding", label: "Funding", ic: "zap", tone: "orange", sub: "Rates, leaders and history" },
  { id: "movers", section: "crypto", path: "/movers", label: "Movers", ic: "trendingUp", tone: "green", sub: "Momentum windows and breadth" },
];
const NAV_ITEMS = [
  { id: "global", label: "GLOBAL", path: "/", menuTitle: "GLOBAL", menuSub: "World markets first: indices, stocks, futures and crypto stay in separate lanes.", items: GLOBAL_MENU_ITEMS },
  { id: "crypto", label: "CRYPTO", path: "/?sec=crypto", menuTitle: "CRYPTO", menuSub: "Crypto tools stay together without taking over the global surface.", items: CRYPTO_MENU_ITEMS },
];

const NAV_SECTION_IDS = new Set(["global", "indices", "us-stocks", "world-stocks", "crypto", "futures"]);
const SECTION_ALIASES = {
  world: "indices",
  prices: "crypto",
  news: "global",
};

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "JPY"];
const LIVE_LANES = [
  {
    key: "macro",
    label: "World / TradFi",
    sub: "indices, stocks, commodities, rates",
    ic: "activity",
    path: "/?sec=world",
    match: (s) => s.id.includes("yahoo") || s.id.includes("global") || s.id.includes("fx"),
  },
  {
    key: "exchange",
    label: "Exchange tape",
    sub: "Exchange spot/perp flow from combined public venues",
    ic: "barChart",
    path: "/",
    match: (s) => s.id.includes("binance") || s.id.includes("snapshot") || s.kind === "exchange",
  },
  {
    key: "crypto",
    label: "Crypto market",
    sub: "coins, logos, market cap and sparkline context",
    ic: "globe",
    path: "/?sec=prices",
    match: (s) => s.id.includes("coingecko") || s.id.includes("paprika") || s.id.includes("coincap"),
  },
  {
    key: "defi",
    label: "DeFi fabric",
    sub: "TVL, stablecoins and DEX volume",
    ic: "layers",
    path: "/?sec=world",
    match: (s) => s.id.includes("llama") || s.kind === "defi",
  },
  {
    key: "news",
    label: "News wire",
    sub: "RSS, Tree of Alpha, Lookonchain and open feeds",
    ic: "radio",
    path: "/?sec=news",
    match: (s) => s.kind === "news" || s.id.includes("news") || s.id.includes("rss") || s.id.includes("tree") || s.id.includes("lookonchain"),
  },
];

export function buildHeader({ onSearch }) {
  const brand = h("a", { class: "brand", href: "/", onClick: linkTo("/"), html: BRAND_MARK });
  brand.appendChild(h("span", { class: "brand-name", html: "CosmosGeek&nbsp;<b>Radar</b>" }));
  const nav = h("nav", { class: "nav s2-top-nav", "aria-label": "Primary market navigation" }, NAV_ITEMS.map((it) => {
    const a = h("a", {
      href: it.path,
      "data-section": it.id,
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      title: it.sub,
      onClick: (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        openNavMenu(a, it);
      },
      onPointerEnter: () => openNavMenu(a, it),
      onMouseOver: () => openNavMenu(a, it),
      onMouseEnter: () => openNavMenu(a, it),
      onFocus: () => openNavMenu(a, it),
    }, h("span", {}, it.label), icon("chevronDown"));
    return h("span", { class: "nav-item" }, a);
  }));

  const searchBtn = h("button", { class: "search-btn", onClick: onSearch, title: "Search (Cmd/Ctrl K)" },
    icon("search"), h("span", { class: "stxt" }, "Search"), h("span", { class: "kbd" }, cmdKey() + "K"));

  const liveCount = h("span", { class: "live-count num" }, "--");
  const liveText = h("span", { class: "live-txt" }, "Checking");
  const liveBtn = h("button", { class: "live-hub idle", title: "Live data health" },
    h("span", { class: "live-orbit", "aria-hidden": "true" },
      h("span", { class: "live-pip p1" }),
      h("span", { class: "live-pip p2" }),
      h("span", { class: "live-pip p3" })),
    h("span", { class: "live-copy" },
      h("span", { class: "live-k" }, "Live"),
      liveText),
    liveCount);
  liveBtn.addEventListener("click", () => openLiveHub(liveBtn));

  let cachedSources = [];
  let cachedFx = { rates: {}, status: "checking" };
  let sourceWarm = null;
  let fxWarm = null;
  const warmSources = () => {
    sourceWarm = api.sources()
      .then((res) => { cachedSources = (res && res.sources) || []; return cachedSources; })
      .catch(() => cachedSources)
      .finally(() => { sourceWarm = null; });
    return sourceWarm;
  };
  const warmFx = () => {
    fxWarm = api.fx()
      .then((res) => { cachedFx = res || { rates: {}, status: "unavailable" }; return cachedFx; })
      .catch(() => cachedFx)
      .finally(() => { fxWarm = null; });
    return fxWarm;
  };
  function sourceCounts(sources) {
    const out = { live: 0, warn: 0, off: 0, total: sources.length };
    for (const s of sources) {
      const st = normalizeStatus(s.status);
      if (st === "live") out.live += 1;
      else if (st === "stale" || st === "idle" || st === "tree") out.warn += 1;
      else out.off += 1;
    }
    return out;
  }

  function normalizeStatus(status) {
    if (status === "live") return "live";
    if (status === "delayed") return "tree";
    if (status === "stale") return "stale";
    if (status === "tree_backed") return "tree";
    if (status === "requires_key") return "locked";
    if (status === "not_configured" || status === "disabled") return "off";
    if (status === "error" || status === "unavailable") return "error";
    return "idle";
  }

  function sourceBadge(st) {
    return ({
      live: "live", warn: "warming", stale: "stale", idle: "warming", tree: "relay",
      locked: "keyed", off: "off", error: "error",
    })[st] || "idle";
  }

  function ageShort(sec) {
    const s = Math.max(0, Number(sec) || 0);
    if (s < 90) return Math.round(s) + "s ago";
    if (s < 5400) return Math.round(s / 60) + "m ago";
    return Math.round(s / 3600) + "h ago";
  }

  function sourceRows(sources, match = () => true) {
    return (sources || []).map((s) => ({
      ...s,
      id: String(s.id || "").toLowerCase(),
      kind: String(s.kind || "").toLowerCase(),
      label: String(s.label || s.id || ""),
    })).filter(match);
  }

  function laneSnapshot(lane, sources) {
    const rows = sourceRows(sources, lane.match);
    if (!rows.length) return { state: "idle", live: 0, warn: 0, off: 0, total: 0, detail: "waiting for feed" };
    const live = rows.filter((s) => normalizeStatus(s.status) === "live").length;
    const warn = rows.filter((s) => ["stale", "tree", "idle"].includes(normalizeStatus(s.status))).length;
    const off = rows.length - live - warn;
    const state = live ? "live" : warn ? "warn" : off ? "off" : "idle";
    const freshest = rows
      .filter((s) => s.age_seconds != null)
      .sort((a, b) => Number(a.age_seconds) - Number(b.age_seconds))[0];
    const age = freshest ? " · " + ageShort(freshest.age_seconds) : "";
    return { state, live, warn, off, total: rows.length, detail: `${live} live · ${warn} warming · ${off} blocked${age}` };
  }

  function healthLabel(counts) {
    if (!counts.total) return "No sources";
    if (counts.live >= Math.max(1, counts.total - counts.off)) return "Orderly";
    if (counts.live) return "Partial";
    return counts.warn ? "Warming" : "Blocked";
  }

  function healthState(counts) {
    if (!counts.total) return "off";
    if (counts.live) return counts.off > counts.live ? "warn" : "live";
    return counts.warn ? "warn" : "off";
  }

  function liveFooter(counts) {
    return h("div", { class: "live-menu-foot" },
      h("span", {}, h("span", { class: "m-dot dot-live" }), `${counts.live} live`),
      h("span", {}, h("span", { class: "m-dot dot-stale" }), `${counts.warn} warming`),
      h("span", {}, h("span", { class: "m-dot dot-off" }), `${counts.off} blocked`),
      h("b", {}, "labels beat fake data"));
  }

  function openLiveHub(anchor) {
    const sources = cachedSources;
    const counts = sourceCounts(sources);
    openMenu(anchor, {
      title: "Live market health",
      subtitle: `${counts.live}/${counts.total} sources live · ${counts.warn} warming · ${counts.off} blocked`,
      width: 462,
      className: "live-menu-pop",
      items: [
        {
          className: "live-overview-card " + healthState(counts),
          ic: icon("radio"),
          label: healthLabel(counts),
          sub: "Source state is shown honestly. Gated feeds stay labeled instead of becoming fake market values.",
          right: `${counts.live}/${counts.total || 0}`,
        },
        { group: "Data lanes", sub: "click opens the real surface" },
        ...LIVE_LANES.map((lane) => {
          const snap = laneSnapshot(lane, sources);
          return {
            className: "live-lane-card " + snap.state,
            ic: icon(lane.ic),
            label: lane.label,
            sub: lane.sub,
            meta: snap.detail,
            badge: sourceBadge(snap.state),
            badgeClass: snap.state,
            right: snap.total ? `${snap.live}/${snap.total}` : "0",
            onClick: () => navigate(lane.path),
          };
        }),
        { separator: true },
        { className: "menu-action", ic: icon("refresh"), label: "Refresh source status",
          sub: "Runs a fresh adapter health check.", onClick: () => refreshLiveHub(true) },
        { className: "menu-action", ic: icon("database"), label: "Open full data health",
          sub: "Collector cache, source methods and raw adapter states.", onClick: openDataSheet },
      ],
      footer: liveFooter(counts),
    });
    if (!sourceWarm) warmSources().then(() => refreshLiveHub(false));
  }

  let liveSpin = null;
  async function refreshLiveHub(force = false) {
    if (force) liveBtn.classList.add("refreshing");
    let sources = cachedSources;
    try {
      sources = (await api.sources()).sources || [];
      cachedSources = sources;
    } catch (e) {}
    const counts = sourceCounts(sources);
    const st = healthState(counts);
    liveBtn.classList.remove("live", "warn", "off", "idle");
    liveBtn.classList.add(st);
    liveCount.textContent = counts.total ? `${counts.live}/${counts.total}` : "0";
    liveText.textContent = healthLabel(counts);
    liveBtn.title = `Live data health · ${counts.live} live · ${counts.warn} warming · ${counts.off} blocked`;
    if (force) {
      clearTimeout(liveSpin);
      liveSpin = setTimeout(() => liveBtn.classList.remove("refreshing"), 1400);
    }
  }
  refreshLiveHub(false);
  warmFx();
  setInterval(() => refreshLiveHub(false), 15000);

  // currency selector — conversion only when a live FX rate exists (honest)
  const curBtn = h("button", { class: "hdr-ctl hdr-currency", title: "Currency" },
    h("span", { class: "ctl-txt num" }, getSettings().currency));
  curBtn.addEventListener("click", () => {
    const fx = cachedFx || { rates: {}, status: "checking" };
    openMenu(curBtn, {
      title: "Display currency",
      width: 280,
      items: CURRENCIES.map((c) => {
        const rate = c === "USD" ? 1 : (fx.rates || {})[c];
        const ok = c === "USD" || (isFinite(rate) && rate > 0);
        return {
          label: c === "USD" ? "USD / USDT" : c,
          sub: c === "USD" ? "Native Binance quote (USDT ≈ USD)"
            : ok ? `1 USD = ${Number(rate).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${c} · ${fx.source || "fx"}`
            : "FX source unavailable — " + (fx.status || "not configured"),
          active: getSettings().currency === c,
          disabled: !ok,
          onClick: () => setSetting("currency", c),
        };
      }),
    });
    if (!fxWarm) warmFx();
  });

  const themeBtn = h("button", { class: "icon-btn", title: "Toggle theme", onClick: toggleTheme },
    icon(getTheme() === "dark" ? "sun" : "moon"));
  const settingsBtn = h("button", { class: "icon-btn", title: "Settings", onClick: openSettingsSheet }, icon("sliders"));

  const right = h("div", { class: "hdr-right" }, searchBtn, liveBtn, curBtn, themeBtn, settingsBtn);
  const header = h("header", { class: "hdr" }, h("div", { class: "container container-full hdr-in" },
    brand, nav, h("span", { class: "hdr-spacer", "aria-hidden": "true" }), right));
  installSprint2TapePruner();

  function paintRoute() {
    closeOpenMenu();
    const active = activeTopNav();
    for (const a of nav.querySelectorAll("a")) a.classList.toggle("active", a.dataset.section === active);
    syncMarketCategoryFromUrl();
  }
  function paintTheme() { themeBtn.replaceChildren(icon(getTheme() === "dark" ? "sun" : "moon")); }
  paintRoute(); paintTheme();
  onRoute(paintRoute);
  onTheme(paintTheme);
  onSettings((s) => {
    curBtn.querySelector(".ctl-txt").textContent = s.currency;
  });
  return header;
}

function cmdKey() {
  return /mac/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ";
}

function openNavMenu(anchor, item) {
  openMenu(anchor, {
    title: item.menuTitle || "Market categories",
    subtitle: item.menuSub || "",
    width: item.id === "crypto" ? 384 : 392,
    align: "left",
    className: `nav-menu-pop nav-category-pop s2-nav-pop s2-nav-${item.id}`,
    items: navCategoryItems(item),
  });
}

function navCategoryItems(item) {
  const activeSection = activeNavSection();
  const route = currentRoute();
  return (item.items || []).map((row) => ({
    className: "nav-cat tone-" + row.tone,
    ic: icon(row.ic),
    label: row.label,
    sub: row.sub,
    active: row.path === location.pathname || row.id === activeSection || (row.section === activeSection && row.id === route.name),
    rightIc: icon("chevronRight"),
    onClick: () => goNavItem(row.path, row.section || row.id),
  }));
}

function goNavItem(path, section) {
  closeOpenMenu();
  if (path) navigate(path);
  if (section) syncMarketCategory(section);
}

function activeNavSection() {
  const r = currentRoute();
  if (r.name === "radar" || r.name === "heatmap" || r.name === "bubbles" || r.name === "funding" || r.name === "movers" || r.name === "symbol") {
    return "crypto";
  }
  const params = new URLSearchParams(location.search);
  const raw = params.get("sec");
  const section = SECTION_ALIASES[raw] || raw || "global";
  return NAV_SECTION_IDS.has(section) ? section : "global";
}

function activeTopNav() {
  return activeNavSection() === "crypto" ? "crypto" : "global";
}

function syncMarketCategoryFromUrl() {
  const r = currentRoute();
  if (r.name !== "market") return;
  syncMarketCategory(activeNavSection());
}

function syncMarketCategory(section, tries = 0) {
  if (!NAV_SECTION_IDS.has(section)) return;
  const btn = document.querySelector(`.market-taxonomy-pill[data-atlas-category="${section}"]`);
  if (btn) {
    if (!btn.classList.contains("active")) btn.click();
    return;
  }
  if (tries < 10) setTimeout(() => syncMarketCategory(section, tries + 1), 90);
}

let sprint2TapePrunerInstalled = false;

function installSprint2TapePruner() {
  if (sprint2TapePrunerInstalled || typeof MutationObserver === "undefined") return;
  sprint2TapePrunerInstalled = true;
  const prune = () => {
    for (const chip of document.querySelectorAll(".atlas-tape-chip, .atlas-symbol-card, .atlas-group-row, .seq-rail-chip")) {
      const labels = Array.from(chip.querySelectorAll("small"))
        .map((node) => (node.textContent || "").trim().toLowerCase());
      const state = labels[labels.length - 1] || "";
      chip.classList.toggle("s2-dead-tape", !state || state === "chart" || state === "unavailable" || state === "-");
    }
  };
  prune();
  new MutationObserver(prune).observe(document.body, { childList: true, subtree: true, characterData: true });
}
