from __future__ import annotations

import aiohttp
from .config import SPOT_REST_BASE, FUTURES_REST_BASE, DEFAULT_QUOTE


async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict:
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
        resp.raise_for_status()
        return await resp.json()


async def get_spot_usdt_symbols(session: aiohttp.ClientSession, quote: str = DEFAULT_QUOTE) -> set[str]:
    data = await fetch_json(session, f"{SPOT_REST_BASE}/api/v3/exchangeInfo")
    out: set[str] = set()
    for s in data.get("symbols", []):
        if s.get("quoteAsset") == quote and s.get("status") == "TRADING" and s.get("isSpotTradingAllowed", True):
            out.add(s["symbol"])
    return out


async def get_futures_usdt_symbols(session: aiohttp.ClientSession, quote: str = DEFAULT_QUOTE) -> set[str]:
    data = await fetch_json(session, f"{FUTURES_REST_BASE}/fapi/v1/exchangeInfo")
    out: set[str] = set()
    for s in data.get("symbols", []):
        if s.get("quoteAsset") == quote and s.get("status") == "TRADING" and s.get("contractType") == "PERPETUAL":
            out.add(s["symbol"])
    return out


async def get_common_symbols(limit: int | None = None, quote: str = DEFAULT_QUOTE) -> list[str]:
    async with aiohttp.ClientSession() as session:
        spot, fut = await get_spot_usdt_symbols(session, quote), await get_futures_usdt_symbols(session, quote)
    common = sorted(spot & fut)
    if limit:
        common = common[:limit]
    return common


async def get_common_symbol_coverage(quote: str = DEFAULT_QUOTE) -> dict:
    async with aiohttp.ClientSession() as session:
        spot, fut = await get_spot_usdt_symbols(session, quote), await get_futures_usdt_symbols(session, quote)
    common = sorted(spot & fut)
    return {
        "ok": True,
        "quote": quote,
        "spot_count": len(spot),
        "futures_count": len(fut),
        "common_count": len(common),
        "symbols": common,
    }
