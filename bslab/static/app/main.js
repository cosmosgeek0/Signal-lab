// Entry point: shell, router, live poll, health badge, hotkeys.

import { h, mount, clear } from "./lib/dom.js";
import { buildHeader } from "./ui/header.js";
import { openCommand, wireCommandHotkey } from "./ui/command.js";
import { openDataSheet } from "./ui/drawer.js";
import { buildHealthBadge } from "./ui/health.js";
import { onRoute, currentRoute, startPolling, navigate, linkTo } from "./lib/store.js";
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

// Ordered, Coinbase-style footer: brand + tagline, then clean link columns,
// then a quiet legal line. Structure = hairlines + whitespace, no boxes.
const BRAND_MARK_SM = `<svg viewBox="0 0 32 32" width="26" height="26" style="border-radius:7px;display:block">
  <rect width="32" height="32" rx="8" fill="#0b0e11"/>
  <path d="M6 20.5h4.2l2.6-8.4 4.4 12.6 2.8-8.8 1.8 3h4.2" stroke="#f0b90b" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const fLink = (label, href) => h("a", { href, onClick: linkTo(href) }, label);
const xLink = (label, href) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, label);
const footer = h("footer", { class: "footer" },
  h("div", { class: "container" },
    h("div", { class: "ftr-grid" },
      h("div", { class: "ftr-brand" },
        h("div", { style: { display: "flex", alignItems: "center", gap: "9px" } },
          h("span", { html: BRAND_MARK_SM }),
          h("span", { class: "ftr-name" }, "CosmosGeek Radar")),
        h("p", { class: "ftr-tag" },
          "Public market-intelligence terminal: world indices, crypto, tokenized ",
          "equities, spot/perp basis & funding and live multi-source news — ",
          "keyless public data, never fabricated.")),
      h("div", { class: "ftr-col" },
        h("div", { class: "ftr-h" }, "Product"),
        fLink("Market", "/"), fLink("Radar", "/radar"), fLink("Heatmap", "/heatmap"),
        fLink("Funding", "/funding"), fLink("Movers", "/movers")),
      h("div", { class: "ftr-col" },
        h("div", { class: "ftr-h" }, "Data sources"),
        xLink("Binance public API", "https://www.binance.com"),
        xLink("CoinGecko", "https://www.coingecko.com"),
        xLink("DefiLlama", "https://defillama.com"),
        xLink("Alternative.me F&G", "https://alternative.me/crypto/fear-and-greed-index/"),
        h("a", { href: "#", onClick: (e) => { e.preventDefault(); openDataSheet(); } }, "Data health →")),
      h("div", { class: "ftr-col" },
        h("div", { class: "ftr-h" }, "Developers"),
        xLink("JSON API · /api/state", "/api/state"),
        xLink("Health · /api/health", "/api/health"),
        xLink("Sources · /api/sources", "/api/sources"))),
    h("div", { class: "ftr-bottom" },
      h("span", {}, "© 2026 CosmosGeek Radar"),
      h("span", {}, "Research only — not investment advice"),
      h("span", {}, "No accounts · no keys · no trading"),
      h("span", { class: "num", style: { marginLeft: "auto" } }, "All times UTC"))));

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
