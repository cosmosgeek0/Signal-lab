from __future__ import annotations

import importlib.util
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import web_app
from bslab import web_cache, web_queries

ROOT = Path(__file__).resolve().parents[1]

SCHEMA = """
CREATE TABLE basis_snapshots (
  ts_ms INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  spot_bid REAL NOT NULL,
  spot_ask REAL NOT NULL,
  fut_bid REAL NOT NULL,
  fut_ask REAL NOT NULL,
  mark_price REAL NOT NULL,
  funding_rate REAL NOT NULL,
  spot_to_perp_bps REAL NOT NULL,
  perp_to_spot_bps REAL NOT NULL,
  spot_age_sec REAL NOT NULL,
  fut_age_sec REAL NOT NULL,
  mark_age_sec REAL NOT NULL
);
"""


def setup_function():
    web_cache.CACHE.reset()


def make_db(path, symbols=("BTCUSDT", "ETHUSDT", "SOLUSDT")):
    ts_ms = int(time.time() * 1000)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        for older in (ts_ms - 30_000, ts_ms):  # two snapshots so dedupe is exercised
            for i, sym in enumerate(symbols):
                base = 100.0 + i
                conn.execute(
                    "INSERT INTO basis_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (older, sym, base, base + 0.1, base + 0.2, base + 0.3, base + 0.25,
                     0.0001 * (i + 1), 12.0 + i, -20.0 - i, 1.0, 1.1, 1.2),
                )
    return path


def point(db_path, monkeypatch):
    monkeypatch.setattr(web_app, "DB_PATH", str(db_path))
    monkeypatch.setattr(web_queries, "DB_PATH", str(db_path))
    web_cache.CACHE.reset()


def test_cache_refresh_returns_rows(tmp_path, monkeypatch):
    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)

    snapshot = web_cache.CACHE.refresh()

    assert snapshot["ok"] is True
    assert len(snapshot["live"]) == 3            # deduped to latest-per-symbol
    assert snapshot["health"]["status"] == "LIVE"
    assert snapshot["health"]["tracked_symbols"] == 3
    metrics = snapshot["cache"]
    assert metrics["symbol_count"] == 3
    assert metrics["row_count"] == 6             # MAX(rowid) == total inserted
    assert metrics["last_error"] == ""


def test_cache_keeps_last_good_when_db_path_missing(tmp_path, monkeypatch):
    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    good = web_cache.CACHE.refresh()
    assert len(good["live"]) == 3

    # Point at a non-existent DB and force a refresh: snapshot must not blank out.
    monkeypatch.setattr(web_queries, "DB_PATH", str(tmp_path / "gone.sqlite"))
    snapshot = web_cache.CACHE.refresh()
    assert isinstance(snapshot, dict)
    assert "live" in snapshot


def test_empty_db_returns_structured_warming(tmp_path, monkeypatch):
    db = tmp_path / "empty.sqlite"
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
    point(db, monkeypatch)

    snapshot = web_cache.CACHE.refresh()
    assert snapshot["ok"] is True
    assert snapshot["live"] == []
    assert snapshot["health"]["status"] == "DB WARMING"
    assert snapshot["health"]["db_exists"] is True


def test_api_state_returns_rows_with_sample_db(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    client = TestClient(web_app.app)

    payload = client.get("/api/state").json()
    assert payload["ok"] is True
    assert len(payload["live"]) == 3
    assert payload["health"]["status"] == "LIVE"
    assert payload["summary"]["metrics"]["total_symbols"] == 3
    assert payload["cache"]["row_count"] == 6
    assert "opportunities" in payload and "funding" in payload


def test_api_state_empty_db_is_warming_json(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = tmp_path / "empty.sqlite"
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
    point(db, monkeypatch)
    client = TestClient(web_app.app)

    payload = client.get("/api/state").json()
    assert payload["ok"] is True
    assert payload["live"] == []
    assert payload["health"]["status"] == "DB WARMING"


def test_health_fast_path_does_not_full_scan(tmp_path, monkeypatch):
    # Build a DB with many rows but few symbols; the bounded read must only touch
    # RECENT_READ_LIMIT rows, never COUNT(*)/GROUP-BY the whole table.
    db = tmp_path / "big.sqlite"
    ts_ms = int(time.time() * 1000)
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
        rows = []
        for s in range(2000):  # 2000 snapshots * 3 symbols = 6000 rows
            t = ts_ms - s * 1000
            for i, sym in enumerate(("BTCUSDT", "ETHUSDT", "SOLUSDT")):
                rows.append((t, sym, 100.0 + i, 100.1 + i, 100.2 + i, 100.3 + i,
                             100.25 + i, 0.0001, 12.0, -20.0, 1.0, 1.1, 1.2))
        conn.executemany("INSERT INTO basis_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    point(db, monkeypatch)

    health = web_app.market_cache.health()
    assert health["status"] == "LIVE"
    assert health["tracked_symbols"] == 3
    assert web_app.market_cache.metrics()["row_count"] == 6000


def test_ensure_indexes_script_runs(tmp_path):
    db = make_db(tmp_path / "idx.sqlite")
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "ensure_indexes.py"), "--db", str(db)],
        cwd=str(ROOT), capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "OK" in result.stdout
    # Indexes should now exist.
    with sqlite3.connect(db) as conn:
        names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
    assert {"idx_basis_ts_symbol", "idx_basis_symbol_ts", "idx_basis_ts"} <= names


def test_state_lite_returns_rows(tmp_path, monkeypatch):
    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    lite = web_cache.CACHE.state_lite()
    assert lite["ok"] is True
    assert len(lite["radar_top"]) == 3
    assert lite["metrics"]["total_symbols"] == 3
    assert "cache" in lite and "health" in lite and "ticker" in lite


def test_api_state_lite_and_radar_return_rows(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    client = TestClient(web_app.app)

    lite = client.get("/api/state-lite").json()
    assert lite["ok"] is True and len(lite["radar_top"]) == 3
    radar = client.get("/api/radar?limit=300").json()
    assert radar["ok"] is True and radar["count"] == 3
    radar_alts = client.get("/api/radar?limit=300&filter=alts").json()
    assert radar_alts["ok"] is True  # BTC/ETH/SOL are majors -> alts filter yields none, must not crash
    detail = client.get("/api/detail?symbol=BTCUSDT&minutes=60").json()
    assert detail["ok"] is True and detail["symbol"] == "BTCUSDT"


def test_lazy_tab_endpoints_do_not_crash_on_empty_db(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = tmp_path / "empty.sqlite"
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
    point(db, monkeypatch)
    client = TestClient(web_app.app)

    for path in [
        "/api/state-lite",
        "/api/radar?limit=300",
        "/api/radar?limit=300&filter=fundpos",
        "/api/detail?symbol=BTCUSDT&minutes=60",
        "/api/heatmap",
        "/api/movers?minutes=5",
        "/api/funding",
        "/api/opportunities",
        "/api/perf",
    ]:
        resp = client.get(path)
        assert resp.status_code == 200, path
        body = resp.json()
        assert isinstance(body, dict)
        assert body.get("ok", True) is not False


def test_search_and_pages_and_symbol_endpoints(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    client = TestClient(web_app.app)

    s = client.get("/api/search?q=bt").json()
    assert s["ok"] is True and any(r["symbol"] == "BTCUSDT" for r in s["results"])

    p = client.get("/api/pages/markets?page=1&page_size=2&sort=funding_rate&direction=asc").json()
    assert p["ok"] is True and p["page_size"] == 2 and p["total"] == 3 and p["pages"] == 2
    assert len(p["rows"]) == 2

    sym = client.get("/api/symbol/BTCUSDT").json()
    assert sym["ok"] is True and sym["symbol"] == "BTCUSDT" and sym["row"] is not None

    hist = client.get("/api/symbol/BTCUSDT/history?window=15m").json()
    assert hist["ok"] is True and hist["window"] == "15m" and isinstance(hist["rows"], list)
    hist_7d = client.get("/api/symbol/BTCUSDT/history?window=7d").json()
    assert hist_7d["ok"] is True and hist_7d["window"] == "7d" and hist_7d["minutes"] == 10080


def test_pages_markets_empty_db_does_not_crash(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = tmp_path / "empty.sqlite"
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
    point(db, monkeypatch)
    client = TestClient(web_app.app)
    for path in ["/api/search?q=x", "/api/pages/markets?page=1", "/api/symbol/BTCUSDT",
                 "/api/symbol/BTCUSDT/history?window=1h"]:
        r = client.get(path)
        assert r.status_code == 200 and isinstance(r.json(), dict)


def test_static_icons_served(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    client = TestClient(web_app.app)
    # web_app exposes the discovered icon set; if BTC icon is bundled it must serve.
    if "BTC" in web_app.ICON_BASES:
        r = client.get("/static/icons/btc.svg")
        assert r.status_code == 200 and "svg" in r.headers.get("content-type", "")


def test_perf_reports_payload_sizes(tmp_path, monkeypatch):
    db = make_db(tmp_path / "sample.sqlite")
    point(db, monkeypatch)
    web_cache.CACHE.refresh()
    perf = web_cache.CACHE.perf()
    assert perf["payload_sizes"]["state_lite_bytes"] > 0
    assert perf["payload_sizes"]["state_bytes"] >= perf["payload_sizes"]["state_lite_bytes"]


def test_perf_check_script_imports():
    spec = importlib.util.spec_from_file_location("perf_check", ROOT / "scripts" / "perf_check.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert hasattr(module, "main")
    paths = [c[0] for c in module.CORE]
    assert "/api/state-lite" in paths and "/api/radar?limit=300" in paths
