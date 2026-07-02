"""Source-layer tests. Deliberately NETWORK-FREE: adapters are monkeypatched
with fixtures or forced failures, proving the endpoints stay honest and never
break when external sources are down."""
from __future__ import annotations

import importlib.util
import sqlite3
import time
from pathlib import Path

import web_app
from bslab import web_cache, web_queries, web_sources

ROOT = Path(__file__).resolve().parents[1]

SCHEMA = """
CREATE TABLE basis_snapshots (
  ts_ms INTEGER NOT NULL, symbol TEXT NOT NULL,
  spot_bid REAL NOT NULL, spot_ask REAL NOT NULL,
  fut_bid REAL NOT NULL, fut_ask REAL NOT NULL,
  mark_price REAL NOT NULL, funding_rate REAL NOT NULL,
  spot_to_perp_bps REAL NOT NULL, perp_to_spot_bps REAL NOT NULL,
  spot_age_sec REAL NOT NULL, fut_age_sec REAL NOT NULL, mark_age_sec REAL NOT NULL
);
"""


def setup_function():
    web_cache.CACHE.reset()
    # isolate every test from real network + shared adapter state
    for src in web_sources.SOURCES.values():
        src.data = None
        src.fetched_mono = 0.0
        src.last_ok_ts = None
        src.last_error = ""
        src._next_try = 0.0


def make_client(tmp_path, monkeypatch):
    if importlib.util.find_spec("httpx") is None:
        return None
    from starlette.testclient import TestClient

    db = tmp_path / "src.sqlite"
    ts = int(time.time() * 1000)
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT INTO basis_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (ts, "BTCUSDT", 100.0, 100.1, 100.2, 100.3, 100.25, 0.0001, 12.0, -20.0, 1.0, 1.1, 1.2),
        )
    monkeypatch.setattr(web_app, "DB_PATH", str(db))
    monkeypatch.setattr(web_queries, "DB_PATH", str(db))
    web_cache.CACHE.reset()
    return TestClient(web_app.app)


def kill_all_fetchers(monkeypatch):
    def boom():
        raise OSError("network disabled in tests")
    for src in web_sources.SOURCES.values():
        if src.fetcher is not None:
            monkeypatch.setattr(src, "fetcher", boom)


CG_FIXTURE = [{
    "id": "bitcoin", "symbol": "btc", "name": "Bitcoin",
    "image": "https://img.example/btc.png", "market_cap_rank": 1,
    "current_price": 60000.0, "market_cap": 1.2e12, "total_volume": 3.5e10,
    "price_change_percentage_1h_in_currency": 0.4,
    "price_change_percentage_24h_in_currency": 2.1,
    "price_change_percentage_7d_in_currency": -1.2,
    "price_change_percentage_30d_in_currency": 9.9,
    "sparkline_in_7d": {"price": [59000.0 + i for i in range(168)]},
    "ath": 126080.0, "ath_change_percentage": -52.0, "atl": 67.8,
    "circulating_supply": 2.0e7, "total_supply": 2.1e7,
    "high_24h": 61000.0, "low_24h": 58000.0,
}]


def test_market_overview_offline_is_honest(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    kill_all_fetchers(monkeypatch)
    payload = client.get("/api/market-overview").json()
    assert payload["ok"] is True
    assert payload["global"]["status"] in {"unavailable", "error"}
    assert payload["fear_greed"]["status"] in {"unavailable", "error"}
    assert payload["top_coins"]["coins"] == []          # never fabricated
    assert payload["stocks"]["items"] == []             # tokenized equities too
    assert payload["dex"]["status"] in {"unavailable", "error"}
    assert payload["metrics"]["total_symbols"] == 1      # Binance block still live


STOCKS_FIXTURE = [
    {"id": "tesla-xstock", "symbol": "tslax", "name": "Tesla xStock",
     "image": "https://img.example/tsla.png", "current_price": 423.0,
     "market_cap": 1.1e9, "total_volume": 5.0e7,
     "price_change_percentage_24h_in_currency": 1.9,
     "price_change_percentage_7d_in_currency": 4.2,
     "sparkline_in_7d": {"price": [400.0 + i for i in range(168)]}},
    {"id": "tesla-ondo", "symbol": "tslaon", "name": "Tesla (Ondo Tokenized Stock)",
     "image": "https://img.example/tsla2.png", "current_price": 422.5,
     "market_cap": 0.9e9, "total_volume": 3.0e7,
     "price_change_percentage_24h_in_currency": 1.8,
     "price_change_percentage_7d_in_currency": 4.0,
     "sparkline_in_7d": {"price": [401.0 + i for i in range(168)]}},
]


def test_stocks_and_dex_composers(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    kill_all_fetchers(monkeypatch)
    monkeypatch.setattr(web_sources.SOURCES["cg_stocks"], "fetcher", lambda: STOCKS_FIXTURE)
    monkeypatch.setattr(
        web_sources.SOURCES["llama_dex"], "fetcher",
        lambda: {"total24h": 7.4e9, "change_1d": 2.1, "chart": [[1, 2.0], [2, 3.0], [3, 4.0]]})
    web_sources.SOURCES["cg_stocks"].get()   # deterministic: composers are non-blocking
    web_sources.SOURCES["llama_dex"].get()
    p = client.get("/api/market-overview").json()
    stocks = p["stocks"]["items"]
    # two wrappers of the same company dedupe to ONE clean entry
    assert len(stocks) == 1
    assert stocks[0]["base"] == "TSLA" and stocks[0]["name"] == "Tesla"
    assert stocks[0]["price"] == 423.0 and len(stocks[0]["spark"]) <= 42
    assert p["dex"]["total24h_usd"] == 7.4e9 and len(p["dex"]["bars"]) == 3
    # clicking a stock opens a real asset page: ticker resolves to the wrapper id
    coin = web_sources.coin_by_base("TSLA")
    assert coin and coin.get("kind") == "stock" and coin["id"] == "tesla-xstock"


def test_market_overview_merges_binance_basis_into_coins(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    kill_all_fetchers(monkeypatch)
    monkeypatch.setattr(web_sources.SOURCES["coingecko"], "fetcher", lambda: CG_FIXTURE)
    web_sources.SOURCES["coingecko"].get()   # deterministic: composers are non-blocking
    payload = client.get("/api/market-overview").json()
    coins = payload["top_coins"]["coins"]
    assert len(coins) == 1
    btc = coins[0]
    assert btc["base"] == "BTC" and btc["rank"] == 1 and btc["price"] == 60000.0
    assert len(btc["spark"]) <= 42                        # downsampled
    assert btc["binance"]["symbol"] == "BTCUSDT"          # merged local basis
    assert isinstance(btc["binance"]["basis_bps"], float)


def test_coin_profile_composes_sources_and_row(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    kill_all_fetchers(monkeypatch)
    monkeypatch.setattr(web_sources.SOURCES["coingecko"], "fetcher", lambda: CG_FIXTURE)
    web_sources.SOURCES["coingecko"].get()   # deterministic: composers are non-blocking
    p = client.get("/api/coin-profile/BTCUSDT").json()
    assert p["ok"] is True and p["base"] == "BTC"
    assert p["coin"]["name"] == "Bitcoin" and p["coin"]["ath"] == 126080.0
    assert p["row"]["symbol"] == "BTCUSDT"
    # unknown symbol: still 200, honest nulls
    q = client.get("/api/coin-profile/NOPEUSDT").json()
    assert q["ok"] is True and q["coin"] is None and q["row"] is None


def test_fx_and_news_and_manifest_offline_safe(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    kill_all_fetchers(monkeypatch)
    fx = client.get("/api/fx").json()
    assert fx["ok"] is True and fx["rates"] == {}
    news = client.get("/api/news-context").json()
    assert news["ok"] is True and news["items"] == [] and news["options"]
    man = client.get("/api/icon-manifest").json()
    assert man["ok"] is True and isinstance(man["local"], list) and man["remote"] == {}


def test_fx_with_fixture(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    if client is None:
        return
    kill_all_fetchers(monkeypatch)
    monkeypatch.setattr(
        web_sources.SOURCES["fx"], "fetcher",
        lambda: {"result": "success", "rates": {"INR": 89.2, "EUR": 0.91, "GBP": 0.78, "JPY": 155.1, "XXX": 1.0}},
    )
    fx = client.get("/api/fx").json()
    assert fx["rates"] == {"INR": 89.2, "EUR": 0.91, "GBP": 0.78, "JPY": 155.1}


def test_stale_if_error_keeps_last_good(monkeypatch):
    src = web_sources.SOURCES["coingecko_global"]
    monkeypatch.setattr(src, "fetcher", lambda: {"total_market_cap": {"usd": 1.0}})
    assert src.get()["total_market_cap"]["usd"] == 1.0
    src.fetched_mono = time.monotonic() - src.ttl * 2  # force expiry (monotonic-relative)

    def boom():
        raise OSError("down")
    monkeypatch.setattr(src, "fetcher", boom)
    assert src.get()["total_market_cap"]["usd"] == 1.0    # stale data survives
    assert src.status()["status"] == "stale"
