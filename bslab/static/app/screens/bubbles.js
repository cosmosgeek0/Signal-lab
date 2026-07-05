import { h, clear } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { coinIcon, brandColor, icon } from "../lib/icons.js";
import { fmtMoney, fmtPct, fmtPrice, signClass } from "../lib/format.js";
import { navigate } from "../lib/store.js";

const WINDOWS = [
  { id: "1h", label: "1H" },
  { id: "24h", label: "1D" },
  { id: "7d", label: "1W" },
  { id: "30d", label: "1M" },
  { id: "1y", label: "1Y" },
];
const LIMITS = [50, 100, 250];
const STOCK_LIMITS = [25, 50, 100];
const REFRESHES = [15, 30, 60, 120, 300];
const BUBBLE_TONES = {
  up: "#4f9b73",
  down: "#b76b72",
  flat: "#8b95a7",
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function param(name, fallback) {
  try {
    return new URL(location.href).searchParams.get(name) || fallback;
  } catch (e) {
    return fallback;
  }
}

function softUpdateUrl(asset, window, limit) {
  const next = `/bubbles?asset=${encodeURIComponent(asset)}&window=${encodeURIComponent(window)}&limit=${encodeURIComponent(limit)}`;
  history.replaceState({}, "", next);
}

function rowValue(row, sort) {
  if (sort === "gain") return num(row.change) ?? -Infinity;
  if (sort === "loss") return -(num(row.change) ?? Infinity);
  return Math.abs(num(row.change) ?? 0);
}

function moveStrength(row, sort) {
  const change = num(row.change);
  if (change == null) return 0;
  if (sort === "loss") return Math.max(-change, 0);
  if (sort === "abs") return Math.abs(change);
  return Math.max(change, 0);
}

function sparkPath(points, w = 86, h = 30) {
  const vals = (Array.isArray(points) ? points : []).map(Number).filter(Number.isFinite);
  if (vals.length < 2) return "";
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function miniSpark(row) {
  const cls = signClass(row.change);
  const d = sparkPath(row.spark, 92, 32);
  return h("svg", { class: `bb-spark ${cls}`, viewBox: "0 0 92 32", preserveAspectRatio: "none" },
    d ? h("path", { d }) : h("path", { d: "M0 20 L92 20" }));
}

function filterRows(rows, query, sort) {
  const q = String(query || "").trim().toUpperCase();
  return rows
    .filter((r) => !q || String(r.base || "").includes(q) || String(r.name || "").toUpperCase().includes(q))
    .sort((a, b) => rowValue(b, sort) - rowValue(a, sort));
}

function breadth(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const change = num(row.change);
    if (change == null || Math.abs(change) < 0.05) acc.flat += 1;
    else if (change > 0) acc.up += 1;
    else acc.down += 1;
    return acc;
  }, { up: 0, down: 0, flat: 0 });
}

function makeBubble(row, radius, compact, hooks = {}, maxStrength = 1, sort = "gain") {
  const change = num(row.change);
  const up = change == null ? "flat" : change >= 0 ? "up" : "down";
  const accent = change == null ? BUBBLE_TONES.flat : change >= 0 ? BUBBLE_TONES.up : BUBBLE_TONES.down;
  const brand = brandColor(row.base);
  const strength = moveStrength(row, sort);
  const energy = clamp(strength / Math.max(maxStrength, 0.01), 0, 1);
  const node = h("button", {
    class: `bb-bubble ${up}${compact ? " compact" : ""}`,
    "aria-label": `${row.base} ${row.name || ""} ${change == null ? "change unavailable" : fmtPct(change, 2)}`,
    title: `${row.base} ${row.name || ""} ${change == null ? "change unavailable" : fmtPct(change)}`,
    style: {
      width: `${radius * 2}px`,
      height: `${radius * 2}px`,
      "--bb-r": `${Math.round(radius)}px`,
      "--bb-accent": accent,
      "--bb-brand": brand,
      "--bb-heat": `${Math.round(14 + energy * 30)}%`,
      "--bb-energy": energy.toFixed(3),
    },
    onPointerenter: (event) => hooks.show?.(row, event, node),
    onPointermove: (event) => hooks.move?.(row, event, node),
    onPointerleave: () => hooks.hide?.(),
    onMouseenter: (event) => hooks.show?.(row, event, node),
    onMousemove: (event) => hooks.move?.(row, event, node),
    onMouseleave: () => hooks.hide?.(),
    onFocus: (event) => hooks.show?.(row, event, node),
    onBlur: () => hooks.hide?.(),
    onClick: () => {
      if (node.__bb && node.__bb.dragged) {
        node.__bb.dragged = false;
        return;
      }
      openRow(row);
    },
  },
    h("span", { class: "bb-bubble-shine" }),
    h("span", { class: "bb-bubble-rim" }),
    h("span", { class: "bb-bubble-logo" }, coinIcon(row, compact ? 28 : Math.round(clamp(radius * 0.46, 28, 76)))),
    h("span", { class: "bb-bubble-symbol" }, row.base),
    h("span", { class: "bb-bubble-change" }, change == null ? "no data" : fmtPct(change, Math.abs(change) >= 10 ? 1 : 2)));
  node.__bb = {
    row,
    r: radius,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    mass: radius * radius,
    energy,
    held: false,
    dragged: false,
    pointerId: null,
    grabDx: 0,
    grabDy: 0,
    lastPx: 0,
    lastPy: 0,
    lastT: 0,
  };
  return node;
}

function openRow(row) {
  if (row && row.external && row.href) {
    window.open(row.href, "_blank", "noopener,noreferrer");
    return;
  }
  navigate((row && row.href) || `/symbol/${row.base}USDT`);
}

function initPhysics(nodes, stage) {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(320, rect.width);
  const hgt = Math.max(420, rect.height);
  const cols = Math.max(4, Math.floor(w / 122));
  nodes.forEach((node, i) => {
    const b = node.__bb;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = ((i * 97) % 45) - 22;
    const jitterY = ((i * 53) % 37) - 18;
    b.x = clamp((col + 0.52) * (w / cols) + jitterX, b.r + 10, w - b.r - 10);
    b.y = clamp(58 + row * 94 + jitterY, b.r + 10, hgt - b.r - 10);
    b.vx = (((i * 19) % 13) - 6) * 0.11;
    b.vy = (((i * 23) % 11) - 5) * 0.09;
  });
  settlePhysics(nodes, stage, 84);
}

function settlePhysics(nodes, stage, passes = 48) {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(320, rect.width);
  const hgt = Math.max(420, rect.height);
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i].__bb;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j].__bb;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.r + b.r + 6;
        const d2 = dx * dx + dy * dy;
        if (!d2 || d2 >= minD * minD) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const push = (minD - d) * 0.74;
        const total = a.mass + b.mass || 1;
        a.x -= nx * push * (b.mass / total);
        a.y -= ny * push * (b.mass / total);
        b.x += nx * push * (a.mass / total);
        b.y += ny * push * (a.mass / total);
      }
    }
    nodes.forEach((node) => {
      const b = node.__bb;
      b.x = clamp(b.x, b.r + 6, w - b.r - 6);
      b.y = clamp(b.y, b.r + 6, hgt - b.r - 6);
    });
  }
}

function tickPhysics(nodes, stage, reduceMotion) {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(320, rect.width);
  const hgt = Math.max(420, rect.height);
  const cx = w / 2;
  const cy = hgt / 2;
  const maxNodes = reduceMotion ? 0 : Math.min(nodes.length, 96);
  const now = performance.now();
  for (let i = 0; i < maxNodes; i++) {
    const a = nodes[i].__bb;
    if (a.held) continue;
    const energy = a.energy || 0;
    const ax = (cx - a.x) * 0.000065;
    const ay = (cy - a.y) * 0.000052;
    const driftX = Math.sin((now * 0.0011) + i * 1.7) * (0.012 + energy * 0.016);
    const driftY = Math.cos((now * 0.0009) + i * 1.3) * (0.010 + energy * 0.012);
    a.vx = (a.vx + ax + driftX) * 0.966;
    a.vy = (a.vy + ay + driftY) * 0.966;
    a.vx = clamp(a.vx, -1.15, 1.15);
    a.vy = clamp(a.vy, -1.15, 1.15);
    a.x += a.vx;
    a.y += a.vy;
    if (a.x < a.r + 6) { a.x = a.r + 6; a.vx = Math.abs(a.vx) * 0.56; }
    if (a.x > w - a.r - 6) { a.x = w - a.r - 6; a.vx = -Math.abs(a.vx) * 0.56; }
    if (a.y < a.r + 6) { a.y = a.r + 6; a.vy = Math.abs(a.vy) * 0.56; }
    if (a.y > hgt - a.r - 6) { a.y = hgt - a.r - 6; a.vy = -Math.abs(a.vy) * 0.56; }
  }
  for (let i = 0; i < maxNodes; i++) {
    const a = nodes[i].__bb;
    if (a.held) continue;
    for (let j = i + 1; j < maxNodes; j++) {
      const b = nodes[j].__bb;
      if (b.held) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = a.r + b.r + 7;
      const d2 = dx * dx + dy * dy;
      if (!d2 || d2 >= minD * minD) continue;
      const d = Math.sqrt(d2);
      const overlap = minD - d;
      const nx = dx / d;
      const ny = dy / d;
      const total = a.mass + b.mass || 1;
      const push = overlap * 0.42;
      a.x -= nx * push * (b.mass / total);
      a.y -= ny * push * (b.mass / total);
      b.x += nx * push * (a.mass / total);
      b.y += ny * push * (a.mass / total);
      const impulse = overlap * 0.012;
      a.vx -= nx * impulse * (b.mass / total); a.vy -= ny * impulse * (b.mass / total);
      b.vx += nx * impulse * (a.mass / total); b.vy += ny * impulse * (a.mass / total);
    }
  }
  nodes.forEach((node) => {
    const b = node.__bb;
    node.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0)`;
  });
}

function wireDrag(nodes, stage) {
  const byPointer = new Map();
  const stagePoint = (event) => {
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
      t: performance.now(),
    };
  };
  const clampBubble = (b, p) => {
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp(p.x - b.grabDx, b.r + 6, Math.max(b.r + 6, rect.width - b.r - 6)),
      y: clamp(p.y - b.grabDy, b.r + 6, Math.max(b.r + 6, rect.height - b.r - 6)),
    };
  };
  const cleanups = [];
  nodes.forEach((node) => {
    const down = (event) => {
      if (event.button != null && event.button !== 0) return;
      const b = node.__bb;
      const p = stagePoint(event);
      b.held = true;
      b.dragged = false;
      b.pointerId = event.pointerId;
      b.grabDx = p.x - b.x;
      b.grabDy = p.y - b.y;
      b.lastPx = p.x;
      b.lastPy = p.y;
      b.lastT = p.t;
      b.vx = 0;
      b.vy = 0;
      byPointer.set(event.pointerId, node);
      node.classList.add("dragging");
      node.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    node.addEventListener("pointerdown", down);
    cleanups.push(() => node.removeEventListener("pointerdown", down));
  });
  const move = (event) => {
    const node = byPointer.get(event.pointerId);
    if (!node) return;
    const b = node.__bb;
    const p = stagePoint(event);
    const next = clampBubble(b, p);
    const dt = Math.max(16, p.t - b.lastT);
    const dx = p.x - b.lastPx;
    const dy = p.y - b.lastPy;
    b.dragged = b.dragged || Math.abs(dx) + Math.abs(dy) > 4;
    b.vx = clamp((dx / dt) * 16, -2.2, 2.2);
    b.vy = clamp((dy / dt) * 16, -2.2, 2.2);
    b.x = next.x;
    b.y = next.y;
    b.lastPx = p.x;
    b.lastPy = p.y;
    b.lastT = p.t;
    node.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0)`;
  };
  const up = (event) => {
    const node = byPointer.get(event.pointerId);
    if (!node) return;
    const b = node.__bb;
    b.held = false;
    b.pointerId = null;
    b.vx *= 0.78;
    b.vy *= 0.78;
    byPointer.delete(event.pointerId);
    node.classList.remove("dragging");
    node.releasePointerCapture?.(event.pointerId);
  };
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  cleanups.push(() => {
    stage.removeEventListener("pointermove", move);
    stage.removeEventListener("pointerup", up);
    stage.removeEventListener("pointercancel", up);
  });
  return () => cleanups.forEach((fn) => fn());
}

export function renderBubbles(root) {
  let asset = param("asset", "crypto") === "stocks" ? "stocks" : "crypto";
  let windowKey = WINDOWS.some((w) => w.id === param("window", "24h")) ? param("window", "24h") : "24h";
  let limit = clamp(Number(param("limit", asset === "crypto" ? 100 : 50)) || 100, 20, asset === "crypto" ? 250 : 100);
  let refreshSec = clamp(Number(localStorage.getItem("cg-bubbles-refresh") || "60") || 60, 15, 300);
  let query = "";
  let sort = "gain";
  let intervalOpen = false;
  let rows = [];
  let payload = null;
  let abort = null;
  let loadSeq = 0;
  let raf = 0;
  let timer = 0;
  let paused = false;
  let bubbleNodes = [];
  let dragCleanup = null;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const page = h("section", { class: "page bubbles-page" });
  const head = h("div", { class: "bubbles-head" });
  const tools = h("div", { class: "bubbles-tools" });
  const legend = h("div", { class: "bb-legend", "aria-label": "Bubble legend" });
  const stage = h("div", { class: "bb-stage", role: "application", "aria-label": "Animated market bubbles" });
  const side = h("aside", { class: "bb-side" });
  const tableWrap = h("div", { class: "bb-table-wrap" });
  const hoverCard = h("div", { class: "bb-hover-card", role: "tooltip", hidden: true });
  page.append(head, tools, legend, h("div", { class: "bb-layout" }, stage, side), tableWrap);
  root.appendChild(page);

  function renderHead() {
    clear(head);
    const supported = payload ? payload.supported_count : 0;
    const total = payload ? payload.count : 0;
    head.append(
      h("div", {},
        h("div", { class: "kicker" }, h("span", { class: "live-dot" }), " Bubbles"),
        h("h1", {}, asset === "crypto" ? "Crypto bubbles" : "Stock bubbles"),
        h("p", { class: "muted" },
          "A physical market field: size follows move magnitude, color follows direction, and hover reveals the source-backed detail.")),
      h("div", { class: "bb-head-stats" },
        h("div", {}, h("b", {}, total || "—"), h("span", {}, "assets")),
        h("div", {}, h("b", {}, supported || "—"), h("span", {}, "with window data")),
        h("div", {}, h("b", {}, `${refreshSec}s`), h("span", {}, "refresh"))));
  }

  function chip(label, active, onClick, extra = "") {
    return h("button", { class: `chip ${active ? "active" : ""} ${extra}`, onClick }, label);
  }

  function opt(value, label, selected) {
    return h("option", { value: String(value), selected: String(value) === String(selected) }, label);
  }

  function intervalChip(w, pinned = false) {
    const disabled = asset === "stocks" && w.id !== "24h";
    return h("button", {
      class: `bb-int-chip ${windowKey === w.id ? "on" : ""} ${pinned ? "pinned" : ""}`,
      type: "button",
      disabled,
      title: disabled ? "Stock bubbles currently use the 1D public session window." : `${w.label} source-backed window`,
      onClick: () => {
        if (disabled) return;
        intervalOpen = false;
        windowKey = w.id;
        load();
      },
    }, w.label);
  }

  function intervalPicker() {
    const current = WINDOWS.find((w) => w.id === windowKey) || WINDOWS[1];
    const pinned = WINDOWS.slice(0, 3);
    const available = WINDOWS.slice(3);
    return h("div", { class: "bb-interval-wrap" },
      h("button", {
        class: "bb-interval-trigger " + (intervalOpen ? "open" : ""),
        type: "button",
        "aria-expanded": intervalOpen ? "true" : "false",
        onClick: () => { intervalOpen = !intervalOpen; renderTools(); },
      }, icon("clock"), current.label, icon("chevronDown")),
      intervalOpen ? h("div", { class: "bb-interval-pop", role: "menu" },
        h("div", { class: "bb-int-head" },
          h("span", {}, "Pinned"),
          h("em", {}, "Source backed")),
        h("div", { class: "bb-int-grid pinned" }, pinned.map((w) => intervalChip(w, true))),
        h("div", { class: "bb-int-label" }, "Available"),
        h("div", { class: "bb-int-grid" }, available.map((w) => intervalChip(w))),
        h("div", { class: "bb-int-label custom" }, "Custom Intervals"),
        h("button", { class: "bb-int-add", type: "button", disabled: true, title: "Custom intervals need a licensed history feed." }, "+")) : null);
  }

  function renderTools() {
    clear(tools);
    const lims = asset === "crypto" ? LIMITS : STOCK_LIMITS;
    tools.append(
      h("div", { class: "seg bb-asset" },
        chip("Crypto", asset === "crypto", () => {
          asset = "crypto";
          query = "";
          if (limit > 250) limit = 250;
          load();
        }),
        chip("Stocks", asset === "stocks", () => {
          asset = "stocks";
          query = "";
          if (windowKey !== "24h") windowKey = "24h";
          if (limit > 100) limit = 100;
          load();
        })),
      intervalPicker(),
      h("label", { class: "bb-search" }, icon("search"), h("input", {
        placeholder: "Search symbol",
        value: query,
        onInput: (e) => { query = e.target.value; paint(false); },
      })),
      h("select", {
        class: "bb-select",
        title: "Rank range",
        value: String(limit),
        onChange: (e) => { limit = Number(e.target.value); load(); },
      }, lims.map((n) => opt(n, `1 - ${n}`, limit))),
      h("select", {
        class: "bb-select",
        title: "Sort bubbles",
        value: sort,
        onChange: (e) => { sort = e.target.value; paint(); },
      },
        opt("gain", "Gainers", sort),
        opt("loss", "Losers", sort),
        opt("abs", "Biggest move", sort)),
      h("select", {
        class: "bb-select",
        title: "Auto-refresh rate",
        value: String(refreshSec),
        onChange: (e) => {
          refreshSec = clamp(Number(e.target.value) || 60, 15, 300);
          localStorage.setItem("cg-bubbles-refresh", String(refreshSec));
          schedule();
          renderHead();
        },
      }, REFRESHES.map((n) => opt(n, `${n}s refresh`, refreshSec))),
      h("button", { class: "mini-btn", onClick: () => { paused = !paused; schedule(); paintSide(); } },
        icon(paused ? "activity" : "clock"), paused ? "Resume" : "Pause"),
      h("button", { class: "mini-btn primary", onClick: () => load() }, icon("refresh"), "Refresh"));
  }

  function radiusFor(row, values) {
    const val = moveStrength(row, sort);
    const max = Math.max(...values, 0.01);
    const scaled = max > 0 ? Math.sqrt(clamp(val / max, 0, 1)) : 0.35;
    return clamp(24 + scaled * 78, 26, 104);
  }

  function renderLegend(viewRows) {
    clear(legend);
    const br = breadth(viewRows);
    const sourceText = payload && payload.supported
      ? `${payload.supported_count}/${payload.count} source-backed`
      : "Unsupported window";
    legend.append(
      h("div", { class: "bb-legend-copy" },
        h("b", {}, "Read the field"),
        h("span", {}, "Muted color shows direction; intensity and diameter show magnitude.")),
      h("div", { class: "bb-legend-keys" },
        h("span", { class: "bb-key up" }, h("i"), `${br.up} up`),
        h("span", { class: "bb-key down" }, h("i"), `${br.down} down`),
        h("span", { class: "bb-key flat" }, h("i"), `${br.flat} flat`),
        h("span", { class: "bb-key size" }, h("i"), "size = move"),
        h("span", { class: "bb-key source" }, h("i"), sourceText)));
  }

  function hoverStat(label, value, cls = "") {
    return h("div", { class: "bb-hover-stat" },
      h("span", {}, label),
      h("b", { class: cls }, value));
  }

  function placeHover(event, node) {
    const rect = stage.getBoundingClientRect();
    const b = node && node.__bb;
    const rawX = event && Number.isFinite(event.clientX) ? event.clientX - rect.left : (b ? b.x + b.r * 0.35 : rect.width / 2);
    const rawY = event && Number.isFinite(event.clientY) ? event.clientY - rect.top : (b ? b.y - b.r * 0.3 : 90);
    const cardW = 286;
    const cardH = 174;
    const x = clamp(rawX + 18, 12, Math.max(12, rect.width - cardW - 12));
    const y = clamp(rawY - 34, 12, Math.max(12, rect.height - cardH - 12));
    hoverCard.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
  }

  function showHover(row, event, node) {
    const change = num(row.change);
    const cls = signClass(change);
    const windowLabel = payload?.window_label || windowKey.toUpperCase();
    clear(hoverCard);
    hoverCard.className = `bb-hover-card ${change == null ? "flat" : change >= 0 ? "up" : "down"}`;
    hoverCard.append(
      h("div", { class: "bb-hover-top" },
        coinIcon(row, 34),
        h("div", { class: "bb-hover-name" },
          h("b", {}, row.name || row.base),
          h("span", {}, `${row.base} · ${windowLabel}`)),
        h("strong", { class: cls }, change == null ? "—" : fmtPct(change, 2))),
      h("div", { class: "bb-hover-spark" }, miniSpark(row)),
      h("div", { class: "bb-hover-grid" },
        hoverStat("Price", fmtPrice(row.price)),
        hoverStat("Market cap", fmtMoney(row.mcap)),
        hoverStat("Volume", fmtMoney(row.volume)),
        hoverStat("Status", row.supported ? "source-backed" : "unavailable", row.supported ? "up" : "flat")));
    hoverCard.hidden = false;
    placeHover(event, node);
  }

  function moveHover(row, event, node) {
    if (!hoverCard.hidden) placeHover(event, node);
  }

  function hideHover() {
    hoverCard.hidden = true;
  }

  function paintStage(viewRows) {
    cancelAnimationFrame(raf);
    if (dragCleanup) {
      dragCleanup();
      dragCleanup = null;
    }
    clear(stage);
    bubbleNodes = [];
    if (!payload) {
      stage.append(h("div", { class: "bb-empty" }, "Loading bubbles..."));
      return;
    }
    if (!viewRows.length) {
      stage.append(h("div", { class: "bb-empty" }, "No matching assets."));
      return;
    }
    if (!payload.supported) {
      stage.append(h("div", { class: "bb-empty" },
        h("b", {}, "This public source has no values for ", windowKey.toUpperCase(), "."),
        h("span", {}, "Switch to a supported timeframe, or connect a licensed history feed.")));
      return;
    }
    const values = viewRows.map((r) => moveStrength(r, sort)).filter(Number.isFinite);
    const maxStrength = Math.max(...values, 0.01);
    const showRows = viewRows.slice(0, 130);
    const stageHeight = clamp(600 + Math.ceil(showRows.length / 13) * 58, 720, 1080);
    stage.style.minHeight = `${stageHeight}px`;
    const compactAfter = showRows.length > 80;
    const hooks = { show: showHover, move: moveHover, hide: hideHover };
    bubbleNodes = showRows.map((row, i) => makeBubble(row, radiusFor(row, values), compactAfter && i > 65, hooks, maxStrength, sort));
    hoverCard.hidden = true;
    stage.append(...bubbleNodes, hoverCard);
    initPhysics(bubbleNodes, stage);
    dragCleanup = wireDrag(bubbleNodes, stage);
    const frame = () => {
      if (!paused) tickPhysics(bubbleNodes, stage, reduceMotion);
      raf = requestAnimationFrame(frame);
    };
    frame();
  }

  function paintSide() {
    clear(side);
    const viewRows = filterRows(rows, query, sort);
    const top = viewRows.slice(0, 8);
    const br = breadth(viewRows);
    const sourceNote = payload ? payload.source_note : "Fetching source-backed rows.";
    side.append(
      h("div", { class: "bb-side-card bb-read-card" },
        h("div", { class: "bb-card-head" },
          h("span", {}, icon(paused ? "clock" : "radio"), paused ? "Paused field" : "Live field"),
        h("b", {}, payload ? payload.status : "loading")),
        h("p", { class: "muted" }, sourceNote),
        h("div", { class: "bb-breadth" },
          h("span", { class: "up" }, h("b", {}, br.up), " up"),
          h("span", { class: "down" }, h("b", {}, br.down), " down"),
          h("span", { class: "flat" }, h("b", {}, br.flat), " flat"))),
      h("div", { class: "bb-side-card compact bb-scale-card" },
        h("div", { class: "bb-card-head" }, h("span", {}, icon("clock"), "Scale"), h("b", {}, windowKey.toUpperCase())),
        h("div", { class: "bb-scale-row" }, h("i", { class: "small" }), h("span", {}, "Minor move")),
        h("div", { class: "bb-scale-row" }, h("i", { class: "large" }), h("span", {}, "Outlier move")),
        h("p", { class: "muted" }, payload && payload.supported
          ? `${payload.supported_count}/${payload.count} assets have source-backed ${payload.window_label} movement.`
          : "Unavailable windows stay compact and honest.")),
      h("div", { class: "bb-side-card" },
        h("div", { class: "bb-card-head" }, h("span", {}, icon("trendingUp"), "Leaders"), h("b", {}, windowKey.toUpperCase())),
        top.map((r, i) => h("button", { class: "bb-leader", onClick: () => openRow(r) },
          h("span", { class: "idx" }, i + 1),
          coinIcon(r, 28),
          h("span", { class: "name" }, h("b", {}, r.base), h("small", {}, r.name || "")),
          h("span", { class: signClass(r.change) }, r.change == null ? "—" : fmtPct(r.change, 2))))));
  }

  function paintTable(viewRows) {
    clear(tableWrap);
    const sourceLabel = payload
      ? `${payload.window_label || windowKey.toUpperCase()} · ${payload.status || "warming"} · ${payload.source || "market feed"}`
      : "warming market feed";
    tableWrap.append(
      h("div", { class: "sec-title" },
        h("h2", {}, asset === "crypto" ? "Crypto movers" : "Stock movers"),
        h("span", { class: "muted" }, sourceLabel)),
      h("table", { class: "mkt bb-table" },
        h("thead", {}, h("tr", {},
          h("th", {}, "#"),
          h("th", {}, "Asset"),
          h("th", {}, "7d chart"),
          h("th", {}, "Price"),
          h("th", {}, "Move"),
          h("th", {}, "Market cap"),
          h("th", {}, "Volume"),
          h("th", {}))),
        h("tbody", {}, viewRows.slice(0, 100).map((r, i) => h("tr", { class: r.supported ? "" : "is-muted" },
          h("td", { class: "idx" }, i + 1),
          h("td", {}, h("span", { class: "tok" }, coinIcon(r, 32),
            h("span", {}, h("span", { class: "tok-name" }, r.name || r.base), h("span", { class: "tok-sub" }, r.base)))),
          h("td", { class: "bb-spark-cell" }, miniSpark(r)),
          h("td", { class: "num" }, fmtPrice(r.price)),
          h("td", { class: `num ${signClass(r.change)}` }, r.change == null ? "unavailable" : fmtPct(r.change, 2)),
          h("td", { class: "num" }, fmtMoney(r.mcap)),
          h("td", { class: "num" }, fmtMoney(r.volume)),
          h("td", {}, h("button", { class: "cta-pill", onClick: () => openRow(r) }, r.external ? "Chart" : "View")))))));
  }

  function paint(withTools = true) {
    renderHead();
    if (withTools) renderTools();
    const viewRows = filterRows(rows, query, sort);
    renderLegend(viewRows);
    paintStage(viewRows);
    paintSide();
    paintTable(viewRows);
  }

  function schedule() {
    clearTimeout(timer);
    if (paused) return;
    timer = setTimeout(load, clamp(refreshSec, 15, 300) * 1000);
  }

  async function load() {
    const seq = ++loadSeq;
    let cancelled = false;
    softUpdateUrl(asset, windowKey, limit);
    if (abort) abort.abort();
    abort = new AbortController();
    page.classList.add("loading");
    try {
      const next = await api.bubbles(asset, windowKey, limit, { signal: abort.signal });
      if (seq !== loadSeq) return;
      payload = next;
      rows = Array.isArray(payload.rows) ? payload.rows : [];
    } catch (e) {
      if (seq !== loadSeq || e?.name === "AbortError") {
        cancelled = true;
        return;
      }
      payload = { status: "unavailable", source_note: "Bubbles feed failed to load.", source: "api/bubbles", count: 0, supported_count: 0 };
      rows = [];
    } finally {
      if (cancelled || seq !== loadSeq) return;
      page.classList.remove("loading");
      paint();
      schedule();
    }
  }

  const onResize = () => {
    if (!bubbleNodes.length) return;
    initPhysics(bubbleNodes, stage);
  };
  window.addEventListener("resize", onResize);
  renderHead();
  renderTools();
  load();

  return () => {
    loadSeq += 1;
    if (abort) abort.abort();
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    if (dragCleanup) dragCleanup();
    window.removeEventListener("resize", onResize);
  };
}
