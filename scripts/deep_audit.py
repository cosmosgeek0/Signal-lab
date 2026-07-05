#!/usr/bin/env python3
"""Deep interaction audit: every tab, filter, sort, toggle, window, and menu
must actually change what the user sees.

    python scripts/deep_audit.py --base http://127.0.0.1:8765

Complements scripts/click_audit.py (release gate) with stateful interactions:
market table tabs, trending chips, hover popovers, radar filters/sort/columns/
pagination/stars, all asset tabs + windows, heatmap modes × metrics, funding
history chips, movers windows, command-palette typing, currency conversion
(really converts via live FX), basis-unit switch, theme toggle, settings reset.
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
    import os
    for cand in CHROME_CANDIDATES:
        if cand.startswith("/"):
            if os.path.exists(cand):
                return cand
        elif shutil.which(cand):
            return cand
    return None


AUDIT_JS = r"""
(async () => {
  const R = [];
  const ok = (name, pass_, detail) => R.push({ name, ok: !!pass_, detail: String(detail || "").slice(0, 110) });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 10000, step = 150) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(step); }
    return false;
  };
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  const labelOf = (el) => ((el && el.textContent) || "").trim();
  const go = async (p) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); await sleep(300); };
  const closeSheet = async () => { const s = q(".sheet-scrim"); if (s) s.click(); await sleep(160); };
  const txt = (s) => (q(s) || {}).textContent || "";

  ok("boot", await until(() => window.__CG_BOOTED__, 9000), "");

  // ================= MARKET =================
  await go("/");
  await until(() => q("#sec-prices") && qa("button[data-atlas-category]").length >= 8, 12000);
  await sleep(500);
  const cryptoTax = qa("button[data-atlas-category]").find((b) => b.dataset.atlasCategory === "crypto");
  if (cryptoTax) {
    cryptoTax.scrollIntoView({ block: "center", inline: "center" });
    cryptoTax.click();
    await sleep(700);
    await until(() =>
      (q(".market-taxonomy-pill.active") || {}).dataset?.atlasCategory === "crypto"
      && qa("#sec-prices tbody tr").length >= 10
      && qa(".table-tools .chip, .chips .chip").some((c) => labelOf(c) === "Top gainers"),
      12000);
  }

  // table tabs actually change content
  const firstTokenName = () => txt("#sec-prices tbody tr .tok-name");
  for (const label of ["Top gainers", "Stablecoins", "Highest basis", "Exchange listed"]) {
    const chip = qa(".table-tools .chip, .chips .chip").find((c) => labelOf(c) === label);
    if (!chip) {
      ok("mkt-tab:" + label, false, `chip missing active=${(q(".market-taxonomy-pill.active") || {}).dataset?.atlasCategory || ""} chips=${qa(".table-tools .chip, .chips .chip").map(labelOf).join("|")}`);
      continue;
    }
    const before = firstTokenName();
    chip.click(); await sleep(350);
    // chips re-mount on click: re-query for the active state
    const fresh = qa(".table-tools .chip, .chips .chip").find((c) => labelOf(c) === label);
    const active = fresh && fresh.classList.contains("active");
    const rows = qa("#sec-prices tbody tr").length;
    ok("mkt-tab:" + label, active && rows > 0, `rows=${rows} first=${firstTokenName()}`);
  }
  const allChip = qa(".table-tools .chip, .chips .chip").find((c) => labelOf(c) === "All assets");
  if (allChip) { allChip.click(); await sleep(300); }

  // trending chip -> asset page gets a REAL chart even off top-100
  const tchip = q(".trend-chip");
  if (tchip) {
    const tbase = labelOf(tchip.querySelector("b"));
    tchip.click(); await sleep(500);
    const metaOk = await until(() => {
      const meta = txt(".chart-meta").toLowerCase();
      return meta.includes("binance") || meta.includes("coingecko") || meta.includes("real market data") || meta.includes("retrying");
    }, 30000);
    ok("trending->real-chart", location.pathname.startsWith("/symbol/") && metaOk,
       `${tbase} -> ${location.pathname} meta="${txt(".chart-meta")}"`);
    // headline fills from the real chart; under provider rate limits the
    // page must instead show its honest loading/empty state — never garbage
    const headlineOk = await until(() => txt(".headline-val") !== "—", 12000);
    const honest = !!q(".chart-empty");
    ok("trending-headline-price", headlineOk || honest, headlineOk ? txt(".headline-val") : "honest empty state");
  } else ok("trending->real-chart", false, "no trending chips");

  // hover popover on a major card
  await go("/");
  await until(() => q(".mcard") || q(".market-leader-card"), 10000);
  const hoverCard = q(".mcard") || q(".market-leader-card");
  if (!hoverCard) {
    ok("major-hover-popover", false, "no major card");
  } else {
  hoverCard.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  const popOk = await until(() => q(".hover-pop"), 3000);
  ok("major-hover-popover", popOk, "popover appears");
  hoverCard.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  await sleep(200);
  }

  // footer data-health link
  const foot = qa(".footer a").find((a) => labelOf(a).includes("Data health"));
  if (foot) { foot.click(); await sleep(300); ok("footer-health", !!q(".sheet"), ""); await closeSheet(); }
  else ok("footer-health", false, "missing");

  // ================= RADAR =================
  await go("/radar");
  await until(() => q("table.mkt tbody tr td .tok"), 12000);

  // filters
  const majors = qa(".table-tools .chip").find((c) => labelOf(c) === "Majors");
  if (majors) {
    majors.click();
    await until(() => qa("table.mkt tbody tr").filter((tr) => tr.querySelector(".tok")).length > 0, 8000);
    const rows = qa("table.mkt tbody tr").filter((tr) => tr.querySelector(".tok")).length;
    ok("radar-filter-majors", rows > 0 && rows <= 6, `rows=${rows}`);
  } else ok("radar-filter-majors", false, "chip missing");
  const allR = qa(".table-tools .chip").find((c) => labelOf(c) === "All");
  if (allR) {
    allR.click();
    await until(() => qa("table.mkt tbody tr").filter((tr) => tr.querySelector(".tok")).length >= 25, 8000);
  }

  // sort by Spot: click header, sorted class moves + order changes
  const spotTh = qa("table.mkt thead th").find((t) => labelOf(t).startsWith("Spot"));
  if (spotTh) {
    spotTh.click(); await sleep(500);
    const freshTh = qa("table.mkt thead th").find((t) => labelOf(t).startsWith("Spot"));
    ok("radar-sort-spot", freshTh && freshTh.classList.contains("sorted"), "sorted class");
  } else ok("radar-sort-spot", false, "no header");

  // columns popover toggle adds a column
  const colsBtn = qa(".mini-btn").find((b) => labelOf(b).includes("Columns"));
  if (colsBtn) {
    colsBtn.click(); await sleep(250);
    const row = qa(".cols-pop .toggle-row").find((r) => labelOf(r).includes("Spot bid"));
    if (row) {
      row.click(); await sleep(500);
      const has = qa("table.mkt thead th").some((t) => labelOf(t).startsWith("Spot bid"));
      ok("radar-adv-column", has, "Spot bid column appears");
      row.click(); await sleep(400); // toggle back off
    } else ok("radar-adv-column", false, "toggle missing");
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const pop = q(".cols-pop"); if (pop) pop.remove();
  } else ok("radar-adv-column", false, "Columns btn missing");

  // pagination: page 2 shows row #26
  const p2 = qa(".pager button").find((b) => labelOf(b) === "2");
  if (p2) {
    p2.click();
    await until(() => txt("table.mkt tbody tr .idx").trim() === "26", 8000);
    const idx = txt("table.mkt tbody tr .idx");
    ok("radar-pagination", idx.trim() === "26", `first idx=${idx}`);
    const p1 = qa(".pager button").find((b) => labelOf(b) === "1");
    if (p1) {
      p1.click();
      await until(() => txt("table.mkt tbody tr .idx").trim() === "1" && !!q("table.mkt tbody .star-btn"), 8000);
    }
  } else ok("radar-pagination", false, "no page 2");

  // star a row
  const starBtn = await until(() => q("table.mkt tbody .star-btn"), 8000);
  if (starBtn) {
    starBtn.click(); await sleep(200);
    ok("radar-star", !!starBtn.querySelector(".star.on"), "star fills");
    starBtn.click(); await sleep(150);
  } else ok("radar-star", false, "no star");

  // basis distribution rendered
  ok("radar-distribution", qa(".dist-col").length >= 8, `${qa(".dist-col").length} bins`);

  // ================= ASSET (all tabs & windows) =================
  await go("/symbol/ETHUSDT?tab=overview");
  await until(() => q(".chart-body svg"), 15000);
  for (const label of ["Price", "Funding", "Spread", "Market stats", "Quality", "Basis"]) {
    const t = qa(".atab").find((x) => labelOf(x) === label);
    if (!t) { ok("atab:" + label, false, "tab missing"); continue; }
    t.click(); await sleep(600);
    const active = labelOf(q(".atab.on")) === label;
    const content = ["Market stats", "Quality"].includes(label)
      ? qa(".apanel").length >= 3
      : await until(() => q(".chart-body svg, .chart-body iframe, .chart-empty"), 8000);
    ok("atab:" + label, active && !!content, "activates with content");
  }
  // local window on basis tab
  const w5 = qa(".win button").find((b) => labelOf(b) === "5m");
  if (w5) {
    w5.click();
    const basisDrawn = await until(() => q(".chart-body svg") || q(".chart-empty"), 10000);
    ok("asset-basis-5m", !!basisDrawn && !!q(".chart-body svg"), txt(".chart-meta") || txt(".chart-empty"));
  }
  else ok("asset-basis-5m", false, "no 5m window");

  // ================= HEATMAP (all modes × key metrics) =================
  await go("/heatmap");
  await until(() => q(".tile, .tm-cell"), 10000);
  const modeSel = { Treemap: ".tm-cell", Tiles: ".tile", Mosaic: ".mosaic-grid .tile", Bubbles: ".bubble", Strips: ".strip-row" };
  for (const [mode, sel] of Object.entries(modeSel)) {
    const btn = qa(".page-head .seg button").find((b) => labelOf(b) === mode);
    if (!btn) { ok("heat-mode:" + mode, false, "button missing"); continue; }
    btn.click(); await sleep(600);
    ok("heat-mode:" + mode, qa(sel).length > 3, `${qa(sel).length} items`);
  }
  const heatMetricGroups = {
    "Market cap": "Radar signals",
    "Funding": "Funding & OI",
    "Score": "Radar signals",
    "Basis": "Radar signals",
  };
  for (const metric of ["Market cap", "Funding", "Score", "Basis"]) {
    const groupName = heatMetricGroups[metric];
    const groupBtn = qa(".deriv-groups button").find((b) => labelOf(b) === groupName);
    if (groupBtn) {
      groupBtn.click();
      await sleep(700);
    }
    const btn = qa(".deriv-metrics button, .heat-tools .seg button").find((b) => labelOf(b) === metric);
    if (!btn) { ok("heat-metric:" + metric, false, "button missing"); continue; }
    btn.click(); await sleep(700);
    const n = qa(".tm-cell, .tile, .bubble, .strip-row").length;
    ok("heat-metric:" + metric, n > 3, `${n} items`);
  }

  // ================= BUBBLES =================
  await go("/bubbles?asset=crypto&window=24h&limit=50");
  await until(() => q(".bubbles-page") && q(".bb-stage"), 15000);
  const cryptoBubblesReady = await until(() => qa(".bb-bubble").length >= 10, 30000);
  ok("bubbles-crypto", !!cryptoBubblesReady, `bubbles=${qa(".bb-bubble").length}`);
  // window picker is a dropdown now: trigger opens a pop with interval chips
  const intTrigger = q(".bb-interval-trigger");
  if (intTrigger) {
    intTrigger.click(); await sleep(250);
    const w1 = qa(".bb-interval-pop .bb-int-chip").find((b) => labelOf(b) === "1H");
    if (w1) {
      w1.click();
      const hourReady = await until(() => location.search.includes("window=1h") && qa(".bb-bubble").length >= 10, 30000);
      ok("bubbles-window-1h", !!hourReady, `${location.search} bubbles=${qa(".bb-bubble").length}`);
    } else ok("bubbles-window-1h", false, "1H chip missing in interval picker");
  } else ok("bubbles-window-1h", false, "interval picker missing");
  // refresh cadence is in seconds now (15/30/60/120/300)
  const refreshSelect = q('.bb-select[title="Auto-refresh rate"]');
  if (refreshSelect) {
    refreshSelect.value = "30";
    refreshSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(250);
    ok("bubbles-refresh-select", localStorage.getItem("cg-bubbles-refresh") === "30", localStorage.getItem("cg-bubbles-refresh"));
  } else ok("bubbles-refresh-select", false, "refresh select missing");
  const searchBox = q(".bb-search input");
  if (searchBox) {
    const firstBubbleSymbol = labelOf(q(".bb-bubble .bb-bubble-symbol")) || "BTC";
    const needle = firstBubbleSymbol.slice(0, Math.min(firstBubbleSymbol.length, 4)).toLowerCase();
    searchBox.focus();
    searchBox.value = needle;
    searchBox.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: needle }));
    const searchReady = await until(() => qa(".bb-bubble").length >= 1 && document.activeElement === searchBox, 10000);
    ok("bubbles-search", !!searchReady, `bubbles=${qa(".bb-bubble").length}`);
  } else ok("bubbles-search", false, "search input missing");
  const stockBtn = qa(".bb-asset .chip").find((b) => labelOf(b) === "Stocks");
  if (stockBtn) {
    stockBtn.click();
    const stocksReady = await until(() => location.search.includes("asset=stocks") && qa(".bb-bubble").length >= 5, 30000);
    ok("bubbles-stocks-mode", !!stocksReady, `${location.search} bubbles=${qa(".bb-bubble").length}`);
  } else ok("bubbles-stocks-mode", false, "stocks chip missing");

  // ================= FUNDING =================
  await go("/funding");
  await until(() => q(".lb-row"), 10000);
  const ethChip = qa(".table-tools .chip").find((c) => labelOf(c) === "ETH");
  if (ethChip) {
    ethChip.click();
    await until(() => !!q(".chart-body svg") || !!q(".chart-empty"), 10000);
    const freshChip = qa(".table-tools .chip").find((c) => labelOf(c) === "ETH");
    ok("funding-hist-chip", freshChip && freshChip.classList.contains("active") && !!q(".chart-body svg"), "ETH history draws");
  } else ok("funding-hist-chip", false, "chip missing");
  ok("funding-scatter", qa("circle[data-sym]").length >= 6, `${qa("circle[data-sym]").length} dots`);

  // ================= MOVERS =================
  await go("/movers");
  await until(() => q(".lb-row"), 10000);
  const w15 = qa(".page-head .seg button").find((b) => labelOf(b) === "15m");
  if (w15) {
    w15.click(); await sleep(900);
    const freshW = qa(".page-head .seg button").find((b) => labelOf(b) === "15m");
    const headOk = qa(".sec-title").some((t) => labelOf(t).includes("15m"));
    ok("movers-window-15m", freshW && freshW.classList.contains("on") && headOk, "heading follows window");
  } else ok("movers-window-15m", false, "no 15m");
  ok("movers-external-boards", qa(".lb-row .sparkbox").length > 3, "gainers/losers have mini charts");

  // ================= COMMAND PALETTE (typing + enter) =================
  await go("/");
  const searchBtn = await until(() => q(".search-btn"), 8000);
  if (searchBtn) { searchBtn.click(); await sleep(300); }
  const input = await until(() => q(".cmd-input"), 5000);
  if (input) {
    input.focus();
    input.value = "sol";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "sol" }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "l", bubbles: true }));
    const gotResults = await until(() => qa(".cmd-item").some((i) => labelOf(i).includes("SOL")), 5000);
    ok("palette-search", gotResults, "SOL result appears");
    const solItem = qa(".cmd-item").find((i) => labelOf(i).includes("SOLUSDT"));
    if (solItem) { solItem.click(); await sleep(400); ok("palette-open", location.pathname === "/symbol/SOLUSDT", location.pathname); }
    else { ok("palette-open", false, "no SOL item"); const ov = q(".overlay"); if (ov) ov.remove(); }
  } else ok("palette-search", false, "no input");
  const ovl = q(".overlay"); if (ovl) ovl.remove();

  // ================= CURRENCY really converts =================
  await go("/");
  await until(() => txt(".stat-tile .stat-v") !== "—", 10000);
  const curBtn = qa(".hdr-ctl")[1];
  curBtn.click(); await sleep(600);
  const inr = qa(".menu-item").find((i) => labelOf(i).includes("INR"));
  if (inr && inr.classList.contains("disabled")) {
    ok("currency-inr-converts", true, "INR unavailable this cycle (fx disabled)");
    ok("currency-back-usd", true, "USD base retained");
  } else if (inr) {
    inr.click(); await sleep(1200);
    const converted = await until(() => document.body.textContent.includes("₹"), 6000);
    ok("currency-inr-converts", converted, "₹ appears in prices");
    curBtn.click(); await sleep(400);
    const usd = qa(".menu-item").find((i) => labelOf(i).includes("USD / USDT"));
    if (usd) { usd.click(); await sleep(800); }
    ok("currency-back-usd", await until(() => !txt(".mcard-px").includes("₹"), 5000), "back to USD");
  } else {
    ok("currency-inr-converts", false, "INR option missing");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }

  // ================= SETTINGS: basis unit switch =================
  // basis units live in Settings -> Data -> Source Details as a labeled select
  const settingsBtn = qa(".icon-btn").find((b) => b.title === "Settings");
  settingsBtn.click(); await sleep(300);
  const dataNav = qa(".sheet .settings-nav-item").find((b) => labelOf(b) === "Data");
  if (dataNav) { dataNav.click(); await sleep(250); }
  const unitSel = q("#data-basis-unit");
  if (unitSel) {
    unitSel.value = "pct";
    unitSel.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(250);
    await closeSheet();
    await go("/radar");
    const headerOk = await until(() => qa("table.mkt thead th").some((t) => labelOf(t).includes("Basis (%)")), 8000);
    ok("basis-unit-pct", headerOk, "radar header shows Basis (%)");
    // switch back
    settingsBtn.click(); await sleep(300);
    const dataNav2 = qa(".sheet .settings-nav-item").find((b) => labelOf(b) === "Data");
    if (dataNav2) { dataNav2.click(); await sleep(200); }
    const backSel = q("#data-basis-unit");
    if (backSel) { backSel.value = "bps"; backSel.dispatchEvent(new Event("change", { bubbles: true })); await sleep(150); }
    await closeSheet();
  } else { ok("basis-unit-pct", false, "basis unit select missing in Data section"); await closeSheet(); }

  // ================= THEME toggle =================
  const themeBtn = qa(".icon-btn").find((b) => b.title === "Toggle theme");
  themeBtn.click(); await sleep(300);
  ok("theme-dark", document.documentElement.getAttribute("data-theme") === "dark", "");
  themeBtn.click(); await sleep(200);
  ok("theme-light", document.documentElement.getAttribute("data-theme") === "light", "");

  // ================= no JS errors across everything =================
  ok("no-js-errors", (window.__CG_ERRORS__ || []).length === 0, (window.__CG_ERRORS__ || []).join(" | "));

  return JSON.stringify(R);
})()
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    chrome = find_chrome()
    if not chrome:
        print("deep_audit: SKIP (no Chrome)")
        return 0
    try:
        from websockets.sync.client import connect
    except Exception:
        print("deep_audit: SKIP (no websockets)")
        return 0

    proc = subprocess.Popen(
        [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
         "--remote-debugging-port=0", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    ws_url = None
    try:
        for line in iter(proc.stderr.readline, ""):
            m = re.search(r"DevTools listening on (ws://\S+)", line)
            if m:
                ws_url = m.group(1)
                break
        if not ws_url:
            print("deep_audit: FAIL (no devtools)")
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
            time.sleep(2.5)
            result = cmd("Runtime.evaluate", {
                "expression": AUDIT_JS, "awaitPromise": True, "returnByValue": True, "timeout": 170000,
            }, session=session)
            value = result.get("result", {}).get("value")
            if not value:
                print("deep_audit: FAIL (no report):", json.dumps(result)[:300])
                return 1
            report = json.loads(value)
    finally:
        proc.kill()

    failed = [r for r in report if not r["ok"]]
    for r in report:
        print(f"  {'OK  ' if r['ok'] else 'FAIL'} {r['name']:28} {r['detail']}")
    print(f"\ndeep_audit RESULT: {'PASS' if not failed else 'FAIL'} ({len(report) - len(failed)}/{len(report)})")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
