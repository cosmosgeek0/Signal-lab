"""HTML shell for the CosmosGeek Radar frontend.

The actual product lives in ``bslab/static/app/`` (ES-module JS + CSS) and is
served straight from ``/static/app/`` by Starlette. This module only holds the
minimal document shell.

Server contract preserved for ``web_app.py``:

* ``"__CG_BOOTSTRAP_JSON__"`` is replaced with the compact ``state-lite`` JSON
  object so the first paint has data with no extra request.
* ``"__CG_ICONS__"`` is replaced with the JSON array of token bases that have a
  bundled SVG icon (the client uses it to pick a real icon vs. a monogram).

Bump ``ASSET_VERSION`` whenever the CSS/JS under ``static/app`` changes so
browsers/CDN drop the old cached bundle.
"""
from __future__ import annotations

ASSET_VERSION = "r20"

INDEX_HTML = (
    r"""<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="CosmosGeek Radar - world markets, crypto basis/funding radar and a live news wire. Public data only, research only.">
  <title>CosmosGeek Radar</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%230b0e11'/%3E%3Ccircle cx='16' cy='16' r='10.6' fill='none' stroke='%232b313a' stroke-width='1.1'/%3E%3Ccircle cx='16' cy='16' r='6.2' fill='none' stroke='%232b313a' stroke-width='1.1'/%3E%3Cline x1='16' y1='16' x2='24.4' y2='8.4' stroke='%23f0b90b' stroke-width='1.7' stroke-linecap='round'/%3E%3Ccircle cx='21.4' cy='20.2' r='1.8' fill='%23f0b90b'/%3E%3Ccircle cx='16' cy='16' r='1.5' fill='%23e9edf3'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="/static/app/app.css?v=__CG_VER__">
  <script>
    (function () {
      try {
        var t = localStorage.getItem('cg-theme');
        if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
      } catch (e) {}
    })();
  </script>
</head>
<body>
  <div id="app" class="app-root"></div>
  <script>
    window.__CG_BOOT__ = "__CG_BOOTSTRAP_JSON__";
    window.__CG_ICONS__ = "__CG_ICONS__";
  </script>
  <script>
    /* Boot watchdog: the app must NEVER silently show a blank page. Collect
       startup errors (module link failures included, via capture) and, if the
       app has not mounted within 6s, render a readable failure panel. main.js
       sets window.__CG_BOOTED__ once the first screen renders. */
    (function () {
      var errs = window.__CG_ERRORS__ = [];
      function push(msg) { if (msg && errs.length < 8) errs.push(String(msg)); }
      window.addEventListener("error", function (e) {
        if (e && e.message) push(e.message + (e.filename ? "  @ " + String(e.filename).split("/").pop() + ":" + e.lineno : ""));
        /* IMG failures are normal (icon resolver walks a fallback chain);
           only script/style load failures indicate a broken boot. */
        else if (e && e.target && e.target.src && e.target.tagName !== "IMG") push("Failed to load: " + e.target.src);
      }, true);
      window.addEventListener("unhandledrejection", function (e) {
        push("Promise rejection: " + ((e.reason && (e.reason.message || e.reason)) || "unknown"));
      });
      window.__CG_BOOT_WATCHDOG__ = setTimeout(function () {
        var app = document.getElementById("app");
        if (window.__CG_BOOTED__ || (app && app.childElementCount > 0)) return;
        var esc = function (s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
        var box = document.createElement("div");
        box.id = "cg-boot-error";
        box.style.cssText = "max-width:680px;margin:70px auto;padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e2329;background:#fff;border:1px solid #e4e7ec;border-radius:16px;box-shadow:0 12px 40px -12px rgba(16,20,28,.26)";
        box.innerHTML =
          '<div style="font-size:18px;font-weight:700;margin-bottom:6px">CosmosGeek Radar could not start</div>' +
          '<div style="color:#808a9d;font-size:13.5px;line-height:1.6">The page loaded but the app failed to boot. This is usually a stale cached script or a blocked module.</div>' +
          (errs.length
            ? '<pre style="margin:14px 0 0;padding:12px 14px;background:#f5f6f8;border-radius:10px;font-size:12px;line-height:1.5;white-space:pre-wrap;color:#b3261e">' + errs.map(esc).join("\n") + "</pre>"
            : '<pre style="margin:14px 0 0;padding:12px 14px;background:#f5f6f8;border-radius:10px;font-size:12px;color:#808a9d">No JavaScript error was captured - the module graph may have failed to load. Hard-reload to bypass the cache.</pre>') +
          '<div style="margin-top:16px;display:flex;gap:10px;align-items:center">' +
          '<button id="cg-boot-reload" style="height:36px;padding:0 18px;border-radius:999px;border:0;background:#0b0e11;color:#fff;font-weight:650;font-size:13px;cursor:pointer">Reload</button>' +
          '<a href="/api/health" style="height:36px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;border:1px solid #e4e7ec;color:#363c45;text-decoration:none;font-size:13px">Check /api/health</a></div>';
        (app || document.body).appendChild(box);
        var btn = document.getElementById("cg-boot-reload");
        if (btn) btn.addEventListener("click", function () { location.reload(); });
      }, 6000);
    })();
  </script>
  <script type="module" src="/static/app/main.js?v=__CG_VER__"></script>
  <noscript>
    <div style="max-width:640px;margin:80px auto;padding:0 24px;font-family:system-ui;color:#1e2329">
      <h1 style="font-size:20px">CosmosGeek Radar</h1>
      <p style="color:#707a8a">This market terminal needs JavaScript enabled. The public JSON API
      remains available at <code>/api/state</code>, <code>/api/radar</code> and related endpoints.</p>
    </div>
  </noscript>
</body>
</html>
"""
).replace("__CG_VER__", ASSET_VERSION)
