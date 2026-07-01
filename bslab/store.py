from __future__ import annotations

import aiosqlite
from pathlib import Path
from typing import Iterable
from .models import BasisRow

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS basis_snapshots (
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
CREATE INDEX IF NOT EXISTS idx_basis_ts ON basis_snapshots(ts_ms);
CREATE INDEX IF NOT EXISTS idx_basis_symbol_ts ON basis_snapshots(symbol, ts_ms);
"""


async def init_db(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(path) as db:
        await db.executescript(SCHEMA)
        await db.commit()


async def insert_rows(path: str, rows: Iterable[BasisRow]) -> None:
    vals = [(
        r.ts_ms, r.symbol, r.spot_bid, r.spot_ask, r.fut_bid, r.fut_ask,
        r.mark_price, r.funding_rate, r.spot_to_perp_bps, r.perp_to_spot_bps,
        r.spot_age_sec, r.fut_age_sec, r.mark_age_sec,
    ) for r in rows]
    if not vals:
        return
    async with aiosqlite.connect(path) as db:
        await db.executemany(
            """INSERT INTO basis_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            vals,
        )
        await db.commit()
