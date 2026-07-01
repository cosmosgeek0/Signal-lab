from __future__ import annotations

import argparse
import asyncio
from .collector import run_collector


def main() -> None:
    p = argparse.ArgumentParser(description="CG Signal Lab public-data collector")
    p.add_argument("--db", default="data/binance_signal_lab.sqlite", help="SQLite DB path")
    p.add_argument("--limit", type=int, default=None, help="Limit symbol count for testing")
    p.add_argument("--top", type=int, default=25, help="Rows to show in terminal")
    args = p.parse_args()
    asyncio.run(run_collector(args.db, args.limit, args.top))


if __name__ == "__main__":
    main()
