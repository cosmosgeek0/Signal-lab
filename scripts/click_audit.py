#!/usr/bin/env python3
"""Browser click audit: every clickable-looking element must DO something.

    python scripts/click_audit.py --base http://127.0.0.1:8765

Drives headless Chrome over CDP and clicks through the real product:
nav items, market cards (detail sheets), source labels, majors, table rows
(full asset page with tabs — NOT a basis-only page), radar rows (?tab=basis),
heatmap cells, funding/movers rows, header controls (source / currency /
clock / settings / search) and the health badge. Fails if a click does nothing, a
sheet/menu does not open, the URL does not change, tabs are missing on the
asset page, or any JS error is captured.

Skips (exit 0, warning) when Chrome or websockets are unavailable.
"""
from __future__ import annotations

import argparse
import itertools
import json
import re
import shutil
import subprocess
import sys
import time

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome", "chromium-browser", "chromium",
]


def find_chrome():
    for cand in CHROME_CANDIDATES:
        if cand.startswith("/"):
            import os
            if os.path.exists(cand):
                return cand
        elif shutil.which(cand):
            return cand
    return None


# The audit itself runs INSIDE the page (async IIFE, returns a JSON report).
AUDIT_JS = r"""
(async () => {
  const R = [];
  const ok = (name, pass_, detail) => R.push({ name, ok: !!pass_, detail: String(detail || "") });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 9000, step = 150) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(step); }
    return false;
  };
  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));
  const path = () => location.pathname + location.search;
  const go = async (p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); await sleep(250); };
  const waitMarketReady = async (minRows = 2, ms = 18000) => await until(() =>
    location.pathname === "/"
    && q("button[data-atlas-category]")
    && qa("#sec-prices tbody tr .cta-pill").length >= minRows
    && qa("#sec-prices th.th-sort").length >= 3,
    ms);
  const selectSector = async (id, minRows = 2) => {
    if (location.pathname !== "/") {
      await go("/");
      await waitMarketReady(2, 20000);
    }
    const btn = qa("button[data-atlas-category]").find((b) => b.dataset.atlasCategory === id);
    if (!btn) return false;
    btn.click();
    return await until(() =>
      (q(".market-taxonomy-pill.active") || {}).dataset?.atlasCategory === id
      && qa("#sec-prices tbody tr .cta-pill").length >= minRows
      && qa("#sec-prices th.th-sort").length >= 3,
      20000);
  };
  const closeSheet = async () => { const s = q(".sheet-scrim"); if (s) s.click(); await sleep(150); };
  const closeMenu = async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await sleep(120); };
  try { localStorage.setItem("cg-chartsrc", "native"); } catch (e) {}

  // boot
  ok("boot", await until(() => window.__CG_BOOTED__, 8000), "app booted");

  // ---------- nav (Global-first category rail; tools live inside category menus) ----------
  await go("/");
  for (const [id, sec] of [["global", null], ["indices", "indices"], ["us-stocks", "us-stocks"], ["crypto", "crypto"]]) {
    const href = sec ? "/?sec=" + sec : "/";
    const a = qa(".nav a").find((x) => x.getAttribute("href") === href);
    if (!a) { ok("nav:" + id, false, "category link missing " + href); continue; }
    a.click(); await sleep(300);
    const secOk = sec ? location.search.includes("sec=" + sec) : true;
    ok("nav:" + id, location.pathname === "/" && secOk, `loc=${location.pathname}${location.search}`);
  }
  // analysis tool pages remain reachable as standalone routes
  for (const tool of ["radar", "heatmap", "bubbles", "funding", "movers"]) {
    await go("/" + tool);
    const rendered = await until(() => q(".page") && document.body.textContent.length > 500, 8000);
    ok("nav:" + tool, rendered && location.pathname === "/" + tool, `pathname=${location.pathname}`);
  }
  // and are linked from inside the crypto category menu
  await go("/");
  const cryptoItem = qa(".nav a").find((x) => x.getAttribute("href") === "/?sec=crypto");
  if (cryptoItem) {
    cryptoItem.focus(); cryptoItem.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); await sleep(700);
    // menu renders items as buttons (onClick -> navigate), not anchors
    const menuItems = qa(".nav-menu-pop .menu-item, .nav-category-pop .menu-item, .menu-pop .menu-item");
    const radarItem = menuItems.find((x) => /Basis radar|Radar/.test(x.textContent));
    const fundingItem = menuItems.find((x) => /Funding/.test(x.textContent));
    if (radarItem && fundingItem) {
      radarItem.click(); await sleep(500);
      ok("nav-tools-menu", location.pathname === "/radar", "clicked Basis radar -> " + location.pathname);
      await go("/");
    } else ok("nav-tools-menu", false, "menu items=" + menuItems.map((x) => x.textContent.trim().slice(0, 18)).slice(0, 10).join("|"));
  } else ok("nav-tools-menu", false, "crypto category missing");

  // ---------- market cards ----------
  await go("/");
  await until(() => qa(".stat-tile .stat-v").some((v) => v.textContent !== "—"), 12000);
  for (const key of ["mcap", "vol", "dom", "dex", "fng", "stbl", "tvl"]) {
    const card = q(`.stat-tile[data-card="${key}"]`);
    if (!card) { ok("card:" + key, false, "card missing"); continue; }
    card.click(); await sleep(300);
    ok("card:" + key, !!q(".sheet"), "detail sheet opens");
    await closeSheet();
  }
  const uni = q('.stat-tile[data-card="uni"]');
  if (uni) { uni.click(); await sleep(250); ok("card:uni", location.pathname === "/radar", "opens radar"); await go("/"); }
  else ok("card:uni", false, "missing");

  // source label on a card opens data-health sheet
  await until(() => q(".stat-tile .card-src"), 4000);
  const src = q(".stat-tile .card-src");
  if (src) { src.click(); await sleep(300); ok("card-src", !!q(".sheet"), "source detail opens"); await closeSheet(); }
  else ok("card-src", false, "missing");

  // Overview stat visuals must be present on the overview itself. Check them
  // here before route/sector transitions intentionally change the market board.
  const visualNodes = (sel) => qa(`${sel} circle, ${sel} rect, ${sel} path, ${sel} line, ${sel} polyline`);
  await until(() =>
    visualNodes('.stat-tile[data-card="dom"] .stat-spark svg').length >= 3
    && visualNodes('.stat-tile[data-card="dex"] .stat-spark svg').length >= 3,
    10000);
  ok("dominance-donut", visualNodes('.stat-tile[data-card="dom"] .stat-spark svg').length >= 3, "donut SVG renders");
  ok("dex-bars", visualNodes('.stat-tile[data-card="dex"] .stat-spark svg').length >= 3, "daily volume SVG renders");

  // ---------- majors -> FULL asset page ----------
  await until(() => q(".mcard") || q(".market-leader-card"), 8000);
  let mcard = q(".mcard");
  if (!mcard) {
    const cryptoLeadTab = qa("button[data-atlas-category]").find((b) => b.dataset.atlasCategory === "crypto");
    if (cryptoLeadTab) { cryptoLeadTab.click(); await sleep(700); }
    await until(() => q(".market-leader-card"), 6000);
    mcard = q(".market-leader-card");
  }
  if (mcard) {
    mcard.click(); await sleep(400);
    const tabs = qa(".atab").map((t) => t.textContent);
    ok("major->asset", location.pathname.startsWith("/symbol/"), path());
    ok("asset-tabs", tabs.length >= 8, "tabs: " + tabs.join(","));
    ok("asset-overview-default", (q(".atab.on") || {}).textContent === "Overview", "active=" + (q(".atab.on") || {}).textContent);
    // tab clicks work
    const basisTab = qa(".atab").find((t) => t.textContent === "Basis");
    if (basisTab) { basisTab.click(); await sleep(300); ok("asset-tab-basis", (q(".atab.on") || {}).textContent === "Basis" && location.search.includes("tab=basis"), path()); }
    const newsTab = qa(".atab").find((t) => t.textContent === "News");
    if (newsTab) { newsTab.click(); await sleep(400); ok("asset-tab-news", (q(".atab.on") || {}).textContent === "News", "news tab activates"); }
  } else ok("major->asset", false, "no mcard");

  // ---------- asset chart controls (real data + TradingView) ----------
  await go("/symbol/BTCUSDT?tab=overview");
  await until(() => q(".chart-body svg, .chart-body iframe"), 12000);
  ok("asset-chart-renders", !!q(".chart-body svg"), "native chart svg present");
  // real external history, OR the honest self-healing fallback while the
  // provider is rate-limited (local Binance series + visible retry note)
  const metaOk = await until(() => {
    const t = ((q(".chart-meta") || {}).textContent || "").toLowerCase();
    return t.includes("binance") || t.includes("coingecko") || t.includes("tradingview") || t.includes("retrying");
  }, 12000);
  ok("asset-chart-real-source", metaOk, (q(".chart-meta") || {}).textContent);
  const volBtn = qa(".chart-head .seg button").find((b) => b.textContent === "Volume");
  if (volBtn) { volBtn.click(); await sleep(600); ok("asset-volume-mode", !!q(".chart-body svg"), "volume series draws"); }
  else ok("asset-volume-mode", false, "no Volume button");
  const tvBtn = qa(".chart-head .seg button").find((b) => b.textContent === "TradingView");
  if (tvBtn) {
    tvBtn.click(); await sleep(700);
    ok("asset-tradingview", !!q(".chart-body iframe"), "TV widget iframe mounts");
    const cgBtn = qa(".chart-head .seg button").find((b) => b.textContent === "Chart");
    if (cgBtn) { cgBtn.click(); await sleep(500); }
  } else ok("asset-tradingview", false, "no TradingView button");
  const w7 = qa(".win button").find((b) => b.textContent === "7d");
  if (w7) { w7.click(); await sleep(1500); ok("asset-window-7d", !!q(".chart-body svg"), "7d real window draws"); }
  else ok("asset-window-7d", false, "no 7d window");

  // non-tracked coin still gets a real chart (or, under provider rate limits,
  // the honest self-healing retry state — never a silent dead chart)
  await go("/symbol/XMRUSDT");
  const xmrOk = await until(() => {
    const t = ((q(".chart-meta") || {}).textContent || "").toLowerCase();
    return q(".chart-body svg") && (t.includes("binance") || t.includes("coingecko") || t.includes("real market data"));
  }, 26000);
  const retrying = ((q(".chart-meta") || {}).textContent || "").toLowerCase().includes("retrying");
  ok("non-binance-coin-chart", xmrOk || retrying, (q(".chart-meta") || {}).textContent);

  // ---------- market sectors: TradFi and crypto must not be mixed ----------
  await go("/");
  await waitMarketReady(2, 20000);
  const expectedSectors = ["global", "indices", "us-stocks", "world-stocks", "crypto", "futures", "forex", "gov-bonds", "corp-bonds", "etfs", "economy"];
  const sectorIds = qa("button[data-atlas-category]").map((b) => b.dataset.atlasCategory);
  ok("market-sector-tabs", expectedSectors.every((id) => sectorIds.includes(id)), sectorIds.join(","));
  ok("market-default-global", (q(".market-taxonomy-pill.active") || {}).dataset?.atlasCategory === "global", (q(".market-taxonomy-pill.active") || {}).textContent);
  ok("crypto-section-hidden-on-tradfi", !qa(".sector-crypto-only").some((el) => getComputedStyle(el).display !== "none" && el.offsetParent !== null), "crypto-only blocks hidden on global");

  // TradFi table rows update the TradingView chart in place; they should not
  // pretend to be app-native crypto asset pages.
  await until(() => qa("#sec-prices tbody tr .cta-pill").length >= 2, 10000);
  const beforeTv = (q(".atlas-chart-widget iframe") || {}).src || "";
  const ndxBtn = qa("#sec-prices tbody tr")[1]?.querySelector(".cta-pill");
  if (ndxBtn) {
    ndxBtn.click(); await sleep(900);
    const afterTv = (q(".atlas-chart-widget iframe") || {}).src || "";
    ok("tradfi-row->chart", location.pathname === "/" && afterTv !== beforeTv && /NASDAQ%3ANDX|NASDAQ:NDX/.test(afterTv), afterTv.slice(0, 120));
  } else ok("tradfi-row->chart", false, "no second index row chart button");

  // Crypto sector keeps full asset routing plus real crypto movers/table data.
  const cryptoTab = qa("button[data-atlas-category]").find((b) => b.dataset.atlasCategory === "crypto");
  if (cryptoTab) { cryptoTab.click(); await sleep(700); }
  await until(() => q("#sec-prices tbody tr td") && qa("#sec-prices tbody tr").length >= 10, 10000);
  ok("crypto-sector-active", (q(".market-taxonomy-pill.active") || {}).dataset?.atlasCategory === "crypto", "active crypto tab");
  ok("crypto-table-depth", qa("#sec-prices tbody tr").length >= 50, "rows=" + qa("#sec-prices tbody tr").length);
  ok("crypto-movers-real", /Top gainers|Top losers|Top volume|7d strength/.test((q("#sec-movers") || {}).textContent || ""), ((q("#sec-movers") || {}).textContent || "").slice(0, 140));
  const cryptoView = q("#sec-prices tbody tr .cta-pill");
  if (cryptoView) {
    cryptoView.click(); await sleep(500);
    ok("crypto-row->asset", location.pathname.startsWith("/symbol/") && qa(".atab").length >= 8, path());
    await go("/");
    await waitMarketReady(2, 20000);
    await selectSector("crypto", 10);
  } else ok("crypto-row->asset", false, "no crypto view button");

  // ---------- sortable crypto table headers ----------
  await selectSector("crypto", 10);
  const firstTok = () => (q("#sec-prices tbody tr .tok-sub") || {}).textContent || "";
  const before = firstTok();
  const priceTh = qa("#sec-prices th.th-sort").find((t) => t.textContent.startsWith("Price"));
  if (priceTh) {
    priceTh.click(); await sleep(350);
    const sortedDesc = firstTok();
    ok("table-sort-price", !!sortedDesc && sortedDesc !== "—", `first row after sort=${sortedDesc} (was ${before})`);
    priceTh.click(); await sleep(350);
    ok("table-sort-price-asc", firstTok() !== sortedDesc, "ascending flips order");
    priceTh.click(); await sleep(250);   // back to default
  } else ok("table-sort-price", false, "no sortable Price header");
  const upCell = q("#sec-prices tbody td.up");
  const downCell = q("#sec-prices tbody td.down");
  const plainCell = qa("#sec-prices tbody td").find((t) => !t.classList.contains("up") && !t.classList.contains("down") && t.classList.contains("num"));
  const colored = upCell && plainCell && getComputedStyle(upCell).color !== getComputedStyle(plainCell).color
    && (!downCell || getComputedStyle(downCell).color !== getComputedStyle(plainCell).color);
  ok("pct-cells-colored", !!colored,
     `up=${upCell ? getComputedStyle(upCell).color : "n/a"} plain=${plainCell ? getComputedStyle(plainCell).color : "n/a"}`);

  const headTxt = qa("#sec-prices thead th").map((t) => t.textContent).join("|");
  ok("table-no-basis-by-default", !headTxt.includes("Basis"), headTxt);
  const pinBtn = q("#sec-prices tbody tr .star-btn");
  const pinChip = qa(".chips .chip").find((c) => c.textContent === "Pinned");
  if (pinBtn && pinChip) {
    pinBtn.click(); await sleep(250);
    pinChip.click(); await sleep(450);
    ok("table-pinned-filter", qa("#sec-prices tbody tr").length >= 1, "pinned rows=" + qa("#sec-prices tbody tr").length);
  } else ok("table-pinned-filter", false, "pin button or pinned chip missing");

  // Stock/ETF/etc. sector rows stay in market context and switch charts.
  const usReady = await selectSector("us-stocks", 25);
  if (usReady) {
    ok("us-stocks-table", qa("#sec-prices tbody tr").length >= 25, "rows=" + qa("#sec-prices tbody tr").length);
    ok("us-stocks-no-crypto-intel", !qa(".sector-crypto-only").some((el) => getComputedStyle(el).display !== "none" && el.offsetParent !== null), "crypto intel hidden");
    const beforeStockTv = (q(".atlas-chart-widget iframe") || {}).src || "";
    const stockChart = qa("#sec-prices tbody tr")[1]?.querySelector(".cta-pill") || q("#sec-prices tbody tr .cta-pill");
    if (stockChart) { stockChart.click(); await sleep(900); }
    const afterStockTv = (q(".atlas-chart-widget iframe") || {}).src || "";
    ok("stock-row->chart", location.pathname === "/" && afterStockTv !== beforeStockTv, afterStockTv.slice(0, 120));
  } else ok("us-stocks-table", false, "US stocks tab missing");

  // ---------- v9: non-line visuals + news lead ----------
  const wireOpenBtn = qa("button").find((b) => /Open wire|Expand/.test(b.textContent || ""));
  if (wireOpenBtn) { wireOpenBtn.click(); await sleep(500); }
  const wireOk = await until(() => q(".wire-desk.open .wire-story-title, .wire-desk.open .wire-empty"), 10000);
  ok("news-wire-drawer", wireOk, "expandable wire opens with live story or honest warming state");
  ok("news-side-rail", !!q("#sec-news-rail.news-rail"), "compact live-news rail exists beside market surface");
  const wireClose = q(".wire-desk.open .wire-close");
  if (wireClose) { wireClose.click(); await sleep(200); }

  // ---------- radar ----------
  await go("/radar");
  let radarReady = await until(() => q("table.mkt tbody tr .tok") || q("table.mkt tbody tr"), 30000);
  if (!radarReady) {
    await go("/radar");
    radarReady = await until(() => q("table.mkt tbody tr .tok") || q("table.mkt tbody tr"), 30000);
  }
  let rrow = q("table.mkt tbody tr");
  if (!rrow) {
    await sleep(1500);
    rrow = q("table.mkt tbody tr");
  }
  if (rrow) {
    rrow.click(); await sleep(400);
    ok("radar-row->basis-tab", location.search.includes("tab=basis") && (q(".atab.on") || {}).textContent === "Basis", path());
    ok("radar-row-is-full-asset", qa(".atab").length >= 8, "tabs present");
  } else ok("radar-row->basis-tab", false, "no rows");

  // radar icons use the same resolver (img or svg monogram — never empty)
  await go("/radar");
  await until(() => q("table.mkt tbody tr .tok"), 8000);
  const iconsOk = qa("table.mkt tbody tr .tok").slice(0, 10).every((t) => t.querySelector("img, .tok-mono svg"));
  ok("radar-icons", iconsOk, "every token cell has img or monogram svg");

  // ---------- heatmap ----------
  await go("/heatmap");
  await until(() => q(".tile, .tm-cell"), 8000);
  const cell = q(".tm-cell, .tile");
  if (cell) { cell.click(); await sleep(350); ok("heatmap-cell->asset", location.pathname.startsWith("/symbol/"), path()); }
  else ok("heatmap-cell->asset", false, "no cells");

  // ---------- bubbles ----------
  await go("/bubbles");
  await until(() => q(".bb-stage") && (qa(".bb-bubble").length > 4 || q(".bb-empty")), 25000);
  ok("bubbles-stage", !!q(".bb-stage") && (qa(".bb-bubble").length > 4 || q(".bb-empty")), `bubbles=${qa(".bb-bubble").length}`);
  const stockChip = qa(".bb-asset .chip").find((b) => (b.textContent || "").trim() === "Stocks");
  if (stockChip) {
    stockChip.click();
    await sleep(1100);
    ok("bubbles-stocks", location.pathname === "/bubbles" && location.search.includes("asset=stocks") && !!q(".bb-stage"), path());
  } else ok("bubbles-stocks", false, "missing stocks chip");
  const refreshSel = q('.bb-select[title="Auto-refresh rate"]');
  if (refreshSel) {
    refreshSel.value = "15";
    refreshSel.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(250);
    ok("bubbles-refresh", localStorage.getItem("cg-bubbles-refresh") === "15", localStorage.getItem("cg-bubbles-refresh"));
  } else ok("bubbles-refresh", false, "missing refresh select");

  // ---------- funding ----------
  await go("/funding");
  await until(() => q(".lb-row"), 8000);
  const frow = q(".lb-row");
  if (frow) { frow.click(); await sleep(350); ok("funding-row->funding-tab", location.search.includes("tab=funding"), path()); }
  else ok("funding-row->funding-tab", false, "no rows");

  // ---------- movers ----------
  await go("/movers");
  await until(() => q(".lb-row"), 18000);
  const mrow = q(".lb-row");
  if (mrow) { mrow.click(); await sleep(350); ok("movers-row->asset", location.pathname.startsWith("/symbol/"), path()); }
  else ok("movers-row->asset", false, "no rows");

  // ---------- header controls ----------
  await go("/");
  const hdrBtns = qa(".hdr-ctl");
  if (hdrBtns[0]) { hdrBtns[0].click(); await sleep(350); ok("source-menu", !!q(".menu-pop"), "source menu opens"); await closeMenu(); }
  else ok("source-menu", false, "missing");
  if (hdrBtns[1]) { hdrBtns[1].click(); await sleep(350); ok("currency-menu", !!q(".menu-pop"), "currency menu opens"); await closeMenu(); }
  else ok("currency-menu", false, "missing");
  const settingsBtn = qa(".icon-btn").find((b) => b.title === "Settings");
  if (settingsBtn) { settingsBtn.click(); await sleep(300); ok("settings-sheet", !!q(".sheet"), "settings opens"); await closeSheet(); }
  else ok("settings-sheet", false, "missing");
  const search = q(".search-btn");
  if (search) {
    search.click(); await sleep(300);
    ok("command-palette", !!q(".cmd"), "palette opens");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    const overlay = q(".overlay"); if (overlay) overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(200); const ov2 = q(".overlay"); if (ov2) ov2.remove();
  } else ok("command-palette", false, "missing");
  const badge = q(".health-badge");
  if (badge) { badge.click(); await sleep(300); ok("health-badge", !!q(".sheet"), "health drawer opens"); await closeSheet(); }
  else ok("health-badge", false, "missing");

  // Market clock defaults to UTC, exposes every zone on hover, and cycles by click.
  const clock = q(".hdr-clock");
  ok("utc-clock", !!clock && /\d{2}:\d{2}:\d{2} UTC/.test(clock.textContent), (clock || {}).textContent);
  if (clock) {
    clock.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await sleep(180);
    ok("clock-menu", qa(".clock-zone-card").length === 3, `zones=${qa(".clock-zone-card").length}`);
    await closeMenu();
    clock.click(); await sleep(160);
    ok("clock-cycle-ist", /\d{2}:\d{2}:\d{2} IST/.test(clock.textContent), clock.textContent);
    clock.click(); await sleep(160);
    ok("clock-cycle-local", /\d{2}:\d{2}:\d{2} LOCAL/.test(clock.textContent), clock.textContent);
    clock.click(); await sleep(160);
    ok("clock-cycle-utc", /\d{2}:\d{2}:\d{2} UTC/.test(clock.textContent), clock.textContent);
    await closeMenu();
  }

  // market pulse exists as an expandable side drawer, not as a permanent rail
  await go("/");
  const openWire = qa("button").find((b) => /Open wire|Expand/.test(b.textContent || ""));
  if (openWire) { openWire.click(); await sleep(500); }
  await until(() => q(".wire-desk.open .wire-story, .wire-desk.open .wire-empty"), 8000);
  ok("market-pulse", !!q(".wire-desk.open .wire-story") || !!q(".wire-desk.open .wire-empty"),
     `wire stories=${qa(".wire-desk.open .wire-story").length}`);

  // js errors captured across the whole audit
  ok("no-js-errors", (window.__CG_ERRORS__ || []).length === 0, (window.__CG_ERRORS__ || []).join(" | ").slice(0, 300));

  return JSON.stringify(R);
})()
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Click-audit the live app in headless Chrome.")
    parser.add_argument("--base", default="http://127.0.0.1:8765")
    args = parser.parse_args()

    chrome = find_chrome()
    if not chrome:
        print("click_audit: SKIP (no Chrome found)")
        return 0
    try:
        from websockets.sync.client import connect
    except Exception:
        print("click_audit: SKIP (websockets sync client unavailable)")
        return 0

    proc = subprocess.Popen(
        [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
         "--remote-debugging-port=0", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    ws_url = None
    try:
        for line in iter(proc.stderr.readline, ""):
            m = re.search(r"DevTools listening on (ws://\S+)", line)
            if m:
                ws_url = m.group(1)
                break
        if not ws_url:
            print("click_audit: FAIL (no DevTools endpoint)")
            return 1

        seq = itertools.count(1)
        with connect(ws_url, max_size=20_000_000) as ws:
            def cmd(method, params=None, session=None):
                mid = next(seq)
                msg = {"id": mid, "method": method, "params": params or {}}
                if session:
                    msg["sessionId"] = session
                ws.send(json.dumps(msg))
                while True:
                    resp = json.loads(ws.recv(timeout=180))
                    if resp.get("id") == mid:
                        if "error" in resp:
                            raise RuntimeError(f"{method}: {resp['error']}")
                        return resp.get("result", {})

            target = cmd("Target.createTarget", {"url": args.base + "/"})
            session = cmd("Target.attachToTarget", {"targetId": target["targetId"], "flatten": True})["sessionId"]
            cmd("Runtime.enable", session=session)
            time.sleep(2.5)  # first paint + boot
            result = cmd("Runtime.evaluate", {
                "expression": AUDIT_JS, "awaitPromise": True, "returnByValue": True, "timeout": 180000,
            }, session=session)
            value = result.get("result", {}).get("value")
            if not value:
                print("click_audit: FAIL (no report returned):", json.dumps(result)[:300])
                return 1
            report = json.loads(value)
    finally:
        proc.kill()

    failed = [r for r in report if not r["ok"]]
    for r in report:
        print(f"  {'OK  ' if r['ok'] else 'FAIL'} {r['name']:26} {r['detail'][:90]}")
    print(f"\nclick_audit RESULT: {'PASS' if not failed else 'FAIL'} ({len(report) - len(failed)}/{len(report)})")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
