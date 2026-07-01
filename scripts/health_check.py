from __future__ import annotations

import argparse
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path


def utc_label(ts_ms: int | float | None) -> str:
    if not ts_ms:
        return "none"
    return datetime.fromtimestamp(float(ts_ms) / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def table_exists(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'basis_snapshots'
        """
    ).fetchone()
    return row is not None


def print_top_rows(conn: sqlite3.Connection, latest_ts_ms: int, limit: int) -> None:
    rows = conn.execute(
        """
        SELECT
          symbol,
          spot_to_perp_bps,
          perp_to_spot_bps,
          funding_rate,
          spot_bid,
          spot_ask,
          fut_bid,
          fut_ask,
          spot_age_sec,
          fut_age_sec
        FROM basis_snapshots
        WHERE ts_ms = ?
        ORDER BY MAX(ABS(spot_to_perp_bps), ABS(perp_to_spot_bps)) DESC
        LIMIT ?
        """,
        (latest_ts_ms, limit),
    ).fetchall()

    print(f"top {limit} basis rows:")
    if not rows:
        print("  none")
        return

    for row in rows:
        symbol, spot_perp, perp_spot, funding, spot_bid, spot_ask, fut_bid, fut_ask, spot_age, fut_age = row
        age = max(float(spot_age), float(fut_age))
        print(
            "  "
            f"{symbol:14s} "
            f"spot->perp={spot_perp:9.2f} bps  "
            f"perp->spot={perp_spot:9.2f} bps  "
            f"funding={funding * 100:9.4f}%  "
            f"spot={spot_bid:g}/{spot_ask:g}  "
            f"fut={fut_bid:g}/{fut_ask:g}  "
            f"age={age:.2f}s"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="CG Signal Lab SQLite health check")
    parser.add_argument("--db", default="data/binance_signal_lab.sqlite", help="SQLite DB path")
    parser.add_argument("--stale-after", type=float, default=15.0, help="Warn if latest snapshot is older than this many seconds")
    parser.add_argument("--top", type=int, default=5, help="Number of top basis rows to print")
    args = parser.parse_args()

    path = Path(args.db)
    print(f"db: {path}")
    print(f"db exists: {path.exists()}")
    if not path.exists():
        print("latest snapshot timestamp: none")
        print("number of symbols: 0")
        print("top 5 basis rows:")
        print("  none")
        print("warning: database has not been created yet")
        return 1

    try:
        with sqlite3.connect(path, timeout=2.0) as conn:
            if not table_exists(conn):
                print("latest snapshot timestamp: none")
                print("number of symbols: 0")
                print("top 5 basis rows:")
                print("  none")
                print("warning: basis_snapshots table does not exist yet")
                return 1

            latest_row = conn.execute("SELECT MAX(ts_ms) FROM basis_snapshots").fetchone()
            latest_ts_ms = latest_row[0] if latest_row else None
            symbol_row = conn.execute("SELECT COUNT(DISTINCT symbol) FROM basis_snapshots").fetchone()
            symbol_count = int(symbol_row[0] or 0) if symbol_row else 0

            print(f"latest snapshot timestamp: {utc_label(latest_ts_ms)}")
            print(f"number of symbols: {symbol_count}")

            if not latest_ts_ms:
                print_top_rows(conn, 0, args.top)
                print("warning: no snapshots found")
                return 1

            print_top_rows(conn, int(latest_ts_ms), args.top)

            latest_age = max(0.0, time.time() - (float(latest_ts_ms) / 1000))
            stale_feeds = conn.execute(
                """
                SELECT COUNT(*)
                FROM basis_snapshots
                WHERE ts_ms = ?
                  AND MAX(spot_age_sec, fut_age_sec) > ?
                """,
                (latest_ts_ms, args.stale_after),
            ).fetchone()[0]

            if latest_age > args.stale_after:
                print(f"warning: latest snapshot is stale ({latest_age:.1f}s old)")
                return 1
            if stale_feeds:
                print(f"warning: {stale_feeds} latest rows have stale spot/futures ages")
                return 1
            print("stale data warning: none")
            return 0
    except sqlite3.Error as exc:
        print(f"warning: could not read database: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
