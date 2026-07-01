from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import time


def fnum(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


@dataclass
class Quote:
    bid: float = 0.0
    bid_qty: float = 0.0
    ask: float = 0.0
    ask_qty: float = 0.0
    event_ms: int = 0
    updated_at: float = 0.0

    @classmethod
    def from_bookticker(cls, data: dict) -> "Quote":
        return cls(
            bid=fnum(data.get("b")),
            bid_qty=fnum(data.get("B")),
            ask=fnum(data.get("a")),
            ask_qty=fnum(data.get("A")),
            event_ms=int(data.get("E") or data.get("T") or int(time.time() * 1000)),
            updated_at=time.time(),
        )

    def ok(self) -> bool:
        return self.bid > 0 and self.ask > 0 and self.ask >= self.bid


@dataclass
class MarkFunding:
    mark_price: float = 0.0
    index_price: float = 0.0
    funding_rate: float = 0.0
    next_funding_ms: int = 0
    event_ms: int = 0
    updated_at: float = 0.0

    @classmethod
    def from_mark(cls, data: dict) -> "MarkFunding":
        return cls(
            mark_price=fnum(data.get("p")),
            index_price=fnum(data.get("i")),
            funding_rate=fnum(data.get("r")),
            next_funding_ms=int(data.get("T") or 0),
            event_ms=int(data.get("E") or int(time.time() * 1000)),
            updated_at=time.time(),
        )


@dataclass
class BasisRow:
    ts_ms: int
    symbol: str
    spot_bid: float
    spot_ask: float
    fut_bid: float
    fut_ask: float
    mark_price: float
    funding_rate: float
    spot_to_perp_bps: float
    perp_to_spot_bps: float
    spot_age_sec: float
    fut_age_sec: float
    mark_age_sec: float
