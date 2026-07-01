from __future__ import annotations


def bps(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return (numerator / denominator) * 10000.0


def spot_to_perp_bps(spot_ask: float, fut_bid: float) -> float:
    """Executable-ish gap: buy spot at ask, sell perp at bid."""
    if spot_ask <= 0 or fut_bid <= 0:
        return 0.0
    return bps(fut_bid - spot_ask, spot_ask)


def perp_to_spot_bps(fut_ask: float, spot_bid: float) -> float:
    """Reverse gap: buy perp at ask, sell spot at bid. Needs spot inventory/borrow."""
    if fut_ask <= 0 or spot_bid <= 0:
        return 0.0
    return bps(spot_bid - fut_ask, fut_ask)
