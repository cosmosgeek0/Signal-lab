from __future__ import annotations

import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_DEBUG = ROOT / "scripts" / "web_debug.py"

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


def _sample_db(path: Path) -> Path:
    ts_ms = int(time.time() * 1000)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (ts_ms, "BTCUSDT", 100.0, 100.1, 100.3, 100.4, 100.35, 0.0001, 19.98, -39.88, 1.0, 1.1, 1.2),
        )
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (ts_ms, "ETHUSDT", 50.0, 50.05, 49.7, 49.8, 49.75, -0.0002, -69.93, 40.16, 1.2, 1.3, 1.4),
        )
    return path


def _empty_db(path: Path) -> Path:
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
    return path


def _run(db_path: Path, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(WEB_DEBUG), "--db", str(db_path), *extra],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )


def test_web_debug_reports_ok_for_populated_db(tmp_path):
    db = _sample_db(tmp_path / "sample.sqlite")
    result = _run(db)
    assert result.returncode == 0, result.stderr
    out = result.stdout
    # Every required field the mission lists must be printed.
    for needle in [
        "status: OK",
        "cwd:",
        "absolute DB path:",
        "DB path exists: yes",
        "sqlite tables: basis_snapshots",
        "schema columns:",
        "schema ok: yes",
        "latest timestamp:",
        "total rows: 2",
        "total symbols: 2",
        "latest rows: 2",
        "internal live query:",
        "internal summary query:",
    ]:
        assert needle in out, f"missing {needle!r} in:\n{out}"
    assert "total_symbols=2" in out


def test_web_debug_json_flag_is_valid_json(tmp_path):
    db = _sample_db(tmp_path / "sample.sqlite")
    result = _run(db, "--json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["status"] == "OK"
    assert payload["diagnostics"]["schema_ok"] is True
    assert payload["live_probe"]["count"] == 2


def test_web_debug_empty_db_is_ok_with_zero_rows(tmp_path):
    db = _empty_db(tmp_path / "empty.sqlite")
    result = _run(db)
    assert result.returncode == 0, result.stderr
    assert "status: OK" in result.stdout
    assert "total rows: 0" in result.stdout


def test_web_debug_missing_db_reports_no(tmp_path):
    db = tmp_path / "nope.sqlite"
    result = _run(db)
    # Missing DB must not crash; it reports a clean "DB path exists: no".
    assert "DB path exists: no" in result.stdout
