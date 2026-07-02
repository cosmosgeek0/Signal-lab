// UI icons (Lucide, ISC-licensed stroke set, inlined) + token icons with a
// deterministic monogram fallback so a missing logo is never an empty circle.

import { baseOf } from "./format.js";

const ICON_SET = new Set(
  (Array.isArray(window.__CG_ICONS__) ? window.__CG_ICONS__ : []).map((s) => String(s).toUpperCase())
);

const I = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const UI = {
  search: I('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  radar: I('<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>'),
  grid: I('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  candles: I('<path d="M9 5v4"/><rect width="4" height="6" x="7" y="9" rx="1"/><path d="M9 15v2"/><path d="M17 3v2"/><rect width="4" height="8" x="15" y="5" rx="1"/><path d="M17 13v3"/><path d="M3 3v18h18"/>'),
  target: I('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
  moon: I('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  sliders: I('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
  database: I('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>'),
  x: I('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  chevronLeft: I('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: I('<path d="m9 18 6-6-6-6"/>'),
  chevronDown: I('<path d="m6 9 6 6 6-6"/>'),
  arrowLeft: I('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  arrowUpRight: I('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  zap: I('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  flame: I('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  gauge: I('<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>'),
  clock: I('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  activity: I('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  columns: I('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>'),
  enter: I('<polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>'),
  trendingUp: I('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  wind: I('<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>'),
  info: I('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  globe: I('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
  wifi: I('<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>'),
  refresh: I('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
  warning: I('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
};

export function icon(name, cls) {
  const span = document.createElement("span");
  span.className = "ico " + (cls || "");
  span.style.display = "inline-flex";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = UI[name] || "";
  return span;
}

export function starIcon(on) {
  const span = document.createElement("span");
  span.className = "star" + (on ? " on" : "");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return span;
}

// Deterministic pleasant gradient from a token base string.
function hueOf(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % 360;
}
let monoSeq = 0;

export function monogram(base, px) {
  const b = (base || "?").toUpperCase();
  const text = b.slice(0, 4);
  const h1 = hueOf(b);
  const h2 = (h1 + 26) % 360;
  const gid = "mg" + monoSeq++;
  const fs = text.length >= 4 ? 10.5 : text.length === 3 ? 13 : 17;
  const svgMk = `
  <svg viewBox="0 0 40 40" width="${px}" height="${px}" class="tok-mono-svg">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h1} 64% 54%)"/>
      <stop offset="1" stop-color="hsl(${h2} 62% 42%)"/>
    </linearGradient></defs>
    <circle cx="20" cy="20" r="20" fill="url(#${gid})"/>
    <text x="20" y="20.5" text-anchor="middle" dominant-baseline="central"
      font-family="var(--font)" font-weight="700" font-size="${fs}"
      letter-spacing="-.3" fill="#fff">${text}</text>
  </svg>`;
  const span = document.createElement("span");
  span.className = "tok-mono";
  span.style.width = px + "px";
  span.style.height = px + "px";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = svgMk;
  return span;
}

// Local icon manifest. The browser does not load third-party token images; if
// a bundled CC0 SVG is unavailable, the deterministic monogram is the fallback.
const iconSubs = new Set();
export function onIconsReady(fn) { iconSubs.add(fn); return () => iconSubs.delete(fn); }
export function iconsReady() { return true; }
export async function loadIconManifest() {
  try {
    const res = await fetch("/api/icon-manifest", { headers: { accept: "application/json" } });
    const man = await res.json();
    (man && man.local || []).forEach((b) => ICON_SET.add(String(b).toUpperCase()));
    for (const fn of iconSubs) { try { fn(); } catch (e) { console.error(e); } }
  } catch (e) {}
}

// Token icon resolver: 1) bundled CC0 SVG  2) polished brand-colored monogram.
// Never a blank circle and never a browser-side third-party image request.
export function tokenIcon(symbol, size = 26) {
  const base = baseOf(symbol);
  const local = ICON_SET.has(base) ? `/static/icons/${base.toLowerCase()}.svg` : null;
  if (local) {
    const img = document.createElement("img");
    img.className = "tok-ico" + sizeClass(size);
    img.width = size; img.height = size;
    img.loading = "lazy"; img.decoding = "async";
    img.alt = base;
    img.src = local;
    img.addEventListener("error", () => {
      img.replaceWith(monogram(base, size));
    }, { once: true });
    return img;
  }
  return monogram(base, size);
}

function sizeClass(size) {
  if (size <= 20) return " sm";
  if (size >= 40) return " lg";
  return "";
}

export function hasIcon(symbol) {
  return ICON_SET.has(baseOf(symbol));
}

// Recognized token brand hues for sparklines / accents (vivid subset only —
// near-black brands are skipped so lines stay visible in dark mode).
// Falls back to the same deterministic hue used by the monogram.
const BRAND = {
  BTC: "#F7931A", ETH: "#627EEA", BNB: "#F0B90B", SOL: "#9945FF", DOGE: "#C2A633",
  ADA: "#2A71D0", AVAX: "#E84142", DOT: "#E6007A", MATIC: "#8247E5", LINK: "#2A5ADA",
  LTC: "#345D9D", BCH: "#0AC18E", TRX: "#EF0027", UNI: "#FF007A", FIL: "#0090FF",
  ICP: "#F15A24", VET: "#15BDFF", AAVE: "#B6509E", MKR: "#1AAB9B", COMP: "#00D395",
  APE: "#0054F9", SAND: "#00ADEF", MANA: "#FF2D55", GRT: "#6747ED", STX: "#5546FF",
  NEAR: "#00C08B", FTM: "#1969FF", INJ: "#0BA5EC", TIA: "#7B2BF9", SUI: "#4DA2FF",
  ARB: "#12AAFF", OP: "#FF0420", ATOM: "#6F7CBA", XRP: "#8A93A6", XLM: "#7A8CF0",
};

export function brandColor(symbol) {
  const b = baseOf(symbol);
  if (BRAND[b]) return BRAND[b];
  return `hsl(${hueOf(b)} 62% 46%)`;
}
