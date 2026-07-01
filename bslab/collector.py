from __future__ import annotations

import asyncio
import json
import time
from collections import defaultdict, deque
from typing import Iterable

import websockets
from rich.console import Console
from rich.table import Table

from .config import (
    SPOT_WS_BASE, FUTURES_PUBLIC_WS, FUTURES_MARKET_WS, SPOT_STREAM_CHUNK_SIZE,
    SNAPSHOT_INTERVAL_SEC, RECONNECT_BACKOFF_SEC, STALE_AFTER_SEC,
)
from .models import Quote, MarkFunding, BasisRow
from .math import spot_to_perp_bps, perp_to_spot_bps
from .store import init_db, insert_rows
from .symbols import get_common_symbols

console = Console()


class MarketState:
    def __init__(self, symbols: Iterable[str]) -> None:
        self.symbols = set(symbols)
        self.spot: dict[str, Quote] = {}
        self.fut: dict[str, Quote] = {}
        self.mark: dict[str, MarkFunding] = {}
        self.history = defaultdict(lambda: deque(maxlen=300))
        self.lock = asyncio.Lock()

    async def update_spot(self, symbol: str, data: dict) -> None:
        if symbol in self.symbols:
            async with self.lock:
                self.spot[symbol] = Quote.from_bookticker(data)

    async def update_fut(self, symbol: str, data: dict) -> None:
        if symbol in self.symbols:
            async with self.lock:
                self.fut[symbol] = Quote.from_bookticker(data)

    async def update_mark(self, symbol: str, data: dict) -> None:
        if symbol in self.symbols:
            async with self.lock:
                self.mark[symbol] = MarkFunding.from_mark(data)

    async def rows(self) -> list[BasisRow]:
        now = time.time()
        ts_ms = int(now * 1000)
        rows: list[BasisRow] = []
        async with self.lock:
            for s in self.symbols:
                sq = self.spot.get(s)
                fq = self.fut.get(s)
                if not sq or not fq or not sq.ok() or not fq.ok():
                    continue
                mf = self.mark.get(s, MarkFunding())
                spot_age = now - sq.updated_at
                fut_age = now - fq.updated_at
                mark_age = now - mf.updated_at if mf.updated_at else 9999.0
                if spot_age > STALE_AFTER_SEC or fut_age > STALE_AFTER_SEC:
                    continue
                row = BasisRow(
                    ts_ms=ts_ms,
                    symbol=s,
                    spot_bid=sq.bid,
                    spot_ask=sq.ask,
                    fut_bid=fq.bid,
                    fut_ask=fq.ask,
                    mark_price=mf.mark_price,
                    funding_rate=mf.funding_rate,
                    spot_to_perp_bps=spot_to_perp_bps(sq.ask, fq.bid),
                    perp_to_spot_bps=perp_to_spot_bps(fq.ask, sq.bid),
                    spot_age_sec=spot_age,
                    fut_age_sec=fut_age,
                    mark_age_sec=mark_age,
                )
                rows.append(row)
                self.history[s].append(row)
        return rows


def chunks(items: list[str], n: int):
    for i in range(0, len(items), n):
        yield items[i:i+n]


async def spot_bookticker_worker(state: MarketState, symbols: list[str], worker_id: int) -> None:
    streams = "/".join(f"{s.lower()}@bookTicker" for s in symbols)
    url = SPOT_WS_BASE + streams
    while True:
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=60, max_size=20_000_000) as ws:
                console.print(f"[green]spot worker {worker_id} connected[/green] {len(symbols)} streams")
                async for msg in ws:
                    payload = json.loads(msg)
                    data = payload.get("data", payload)
                    sym = data.get("s")
                    if sym:
                        await state.update_spot(sym, data)
        except Exception as e:
            console.print(f"[yellow]spot worker {worker_id} reconnecting after {type(e).__name__}: {e}[/yellow]")
            await asyncio.sleep(RECONNECT_BACKOFF_SEC)


async def futures_bookticker_worker(state: MarketState) -> None:
    while True:
        try:
            async with websockets.connect(FUTURES_PUBLIC_WS, ping_interval=180, ping_timeout=600, max_size=20_000_000) as ws:
                console.print("[green]futures !bookTicker connected[/green]")
                async for msg in ws:
                    data = json.loads(msg)
                    sym = data.get("s")
                    if sym:
                        await state.update_fut(sym, data)
        except Exception as e:
            console.print(f"[yellow]futures bookTicker reconnecting after {type(e).__name__}: {e}[/yellow]")
            await asyncio.sleep(RECONNECT_BACKOFF_SEC)


async def futures_mark_worker(state: MarketState) -> None:
    while True:
        try:
            async with websockets.connect(FUTURES_MARKET_WS, ping_interval=180, ping_timeout=600, max_size=20_000_000) as ws:
                console.print("[green]futures !markPrice@arr@1s connected[/green]")
                async for msg in ws:
                    arr = json.loads(msg)
                    if isinstance(arr, dict):
                        arr = arr.get("data", [])
                    for data in arr or []:
                        sym = data.get("s")
                        if sym:
                            await state.update_mark(sym, data)
        except Exception as e:
            console.print(f"[yellow]futures markPrice reconnecting after {type(e).__name__}: {e}[/yellow]")
            await asyncio.sleep(RECONNECT_BACKOFF_SEC)


async def snapshot_worker(state: MarketState, db_path: str, top: int) -> None:
    await init_db(db_path)
    while True:
        rows = await state.rows()
        await insert_rows(db_path, rows)
        show_top(rows, top)
        await asyncio.sleep(SNAPSHOT_INTERVAL_SEC)


def show_top(rows: list[BasisRow], top: int) -> None:
    if not rows:
        console.print("waiting for market data...")
        return
    rows = sorted(rows, key=lambda r: max(r.spot_to_perp_bps, r.perp_to_spot_bps), reverse=True)[:top]
    table = Table(title=f"CG Signal Lab — top {top} gaps")
    table.add_column("symbol")
    table.add_column("spot→perp bps", justify="right")
    table.add_column("perp→spot bps", justify="right")
    table.add_column("funding %", justify="right")
    table.add_column("spot bid/ask", justify="right")
    table.add_column("fut bid/ask", justify="right")
    for r in rows:
        table.add_row(
            r.symbol,
            f"{r.spot_to_perp_bps:.2f}",
            f"{r.perp_to_spot_bps:.2f}",
            f"{r.funding_rate * 100:.4f}",
            f"{r.spot_bid:g}/{r.spot_ask:g}",
            f"{r.fut_bid:g}/{r.fut_ask:g}",
        )
    console.clear()
    console.print(table)


async def run_collector(db_path: str, limit: int | None, top: int) -> None:
    symbols = await get_common_symbols(limit=limit)
    if not symbols:
        raise RuntimeError("No common spot/futures symbols found")
    console.print(f"Loaded {len(symbols)} common USDT spot+perp symbols")
    state = MarketState(symbols)
    tasks = []
    for idx, part in enumerate(chunks(symbols, SPOT_STREAM_CHUNK_SIZE), start=1):
        tasks.append(asyncio.create_task(spot_bookticker_worker(state, part, idx)))
    tasks.append(asyncio.create_task(futures_bookticker_worker(state)))
    tasks.append(asyncio.create_task(futures_mark_worker(state)))
    tasks.append(asyncio.create_task(snapshot_worker(state, db_path, top)))
    await asyncio.gather(*tasks)
