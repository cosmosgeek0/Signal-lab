"""Boot smoke tests: the app must never ship a silently blank page.

Covers the three blank-page classes:
* shell regressions (brand/bootstrap/fallback missing from the HTML),
* stale-cache module graphs (Cache-Control headers),
* broken ES-module graphs (missing files / missing named exports).
"""
from __future__ import annotations

import importlib.util
import re
import sqlite3
import time
from pathlib import Path

import web_app
from bslab import web_cache, web_queries

ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "bslab" / "static" / "app"

SCHEMA = """
CREATE TABLE basis_snapshots (
  ts_ms INTEGER NOT NULL, symbol TEXT NOT NULL,
  spot_bid REAL NOT NULL, spot_ask REAL NOT NULL,
  fut_bid REAL NOT NULL, fut_ask REAL NOT NULL,
  mark_price REAL NOT NULL, funding_rate REAL NOT NULL,
  spot_to_perp_bps REAL NOT NULL, perp_to_spot_bps REAL NOT NULL,
  spot_age_sec REAL NOT NULL, fut_age_sec REAL NOT NULL, mark_age_sec REAL NOT NULL
);
"""


def setup_function():
    web_cache.CACHE.reset()


def make_client(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return None
    from starlette.testclient import TestClient

    db = tmp_path / "boot.sqlite"
    ts = int(time.time() * 1000)
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (ts, "BTCUSDT", 100.0, 100.1, 100.2, 100.3, 100.25, 0.0001, 12.0, -20.0, 1.0, 1.1, 1.2),
        )
    monkeypatch.setattr(web_app, "DB_PATH", str(db))
    monkeypatch.setattr(web_queries, "DB_PATH", str(db))
    web_cache.CACHE.reset()
    return TestClient(web_app.app)


def test_homepage_shell_is_bootable(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    resp = client.get("/")
    html = resp.text
    assert resp.status_code == 200
    assert "CG Signal Lab" in html                       # brand visible
    assert '"__CG_BOOTSTRAP_JSON__"' not in html         # snapshot injected
    assert '"__CG_ICONS__"' not in html.split("__CG_ICONS__ =")[-1][:24]
    assert "/static/app/main.js" in html                 # module entry present
    assert "__CG_BOOT_WATCHDOG__" in html                # blank-page fallback wired
    assert "cg-boot-error" in html                       # fallback panel code present
    # The shell must never be cached (stale shell -> stale module graph).
    assert resp.headers.get("cache-control") == "no-store"


def test_static_modules_send_no_cache(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    r = client.get("/static/app/main.js")
    assert r.status_code == 200
    assert "no-cache" in r.headers.get("cache-control", "")
    r2 = client.get("/static/app/lib/format.js")
    assert r2.status_code == 200
    assert "no-cache" in r2.headers.get("cache-control", "")


IMPORT_RE = re.compile(r'import\s+(?:[A-Za-z0-9_$]+\s*,\s*)?(?:\{([^}]*)\})?\s*from\s*["\']([^"\']+)["\']')
DYNAMIC_RE = re.compile(r'import\(\s*["\']([^"\']+)["\']\s*\)')
EXPORT_RE = re.compile(r'export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)')
EXPORT_NAMED_RE = re.compile(r'export\s*\{([^}]*)\}')


def module_exports(path: Path) -> set:
    txt = path.read_text()
    names = set(EXPORT_RE.findall(txt))
    for group in EXPORT_NAMED_RE.findall(txt):
        for part in group.split(","):
            part = part.strip().split(" as ")[-1].strip()
            if part:
                names.add(part)
    return names


def test_es_module_graph_is_complete():
    """Every relative import (static or dynamic) must resolve to an existing,
    non-empty file, and every named import must be a real export. A broken
    graph is exactly what boots to a blank page."""
    files = sorted(APP_DIR.rglob("*.js"))
    assert (APP_DIR / "main.js") in files
    exports = {f.resolve(): module_exports(f) for f in files}
    problems = []
    for f in files:
        assert f.stat().st_size > 0, f"empty module: {f}"
        txt = f.read_text()
        targets = [(m.group(1), m.group(2)) for m in IMPORT_RE.finditer(txt)]
        targets += [(None, p) for p in DYNAMIC_RE.findall(txt)]
        for named, rel in targets:
            if not rel.startswith("."):
                continue
            target = (f.parent / rel).resolve()
            if not target.exists():
                problems.append(f"{f.name}: missing import target {rel}")
                continue
            for n in (named or "").split(","):
                local = n.strip().split(" as ")[0].strip()
                if local and local not in exports.get(target, set()):
                    problems.append(f"{f.name}: '{local}' not exported by {rel}")
    assert not problems, "\n".join(problems)


def test_boot_beacon_present():
    main = (APP_DIR / "main.js").read_text()
    assert "__CG_BOOTED__" in main   # main.js must signal the watchdog
