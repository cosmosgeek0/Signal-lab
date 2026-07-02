// Header: brand · Market/Radar/Heatmap/Funding/Movers · search, data source,
// currency, UTC clock, theme, settings. Health lives in the bottom-right badge.

import { h } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { linkTo, onRoute, currentRoute, getTheme, toggleTheme, onTheme } from "../lib/store.js";
import { getSettings, setSetting, onSettings } from "../lib/settings.js";
import { openMenu } from "./menu.js";
import { openSettingsSheet } from "./settings.js";

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

// Every nav item exposes its real deep links on hover — no dead entries: the
// Market anchors scroll to live sections, Heatmap links are documented params.
const NAV_ITEMS = [
  { route: "market", path: "/", label: "Market", ic: "globe", menu: [
    { label: "Overview", sub: "Global pulse, majors, intelligence", path: "/" },
    { label: "World markets", sub: "US · Europe · Asia · India · commodities · FX", path: "/?sec=world" },
    { label: "Crypto prices", sub: "Top-250 table, stocks tab, sortable", path: "/?sec=prices" },
    { label: "Live news", sub: "Squawk wire + macro & crypto outlets", path: "/?sec=news" },
  ] },
  { route: "radar", path: "/radar", label: "Radar", ic: "radar", menu: [
    { label: "Basis radar", sub: "Spot vs perp dislocations, live", path: "/radar" },
  ] },
  { route: "heatmap", path: "/heatmap", label: "Heatmap", ic: "grid", menu: [
    { label: "Treemap · market cap", sub: "Size = cap, color = 24h move", path: "/heatmap?mode=treemap&metric=mcap" },
    { label: "Tiles · basis", sub: "Spot–perp spread across the board", path: "/heatmap?mode=tiles&metric=basis" },
    { label: "Bubbles · funding", sub: "Who pays whom, at a glance", path: "/heatmap?mode=bubbles&metric=funding" },
  ] },
  { route: "funding", path: "/funding", label: "Funding", ic: "zap", menu: [
    { label: "Funding overview", sub: "Distribution, leaderboards, history", path: "/funding" },
  ] },
  { route: "movers", path: "/movers", label: "Movers", ic: "trendingUp", menu: [
    { label: "Momentum boards", sub: "1/5/15/60-minute windows", path: "/movers" },
  ] },
];

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "JPY"];

const pad = (x) => String(x).padStart(2, "0");

export function buildHeader({ onSearch }) {
  const brand = h("a", { class: "brand", href: "/", onClick: linkTo("/"), html: BRAND_MARK });
  brand.appendChild(h("span", { class: "brand-name", html: 'CosmosGeek&nbsp;<b>Radar</b>' }));

  const nav = h("nav", { class: "nav" },
    NAV_ITEMS.map((n) => h("span", { class: "nav-item" },
      h("a", { href: n.path, "data-route": n.route, onClick: linkTo(n.path) }, icon(n.ic), n.label),
      (n.menu || []).length ? h("span", { class: "nav-drop", role: "menu" },
        n.menu.map((m) => h("a", { class: "nav-drop-it", href: m.path, onClick: linkTo(m.path) },
          h("span", { class: "nd-label" }, m.label),
          h("span", { class: "nd-sub" }, m.sub)))) : null)));

  const searchBtn = h("button", { class: "search-btn", onClick: onSearch, title: "Search (Cmd/Ctrl K)" },
    icon("search"), h("span", { class: "stxt" }, "Search"), h("span", { class: "kbd" }, cmdKey() + "K"));

  // data source selector: pick the working mode, inspect every adapter state
  const srcLabel = () => getSettings().source === "binance" ? "Binance" : "Combined";
  const srcBtn = h("button", { class: "hdr-ctl", title: "Data source" }, icon("database"), h("span", { class: "ctl-txt" }, srcLabel()));
  srcBtn.addEventListener("click", async () => {
    let sources = [];
    try { sources = (await api.sources()).sources || []; } catch (e) {}
    const mode = getSettings().source;
    const pick = (id) => { setSetting("source", id); srcBtn.querySelector(".ctl-txt").textContent = srcLabel(); };
    openMenu(srcBtn, {
      title: "Data source mode",
      width: 312,
      items: [
        { label: "Combined", sub: "Binance live + external context (CoinGecko, DefiLlama, F&G…)",
          active: mode !== "binance", dot: "dot-live", onClick: () => pick("combined") },
        { label: "Binance public only", sub: "Hide all external context — local basis/funding data only",
          active: mode === "binance", dot: "dot-live", onClick: () => pick("binance") },
        { group: "Source health (click any card's source label for detail)" },
        ...sources.map((s) => ({
          label: s.label,
          sub: (s.detail || "") + (s.age_seconds != null ? ` · updated ${Math.round(s.age_seconds)}s ago` : ""),
          dot: s.status === "live" ? "dot-live" : s.status === "stale" ? "dot-stale"
            : (s.status === "key_required" || s.status === "not_configured" || s.status === "idle") ? "dot-none" : "dot-off",
          disabled: true,
        })),
      ],
    });
  });

  // currency selector — conversion only when a live FX rate exists (honest)
  const curBtn = h("button", { class: "hdr-ctl", title: "Currency" }, h("span", { class: "ctl-txt" }, getSettings().currency));
  curBtn.addEventListener("click", async () => {
    let fx = { rates: {}, status: "unavailable" };
    try { fx = await api.fx(); } catch (e) {}
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
  });

  // live UTC clock
  const clock = h("span", { class: "hdr-clock num" });
  function tick() {
    const d = new Date();
    clock.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  }
  tick();
  setInterval(tick, 1000);

  const themeBtn = h("button", { class: "icon-btn", title: "Toggle theme", onClick: toggleTheme },
    icon(getTheme() === "dark" ? "sun" : "moon"));
  const settingsBtn = h("button", { class: "icon-btn", title: "Settings", onClick: openSettingsSheet }, icon("sliders"));

  const right = h("div", { class: "hdr-right" }, searchBtn, srcBtn, curBtn, clock, themeBtn, settingsBtn);
  const header = h("header", { class: "hdr" }, h("div", { class: "container container-full hdr-in" }, brand, nav, right));

  function paintRoute() {
    const r = currentRoute();
    for (const a of nav.querySelectorAll("a")) a.classList.toggle("active", a.dataset.route === r.name);
  }
  function paintTheme() { themeBtn.replaceChildren(icon(getTheme() === "dark" ? "sun" : "moon")); }
  paintRoute(); paintTheme();
  onRoute(paintRoute);
  onTheme(paintTheme);
  onSettings((s) => { curBtn.querySelector(".ctl-txt").textContent = s.currency; });
  return header;
}

function cmdKey() {
  return /mac/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ";
}
