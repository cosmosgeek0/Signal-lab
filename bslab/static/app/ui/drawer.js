// Data-health drawer: source status, collector and cache vitals, methodology
// note. This is the ONLY surface for "public data only / no keys / no trading"
// and internals — never the main viewport. Opened from the health badge.

import { h, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { store, onLive } from "../lib/store.js";
import { fmtCompact, ago, fmtDateTime } from "../lib/format.js";

export function openDataSheet() {
  if (document.querySelector(".sheet")) return;
  const scrim = h("div", { class: "sheet-scrim", onClick: close });
  const body = h("div", { class: "sheet-body" });
  const sheet = h("div", { class: "sheet", role: "dialog", "aria-label": "Data health" },
    h("div", { class: "sheet-head" },
      icon("wifi"), h("h2", {}, "Data health"),
      h("button", { class: "icon-btn", style: { marginLeft: "auto" }, onClick: close, title: "Close" }, icon("x"))),
    body);

  let sources = [];
  async function loadSources() {
    try { sources = (await api.sources()).sources || []; paint(); } catch (e) {}
  }

  const unsubs = [];
  function paint() {
    const lite = store.lite || {};
    const health = lite.health || {};
    const cache = lite.cache || {};
    mount(body,
      section("Sources",
        ...(sources.length ? sources.map(srcRow) : [row("Loading…", txt(""))])),
      section("Collector",
        row("Feed status", statusChip(health.status || "—")),
        row("Live symbols", txt(health.live_symbols)),
        row("Stale symbols", txt(health.stale_symbol_count)),
        row("Tracked symbols", txt(health.tracked_symbols)),
        row("Last update", txt(health.latest_ts_ms ? fmtDateTime(health.latest_ts_ms) : "—")),
        row("Feed age", txt(health.freshness_age_seconds != null ? ago(health.freshness_age_seconds) : "—")),
        health.error ? row("Error", txt(String(health.error).slice(0, 80))) : null),
      section("Cache",
        row("Latency", txt(cache.last_refresh_ms != null ? cache.last_refresh_ms + " ms" : "—")),
        row("Cache age", txt(cache.cache_age_seconds != null ? Number(cache.cache_age_seconds).toFixed(1) + "s" : "—")),
        row("Refresh interval", txt(cache.refresh_interval_sec != null ? cache.refresh_interval_sec + "s" : "—")),
        row("Stored rows", txt(fmtCompact(cache.row_count))),
        row("Refreshes", txt(fmtCompact(cache.refresh_count))),
        row("Failed refreshes", txt(cache.failed_refresh_count ?? "—"))),
      section("API",
        linkRow("/api/state", "Full snapshot"),
        linkRow("/api/overview", "Market overview"),
        linkRow("/api/health", "Health JSON")),
      h("div", { style: { padding: "14px 19px", color: "var(--faint)", fontSize: "11.5px", lineHeight: "1.6" } },
        "Public Binance spot + USD-M perp data. No API keys, no orders, no account access. ",
        "Basis and funding are research signals, not trading advice. ",
        h("br"),
        "spot_to_perp = buy spot ask / sell perp bid · perp_to_spot = inverse · shown in bps."));
  }

  function srcRow(s) {
    const dot = s.status === "live" ? "dot-live" : s.status === "stale" ? "dot-stale" : s.status === "not_configured" ? "dot-none" : "dot-off";
    const note = s.status === "not_configured" ? "Not configured" : s.status.toUpperCase();
    return h("div", { class: "drow" },
      h("span", { class: "m-dot " + dot, style: { marginRight: "2px" } }),
      h("div", {},
        h("div", { style: { color: "var(--text)", fontSize: "12.5px", fontWeight: "600" } }, s.label),
        h("div", { style: { color: "var(--muted)", fontSize: "11px", marginTop: "1px" } }, s.detail)),
      h("span", { class: "v", style: { fontSize: "10.5px", letterSpacing: ".05em", color: s.status === "live" ? "var(--up)" : "var(--muted)" } }, note));
  }
  function section(title, ...rows) {
    return h("div", {}, h("div", { class: "menu-title", style: { padding: "16px 19px 6px" } }, title), ...rows.filter(Boolean));
  }
  function row(k, v) { return h("div", { class: "drow" }, h("span", { class: "k" }, k), v); }
  function txt(v) { return h("span", { class: "v" }, v == null ? "—" : String(v)); }
  function statusChip(s) {
    const cls = s === "LIVE" ? "dot-live" : s === "STALE" || s === "DB WARMING" ? "dot-stale" : "dot-off";
    return h("span", { class: "v", style: { display: "inline-flex", alignItems: "center", gap: "7px" } },
      h("span", { class: "dot " + cls, style: { width: "7px", height: "7px", borderRadius: "50%" } }), s);
  }
  function linkRow(href, label) {
    return h("a", { class: "drow ghost-link", href, target: "_blank", rel: "noopener" },
      h("span", { class: "k" }, label), h("span", { class: "v mono" }, href));
  }

  paint();
  loadSources();
  unsubs.push(onLive(paint));
  function close() {
    unsubs.forEach((u) => u());
    scrim.remove(); sheet.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);
}
