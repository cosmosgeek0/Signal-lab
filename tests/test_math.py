from bslab.math import spot_to_perp_bps, perp_to_spot_bps


def test_spot_to_perp_positive_gap():
    assert round(spot_to_perp_bps(100, 101), 6) == 100.0


def test_perp_to_spot_positive_gap():
    assert round(perp_to_spot_bps(100, 101), 6) == 100.0


def test_zero_inputs_safe():
    assert spot_to_perp_bps(0, 101) == 0.0
    assert perp_to_spot_bps(0, 101) == 0.0
