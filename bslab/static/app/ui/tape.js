// Shared marquee tape (majors). Built once; values update in place.
// Scrolling is a rAF modulo loop (NOT a CSS keyframe): we translate by
// -(offset % copyWidth) where copyWidth is re-measured on any layout change,
// so the loop is seamless forever — even when icons/values change the track
// width mid-flight (the old -50% keyframe visibly jumped when that happened).

import { h } from "../lib/dom.js";
import { onLive, store, navigate } from "../lib/store.js";
import { baseOf, fmtPrice, fmtBps, signClass } from "../lib/format.js";
import { tokenIcon } from "../lib/icons.js";
import { getSettings, onSettings } from "../lib/settings.js";

const COPIES = 4;

export const TAPE_SPEEDS = { calm: 22, normal: 42, fast: 78 };   // px per second

function tapeSpeed() {
  return TAPE_SPEEDS[getSettings().tapeSpeed] || TAPE_SPEEDS.normal;
}

// rAF marquee engine: measure one copy's width, advance offset by speed·dt,
// wrap with modulo. Pause on hover, honor reduced motion, idle when hidden.
function attachMarquee(el, track) {
  let offset = 0, period = 0, raf = 0, last = 0, paused = false, speed = tapeSpeed();
  const unSettings = onSettings(() => { speed = tapeSpeed(); });

  function measure() { period = track.scrollWidth / COPIES; }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
  if (ro) ro.observe(track);
  const remeasure = setInterval(measure, 2500);   // icon loads that RO misses

  el.addEventListener("mouseenter", () => { paused = true; });
  el.addEventListener("mouseleave", () => { paused = false; });

  function step(ts) {
    raf = requestAnimationFrame(step);
    if (!last) { last = ts; return; }
    const dt = Math.min(80, ts - last);
    last = ts;
    if (paused || document.hidden) return;
    if (document.documentElement.dataset.motion === "reduced") return;
    if (period < 60) { measure(); return; }
    offset = (offset + (speed * dt) / 1000) % period;
    track.style.transform = `translate3d(${(-offset).toFixed(2)}px,0,0)`;
  }
  raf = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(remeasure);
    if (ro) ro.disconnect();
    unSettings();
  };
}

export function buildTape() {
  const track = h("div", { class: "tape-track" });
  const el = h("div", { class: "tape" }, track);
  const refs = [];
  const stop = attachMarquee(el, track);

  function paint(lite) {
    const rows = (lite && lite.ticker) || [];
    if (!rows.length) return;
    if (!track.childElementCount) {
      for (let copy = 0; copy < COPIES; copy++) {
        rows.forEach((r) => {
          const px = h("span", { class: "tape-px num" });
          const chg = h("span", { class: "tape-chg num" });
          track.appendChild(h("span", {
            class: "tape-item", onClick: () => navigate("/symbol/" + r.symbol),
          }, tokenIcon(r.symbol, 16), h("span", { class: "tape-sym" }, baseOf(r.symbol)), px, chg));
          refs.push({ sym: r.symbol, px, chg });
        });
      }
    }
    const by = {};
    rows.forEach((r) => { by[r.symbol] = r; });
    for (const ref of refs) {
      const r = by[ref.sym];
      if (!r) continue;
      const b = Number(r.mid_spread_bps || 0);
      ref.px.textContent = fmtPrice(r.spot_mid);
      ref.chg.textContent = (b >= 0 ? "↗ " : "↘ ") + fmtBps(b, true);
      ref.chg.className = "tape-chg num " + signClass(b);
    }
  }

  paint(store.lite);
  const un = onLive(paint);
  return { el, destroy: () => { un(); stop(); } };
}

// Real-price tape for the Market page: driven by external top-coin data
// (price + 24h change) instead of local basis. Values update in place.
export function buildCoinsTape() {
  const track = h("div", { class: "tape-track" });
  const el = h("div", { class: "tape" }, track);
  const refs = [];
  const stop = attachMarquee(el, track);

  function update(coins) {
    const rows = (coins || []).slice(0, 20).filter((c) => c.price != null);
    if (!rows.length) return;
    if (!track.childElementCount) {
      for (let copy = 0; copy < COPIES; copy++) {
        rows.forEach((c) => {
          const px = h("span", { class: "tape-px num" });
          const chg = h("span", { class: "tape-chg num" });
          track.appendChild(h("span", {
            class: "tape-item",
            onClick: () => navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")),
          }, tokenIcon(c.base, 16), h("span", { class: "tape-sym" }, c.base), px, chg));
          refs.push({ base: c.base, px, chg });
        });
      }
    }
    const by = {};
    rows.forEach((c) => { by[c.base] = c; });
    for (const ref of refs) {
      const c = by[ref.base];
      if (!c) continue;
      ref.px.textContent = fmtPrice(c.price);
      if (c.chg24h != null) {
        ref.chg.textContent = (c.chg24h >= 0 ? "↗ " : "↘ ") + Math.abs(c.chg24h).toFixed(2) + "%";
        ref.chg.className = "tape-chg num " + signClass(c.chg24h);
      }
    }
  }
  return { el, update, destroy: stop };
}
