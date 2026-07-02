// Entry point: shell, router, live poll, health badge, hotkeys.

import { h, mount, clear } from "./lib/dom.js";
import { buildHeader } from "./ui/header.js";
import { openCommand, wireCommandHotkey } from "./ui/command.js";
import { openDataSheet } from "./ui/drawer.js";
import { buildHealthBadge } from "./ui/health.js";
import { onRoute, currentRoute, startPolling, navigate } from "./lib/store.js";
import { getSettings, onSettings, applyMotion } from "./lib/settings.js";
import { setDisplayCurrency } from "./lib/format.js";
import { loadIconManifest } from "./lib/icons.js";
import { api } from "./lib/api.js";
import { renderMarket } from "./screens/market.js";
import { renderRadar } from "./screens/radar.js";
import { renderSymbol } from "./screens/symbol.js";
import { renderHeatmap } from "./screens/heatmap.js";
import { renderFunding } from "./screens/funding.js";
import { renderMovers } from "./screens/movers.js";

applyMotion();

const app = document.getElementById("app");
const view = h("main", { id: "view" });

const footer = h("footer", { class: "footer" },
  h("div", { class: "container" },
    h("span", {}, "CG Signal Lab"),
    h("span", {}, "Research only · public Binance spot & USD-M perp"),
    h("a", { href: "#", class: "ghost-link", style: { marginLeft: "auto" },
      onClick: (e) => { e.preventDefault(); openDataSheet(); } }, "Data health"),
    h("a", { href: "/api/state", class: "ghost-link", target: "_blank", rel: "noopener" }, "API")));

const header = buildHeader({ onSearch: openCommand });
mount(app, header, view, footer);
document.body.appendChild(buildHealthBadge());

// honor the user's default-page preference on a bare "/" entry
if ((location.pathname.replace(/\/+$/, "") || "/") === "/" && getSettings().defaultPage === "radar") {
  history.replaceState({}, "", "/radar");
}

const SCREENS = {
  market: renderMarket,
  radar: renderRadar,
  heatmap: renderHeatmap,
  funding: renderFunding,
  movers: renderMovers,
};

let cleanup = null;
function route() {
  const r = currentRoute();
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  clear(view);
  if (r.name === "symbol") cleanup = renderSymbol(view, r.symbol);
  else cleanup = (SCREENS[r.name] || renderMarket)(view);
}

onRoute(route);
route();
wireCommandHotkey();
startPolling();
loadIconManifest();

// Apply the persisted display currency once live FX rates are known; on
// change, re-render the current screen so every price updates immediately.
async function applyCurrency(rerender) {
  const cur = getSettings().currency;
  if (cur === "USD") { setDisplayCurrency("USD", 1); }
  else {
    try {
      const fx = await api.fx();
      setDisplayCurrency(cur, (fx.rates || {})[cur]);
    } catch (e) { setDisplayCurrency("USD", 1); }
  }
  if (rerender) route();
}
applyCurrency(false);
onSettings((_, key) => { if (key === "currency" || key === "*") applyCurrency(true); });

// Tell the shell's boot watchdog we are alive (see web_static.py fallback).
window.__CG_BOOTED__ = true;
if (window.__CG_BOOT_WATCHDOG__) clearTimeout(window.__CG_BOOT_WATCHDOG__);
