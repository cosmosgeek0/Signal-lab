// Global client state: live poll of /api/state-lite (paused when tab hidden),
// a tiny path router, theme, and a localStorage watchlist.

import { api } from "./api.js";
import { getSettings, onSettings } from "./settings.js";

function emitter() {
  const subs = new Set();
  return {
    sub(fn) { subs.add(fn); return () => subs.delete(fn); },
    emit(v) { for (const fn of subs) { try { fn(v); } catch (e) { console.error(e); } } },
  };
}

// ---- live tape / metrics ----------------------------------------------------
const liveBus = emitter();
export const onLive = liveBus.sub;
export const store = {
  lite: window.__CG_BOOT__ && typeof window.__CG_BOOT__ === "object" ? window.__CG_BOOT__ : null,
  onLive: liveBus.sub,
};

let pollTimer = null;
let inFlight = false;

async function pollOnce() {
  if (inFlight || document.hidden) return;
  inFlight = true;
  try {
    const lite = await api.stateLite();
    if (lite && lite.ok !== false) { store.lite = lite; liveBus.emit(lite); }
  } catch (e) {
    /* keep last good; the tape simply doesn't update this tick */
  } finally {
    inFlight = false;
  }
}

export function startPolling() {
  if (pollTimer) return;
  const start = () => {
    clearInterval(pollTimer);
    pollTimer = setInterval(pollOnce, Math.max(1000, getSettings().refreshSec * 1000));
  };
  pollOnce();
  start();
  onSettings((_, key) => { if (key === "refreshSec" || key === "*") start(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pollOnce(); // refresh immediately on return; no catch-up storm
  });
}

// ---- router -----------------------------------------------------------------
const routeBus = emitter();
export const onRoute = routeBus.sub;

export function currentRoute() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const m = path.match(/^\/symbol\/([A-Za-z0-9]+)/);
  if (m) return { name: "symbol", symbol: m[1].toUpperCase() };
  if (path === "/world") return { name: "market" };
  if (path === "/radar") return { name: "radar" };
  if (path === "/heatmap") return { name: "heatmap" };
  if (path === "/bubbles") return { name: "bubbles" };
  if (path === "/funding") return { name: "funding" };
  if (path === "/movers") return { name: "movers" };
  return { name: "market" };
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  routeBus.emit(currentRoute());
  window.scrollTo({ top: 0 });
}
window.addEventListener("popstate", () => routeBus.emit(currentRoute()));

// Intercept internal link clicks for SPA navigation.
export function linkTo(path) {
  return (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return; // let browser handle new-tab
    ev.preventDefault();
    navigate(path);
  };
}

// ---- theme ------------------------------------------------------------------
export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
export function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("cg-theme", t); } catch (e) {}
  themeBus.emit(t);
}
export function toggleTheme() { setTheme(getTheme() === "dark" ? "light" : "dark"); }
const themeBus = emitter();
export const onTheme = themeBus.sub;

// ---- watchlist --------------------------------------------------------------
const watchBus = emitter();
export const onWatch = watchBus.sub;
let watch = new Set();
try { watch = new Set(JSON.parse(localStorage.getItem("cg-watch") || "[]")); } catch (e) {}

export function isStarred(sym) { return watch.has(sym); }
export function starred() { return Array.from(watch); }
export function toggleStar(sym) {
  if (watch.has(sym)) watch.delete(sym); else watch.add(sym);
  try { localStorage.setItem("cg-watch", JSON.stringify(Array.from(watch))); } catch (e) {}
  watchBus.emit(watch);
  return watch.has(sym);
}
