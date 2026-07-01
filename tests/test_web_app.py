from __future__ import annotations

import importlib.util
import sqlite3
import time

import web_app


def setup_function():
    web_app.CACHE.clear()
    web_app.LAST_GOOD.clear()
    web_app.market_cache.reset()


def test_web_app_imports_app():
    assert hasattr(web_app, "app")


def test_empty_health_is_json_shape():
    health = web_app.empty_health()
    assert health["status"] == "DB WARMING"
    assert "db_path" in health
    assert "db_abs_path" in health
    assert "tracked_symbols" in health


def test_health_endpoint_returns_json_when_testclient_available():
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    client = TestClient(web_app.app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "status" in response.json()


def create_sample_db(db_path):
    ts_ms = int(time.time() * 1000)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(
            """
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
        )
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (ts_ms - 60_000, "BTCUSDT", 99.0, 99.1, 99.2, 99.3, 99.25, 0.00008, 10.09, -30.21, 2.0, 2.1, 2.2),
        )
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (ts_ms, "BTCUSDT", 100.0, 100.1, 100.3, 100.4, 100.35, 0.0001, 19.98, -39.88, 1.0, 1.1, 1.2),
        )
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (ts_ms, "ETHUSDT", 50.0, 50.05, 49.7, 49.8, 49.75, -0.0002, -69.93, 40.16, 1.2, 1.3, 1.4),
        )
    return db_path


def point_web_app_at(db_path, monkeypatch):
    monkeypatch.setattr(web_app, "DB_PATH", str(db_path))
    monkeypatch.setattr(web_app.queries, "DB_PATH", str(db_path))
    web_app.CACHE.clear()
    web_app.market_cache.reset()


def test_live_builder_with_minimal_sqlite(tmp_path, monkeypatch):
    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)

    payload = web_app.build_live(10)

    assert payload["count"] == 2
    by_symbol = {row["symbol"]: row for row in payload["rows"]}
    btc = by_symbol["BTCUSDT"]
    assert btc["status"] == "LIVE"
    assert btc["spot_mid"] > 0
    assert btc["futures_mid"] > 0
    assert btc["spot_spread_bps"] > 0
    assert btc["futures_spread_bps"] > 0
    assert btc["abs_basis_bps"] > 0


def test_summary_builder_with_sample_sqlite(tmp_path, monkeypatch):
    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)

    payload = web_app.build_summary()

    assert payload["metrics"]["total_symbols"] == 2
    assert payload["metrics"]["live_symbols"] == 2
    assert str(db_path.resolve()) == payload["health"]["db_abs_path"]
    assert payload["metrics"]["max_spot_to_perp_bps"] == 19.98
    assert payload["metrics"]["lowest_funding_rate"] == -0.0002


def test_debug_builder_reports_collector_schema(tmp_path, monkeypatch):
    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)

    payload = web_app.build_debug()

    assert payload["table_name"] == "basis_snapshots"
    assert payload["schema_ok"] is True
    assert payload["total_symbols_count"] == 2
    assert payload["latest_rows_count"] == 2
    assert payload["first_5_latest_rows"][0]["symbol"] in {"BTCUSDT", "ETHUSDT"}


def test_selftest_with_sample_sqlite(tmp_path, monkeypatch):
    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)

    payload = web_app.build_selftest()

    assert payload["ok"] is True
    assert payload["live_count"] == 2
    assert payload["summary_symbols"] == 2


def test_api_live_summary_debug_selftest_with_sample_sqlite(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)
    client = TestClient(web_app.app)

    live = client.get("/api/live").json()
    summary = client.get("/api/summary").json()
    debug = client.get("/api/debug").json()
    selftest = client.get("/api/selftest").json()

    assert live["count"] == 2
    assert summary["metrics"]["total_symbols"] == 2
    assert debug["latest_symbols_count"] == 2
    assert selftest["ok"] is True


def test_empty_collector_schema_db_does_not_crash(tmp_path, monkeypatch):
    db_path = tmp_path / "empty.sqlite"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(
            """
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
        )
    point_web_app_at(db_path, monkeypatch)

    live = web_app.build_live(10)
    summary = web_app.build_summary()
    selftest = web_app.build_selftest()

    assert live["ok"] is True
    assert live["count"] == 0
    assert summary["metrics"]["total_symbols"] == 0
    assert selftest["ok"] is True


def test_open_readonly_cannot_mutate_db(tmp_path, monkeypatch):
    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)

    conn = web_app.queries.open_readonly(str(db_path))
    assert conn is not None
    raised = False
    try:
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (0,'XX',1,1,1,1,1,0,0,0,0,0,0)"
        )
    except sqlite3.OperationalError:
        raised = True
    finally:
        conn.close()
    assert raised, "read-only connection must reject writes"


def test_open_readonly_missing_db_returns_none(tmp_path, monkeypatch):
    point_web_app_at(tmp_path / "does_not_exist.sqlite", monkeypatch)
    assert web_app.queries.open_readonly(str(tmp_path / "does_not_exist.sqlite")) is None


def test_watchlist_and_market_regime_with_sample_sqlite(tmp_path, monkeypatch):
    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)

    watchlist = web_app.build_watchlist(["ETHUSDT"], 5)
    regime = web_app.build_market_regime()

    assert watchlist["count"] >= 2
    assert watchlist["rows"][0]["symbol"] == "ETHUSDT"
    assert regime["ok"] is True
    assert "regime" in regime


def test_new_api_routes_return_json_with_sample_sqlite(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return
    from starlette.testclient import TestClient

    db_path = create_sample_db(tmp_path / "sample.sqlite")
    point_web_app_at(db_path, monkeypatch)
    monkeypatch.setattr(
        web_app.queries,
        "build_enrichment",
        lambda symbols=None, limit=12: {"ok": True, "rows": [], "count": 0, "requested_symbols": symbols or []},
    )
    client = TestClient(web_app.app)

    for path in [
        "/api/health",
        "/api/summary",
        "/api/live?limit=300",
        "/api/symbols",
        "/api/history?symbol=BTCUSDT&minutes=60",
        "/api/opportunities",
        "/api/funding",
        "/api/movers?minutes=1",
        "/api/movers?minutes=5",
        "/api/movers?minutes=15",
        "/api/heatmap",
        "/api/ticker",
        "/api/watchlist",
        "/api/enrichment?symbols=BTCUSDT&limit=1",
        "/api/market-regime",
        "/api/debug",
        "/api/selftest",
    ]:
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/json")
        assert isinstance(response.json(), dict)
