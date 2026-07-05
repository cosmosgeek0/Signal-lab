// Bottom-right data-health badge: a small network bubble that is green when
// healthy, amber when delayed, red when broken. Hover shows a micro summary;
// click opens the polished data-health drawer.

import { h } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { onLive, store } from "../lib/store.js";
import { ago } from "../lib/format.js";
import { openDataSheet } from "./drawer.js";

export function buildHealthBadge() {
  const dot = h("span", { class: "hb-dot" });
  const tip = h("div", { class: "hb-tip" });
  const badge = h("button", { class: "health-badge", title: "Data health", onClick: openDataSheet },
    icon("wifi"), dot, tip);
  let sourceCounts = null;

  async function refreshSources() {
    try {
      const payload = await api.sources();
      sourceCounts = countSources((payload && payload.sources) || []);
      paint();
    } catch (e) {
      sourceCounts = sourceCounts || { live: 0, warn: 0, off: 0, total: 0 };
    }
  }

  function paint() {
    const lite = store.lite || {};
    const health = lite.health || {};
    const cache = lite.cache || {};
    const status = health.status;
    const cacheAge = Number(cache.cache_age_seconds);
    let cls = "warn";
    if (status === "LIVE" && isFinite(cacheAge) && cacheAge < 8 && sourceCounts && !sourceCounts.warn && !sourceCounts.off) cls = "ok";
    else if (status === "DB ERROR" || status === "API RETRY" || (!status && !lite.ok)) cls = "bad";
    badge.className = "health-badge " + cls;
    const sourceLine = sourceCounts && sourceCounts.total
      ? `${sourceCounts.live} up · ${sourceCounts.warn} degraded · ${sourceCounts.off} off`
      : "Checking sources";
    const label = cls === "ok" ? "Sources up" : cls === "bad" ? "Health down" : "Sources degraded";
    badge.title = `Data health · ${sourceLine}`;
    tip.replaceChildren(
      h("div", { class: "hb-top" }, h("b", {}, label), h("span", { class: "hb-state " + cls }, cls === "ok" ? "OK" : cls === "bad" ? "DOWN" : "WATCH")),
      row("Sources", sourceLine),
      row("Collector", status || "—"),
      row("Cache", isFinite(cacheAge) ? cacheAge.toFixed(1) + "s" : "—"),
      row("Feed age", health.freshness_age_seconds != null ? ago(health.freshness_age_seconds) : "—"),
      health.error ? row("Error", String(health.error).slice(0, 60)) : null,
      h("div", { class: "hb-open" }, "Click for data health"));
  }
  function row(k, v) {
    return h("div", { class: "hb-row" }, h("span", { class: "k" }, k), h("span", { class: "v num" }, v));
  }
  function countSources(rows) {
    const out = { live: 0, warn: 0, off: 0, total: rows.length };
    for (const s of rows) {
      if (s.status === "live") out.live += 1;
      else if (s.status === "error" || s.status === "unavailable" || s.status === "requires_key" || s.status === "not_configured") out.off += 1;
      else out.warn += 1;
    }
    return out;
  }

  paint();
  refreshSources();
  onLive(paint);
  setInterval(paint, 2000); // keep the cache-age reading fresh between polls
  setInterval(refreshSources, 30000);
  return badge;
}
