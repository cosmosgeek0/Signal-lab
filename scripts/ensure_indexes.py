"""Create the SQLite indexes that make the dashboard's bounded reads fast.

This is a MANUAL maintenance step, run once against the collector DB. It is the
only place that opens the DB read-write; the dashboard API never creates indexes
on a request path. Creating an index on a multi-million row table can take a
little while and briefly contends with the collector's writes, so run it during
a quiet moment (the collector keeps running fine in WAL mode).

Usage:
    .venv/bin/python scripts/ensure_indexes.py --db data/binance_signal_lab.sqlite
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import time
from pathlib import Path

TABLE = "basis_snapshots"
INDEXES = [
    ("idx_basis_ts_symbol", f"CREATE INDEX IF NOT EXISTS idx_basis_ts_symbol ON {TABLE}(ts_ms DESC, symbol)"),
    ("idx_basis_symbol_ts", f"CREATE INDEX IF NOT EXISTS idx_basis_symbol_ts ON {TABLE}(symbol, ts_ms DESC)"),
    ("idx_basis_ts", f"CREATE INDEX IF NOT EXISTS idx_basis_ts ON {TABLE}(ts_ms DESC)"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Create dashboard read indexes (manual, idempotent).")
    parser.add_argument("--db", default=os.environ.get("BSLAB_DB", "data/binance_signal_lab.sqlite"))
    args = parser.parse_args()

    path = Path(args.db).expanduser()
    if not path.exists():
        print(f"FAIL: DB not found at {path.resolve()}")
        return 1

    print(f"DB: {path.resolve()}")
    conn = sqlite3.connect(str(path), timeout=30.0)
    try:
        conn.execute("PRAGMA busy_timeout = 30000")
        existing = {row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        ).fetchall()}
        for name, sql in INDEXES:
            start = time.perf_counter()
            conn.execute(sql)
            conn.commit()
            took = (time.perf_counter() - start) * 1000
            state = "exists" if name in existing else "created"
            print(f"  {name}: {state} ({took:.0f} ms)")
        # Refresh planner statistics so the new indexes are actually chosen.
        conn.execute("ANALYZE")
        conn.commit()
        print("ANALYZE complete. OK")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
