// Number motion: smooth count-up transitions + a green/red flash on every
// change (up → --up, down → --down, then back to the element's own color).
// Flash is animation-based so it also works on freshly re-rendered elements.

import { motionReduced } from "./settings.js";

export function flashDelta(el, up) {
  if (motionReduced()) return;
  const cls = up ? "flash-up" : "flash-down";
  el.classList.remove("flash-up", "flash-down");
  void el.offsetWidth;                    // restart the CSS animation
  el.classList.add(cls);
  clearTimeout(el._cuFlash);
  el._cuFlash = setTimeout(() => el.classList.remove(cls), 1500);
}

export function countUp(el, to, fmt, { dur = 650 } = {}) {
  const target = Number(to);
  if (!isFinite(target)) { el.textContent = "—"; el._cu = undefined; return; }
  const from = el._cu;
  el._cu = target;
  if (from !== undefined && isFinite(from) && from !== target) flashDelta(el, target > from);
  if (from === undefined || from === target || !isFinite(from) || document.hidden || motionReduced()) {
    el.textContent = fmt(target);
    return;
  }
  cancelAnimationFrame(el._cuRaf);
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = fmt(from + (target - from) * e);
    if (p < 1) el._cuRaf = requestAnimationFrame(step);
  };
  el._cuRaf = requestAnimationFrame(step);
}
