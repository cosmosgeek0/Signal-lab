// Shared marquee tape (majors). Built once; values update in place so the
// scroll animation never restarts. Used by the Market and Radar screens.

import { h } from "../lib/dom.js";
import { onLive, store, navigate } from "../lib/store.js";
import { baseOf, fmtPrice, fmtBps, signClass } from "../lib/format.js";

export function buildTape() {
  const track = h("div", { class: "tape-track" });
  const el = h("div", { class: "tape" }, track);
  const refs = [];

  function paint(lite) {
    const rows = (lite && lite.ticker) || [];
    if (!rows.length) return;
    if (!track.childElementCount) {
      for (let copy = 0; copy < 4; copy++) {
        rows.forEach((r) => {
          const px = h("span", { class: "tape-px num" });
          const chg = h("span", { class: "tape-chg num" });
          track.appendChild(h("span", {
            class: "tape-item", onClick: () => navigate("/symbol/" + r.symbol),
          }, h("span", { class: "tape-sym" }, baseOf(r.symbol)), px, chg));
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
  return { el, destroy: un };
}

// Real-price tape for the Market page: driven by external top-coin data
// (price + 24h change) instead of local basis. Values update in place.
export function buildCoinsTape() {
  const track = h("div", { class: "tape-track" });
  const el = h("div", { class: "tape" }, track);
  const refs = [];

  function update(coins) {
    const rows = (coins || []).slice(0, 10).filter((c) => c.price != null);
    if (!rows.length) return;
    if (!track.childElementCount) {
      for (let copy = 0; copy < 3; copy++) {
        rows.forEach((c) => {
          const px = h("span", { class: "tape-px num" });
          const chg = h("span", { class: "tape-chg num" });
          track.appendChild(h("span", {
            class: "tape-item",
            onClick: () => navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")),
          }, h("span", { class: "tape-sym" }, c.base), px, chg));
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
  return { el, update, destroy: () => {} };
}
