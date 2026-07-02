// Bottom-right data-health badge: a small network bubble that is green when
// healthy, amber when delayed, red when broken. Hover shows a micro summary;
// click opens the polished data-health drawer.

import { h } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { onLive, store } from "../lib/store.js";
import { ago } from "../lib/format.js";
import { openDataSheet } from "./drawer.js";

export function buildHealthBadge() {
  const dot = h("span", { class: "hb-dot" });
  const tip = h("div", { class: "hb-tip" });
  const badge = h("button", { class: "health-badge", title: "Data health", onClick: openDataSheet },
    icon("wifi"), dot, tip);

  function paint() {
    const lite = store.lite || {};
    const health = lite.health || {};
    const cache = lite.cache || {};
    const status = health.status;
    const cacheAge = Number(cache.cache_age_seconds);
    let cls = "warn";
    if (status === "LIVE" && isFinite(cacheAge) && cacheAge < 8) cls = "ok";
    else if (status === "DB ERROR" || status === "API RETRY" || (!status && !lite.ok)) cls = "bad";
    badge.className = "health-badge " + cls;
    tip.replaceChildren(
      row("Status", status || "—"),
      row("Refresh", cache.last_refresh_ms != null ? cache.last_refresh_ms + " ms" : "—"),
      row("Cache age", isFinite(cacheAge) ? cacheAge.toFixed(1) + "s" : "—"),
      row("Symbols", health.live_symbols != null ? `${health.live_symbols} live / ${health.tracked_symbols}` : "—"),
      row("Feed age", health.freshness_age_seconds != null ? ago(health.freshness_age_seconds) : "—"),
      health.error ? row("Error", String(health.error).slice(0, 60)) : null,
      h("div", { class: "hb-open" }, "Click for data health"));
  }
  function row(k, v) {
    return h("div", { class: "hb-row" }, h("span", { class: "k" }, k), h("span", { class: "v num" }, v));
  }

  paint();
  onLive(paint);
  setInterval(paint, 2000); // keep the cache-age reading fresh between polls
  return badge;
}
