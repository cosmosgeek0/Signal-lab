// Movers — market movement across both layers:
// external 24h gainers/losers with mini charts (CoinGecko) + exchange-local
// window movers (spot, basis, funding). Every row opens the asset page.

import { h, mount } from "../lib/dom.js";
import { icon, tokenIcon, coinIcon, onIconsReady } from "../lib/icons.js";
import { api } from "../lib/api.js";
import { navigate } from "../lib/store.js";
import { baseOf, fmtPct, fmtBps, fmtMoney, signClass } from "../lib/format.js";
import { sparkline } from "../lib/chart.js";
import { attachPopover, popRow } from "../ui/popover.js";

const WINDOWS = [1, 5, 15, 60];
const moveText = (v) => v == null || !isFinite(Number(v)) ? "—" : (Number(v) >= 0 ? "↗ " : "↘ ") + fmtPct(Number(v));
const EXCHANGE_LISTS = ["top_spot_up", "top_spot_down", "top_basis_widening", "top_basis_compression"];

function compactAge(seconds) {
  const s = Number(seconds);
  if (!isFinite(s) || s < 0) return "unknown";
  if (s < 90) return `${Math.round(s)}s ago`;
  const m = s / 60;
  if (m < 90) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function utcStamp(s) {
  return s ? String(s).replace(":00 UTC", " UTC") : "no timestamp";
}

export function renderMovers(root) {
  let minutes = 5;
  let latestMovers = null;
  const binanceHead = h("h2", { class: "sec-title" }, "Exchange micro-movers · 5m");
  const exchangeNote = h("span", { class: "sec-note" }, "Exchange public stream · local cache");
  const exchangeWrap = h("div", { class: "exchange-movers-wrap" });
  let coins = [];
  const cleanups = [];
  const winSeg = h("div", { class: "seg" });
  const subLine = h("div", { class: "page-sub" }, "loading…");
  const digestWrap = h("div", { class: "movers-hero" });
  const gainWrap = h("div", { class: "lb" });
  const loseWrap = h("div", { class: "lb" });
  const volWrap = h("div", { class: "lb" });
  const boards = {
    up: h("div", { class: "lb" }), down: h("div", { class: "lb" }),
    widen: h("div", { class: "lb" }), compress: h("div", { class: "lb" }),
    fund: h("div", { class: "lb" }),
  };

  const page_ = h("div", { class: "page movers-page" },
    h("div", { class: "container" },
      h("div", { class: "page-head" },
        h("div", {}, h("h1", { class: "page-title" }, "Movers"), subLine), winSeg),
      digestWrap,
      h("section", { class: "movers-section" },
        h("div", { class: "sec-head" }, h("h2", { class: "sec-title" }, "Market movers · 24h"),
          h("span", { class: "sec-note" }, "CoinGecko · opens asset page")),
        h("div", { class: "movers-grid" },
          board("Price gainers", gainWrap), board("Price losers", loseWrap), board("Volume leaders", volWrap))),
      h("section", { class: "movers-section" },
        h("div", { class: "sec-head" }, binanceHead,
          exchangeNote),
        exchangeWrap)));

  function board(title, wrap) {
    return h("section", { class: "mover-board" }, h("div", { class: "sec-head" },
      h("h2", { class: "sec-title", style: { fontSize: "16px" } }, title)), wrap);
  }

  mount(root, page_);
  buildSeg();
  paintExchangeState(null, "checking");

  function buildSeg() {
    binanceHead.textContent = `Exchange micro-movers · ${minutes}m`;
    mount(winSeg, WINDOWS.map((w) => h("button", { class: w === minutes ? "on" : "", onClick: () => {
      minutes = w; buildSeg(); load();
    } }, w + "m")));
  }

  function paintSubline(text, tone = "checking") {
    mount(subLine,
      h("span", { class: "mv-source-dot " + tone }),
      h("span", {}, text));
  }

  function digestCard(label, iconEl, title, value, cls, sub, run) {
    return h("button", { class: "mv-card" + (run ? "" : " disabled"), disabled: !run, onClick: run || null },
      h("span", { class: "mv-k" }, label),
      h("span", { class: "mv-main" }, iconEl || icon("activity"), h("b", {}, title || "—")),
      h("span", { class: "mv-v num " + (cls || "") }, value || "—"),
      h("span", { class: "mv-sub" }, sub || ""));
  }

  function paintDigest() {
    const byChg = [...coins].filter((c) => c.chg24h != null).sort((a, b) => b.chg24h - a.chg24h);
    const byVol = [...coins].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    const g = byChg[0], l = byChg[byChg.length - 1], v = byVol[0];
    const exchangeLive = hasExchangeRows(latestMovers);
    const localUp = exchangeLive && (latestMovers.top_spot_up || [])[0];
    const health = latestMovers && latestMovers.health;
    const exchangeValue = localUp ? moveText(localUp.spot_mid_change_pct) : health ? "stale" : "checking";
    const exchangeSub = localUp
      ? `${(latestMovers.rows || []).length} live exchange symbols`
      : health
        ? `${health.live_symbols || 0} live · last update ${compactAge(health.freshness_age_seconds)}`
        : "local stream checking";
    mount(digestWrap,
      digestCard("24h leader", g ? coinIcon(g, 26) : null, g && g.base, g ? moveText(g.chg24h) : "warming", "up",
        g ? g.name : "CoinGecko market data", g ? () => navigate("/symbol/" + (g.binance ? g.binance.symbol : g.base + "USDT")) : null),
      digestCard("24h laggard", l ? coinIcon(l, 26) : null, l && l.base, l ? moveText(l.chg24h) : "warming", "down",
        l ? l.name : "CoinGecko market data", l ? () => navigate("/symbol/" + (l.binance ? l.binance.symbol : l.base + "USDT")) : null),
      digestCard("Top volume", v ? coinIcon(v, 26) : null, v && v.base, v ? fmtMoney(v.volume) : "warming", "strong",
        v ? v.name : "CoinGecko market data", v ? () => navigate("/symbol/" + (v.binance ? v.binance.symbol : v.base + "USDT")) : null),
      digestCard(`${minutes}m exchange`, localUp ? tokenIcon(localUp.symbol, 26) : icon(health ? "warning" : "radio"), localUp ? baseOf(localUp.symbol) : "Source",
        exchangeValue, localUp ? "up" : health ? "stale" : "",
        exchangeSub,
        localUp ? () => navigate("/symbol/" + localUp.symbol + "?tab=price") : null));
  }

  // ---- external 24h movers with mini charts ----
  function coinRow(c, valText, cls) {
    const symbol = c.binance ? c.binance.symbol : c.base + "USDT";
    const row = h("button", { class: "lb-row mv-token-row", onClick: () => navigate("/symbol/" + symbol) },
      coinIcon(c, 24),
      h("span", { class: "mv-asset" },
        h("span", { class: "lb-name" }, c.base || c.name),
        h("span", { class: "lb-sub" }, c.name)),
      h("span", { class: "mv-price num" }, fmtMoney(c.price)),
      h("span", { class: "sparkbox", style: { width: "72px", height: "26px" },
        html: sparkline(c.spark || [], 72, 26, (c.chg7d || 0) < 0 ? "var(--down)" : "var(--up)") }),
      h("span", { class: "mv-depth" },
        h("span", { class: "lb-sub" }, "Vol"),
        h("span", { class: "num" }, fmtMoney(c.volume))),
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
    paintDigest();
  }

  // ---- Binance-local movers ----
  function hasExchangeRows(m) {
    return EXCHANGE_LISTS.some((key) => (m && m[key] || []).length) || (m && m.rows || []).length;
  }

  function paintExchangeState(m, state = "stale") {
    latestMovers = m || null;
    const health = m && m.health;
    const live = Number(health && health.live_symbols) || 0;
    const tracked = Number(health && health.tracked_symbols) || 0;
    const age = health ? compactAge(health.freshness_age_seconds) : "checking";
    const title = state === "checking" ? "Checking exchange mover stream" : "Exchange mover stream is stale";
    const copy = state === "checking"
      ? "Waiting for the local public exchange cache before drawing short-window boards."
      : "No fresh exchange symbols moved in this window. The 24h gainers, losers and volume boards above remain available.";
    exchangeNote.textContent = health ? `${health.collector_status || "STALE"} · ${live}/${tracked || "—"} live` : "Exchange public stream · checking";
    paintSubline(health ? `Exchange source stale · last update ${age}` : "Checking exchange source", health && live ? "live" : state);
    mount(exchangeWrap,
      h("div", { class: "movers-stale-state" },
        h("div", { class: "movers-stale-copy" },
          h("span", { class: "movers-stale-icon" }, icon(state === "checking" ? "radio" : "warning")),
          h("div", {},
            h("b", {}, title),
            h("span", {}, copy))),
        h("div", { class: "movers-stale-metrics" },
          staleMetric("Live symbols", live || "0", tracked ? `${tracked} tracked` : "cache pending"),
          staleMetric("Last exchange update", age, health ? utcStamp(health.latest_update_utc) : "waiting on API"),
          staleMetric("Recent rows", health ? String(health.rows_recent_window || 0) : "0", `${health ? health.recent_window_minutes || 60 : 60}m window`)),
        h("button", { class: "movers-stale-action", onClick: () => navigate("/symbol/BTCUSDT?tab=price") },
          icon("arrowUpRight"), "Open BTCUSDT")));
    paintDigest();
  }

  function staleMetric(k, v, sub) {
    return h("span", { class: "movers-stale-metric" },
      h("span", { class: "k" }, k),
      h("b", { class: "num" }, v),
      h("span", { class: "lb-sub" }, sub));
  }

  function paintExchangeGrid() {
    mount(exchangeWrap,
      h("div", { class: "movers-grid movers-exchange-grid" },
        board("Spot gainers", boards.up), board("Spot losers", boards.down),
        board("Basis widening", boards.widen), board("Basis compressing", boards.compress),
        board("Funding jumps", boards.fund)));
  }

  function rows(wrap, list, valFn, clsFn, magFn, tab) {
    const items = (list || []).slice(0, 8);
    if (!items.length) {
      mount(wrap, h("div", { class: "lb-row mv-board-empty" },
        icon("activity"),
        h("span", { class: "lb-name" }, "No fresh rows"),
        h("span", { class: "lb-val num" }, "—")));
      return;
    }
    const max = Math.max(...items.map((r) => Math.abs(magFn(r))), 1e-9);
    mount(wrap, items.map((r) => {
      const cls = clsFn(r);
      return h("button", { class: "lb-row mv-exchange-row", onClick: () => navigate("/symbol/" + r.symbol + (tab ? "?tab=" + tab : "")) },
        h("span", { class: "lb-bar " + (cls === "up" ? "bid" : "ask"), style: { width: (Math.abs(magFn(r)) / max) * 70 + 6 + "%" } }),
        tokenIcon(r.symbol, 24),
        h("span", { class: "mv-asset" },
          h("span", { class: "lb-name" }, baseOf(r.symbol)),
          h("span", { class: "lb-sub" }, r.symbol)),
        h("span", { class: "lb-val num " + cls }, valFn(r)));
    }));
  }

  async function load() {
    try {
      const m = await api.movers(minutes);
      if (!m || m.ok === false || !hasExchangeRows(m)) {
        paintExchangeState(m, "stale");
        return;
      }
      paintExchangeGrid();
      rows(boards.up, m.top_spot_up, (r) => "↗ " + fmtPct(r.spot_mid_change_pct), () => "up", (r) => r.spot_mid_change_pct || 0, "price");
      rows(boards.down, m.top_spot_down, (r) => "↘ " + fmtPct(r.spot_mid_change_pct), () => "down", (r) => r.spot_mid_change_pct || 0, "price");
      rows(boards.widen, m.top_basis_widening, (r) => fmtBps(r.basis_change_bps, true) + " bps", () => "up", (r) => r.basis_change_bps || 0, "basis");
      rows(boards.compress, m.top_basis_compression, (r) => fmtBps(r.basis_change_bps, true) + " bps", () => "down", (r) => r.basis_change_bps || 0, "basis");
      const fund = [...(m.rows || [])].sort((a, b) => Math.abs(b.funding_change || 0) - Math.abs(a.funding_change || 0));
      rows(boards.fund, fund, (r) => {
        const d = (r.funding_change || 0) * 100;
        return (d >= 0 ? "+" : "") + d.toFixed(4) + "%";
      }, (r) => ((r.funding_change || 0) >= 0 ? "up" : "down"), (r) => r.funding_change || 0, "funding");
      latestMovers = m;
      paintDigest();
      exchangeNote.textContent = `Live exchange stream · ${(m.rows || []).length} symbols`;
      paintSubline(`${(m.rows || []).length} exchange symbols moved in ${minutes}m · external 24h data above`, "live");
    } catch (e) {
      paintExchangeState(null, "stale");
    }
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
