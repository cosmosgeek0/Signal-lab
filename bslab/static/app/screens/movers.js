// Movers — market movement across both layers:
// external 24h gainers/losers with mini charts (CoinGecko) + Binance-local
// window movers (spot, basis, funding). Every row opens the asset page.

import { h, mount } from "../lib/dom.js";
import { tokenIcon, coinIcon, onIconsReady } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate } from "../lib/store.js";
import { baseOf, fmtPct, fmtBps, fmtMoney, signClass } from "../lib/format.js";
import { sparkline } from "../lib/chart.js";
import { attachPopover, popRow } from "../ui/popover.js";

const WINDOWS = [1, 5, 15, 60];

export function renderMovers(root) {
  let minutes = 5;
  const binanceHead = h("h2", { class: "sec-title" }, "Binance movers · 5m");
  let coins = [];
  const cleanups = [];
  const winSeg = h("div", { class: "seg" });
  const subLine = h("div", { class: "page-sub" }, "loading…");
  const gainWrap = h("div", { class: "lb" });
  const loseWrap = h("div", { class: "lb" });
  const volWrap = h("div", { class: "lb" });
  const boards = {
    up: h("div", { class: "lb" }), down: h("div", { class: "lb" }),
    widen: h("div", { class: "lb" }), compress: h("div", { class: "lb" }),
    fund: h("div", { class: "lb" }),
  };

  const page_ = h("div", { class: "page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Movers"), subLine), winSeg),
      h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Market movers · 24h"),
        h("span", { class: "sec-note" }, "source: coingecko · click opens asset page")),
      h("div", { class: "movers-grid" },
        board("Price gainers", gainWrap), board("Price losers", loseWrap), board("Volume leaders", volWrap)),
      h("div", { class: "sec-head" }, binanceHead,
        h("span", { class: "sec-note" }, "source: binance local")),
      h("div", { class: "movers-grid" },
        board("Spot up", boards.up), board("Spot down", boards.down),
        board("Basis widening", boards.widen), board("Basis compressing", boards.compress),
        board("Funding jumps", boards.fund))));

  function board(title, wrap) {
    return h("section", {}, h("div", { class: "sec-head", style: { margin: "18px 0 10px" } },
      h("h2", { class: "sec-title", style: { fontSize: "16px" } }, title)), wrap);
  }

  mount(root, page_);
  buildSeg();

  function buildSeg() {
    binanceHead.textContent = `Binance movers · ${minutes}m`;
    mount(winSeg, WINDOWS.map((w) => h("button", { class: w === minutes ? "on" : "", onClick: () => {
      minutes = w; buildSeg(); load();
    } }, w + "m")));
  }

  // ---- external 24h movers with mini charts ----
  function coinRow(c, valText, cls) {
    const row = h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + (c.binance ? c.binance.symbol : c.base + "USDT")) },
      coinIcon(c, 24),
      h("span", { class: "lb-name" }, c.name),
      h("span", { class: "sparkbox", style: { width: "72px", height: "26px" },
        html: sparkline(c.spark || [], 72, 26, (c.chg7d || 0) < 0 ? "var(--down)" : "var(--up)") }),
      h("span", { class: "lb-val num " + cls }, valText));
    attachPopover(row, () => h("div", {},
      h("div", { class: "hp-head" }, coinIcon(c, 22), h("b", {}, c.name), h("span", { class: "muted" }, "#" + (c.rank ?? "—"))),
      popRow("24h", c.chg24h != null ? fmtPct(c.chg24h) : "—", signClass(c.chg24h)),
      popRow("Volume", fmtMoney(c.volume)),
      popRow("Market cap", fmtMoney(c.mcap)),
      h("div", { class: "hp-src" }, "coingecko · click to open")));
    return row;
  }
  function paintExternal() {
    const withChg = coins.filter((c) => c.chg24h != null);
    if (!withChg.length) {
      const ghost = h("div", { class: "empty-state", style: { padding: "16px" } }, "External price source unavailable.");
      mount(gainWrap, ghost.cloneNode(true)); mount(loseWrap, ghost.cloneNode(true)); mount(volWrap, ghost);
      return;
    }
    const byChg = [...withChg].sort((a, b) => b.chg24h - a.chg24h);
    const byVol = [...coins].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    mount(gainWrap, byChg.slice(0, 8).map((c) => coinRow(c, "↗ " + fmtPct(c.chg24h), "up")));
    mount(loseWrap, [...byChg].reverse().slice(0, 8).map((c) => coinRow(c, "↘ " + fmtPct(c.chg24h), "down")));
    mount(volWrap, byVol.slice(0, 8).map((c) => coinRow(c, fmtMoney(c.volume), "strong")));
  }

  // ---- Binance-local movers ----
  function rows(wrap, list, valFn, clsFn, magFn, tab) {
    const items = (list || []).slice(0, 8);
    if (!items.length) { mount(wrap, h("div", { class: "empty-state", style: { padding: "16px" } }, "Nothing measured in this window yet.")); return; }
    const max = Math.max(...items.map((r) => Math.abs(magFn(r))), 1e-9);
    mount(wrap, items.map((r) => {
      const cls = clsFn(r);
      return h("div", { class: "lb-row", onClick: () => navigate("/symbol/" + r.symbol + (tab ? "?tab=" + tab : "")) },
        h("span", { class: "lb-bar " + (cls === "up" ? "bid" : "ask"), style: { width: (Math.abs(magFn(r)) / max) * 70 + 6 + "%" } }),
        tokenIcon(r.symbol, 24),
        h("span", { class: "lb-name" }, baseOf(r.symbol)),
        h("span", { class: "lb-val num " + cls }, valFn(r)));
    }));
  }

  async function load() {
    try {
      const m = await api.movers(minutes);
      if (!m || m.ok === false) return;
      rows(boards.up, m.top_spot_up, (r) => "↗ " + fmtPct(r.spot_mid_change_pct), () => "up", (r) => r.spot_mid_change_pct || 0, "price");
      rows(boards.down, m.top_spot_down, (r) => "↘ " + fmtPct(r.spot_mid_change_pct), () => "down", (r) => r.spot_mid_change_pct || 0, "price");
      rows(boards.widen, m.top_basis_widening, (r) => fmtBps(r.basis_change_bps, true) + " bps", () => "up", (r) => r.basis_change_bps || 0, "basis");
      rows(boards.compress, m.top_basis_compression, (r) => fmtBps(r.basis_change_bps, true) + " bps", () => "down", (r) => r.basis_change_bps || 0, "basis");
      const fund = [...(m.rows || [])].sort((a, b) => Math.abs(b.funding_change || 0) - Math.abs(a.funding_change || 0));
      rows(boards.fund, fund, (r) => {
        const d = (r.funding_change || 0) * 100;
        return (d >= 0 ? "+" : "") + d.toFixed(4) + "%";
      }, (r) => ((r.funding_change || 0) >= 0 ? "up" : "down"), (r) => r.funding_change || 0, "funding");
      mount(subLine, `${(m.rows || []).length} Binance symbols moved in ${minutes}m · external 24h data above`);
    } catch (e) {}
  }
  async function loadCoins() {
    try {
      const ov = await api.marketOverview();
      coins = (ov && ov.top_coins && ov.top_coins.coins) || [];
      paintExternal();
    } catch (e) {}
  }

  load();
  loadCoins();
  const t = setInterval(load, 8000);
  const t2 = setInterval(loadCoins, 30000);
  cleanups.push(() => { clearInterval(t); clearInterval(t2); });
  cleanups.push(onIconsReady(paintExternal));
  return () => cleanups.forEach((c) => c());
}
