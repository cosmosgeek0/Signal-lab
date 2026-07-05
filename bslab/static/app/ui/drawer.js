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
    const live = sources.filter((s) => s.status === "live").length;
    const warn = sources.filter((s) => ["stale", "idle", "tree_backed", "delayed"].includes(s.status)).length;
    const off = Math.max(0, sources.length - live - warn);
    const score = healthScore(sources, health, cache);
    const counts = { live, warn, off, total: sources.length };
    mount(body,
      healthCompactSummary(counts, health, cache, score),
      section("Sources",
        sources.length ? sourceGroupList(sources) : h("div", { class: "health-empty-row" }, "Checking source map...")),
      section("Collector & cache",
        row("Feed status", statusChip(health.status || "—")),
        row("Symbols", txt(`${health.live_symbols ?? 0} live / ${health.stale_symbol_count ?? 0} stale`)),
        row("Last update", txt(health.latest_ts_ms ? fmtDateTime(health.latest_ts_ms) : "—")),
        row("Cache", txt(cache.cache_age_seconds != null ? `${Number(cache.cache_age_seconds).toFixed(1)}s · ${Math.round(Number(cache.last_refresh_ms) || 0)} ms` : "—")),
        row("Rows", txt(`${fmtCompact(cache.row_count)} rows · ${fmtCompact(cache.refresh_count)} refreshes`)),
        Number(cache.failed_refresh_count) ? row("Failures", txt(cache.failed_refresh_count)) : null,
        health.error ? row("Error", txt(String(health.error).slice(0, 80))) : null),
      section("Reports",
        reportRow("/api/sources", "Source map", "server"),
        reportRow("/api/health", "Health JSON", "activity"),
        reportRow("/api/state", "Full snapshot", "database")),
      h("div", { class: "health-method-note" },
        "Public data only. Source state reflects this local server; blocked/key-required adapters stay labeled and are not hidden."));
  }

  function healthScore(sources, health, cache) {
    const total = sources.length || 0;
    const livePct = total ? sources.filter((s) => s.status === "live").length / total : 0;
    const warnPct = total ? sources.filter((s) => ["stale", "idle", "tree_backed", "delayed"].includes(s.status)).length / total : 0;
    const cacheAge = Number(cache.cache_age_seconds);
    const interval = Math.max(5, Number(cache.refresh_interval_sec) || 10);
    const cachePct = Number.isFinite(cacheAge) ? Math.max(0, Math.min(1, 1 - cacheAge / (interval * 3))) : 0.45;
    const feedAge = Number(health.freshness_age_seconds);
    const feedPct = Number.isFinite(feedAge) ? Math.max(0, Math.min(1, 1 - feedAge / 180)) : 0.45;
    const raw = livePct * 70 + warnPct * 16 + cachePct * 9 + feedPct * 5;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function scoreLabel(score) {
    if (score >= 90) return "excellent";
    if (score >= 75) return "stable";
    if (score >= 55) return "watch";
    return "repair";
  }

  function healthCompactSummary(counts, health, cache, score) {
    const state = overallState(counts, health);
    const cacheAge = cache.cache_age_seconds != null ? Number(cache.cache_age_seconds).toFixed(1) + "s cache" : "cache warming";
    const collector = health.status || "checking";
    return h("div", { class: "health-compact-card " + state },
      h("div", { class: "health-compact-copy" },
        h("div", { class: "health-mini-k" },
          h("span", { class: "health-state-dot " + state }),
          "Source map"),
        h("div", { class: "health-compact-title" }, healthHeadline(counts, health)),
        h("div", { class: "health-compact-sub" },
          `${collector} collector · ${cacheAge} · score ${score} ${scoreLabel(score)}`)),
      h("div", { class: "health-count-pack" },
        healthCount("up", counts.live, "Up"),
        healthCount("warn", counts.warn, "Degraded"),
        healthCount("off", counts.off, "Off")),
      h("div", { class: "health-mini-meter", "aria-hidden": "true" },
        h("span", { class: "hm-live", style: { "--w": counts.total ? (counts.live / counts.total * 100) + "%" : "0%" } }),
        h("span", { class: "hm-warn", style: { "--w": counts.total ? (counts.warn / counts.total * 100) + "%" : "0%" } }),
        h("span", { class: "hm-off", style: { "--w": counts.total ? (counts.off / counts.total * 100) + "%" : "0%" } })));
  }

  function healthHeadline(counts, health) {
    if (!counts.total) return "Checking sources";
    if (counts.off || counts.warn || health.status !== "LIVE") return "Sources degraded";
    return "Sources up";
  }

  function overallState(counts, health) {
    if (!counts.total) return "warn";
    if (health.status === "DB ERROR" || health.status === "API RETRY" || (!counts.live && counts.off)) return "bad";
    if (counts.warn || counts.off || health.status !== "LIVE") return "warn";
    return "ok";
  }

  function healthCount(cls, value, label) {
    return h("span", { class: "health-count " + cls },
      h("b", { class: "num" }, value),
      h("small", {}, label));
  }

  function sourceGroupList(rows) {
    const groups = [
      ["primary", "Primary feeds", "wifi"],
      ["cache", "Local cache", "database"],
      ["context", "Market context", "globe"],
      ["news", "News wires", "newspaper"],
      ["fallback", "Fallback adapters", "cloud"],
      ["source", "Other adapters", "grid"],
    ];
    const known = new Set(groups.map(([id]) => id));
    const byKind = new Map(groups.map(([id]) => [id, []]));
    rows.forEach((s) => {
      const kind = sourceKind(s);
      byKind.get(known.has(kind) ? kind : "source").push(s);
    });
    return h("div", { class: "health-source-groups" },
      groups.map(([id, label, ic]) => {
        const list = byKind.get(id) || [];
        if (!list.length) return null;
        return sourceGroupRow(label, ic, list);
      }));
  }

  function sourceGroupRow(label, ic, list) {
    const counts = {
      live: list.filter((s) => sourceBucket(s.status) === "live").length,
      warn: list.filter((s) => sourceBucket(s.status) === "warn").length,
      off: list.filter((s) => sourceBucket(s.status) === "off").length,
      total: list.length,
    };
    const state = counts.off ? "bad" : counts.warn ? "warn" : "ok";
    return h("div", { class: "health-source-group " + state, title: sourceGroupTitle(list) },
      h("span", { class: "health-group-icon" }, icon(ic)),
      h("span", { class: "health-group-copy" },
        h("b", {}, label),
        h("small", {}, sourceGroupDetail(list, counts))),
      h("span", { class: "health-group-state" },
        h("b", { class: "num" }, `${counts.live}/${counts.total}`),
        h("small", {}, groupStateLabel(counts))));
  }

  function sourceBucket(status) {
    if (status === "live") return "live";
    if (status === "error" || status === "unavailable" || status === "requires_key" || status === "not_configured") return "off";
    return "warn";
  }

  function groupStateLabel(counts) {
    if (counts.off && counts.warn) return `${counts.off + counts.warn} affected`;
    if (counts.off) return `${counts.off} off`;
    if (counts.warn) return `${counts.warn} degraded`;
    return "up";
  }

  function sourceGroupDetail(list, counts) {
    const problem = list.filter((s) => sourceBucket(s.status) !== "live").slice(0, 2).map((s) => s.label || s.id);
    if (problem.length) return problem.join(", ") + (counts.warn + counts.off > problem.length ? " +" + (counts.warn + counts.off - problem.length) : "");
    return list.slice(0, 2).map((s) => s.label || s.id).join(", ") + " connected";
  }

  function sourceGroupTitle(list) {
    return list.map((s) => `${s.label || s.id}: ${String(s.status || "warming").replace(/_/g, " ")}`).join(" · ");
  }

  function healthIssueCards(live, warn, off, health, cache) {
    const staleSymbols = Number(health.stale_symbol_count) || 0;
    const failed = Number(cache.failed_refresh_count) || 0;
    return [
      issueCard(off, "Blocked sources", off ? "API key, license or unavailable adapters need attention." : "No blocked adapters reported.", "lock", off ? "bad" : "ok", "Sources"),
      issueCard(warn, "Warming sources", warn ? "Delayed or tree-backed feeds are labeled before use." : "No warming feeds in the current source map.", "warning", warn ? "warn" : "ok", "Sources"),
      issueCard(staleSymbols, "Stale symbols", staleSymbols ? "Collector has symbols older than the freshness window." : "No stale symbols reported by the collector.", "activity", staleSymbols ? "warn" : "ok", "Collector"),
      issueCard(failed, "Failed refreshes", failed ? "Cache refresh failures are counted by the server." : "No failed cache refreshes reported.", "refresh", failed ? "bad" : "ok", "Cache"),
    ];
  }

  function issueCard(value, title, copy, ic, cls, target) {
    return h("button", { class: "health-issue-card " + cls, type: "button", onClick: () => scrollToSection(target) },
      h("span", { class: "health-issue-icon" }, icon(ic)),
      h("b", { class: "num" }, value),
      h("span", { class: "health-issue-title" }, title),
      h("span", { class: "health-issue-copy" }, copy),
      h("span", { class: "health-issue-action" }, "Show items", icon("chevronRight")));
  }

  function scrollToSection(title) {
    const node = Array.from(body.querySelectorAll(".sheet-nav-group")).find((el) => el.dataset.section === title);
    if (node) node.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function metricStat(k, v) {
    return h("span", {}, h("b", {}, v == null ? "—" : String(v)), h("small", {}, k));
  }

  function storagePanel(cache) {
    const storage = cache.storage || {};
    const total = Number(storage.disk_total_bytes) || 0;
    const db = Number(storage.db_bytes) || 0;
    const other = Number(storage.other_used_bytes) || 0;
    const free = Number(storage.disk_free_bytes) || 0;
    const pct = (bytes) => total ? Math.max(0, Math.min(100, bytes / total * 100)) + "%" : "0%";
    return h("div", { class: "cache-storage-card" },
      h("div", { class: "cache-storage-bar", title: total ? "Disk total " + formatBytes(total) : "Storage metrics warming" },
        h("span", { class: "cache-used", style: { "--w": pct(db) } }),
        h("span", { class: "cache-other", style: { "--w": pct(other) } }),
        h("span", { class: "cache-free", style: { "--w": pct(free) } })),
      h("div", { class: "cache-storage-legend" },
        storageItem("Used DB", db, "cache-used"),
        storageItem("Other volumes", other, "cache-other"),
        storageItem("Free", free, "cache-free")));
  }

  function storageItem(label, bytes, cls) {
    return h("span", { class: "cache-storage-item" },
      h("i", { class: cls }),
      h("b", {}, label),
      h("small", { class: "num" }, formatBytes(bytes)));
  }

  function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = n;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    const digits = value >= 100 || idx === 0 ? 0 : value >= 10 ? 1 : 2;
    return value.toFixed(digits) + " " + units[idx];
  }

  function sourceActivityGrid(rows) {
    const list = rows.length ? rows : Array.from({ length: 20 }, (_, i) => ({ label: "Loading source " + (i + 1), status: "idle" }));
    const live = rows.filter((s) => s.status === "live").length;
    return h("div", { class: "source-activity-panel" },
      h("div", { class: "source-activity-head" },
        h("span", {}, "Adapter activity"),
        h("b", {}, rows.length ? `${live}/${rows.length} live` : "warming")),
      h("div", { class: "source-activity-grid" }, list.slice(0, 56).map((s) =>
        h("span", {
          class: "source-activity-cell " + sourceState(s.status),
          title: `${s.label || s.id || "source"} · ${String(s.status || "idle").replace(/_/g, " ")}`,
        }))),
      h("div", { class: "source-activity-legend" },
        h("span", {}, h("i", { class: "live" }), "live"),
        h("span", {}, h("i", { class: "stale" }), "warming"),
        h("span", {}, h("i", { class: "error" }), "blocked")));
  }

  function sourceTelemetryCards(rows, health, cache) {
    const live = rows.filter((s) => s.status === "live").length;
    const warn = rows.filter((s) => ["stale", "idle", "tree_backed", "delayed"].includes(s.status)).length;
    const off = Math.max(0, rows.length - live - warn);
    const freshness = rows.length ? rows.map(sourceFreshness) : [];
    const status = rows.length ? rows.map((s) => s.status === "live" ? 100 : ["stale", "idle", "tree_backed", "delayed"].includes(s.status) ? 48 : 14) : [];
    return h("div", { class: "telemetry-skyline" },
      telemetryCard(fmtCompact(rows.length), "SOURCE FEEDS", "purple", "activity", freshness, ["LIVE", live, "OFF", off]),
      telemetryCard(fmtCompact(live), "LIVE ADAPTERS", "green", "wifi", status, ["WARM", warn, "TOTAL", rows.length]),
      telemetryCard(fmtCompact(cache.row_count), "CACHE ROWS", "cyan", "database", cacheSeries(cache, health), ["AGE", cache.cache_age_seconds != null ? ago(cache.cache_age_seconds) : "—", "LAT", cache.last_refresh_ms != null ? Math.round(Number(cache.last_refresh_ms)) + "ms" : "—"]),
      telemetryCard(fmtCompact(cache.refresh_count), "REFRESHES", "orange", "refresh", refreshSeries(cache), ["FAIL", cache.failed_refresh_count ?? "—", "INT", cache.refresh_interval_sec ? cache.refresh_interval_sec + "s" : "—"]));
  }

  function telemetryCard(value, label, tone, ic, series, foot) {
    const bars = normalizeBars(series);
    return h("div", { class: "telemetry-card tone-" + tone },
      h("div", { class: "telemetry-top" },
        h("div", {},
          h("div", { class: "telemetry-value num" }, value == null ? "—" : value),
          h("div", { class: "telemetry-label" }, h("i" ), label)),
        h("span", { class: "telemetry-icon" }, icon(ic))),
      h("div", { class: "telemetry-bars", "aria-hidden": "true" }, bars.map((height, idx) =>
        h("span", { class: "telemetry-bar" + (idx === bars.length - 1 ? " current" : ""), style: { "--h": height + "%" } }))),
      h("div", { class: "telemetry-foot" },
        h("span", {}, foot[0]),
        h("b", { class: "num" }, foot[1]),
        h("span", {}, foot[2]),
        h("b", { class: "num" }, foot[3])));
  }

  function normalizeBars(series) {
    const clean = (series || []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
    const values = clean.length ? clean.slice(-28) : [0];
    const max = Math.max(1, ...values);
    return values.map((n) => Math.max(9, Math.round(n / max * 100)));
  }

  function cacheSeries(cache, health) {
    const storage = cache.storage || {};
    return [
      cache.row_count,
      cache.refresh_count,
      cache.last_refresh_ms,
      cache.cache_age_seconds,
      cache.refresh_interval_sec,
      health.live_symbols,
      health.tracked_symbols,
      storage.db_bytes ? storage.db_bytes / 1024 / 1024 : null,
    ];
  }

  function refreshSeries(cache) {
    const ok = Number(cache.refresh_count) || 0;
    const failed = Number(cache.failed_refresh_count) || 0;
    const interval = Number(cache.refresh_interval_sec) || 0;
    const latency = Number(cache.last_refresh_ms) || 0;
    const age = Number(cache.cache_age_seconds) || 0;
    return [ok, ok - failed, interval * 100, latency, age * 100, failed * 1000].filter((n) => Number.isFinite(n) && n >= 0);
  }

  function sourceCategoryGrid(rows) {
    const cats = [
      { id: "primary", label: "Primary", icon: "wifi", tone: "blue" },
      { id: "cache", label: "Cache", icon: "database", tone: "amber" },
      { id: "news", label: "News", icon: "newspaper", tone: "cyan" },
      { id: "context", label: "Context", icon: "globe", tone: "green" },
      { id: "fallback", label: "Fallback", icon: "cloud", tone: "gray" },
      { id: "source", label: "Other", icon: "grid", tone: "gray" },
      { id: "group", label: "Group", icon: "layers", tone: "green" },
    ];
    return h("div", { class: "source-category-grid" }, cats.map((cat) => {
      const list = cat.id === "group"
        ? rows
        : rows.filter((s) => sourceKind(s) === cat.id || (!["primary", "cache", "news", "context", "fallback"].includes(sourceKind(s)) && cat.id === "source"));
      const live = list.filter((s) => s.status === "live").length;
      const sub = list.length ? `${live}/${list.length} live` : "All off";
      return h("div", { class: "source-category-tile tone-" + cat.tone },
        h("span", { class: "source-category-icon" }, icon(cat.icon)),
        h("b", {}, cat.label),
        h("small", { class: "num" }, sub));
    }));
  }

  function sourceLedger(rows) {
    const groups = [
      ["primary", "Primary feeds"],
      ["cache", "Local cache"],
      ["context", "Market context"],
      ["fallback", "Fallback adapters"],
      ["news", "News wires"],
      ["source", "Other adapters"],
    ];
    const known = new Set(groups.map((g) => g[0]));
    const byKind = new Map(groups.map(([id]) => [id, []]));
    rows.forEach((s) => {
      const kind = sourceKind(s);
      byKind.get(known.has(kind) ? kind : "source").push(s);
    });
    const nodes = [];
    groups.forEach(([id, label]) => {
      const list = byKind.get(id) || [];
      if (!list.length) return;
      const live = list.filter((s) => s.status === "live").length;
      nodes.push(h("div", { class: "source-ledger-head" },
        h("span", {}, label),
        h("b", { class: "num" }, `${live}/${list.length} live`)));
      list.forEach((s) => nodes.push(srcRow(s)));
    });
    return h("div", { class: "source-ledger" }, ...nodes);
  }

  function srcRow(s) {
    const note = String(s.status || "—").replace(/_/g, " ").toUpperCase();
    const pct = sourceFreshness(s);
    const title = `${s.label || s.id || "source"} · ${String(s.detail || "").slice(0, 180)}${s.error ? " · " + s.error : ""}`;
    return h("div", { class: "drow source-drow " + sourceState(s.status) + " source-kind-" + sourceKind(s), title },
      sourceMark(s),
      h("div", { class: "source-drow-copy" },
        h("div", { class: "source-drow-title" }, s.label),
        h("div", { class: "source-drow-sub" },
          h("span", { class: "source-status-line" }, h("i"), sourceStatusLabel(s.status)),
          h("span", { class: "source-detail-text" }, s.detail)),
        h("span", { class: "m-progress", style: { "--p": pct + "%" } })),
      h("span", { class: "source-drow-value" },
        h("span", { class: "v source-status" }, note),
        h("span", { class: "source-drow-meta num" }, sourceMeta(s)),
        icon("chevronRight")));
  }
  function sourceMark(s) {
    const id = `${s.id || ""} ${s.label || ""}`.toLowerCase();
    let key = "source";
    let text = "S";
    if (id.includes("binance")) { key = "binance"; text = "B"; }
    else if (id.includes("cache")) { key = "cache"; text = "DB"; }
    else if (id.includes("coingecko") || id === "trending") { key = "coingecko"; text = "CG"; }
    else if (id.includes("paprika")) { key = "paprika"; text = "CP"; }
    else if (id.includes("llama")) { key = "llama"; text = "DL"; }
    else if (id.includes("rss")) { key = "rss"; text = "RSS"; }
    else if (id.includes("tree")) { key = "tree"; text = "T"; }
    else if (id.includes("lookonchain")) { key = "lookonchain"; text = "LC"; }
    else if (id.includes("x_") || id === "x_news") { key = "x"; text = "X"; }
    else if (id.includes("yahoo")) { key = "yahoo"; text = "Y"; }
    else if (id.includes("fx")) { key = "fx"; text = "FX"; }
    else if (id.includes("fng")) { key = "fng"; text = "FG"; }
    else if (id.includes("news")) { key = "news"; text = "N"; }
    return h("span", { class: "source-mark mark-" + key, "aria-hidden": "true" }, text);
  }
  function sourceFreshness(s) {
    if (s.status === "live" && s.age_seconds != null && s.ttl_sec) {
      return Math.max(8, 100 - (Number(s.age_seconds) / Math.max(1, Number(s.ttl_sec))) * 100);
    }
    if (s.status === "delayed" || s.status === "stale" || s.status === "tree_backed") return 38;
    if (s.status === "idle") return 18;
    return 8;
  }
  function sourceKind(s) {
    return String((s && s.kind) || "source").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  function sourceIcon(s) {
    if (s.status === "requires_key" || s.status === "not_configured") return "lock";
    if (s.kind === "primary") return "wifi";
    if (s.kind === "cache") return "server";
    if (s.kind === "news") return "newspaper";
    if (s.kind === "fallback") return "cloud";
    if (s.kind === "context") return "globe";
    return "database";
  }
  function sourceMeta(s) {
    if (s.symbols != null) return fmtCompact(s.symbols) + " symbols";
    if (s.latency_ms != null) return Math.round(Number(s.latency_ms)) + " ms";
    if (s.age_seconds != null) return ago(Number(s.age_seconds));
    return s.kind || "source";
  }
  function sourceStatusLabel(status) {
    if (status === "live") return "Connected";
    if (status === "delayed" || status === "stale" || status === "tree_backed") return "Delayed";
    if (status === "error" || status === "unavailable") return "Not connected";
    if (status === "requires_key" || status === "not_configured") return "Inactive";
    return "Warming";
  }
  function sourceState(status) {
    if (status === "live") return "live";
    if (status === "delayed" || status === "stale" || status === "tree_backed") return "stale";
    if (status === "error" || status === "unavailable") return "error";
    return "idle";
  }
  function section(title, ...rows) {
    return h("div", { class: "sheet-nav-group", dataset: { section: title } },
      h("div", { class: "sheet-group-title" }, title),
      ...rows.filter(Boolean));
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
  function reportRow(href, label, ic) {
    return h("a", { class: "report-row", href, target: "_blank", rel: "noopener", title: label + " · " + href },
      h("span", { class: "report-row-icon" }, icon(ic)),
      h("span", { class: "report-row-label" }, label));
  }
  function reportButton(label, ic, onClick) {
    return h("button", { class: "report-row report-row-button", type: "button", onClick, title: label },
      h("span", { class: "report-row-icon" }, icon(ic)),
      h("span", { class: "report-row-label" }, label));
  }
  function openWhatsNew() {
    if (document.querySelector(".whats-new-modal")) return;
    const scrim2 = h("div", { class: "whats-new-scrim", onClick: closeWhatsNew });
    const modal = h("div", { class: "whats-new-modal", role: "dialog", "aria-label": "What's new" },
      h("h2", {}, "What's New in Market Lab"),
      whatsNewRow("radio", "Live Wire Desk", "Grouped headlines, provider status, category filters and impact sorting now live in the news rail."),
      whatsNewRow("shield", "Data Watchtower", "Source score, cache storage, blocked adapters and stale symbols are scored from real server health."),
      whatsNewRow("database", "Public source reports", "Health, source map, market overview, news context and icon manifest open as direct reports."),
      h("button", { class: "whats-new-continue", type: "button", onClick: closeWhatsNew }, "Continue"));
    function closeWhatsNew() {
      scrim2.remove();
      modal.remove();
      document.removeEventListener("keydown", onWhatsNewKey, true);
    }
    function onWhatsNewKey(e) {
      if (e.key === "Escape") closeWhatsNew();
    }
    document.addEventListener("keydown", onWhatsNewKey, true);
    document.body.append(scrim2, modal);
  }
  function whatsNewRow(ic, title, copy) {
    return h("div", { class: "whats-new-row" },
      h("span", { class: "whats-new-icon" }, icon(ic)),
      h("span", { class: "whats-new-copy" },
        h("b", {}, title),
        h("span", {}, copy)));
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
