#!/usr/bin/env python3
"""Browser click audit: every clickable-looking element must DO something.

    python scripts/click_audit.py --base http://127.0.0.1:8765

Drives headless Chrome over CDP and clicks through the real product:
nav items, market cards (detail sheets), source labels, majors, table rows
(full asset page with tabs — NOT a basis-only page), radar rows (?tab=basis),
heatmap cells, funding/movers rows, header controls (source / currency /
settings / search) and the health badge. Fails if a click does nothing, a
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
  const closeSheet = async () => { const s = q(".sheet-scrim"); if (s) s.click(); await sleep(150); };
  const closeMenu = async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await sleep(120); };

  // boot
  ok("boot", await until(() => window.__CG_BOOTED__, 8000), "app booted");

  // ---------- nav ----------
  await go("/");
  for (const [route, label] of [["radar","Radar"],["heatmap","Heatmap"],["funding","Funding"],["movers","Movers"],["market","Market"]]) {
    const a = qa(".nav a").find((x) => x.dataset.route === route);
    if (!a) { ok("nav:" + route, false, "nav item missing"); continue; }
    a.click(); await sleep(250);
    const expected = route === "market" ? "/" : "/" + route;
    ok("nav:" + route, location.pathname === expected, `pathname=${location.pathname}`);
    ok("nav-active:" + route, a.classList.contains("active"), "active class");
  }

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

  // ---------- majors -> FULL asset page ----------
  await until(() => q(".mcard"), 8000);
  const mcard = q(".mcard");
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
    const t = (q(".chart-meta") || {}).textContent || "";
    return t.includes("coingecko") || t.includes("retrying");
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
  const xmrOk = await until(() => q(".chart-body svg") && (q(".chart-meta") || {}).textContent.includes("real market data"), 26000);
  const retrying = (q(".chart-meta") || {}).textContent.includes("retrying");
  ok("non-binance-coin-chart", xmrOk || retrying, (q(".chart-meta") || {}).textContent);

  // ---------- market table row ----------
  await go("/");
  await until(() => q("table.mkt tbody tr td"), 10000);
  const row = q("table.mkt tbody tr");
  if (row) {
    row.click(); await sleep(400);
    ok("table-row->asset", location.pathname.startsWith("/symbol/") && qa(".atab").length >= 8, path());
  } else ok("table-row->asset", false, "no rows");

  // ---------- v9: sortable table headers ----------
  await go("/");
  await until(() => q("table.mkt tbody tr td"), 10000);
  const firstTok = () => (q("table.mkt tbody tr .tok-sub") || {}).textContent || "";
  const before = firstTok();
  const priceTh = qa("th.th-sort").find((t) => t.textContent.startsWith("Price"));
  if (priceTh) {
    priceTh.click(); await sleep(350);
    const sortedDesc = firstTok();
    ok("table-sort-price", sortedDesc.startsWith("BTC"), `first row after sort=${sortedDesc} (was ${before})`);
    priceTh.click(); await sleep(350);
    ok("table-sort-price-asc", firstTok() !== sortedDesc, "ascending flips order");
    priceTh.click(); await sleep(250);   // back to default
  } else ok("table-sort-price", false, "no sortable Price header");
  // signed % cells must be COLORED green/red — a bare td rule once overrode
  // .up/.down and every percentage rendered grey; this pins the fix forever
  const upCell = q("table.mkt tbody td.up");
  const downCell = q("table.mkt tbody td.down");
  const plainCell = qa("table.mkt tbody td").find((t) => !t.classList.contains("up") && !t.classList.contains("down") && t.classList.contains("num"));
  const colored = upCell && plainCell && getComputedStyle(upCell).color !== getComputedStyle(plainCell).color
    && (!downCell || getComputedStyle(downCell).color !== getComputedStyle(plainCell).color);
  ok("pct-cells-colored", !!colored,
     `up=${upCell ? getComputedStyle(upCell).color : "n/a"} plain=${plainCell ? getComputedStyle(plainCell).color : "n/a"}`);

  // basis column stays OUT of the default view (Radar owns basis)
  const headTxt = qa("table.mkt thead th").map((t) => t.textContent).join("|");
  ok("table-no-basis-by-default", !headTxt.includes("Basis"), headTxt);
  const binChip = qa(".chips .chip").find((c) => c.textContent === "Binance-listed");
  if (binChip) {
    binChip.click(); await sleep(400);
    const headTxt2 = qa("table.mkt thead th").map((t) => t.textContent).join("|");
    ok("table-basis-on-binance-tab", headTxt2.includes("Basis"), headTxt2);
    const allChip = qa(".chips .chip").find((c) => c.textContent === "All assets");
    if (allChip) { allChip.click(); await sleep(300); }
  } else ok("table-basis-on-binance-tab", false, "no Binance-listed chip");

  // ---------- v9: tokenized stocks ----------
  await go("/");
  const stocksOk = await until(() => q(".stock-card .sc-px") && (q(".stock-card .sc-px") || {}).textContent !== "—", 15000);
  ok("stocks-strip", stocksOk, "stock cards render with real prices n=" + qa(".stock-card").length);
  const scard = q(".stock-card");
  if (scard) {
    const tick = (scard.querySelector(".tok-name") || {}).textContent;
    scard.click(); await sleep(700);
    ok("stock->asset-page", location.pathname === "/symbol/" + tick, path() + " (ticker " + tick + ")");
    const stockChartOk = await until(() => q(".chart-body svg"), 20000);
    const stockRetry = ((q(".chart-meta") || {}).textContent || "").includes("retrying");
    ok("stock-asset-chart", stockChartOk || stockRetry, (q(".chart-meta") || {}).textContent);
    await go("/");
  } else { ok("stock->asset-page", false, "no stock card"); ok("stock-asset-chart", false, "no stock card"); }
  // stocks tab in the table
  const stChip = qa(".chips .chip").find((c) => c.textContent === "Stocks");
  if (stChip) {
    stChip.click(); await sleep(400);
    const sub = (q("table.mkt tbody tr .tok-sub") || {}).textContent || "";
    ok("table-stocks-tab", sub.includes("stock"), "first row sub=" + sub);
    const allChip2 = qa(".chips .chip").find((c) => c.textContent === "All assets");
    if (allChip2) { allChip2.click(); await sleep(250); }
  } else ok("table-stocks-tab", false, "no Stocks chip");

  // ---------- v9: non-line visuals + news lead ----------
  ok("dominance-donut", !!q('.stat-tile[data-card="dom"] .stat-spark circle'), "donut segments render");
  ok("dex-bars", qa('.stat-tile[data-card="dex"] .stat-spark rect').length >= 3, "daily volume bars render");
  const leadOk = await until(() => q(".nr-lead .nr-lead-title"), 10000);
  ok("news-lead", leadOk, "lead story card renders");
  ok("news-favicons", qa(".news-rail .nr-fav").length >= 3, "source favicons n=" + qa(".news-rail .nr-fav").length);

  // ---------- radar ----------
  await go("/radar");
  await until(() => q("table.mkt tbody tr td .tok"), 10000);
  const rrow = q("table.mkt tbody tr");
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

  // ---------- funding ----------
  await go("/funding");
  await until(() => q(".lb-row"), 8000);
  const frow = q(".lb-row");
  if (frow) { frow.click(); await sleep(350); ok("funding-row->funding-tab", location.search.includes("tab=funding"), path()); }
  else ok("funding-row->funding-tab", false, "no rows");

  // ---------- movers ----------
  await go("/movers");
  await until(() => q(".lb-row"), 8000);
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

  // UTC clock ticking
  const clock = q(".hdr-clock");
  ok("utc-clock", !!clock && /\d{2}:\d{2}:\d{2} UTC/.test(clock.textContent), (clock || {}).textContent);

  // market pulse section exists (real items or polished state)
  await go("/");
  await until(() => q(".nr-item, .pulse-card, .ghost-tile"), 8000);
  ok("market-pulse", !!q(".nr-item") || !!q(".pulse-card") || qa(".ghost-tile").length > 0,
     `news rail items=${qa(".nr-item").length}`);

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
                    resp = json.loads(ws.recv(timeout=90))
                    if resp.get("id") == mid:
                        if "error" in resp:
                            raise RuntimeError(f"{method}: {resp['error']}")
                        return resp.get("result", {})

            target = cmd("Target.createTarget", {"url": args.base + "/"})
            session = cmd("Target.attachToTarget", {"targetId": target["targetId"], "flatten": True})["sessionId"]
            cmd("Runtime.enable", session=session)
            time.sleep(2.5)  # first paint + boot
            result = cmd("Runtime.evaluate", {
                "expression": AUDIT_JS, "awaitPromise": True, "returnByValue": True, "timeout": 120000,
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
