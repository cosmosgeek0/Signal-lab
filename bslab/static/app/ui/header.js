// Header: brand · Market/Radar/Heatmap/Funding/Movers · search, data source,
// currency, UTC clock, theme, settings. Health lives in the bottom-right badge.

import { h } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { linkTo, onRoute, currentRoute, getTheme, toggleTheme, onTheme } from "../lib/store.js";
import { getSettings, setSetting, onSettings } from "../lib/settings.js";
import { openMenu } from "./menu.js";
import { openSettingsSheet } from "./settings.js";

const BRAND_MARK = `<svg viewBox="0 0 32 32" width="32" height="32" class="brand-mark">
  <rect width="32" height="32" rx="8" fill="#0b0e11"/>
  <path d="M6 20.5h4.2l2.6-8.4 4.4 12.6 2.8-8.8 1.8 3h4.2" stroke="#f0b90b" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const NAV_ITEMS = [
  { route: "market", path: "/", label: "Market", ic: "globe" },
  { route: "radar", path: "/radar", label: "Radar", ic: "radar" },
  { route: "heatmap", path: "/heatmap", label: "Heatmap", ic: "grid" },
  { route: "funding", path: "/funding", label: "Funding", ic: "zap" },
  { route: "movers", path: "/movers", label: "Movers", ic: "trendingUp" },
];

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "JPY"];

const pad = (x) => String(x).padStart(2, "0");

export function buildHeader({ onSearch }) {
  const brand = h("a", { class: "brand", href: "/", onClick: linkTo("/"), html: BRAND_MARK });
  brand.appendChild(h("span", { class: "brand-name", html: 'CG <b>Signal&nbsp;Lab</b>' }));

  const nav = h("nav", { class: "nav" },
    NAV_ITEMS.map((n) => h("a", { href: n.path, "data-route": n.route, onClick: linkTo(n.path) }, icon(n.ic), n.label)));

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
