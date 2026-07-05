// User preferences: persisted in localStorage, broadcast on change.

const KEY = "cg-settings";

export const DEFAULTS = {
  currency: "USD",        // converts only where a live FX rate exists
  source: "combined",     // "combined" (Binance + external context) | "binance"
  refreshSec: 1.6,        // live poll cadence
  basisUnit: "bps",       // "bps" | "pct"
  motion: "full",         // "full" | "reduced"
  glassMode: "clear",     // "clear" | "tinted"
  accentColor: "blue",    // "multicolor" | named accent swatch
  textHighlight: "automatic",
  iconStyle: "default",   // "default" | "dark" | "clear" | "tinted"
  folderColor: "automatic",
  sidebarIconSize: "medium",
  tintWallpaper: true,
  scrollBars: "automatic",
  scrollBarClick: "page",
  workMode: "terminal",   // "terminal" | "quiet"
  themeMode: "system",    // "system" | "light" | "dark"
  density: "comfortable", // "comfortable" | "compact"
  interfaceZoom: 100,     // 80-125 percent
  sidebarCategories: true,
  sidebarTags: true,
  shortcutHints: true,    // show shortcut hints in visible header controls
  tapeSpeed: "normal",    // "calm" | "normal" | "fast" — px/s of the top tape
  defaultPage: "market",  // "market" | "radar"
  developerMode: true,    // show local API/debug shortcuts in Settings > Developer
  richIcons: true,         // allow remote/logo token art; false uses local monograms
  sourceHealthBadge: true, // show the local source-health badge
  clockMode: "utc",        // "utc" | "ist" | "local" for the header clock
  lang: "en",
};

let cached = null;
const subs = new Set();

export function getSettings() {
  if (cached) return cached;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  cached = { ...DEFAULTS, ...stored };
  return cached;
}

export function setSetting(key, value) {
  const s = { ...getSettings(), [key]: value };
  cached = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  applyMotion();
  for (const fn of subs) { try { fn(s, key); } catch (e) { console.error(e); } }
}

export function resetSettings() {
  cached = { ...DEFAULTS };
  try { localStorage.removeItem(KEY); localStorage.removeItem("cg-cols"); } catch (e) {}
  applyMotion();
  for (const fn of subs) { try { fn(cached, "*"); } catch (e) {} }
}

export function onSettings(fn) { subs.add(fn); return () => subs.delete(fn); }

export function motionReduced() { return getSettings().motion === "reduced"; }

export function applyMotion() {
  const s = getSettings();
  const zoom = Math.max(80, Math.min(125, Number(s.interfaceZoom) || DEFAULTS.interfaceZoom));
  const accents = {
    multicolor: "#0a84ff",
    blue: "#0a84ff",
    purple: "#8e44ad",
    pink: "#ec4899",
    red: "#e53935",
    orange: "#ff7a1a",
    yellow: "#f0b90b",
    green: "#34a853",
    gray: "#8e8e93",
  };
  const accent = accents[s.accentColor] || accents.blue;
  document.documentElement.dataset.motion = s.motion;
  document.documentElement.dataset.glass = s.glassMode;
  document.documentElement.dataset.accent = s.accentColor || DEFAULTS.accentColor;
  document.documentElement.dataset.iconStyle = s.iconStyle || DEFAULTS.iconStyle;
  document.documentElement.dataset.scrollBars = s.scrollBars || DEFAULTS.scrollBars;
  document.documentElement.dataset.scrollBarClick = s.scrollBarClick || DEFAULTS.scrollBarClick;
  document.documentElement.dataset.themeMode = s.themeMode || DEFAULTS.themeMode;
  document.documentElement.dataset.density = s.density === "compact" ? "compact" : "comfortable";
  document.documentElement.dataset.uiZoom = String(zoom);
  document.documentElement.dataset.sidebarCategories = s.sidebarCategories ? "on" : "off";
  document.documentElement.dataset.sidebarTags = s.sidebarTags === false ? "off" : "on";
  document.documentElement.dataset.shortcutHints = s.shortcutHints === false ? "off" : "on";
  document.documentElement.dataset.richIcons = s.richIcons === false ? "off" : "on";
  document.documentElement.dataset.healthBadge = s.sourceHealthBadge === false ? "off" : "on";
  document.documentElement.style.setProperty("--ui-zoom", (zoom / 100).toFixed(2));
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-ink", accent);
  document.documentElement.style.setProperty("--accent-line", accent);
  document.documentElement.style.setProperty("--accent-soft", colorMixHex(accent, 0.14));
}

function colorMixHex(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  const num = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  if (!Number.isFinite(num)) return "rgba(10,132,255,.14)";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
