// User preferences: persisted in localStorage, broadcast on change.

const KEY = "cg-settings";

export const DEFAULTS = {
  currency: "USD",        // converts only where a live FX rate exists
  source: "combined",     // "combined" (Binance + external context) | "binance"
  refreshSec: 1.6,        // live poll cadence
  basisUnit: "bps",       // "bps" | "pct"
  motion: "full",         // "full" | "reduced"
  tapeSpeed: "normal",    // "calm" | "normal" | "fast" — px/s of the top tape
  defaultPage: "market",  // "market" | "radar"
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
  document.documentElement.dataset.motion = getSettings().motion;
}
