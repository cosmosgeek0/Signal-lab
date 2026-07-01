from __future__ import annotations

import copy
import os
import sqlite3
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


DB_PATH = os.environ.get("BSLAB_DB", "data/binance_signal_lab.sqlite")
STALE_AFTER_SEC = float(os.environ.get("BSLAB_STALE_AFTER_SEC", "15"))
DEFAULT_HISTORY_MINUTES = 60
MAJOR_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]
TABLE_NAME = "basis_snapshots"
REQUIRED_COLUMNS = [
    "ts_ms",
    "symbol",
    "spot_bid",
    "spot_ask",
    "fut_bid",
    "fut_ask",
    "mark_price",
    "funding_rate",
    "spot_to_perp_bps",
    "perp_to_spot_bps",
    "spot_age_sec",
    "fut_age_sec",
    "mark_age_sec",
]

JsonDict = dict[str, Any]
PayloadBuilder = Callable[[], JsonDict]
CACHE: dict[str, tuple[float, JsonDict]] = {}
LAST_GOOD: dict[str, JsonDict] = {}


def now_ms() -> int:
    return int(time.time() * 1000)


def utc_label(ts_ms: int | float | None) -> str | None:
    if not ts_ms:
        return None
    return datetime.fromtimestamp(float(ts_ms) / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def age_seconds(ts_ms: int | float | None) -> float | None:
    if not ts_ms:
        return None
    return round(max(0.0, time.time() - (float(ts_ms) / 1000)), 3)


def pct_change(first: float, last: float) -> float | None:
    if first <= 0:
        return None
    return ((last - first) / first) * 100.0


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    pos = (len(ordered) - 1) * pct
    lo = int(pos)
    hi = min(lo + 1, len(ordered) - 1)
    frac = pos - lo
    return ordered[lo] * (1 - frac) + ordered[hi] * frac


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def clone_payload(payload: JsonDict) -> JsonDict:
    return copy.deepcopy(payload)


def current_db_path(db_path: str | None = None) -> str:
    return db_path if db_path is not None else DB_PATH


def db_abs_path(db_path: str | None = None) -> Path:
    return Path(current_db_path(db_path)).expanduser().resolve()


def open_readonly(db_path: str | None = None) -> sqlite3.Connection | None:
    """Open the collector DB strictly for reading.

    Prefers a ``mode=ro`` URI so the dashboard can never create or mutate the
    DB (even if the path is wrong) and reads a live WAL database cleanly while
    the collector keeps writing. Falls back to a plain ``query_only`` connection
    on the rare platform where the read-only URI cannot attach the WAL ``-shm``.
    A generous ``busy_timeout`` rides out a momentarily locked writer instead of
    surfacing "database is locked" to the frontend.
    """
    path = Path(current_db_path(db_path)).expanduser()
    if not path.exists():
        return None
    try:
        uri = f"file:{path.as_posix()}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=5.0, isolation_level=None)
    except sqlite3.OperationalError:
        conn = sqlite3.connect(str(path), timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 4000")
    conn.execute("PRAGMA query_only = ON")
    return conn


def empty_health(status: str = "DB WARMING", error: str = "") -> JsonDict:
    db_path = current_db_path()
    abs_path = str(db_abs_path(db_path))
    return {
        "status": status,
        "api_status": "OK" if not error else "API RETRY",
        "collector_status": "WAITING" if status == "DB WARMING" else status,
        "db_path": db_path,
        "db_abs_path": abs_path,
        "resolved_db_path": abs_path,
        "db_exists": Path(db_path).expanduser().exists(),
        "table_exists": False,
        "schema_ok": False,
        "missing_columns": [],
        "latest_ts_ms": None,
        "latest_update_utc": None,
        "freshness_age_seconds": None,
        "tracked_symbols": 0,
        "live_symbols": 0,
        "stale_symbol_count": 0,
        "missing_spot_count": 0,
        "missing_futures_count": 0,
        "rows_recent_window": 0,
        "recent_window_minutes": DEFAULT_HISTORY_MINUTES,
        "server_time_utc": utc_label(now_ms()),
        "error": error,
    }


def empty_opportunities() -> JsonDict:
    return {
        "top_spot_to_perp": [],
        "top_perp_to_spot": [],
        "funding_shorts_paid": [],
        "funding_longs_paid": [],
        "highest_positive_funding": [],
        "lowest_negative_funding": [],
        "basis_expansion": [],
        "basis_compression": [],
    }


def empty_funding() -> JsonDict:
    return {
        "positive": [],
        "negative": [],
        "distribution": [],
        "changes": [],
        "note": "Public Binance USD-M mark stream, research only.",
    }


def health_from_rows(
    rows: list[JsonDict],
    latest_ts_ms: int | None,
    rows_recent_window: int,
    *,
    db_exists: bool = True,
    table_exists: bool = True,
    schema_ok: bool = True,
    missing_columns: list[str] | None = None,
    error: str = "",
) -> JsonDict:
    """Build the health payload purely from already-loaded latest rows.

    No COUNT(*) and no per-symbol GROUP BY: the background cache loads rows once
    and this derives every health field in memory, so /api/health stays well
    under 100 ms.
    """
    base = empty_health()
    if not db_exists:
        return base
    freshness = age_seconds(latest_ts_ms)
    live_symbols = sum(1 for row in rows if row["status"] == "LIVE")
    stale_count = sum(1 for row in rows if row["status"] != "LIVE")
    missing_spot = sum(1 for row in rows if row["spot_bid"] <= 0 or row["spot_ask"] <= 0)
    missing_fut = sum(1 for row in rows if row["fut_bid"] <= 0 or row["fut_ask"] <= 0)
    tracked = len(rows)
    if error or missing_columns:
        status, collector, api = "DB ERROR", "ERROR", "DB ERROR"
    elif latest_ts_ms and freshness is not None and freshness <= STALE_AFTER_SEC and live_symbols:
        status, collector, api = "LIVE", "RUNNING", "OK"
    elif latest_ts_ms:
        status, collector, api = "STALE", "STALE", "OK"
    else:
        status, collector, api = "DB WARMING", "WAITING", "OK"
    base.update(
        {
            "status": status,
            "collector_status": collector,
            "api_status": api,
            "db_exists": True,
            "table_exists": table_exists,
            "schema_ok": schema_ok,
            "missing_columns": missing_columns or [],
            "latest_ts_ms": latest_ts_ms,
            "latest_update_utc": utc_label(latest_ts_ms),
            "freshness_age_seconds": freshness,
            "tracked_symbols": tracked,
            "live_symbols": live_symbols,
            "stale_symbol_count": stale_count,
            "missing_spot_count": missing_spot,
            "missing_futures_count": missing_fut,
            "rows_recent_window": rows_recent_window,
            "latest_rows_count": tracked,
            "latest_symbols_count": tracked,
            "server_time_utc": utc_label(now_ms()),
            "error": error,
        }
    )
    return base


def fallback_payload(kind: str, error: str = "") -> JsonDict:
    health = empty_health("API RETRY" if error else "DB WARMING", error)
    base: JsonDict = {"ok": False, "kind": kind, "health": health, "error": error}
    if kind == "health":
        return health
    if kind in {"live", "heatmap", "watchlist"}:
        base.update({"rows": [], "count": 0})
    elif kind == "symbols":
        base.update({"symbols": [], "count": 0})
    elif kind == "history":
        base.update({"symbol": "", "minutes": DEFAULT_HISTORY_MINUTES, "rows": []})
    elif kind == "summary":
        base.update(summary_from_rows([], health))
    elif kind == "opportunities":
        base.update(empty_opportunities())
    elif kind == "funding":
        base.update(empty_funding())
    elif kind == "ticker":
        base.update({"rows": [], "symbols": MAJOR_SYMBOLS})
    elif kind == "movers":
        base.update(empty_movers(5))
    elif kind == "debug":
        base.update({"cache_keys": sorted(CACHE), "required_columns": REQUIRED_COLUMNS})
    elif kind == "selftest":
        base.update({"checks": [], "diagnostics": {}, "live_count": 0, "summary_symbols": 0})
    elif kind == "enrichment":
        base.update({"rows": [], "count": 0, "errors": [error] if error else []})
    elif kind == "market_regime":
        base.update({"regime": "UNKNOWN", "signals": [], "scores": {}})
    return base


def payload_has_rows(kind: str, payload: JsonDict) -> bool:
    if kind in {"live", "heatmap", "watchlist", "ticker"}:
        return bool(payload.get("rows"))
    if kind == "symbols":
        return bool(payload.get("symbols"))
    if kind == "summary":
        return bool(payload.get("metrics", {}).get("total_symbols"))
    return payload.get("ok", True) is not False


def cached_payload(key: str, ttl: float, kind: str, builder: PayloadBuilder) -> JsonDict:
    current = time.monotonic()
    cached = CACHE.get(key)
    if cached and current - cached[0] <= ttl:
        payload = clone_payload(cached[1])
        payload.setdefault("cache", {})
        payload["cache"].update({"hit": True, "age_seconds": round(current - cached[0], 3)})
        return payload
    try:
        start = time.perf_counter()
        payload = builder()
        payload.setdefault("ok", True)
        payload.setdefault("cache", {})
        payload["cache"].update({"hit": False, "age_seconds": 0.0})
        payload["endpoint_latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
        CACHE[key] = (current, clone_payload(payload))
        if payload_has_rows(kind, payload):
            LAST_GOOD[kind] = clone_payload(payload)
        return payload
    except Exception as exc:  # noqa: BLE001 - endpoints must always return JSON
        message = f"{type(exc).__name__}: {exc}"
        previous = LAST_GOOD.get(kind) or (cached[1] if cached else None)
        if previous:
            payload = clone_payload(previous)
            payload["ok"] = False
            payload["api_status"] = "API RETRY"
            payload["error"] = message
            payload.setdefault("health", empty_health())
            payload["health"]["status"] = "API RETRY"
            payload["health"]["api_status"] = "API RETRY"
            payload["health"]["error"] = message
            payload.setdefault("cache", {})
            payload["cache"].update({"hit": True, "stale": True, "age_seconds": round(current - cached[0], 3) if cached else None})
            return payload
        return fallback_payload(kind, message)


def table_columns(conn: sqlite3.Connection) -> list[str]:
    try:
        return [row["name"] for row in conn.execute(f"PRAGMA table_info({TABLE_NAME})").fetchall()]
    except sqlite3.Error:
        return []


def schema_state(conn: sqlite3.Connection) -> tuple[bool, list[str], list[str]]:
    columns = table_columns(conn)
    if not columns:
        return False, [], REQUIRED_COLUMNS
    missing = [column for column in REQUIRED_COLUMNS if column not in columns]
    return True, columns, missing


def sqlite_tables(conn: sqlite3.Connection) -> list[str]:
    return [
        row["name"]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        ).fetchall()
    ]


def latest_snapshot_rows(conn: sqlite3.Connection, limit: int = 10) -> tuple[int | None, int, int, list[JsonDict]]:
    latest_row = conn.execute(f"SELECT MAX(ts_ms) AS latest_ts_ms FROM {TABLE_NAME}").fetchone()
    latest_ts_ms = latest_row["latest_ts_ms"] if latest_row else None
    if not latest_ts_ms:
        return None, 0, 0, []
    count_row = conn.execute(f"SELECT COUNT(*) AS count FROM {TABLE_NAME} WHERE ts_ms = ?", (latest_ts_ms,)).fetchone()
    symbol_row = conn.execute(
        f"SELECT COUNT(DISTINCT symbol) AS count FROM {TABLE_NAME} WHERE ts_ms = ?",
        (latest_ts_ms,),
    ).fetchone()
    rows = [
        {
            "symbol": row["symbol"],
            "spot_bid": row["spot_bid"],
            "spot_ask": row["spot_ask"],
            "fut_bid": row["fut_bid"],
            "fut_ask": row["fut_ask"],
            "spot_mid": (row["spot_bid"] + row["spot_ask"]) / 2 if row["spot_bid"] > 0 and row["spot_ask"] > 0 else 0.0,
            "futures_mid": (row["fut_bid"] + row["fut_ask"]) / 2 if row["fut_bid"] > 0 and row["fut_ask"] > 0 else 0.0,
            "spot_to_perp_bps": row["spot_to_perp_bps"],
            "perp_to_spot_bps": row["perp_to_spot_bps"],
            "funding_rate": row["funding_rate"],
            "spot_age_sec": row["spot_age_sec"],
            "fut_age_sec": row["fut_age_sec"],
        }
        for row in conn.execute(
            f"""
            SELECT symbol, spot_bid, spot_ask, fut_bid, fut_ask,
                   spot_to_perp_bps, perp_to_spot_bps, funding_rate,
                   spot_age_sec, fut_age_sec
            FROM {TABLE_NAME}
            WHERE ts_ms = ?
            ORDER BY MAX(ABS(spot_to_perp_bps), ABS(perp_to_spot_bps)) DESC
            LIMIT ?
            """,
            (latest_ts_ms, max(1, limit)),
        ).fetchall()
    ]
    return latest_ts_ms, int(count_row["count"] or 0), int(symbol_row["count"] or 0), rows


def diagnose_db(db_path: str | None = None, sample_limit: int = 10) -> JsonDict:
    resolved_db_path = current_db_path(db_path)
    path = Path(resolved_db_path).expanduser()
    out: JsonDict = {
        "ok": True,
        "cwd": os.getcwd(),
        "db_path": resolved_db_path,
        "db_abs_path": str(db_abs_path(db_path)),
        "db_exists": path.exists(),
        "sqlite_tables": [],
        "table_exists": False,
        "schema_ok": False,
        "columns": [],
        "missing_columns": [],
        "latest_ts_ms": None,
        "latest_update_utc": None,
        "total_rows_count": 0,
        "total_symbols_count": 0,
        "recent_rows_count": 0,
        "latest_rows_count": 0,
        "latest_symbols_count": 0,
        "first_10_latest_rows": [],
        "first_5_latest_rows": [],
        "error": "",
    }
    try:
        conn = open_readonly(db_path)
    except (OSError, sqlite3.Error) as exc:
        out["ok"] = False
        out["error"] = f"{type(exc).__name__}: {exc}"
        return out
    if conn is None:
        return out
    try:
        tables = sqlite_tables(conn)
        table_exists, columns, missing = schema_state(conn)
        out.update(
            {
                "sqlite_tables": tables,
                "table_exists": table_exists,
                "schema_ok": table_exists and not missing,
                "columns": columns,
                "missing_columns": missing,
            }
        )
        if table_exists and not missing:
            cutoff = int((time.time() - DEFAULT_HISTORY_MINUTES * 60) * 1000)
            total_row = conn.execute(f"SELECT COUNT(*) AS count FROM {TABLE_NAME}").fetchone()
            total_symbol_row = conn.execute(f"SELECT COUNT(DISTINCT symbol) AS count FROM {TABLE_NAME}").fetchone()
            recent_row = conn.execute(f"SELECT COUNT(*) AS count FROM {TABLE_NAME} WHERE ts_ms >= ?", (cutoff,)).fetchone()
            latest_ts_ms, latest_count, latest_symbol_count, rows = latest_snapshot_rows(conn, sample_limit)
            out.update(
                {
                    "total_rows_count": int(total_row["count"] or 0) if total_row else 0,
                    "total_symbols_count": int(total_symbol_row["count"] or 0) if total_symbol_row else 0,
                    "recent_rows_count": int(recent_row["count"] or 0) if recent_row else 0,
                    "latest_ts_ms": latest_ts_ms,
                    "latest_update_utc": utc_label(latest_ts_ms),
                    "latest_rows_count": latest_count,
                    "latest_symbols_count": latest_symbol_count,
                    "first_10_latest_rows": rows,
                    "first_5_latest_rows": rows[:5],
                }
            )
    except sqlite3.Error as exc:
        out["ok"] = False
        out["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        conn.close()
    return out


def row_to_dict(row: sqlite3.Row) -> JsonDict:
    data = {key: row[key] for key in row.keys()}
    spot_bid = safe_float(data.get("spot_bid"))
    spot_ask = safe_float(data.get("spot_ask"))
    fut_bid = safe_float(data.get("fut_bid"))
    fut_ask = safe_float(data.get("fut_ask"))
    spot_mid = (spot_bid + spot_ask) / 2 if spot_bid > 0 and spot_ask > 0 else 0.0
    futures_mid = (fut_bid + fut_ask) / 2 if fut_bid > 0 and fut_ask > 0 else 0.0
    spot_spread_bps = ((spot_ask - spot_bid) / spot_mid) * 10000 if spot_mid > 0 else 0.0
    futures_spread_bps = ((fut_ask - fut_bid) / futures_mid) * 10000 if futures_mid > 0 else 0.0
    spot_to_perp = safe_float(data.get("spot_to_perp_bps"))
    perp_to_spot = safe_float(data.get("perp_to_spot_bps"))
    feed_age = max(safe_float(data.get("spot_age_sec"), 9999.0), safe_float(data.get("fut_age_sec"), 9999.0))
    snapshot_age = age_seconds(data.get("ts_ms")) or 9999.0
    age = max(feed_age, snapshot_age)
    status = "STALE" if age > STALE_AFTER_SEC else "LIVE"
    if spot_bid <= 0 or spot_ask <= 0:
        status = "NO SPOT"
    if fut_bid <= 0 or fut_ask <= 0:
        status = "NO FUT"
    spread_quality = max(0.0, 25.0 - min(25.0, spot_spread_bps + futures_spread_bps))
    freshness_quality = max(0.0, STALE_AFTER_SEC - min(STALE_AFTER_SEC, age))
    abs_basis = round(max(abs(spot_to_perp), abs(perp_to_spot)), 6)
    data.update(
        {
            "snapshot_age_seconds": round(snapshot_age, 3),
            "feed_age_seconds": round(feed_age, 3),
            "age_seconds": round(age, 3),
            "abs_basis_bps": abs_basis,
            "abs_opportunity_bps": abs_basis,
            "spot_mid": spot_mid,
            "futures_mid": futures_mid,
            "spot_spread_bps": spot_spread_bps,
            "futures_spread_bps": futures_spread_bps,
            "mid_spread_bps": ((futures_mid - spot_mid) / spot_mid) * 10000 if spot_mid > 0 else 0.0,
            "opportunity_score": abs_basis + spread_quality + freshness_quality,
            "status": status,
            "is_major": data.get("symbol") in MAJOR_SYMBOLS,
        }
    )
    return data


# Bounded number of most-recent rows to scan per read. The collector writes one
# row per tracked symbol per snapshot, so a few thousand recent rows always
# contain the latest snapshot for every symbol. This keeps reads O(limit) on the
# ts_ms index instead of scanning the whole (multi-million row) table.
RECENT_READ_LIMIT = int(os.environ.get("BSLAB_RECENT_READ_LIMIT", "15000"))


def read_recent_raw(conn: sqlite3.Connection, cap: int = RECENT_READ_LIMIT) -> list[sqlite3.Row]:
    """Read the most recent rows using the ts_ms index. Bounded and fast."""
    return conn.execute(
        f"SELECT * FROM {TABLE_NAME} ORDER BY ts_ms DESC LIMIT ?",
        (max(1, cap),),
    ).fetchall()


def dedupe_latest(rows: list[sqlite3.Row]) -> list[sqlite3.Row]:
    """Keep the newest row per symbol from a ts-descending result set."""
    latest: dict[str, sqlite3.Row] = {}
    for row in rows:
        symbol = row["symbol"]
        if symbol not in latest:
            latest[symbol] = row
    return list(latest.values())


def read_latest_rows(conn: sqlite3.Connection, limit: int | None = None) -> list[JsonDict]:
    raw = read_recent_raw(conn)
    dicts = [row_to_dict(row) for row in dedupe_latest(raw)]
    dicts.sort(key=lambda row: row["abs_basis_bps"], reverse=True)
    if limit:
        dicts = dicts[: max(1, min(1500, limit))]
    return dicts


def read_health_uncached() -> JsonDict:
    health = empty_health()
    debug = diagnose_db(DB_PATH)
    if not debug["db_exists"]:
        return health
    if debug["error"]:
        return {**health, "status": "DB ERROR", "api_status": "DB ERROR", "collector_status": "ERROR", "db_exists": True, "error": debug["error"]}
    if not debug["table_exists"]:
        return {**health, "db_exists": True, "sqlite_tables": debug["sqlite_tables"]}
    if debug["missing_columns"]:
        return {
            **health,
            "status": "DB ERROR",
            "api_status": "DB ERROR",
            "collector_status": "ERROR",
            "db_exists": True,
            "table_exists": True,
            "missing_columns": debug["missing_columns"],
            "error": f"{TABLE_NAME} missing columns: {', '.join(debug['missing_columns'])}",
        }
    try:
        conn = open_readonly()
    except (OSError, sqlite3.Error) as exc:
        return {
            **health,
            "status": "DB ERROR",
            "api_status": "DB ERROR",
            "collector_status": "ERROR",
            "db_exists": True,
            "table_exists": True,
            "schema_ok": True,
            "error": f"{type(exc).__name__}: {exc}",
        }
    if conn is None:
        return health
    try:
        latest_row = conn.execute(f"SELECT MAX(ts_ms) AS latest_ts_ms FROM {TABLE_NAME}").fetchone()
        latest_ts_ms = latest_row["latest_ts_ms"] if latest_row else None
        symbol_row = conn.execute(f"SELECT COUNT(DISTINCT symbol) AS count FROM {TABLE_NAME}").fetchone()
        tracked_symbols = int(symbol_row["count"] or 0) if symbol_row else 0
        recent_cutoff = int((time.time() - DEFAULT_HISTORY_MINUTES * 60) * 1000)
        recent_row = conn.execute(f"SELECT COUNT(*) AS count FROM {TABLE_NAME} WHERE ts_ms >= ?", (recent_cutoff,)).fetchone()
        rows_recent = int(recent_row["count"] or 0) if recent_row else 0
        rows = read_latest_rows(conn)
    finally:
        conn.close()

    freshness = age_seconds(latest_ts_ms)
    stale_count = sum(1 for row in rows if row["status"] != "LIVE")
    missing_spot = sum(1 for row in rows if row["spot_bid"] <= 0 or row["spot_ask"] <= 0)
    missing_futures = sum(1 for row in rows if row["fut_bid"] <= 0 or row["fut_ask"] <= 0)
    live_symbols = sum(1 for row in rows if row["status"] == "LIVE")
    if latest_ts_ms and freshness is not None and freshness <= STALE_AFTER_SEC and live_symbols:
        status = "LIVE"
        collector_status = "RUNNING"
    elif latest_ts_ms:
        status = "STALE"
        collector_status = "STALE"
    else:
        status = "DB WARMING"
        collector_status = "WAITING"
    return {
        **health,
        "status": status,
        "collector_status": collector_status,
        "db_exists": True,
        "table_exists": True,
        "schema_ok": True,
        "missing_columns": [],
        "latest_ts_ms": latest_ts_ms,
        "latest_update_utc": utc_label(latest_ts_ms),
        "freshness_age_seconds": freshness,
        "tracked_symbols": tracked_symbols,
        "live_symbols": live_symbols,
        "stale_symbol_count": stale_count,
        "missing_spot_count": missing_spot,
        "missing_futures_count": missing_futures,
        "rows_recent_window": rows_recent,
        "latest_rows_count": debug["latest_rows_count"],
        "latest_symbols_count": debug["latest_symbols_count"],
        "server_time_utc": utc_label(now_ms()),
        "error": "",
    }


def read_health() -> JsonDict:
    return cached_payload("health", 0.75, "health", read_health_uncached)


def opportunities_from_rows(rows: list[JsonDict]) -> JsonDict:
    spot = sorted(
        [row for row in rows if row["spot_ask"] < row["fut_bid"] and row["spot_to_perp_bps"] > 0],
        key=lambda row: (row["opportunity_score"], row["spot_to_perp_bps"]),
        reverse=True,
    )[:24]
    perp = sorted(
        [row for row in rows if row["fut_ask"] < row["spot_bid"] and row["perp_to_spot_bps"] > 0],
        key=lambda row: (row["opportunity_score"], row["perp_to_spot_bps"]),
        reverse=True,
    )[:24]
    positive_funding = sorted(rows, key=lambda row: row["funding_rate"], reverse=True)[:24]
    negative_funding = sorted(rows, key=lambda row: row["funding_rate"])[:24]
    return {
        "top_spot_to_perp": spot,
        "top_perp_to_spot": perp,
        "funding_shorts_paid": positive_funding,
        "funding_longs_paid": negative_funding,
        "highest_positive_funding": positive_funding,
        "lowest_negative_funding": negative_funding,
    }


def summary_from_rows(rows: list[JsonDict], health: JsonDict) -> JsonDict:
    abs_values = [safe_float(row.get("abs_basis_bps")) for row in rows]
    spreads = [safe_float(row.get("spot_spread_bps")) + safe_float(row.get("futures_spread_bps")) for row in rows]
    metrics = {
        "total_symbols": health.get("tracked_symbols", 0),
        "live_symbols": health.get("live_symbols", 0),
        "stale_symbols": health.get("stale_symbol_count", 0),
        "max_spot_to_perp_bps": max((safe_float(row.get("spot_to_perp_bps")) for row in rows), default=None),
        "max_perp_to_spot_bps": max((safe_float(row.get("perp_to_spot_bps")) for row in rows), default=None),
        "highest_funding_rate": max((safe_float(row.get("funding_rate")) for row in rows), default=None),
        "lowest_funding_rate": min((safe_float(row.get("funding_rate")) for row in rows), default=None),
        "median_abs_basis_bps": statistics.median(abs_values) if abs_values else None,
        "p95_abs_basis_bps": percentile(abs_values, 0.95),
        "median_combined_spread_bps": statistics.median(spreads) if spreads else None,
        "symbols_above_25_bps": sum(1 for value in abs_values if value >= 25),
        "symbols_above_50_bps": sum(1 for value in abs_values if value >= 50),
        "symbols_above_100_bps": sum(1 for value in abs_values if value >= 100),
        "freshest_update_age_seconds": min((safe_float(row.get("age_seconds"), 9999.0) for row in rows), default=health.get("freshness_age_seconds")),
        "collector_age_seconds": health.get("freshness_age_seconds"),
        "last_db_update_utc": health.get("latest_update_utc"),
        "missing_spot_count": health.get("missing_spot_count", 0),
        "missing_futures_count": health.get("missing_futures_count", 0),
    }
    payload = {
        "ok": True,
        "health": health,
        "metrics": metrics,
        **opportunities_from_rows(rows),
    }
    return payload


def build_live(limit: int = 300) -> JsonDict:
    health = read_health()
    conn = open_readonly()
    if conn is None or not health.get("schema_ok"):
        return {"ok": True, "rows": [], "count": 0, "health": health}
    try:
        rows = read_latest_rows(conn, limit)
    finally:
        conn.close()
    return {"ok": True, "rows": rows, "count": len(rows), "health": health}


def build_summary() -> JsonDict:
    health = read_health()
    conn = open_readonly()
    if conn is None or not health.get("schema_ok"):
        return summary_from_rows([], health)
    try:
        rows = read_latest_rows(conn)
    finally:
        conn.close()
    return summary_from_rows(rows, health)


def build_symbols() -> JsonDict:
    health = read_health()
    conn = open_readonly()
    if conn is None or not health.get("schema_ok"):
        return {"ok": True, "symbols": [], "count": 0, "health": health}
    try:
        symbols = [row["symbol"] for row in conn.execute(f"SELECT DISTINCT symbol FROM {TABLE_NAME} ORDER BY symbol").fetchall()]
    finally:
        conn.close()
    return {"ok": True, "symbols": symbols, "count": len(symbols), "health": health}


def build_history(symbol: str, minutes: int) -> JsonDict:
    health = read_health()
    conn = open_readonly()
    symbol = "".join(ch for ch in symbol.upper() if ch.isalnum())
    if conn is None or not health.get("schema_ok") or not symbol:
        return {"ok": True, "symbol": symbol, "minutes": minutes, "rows": [], "health": health}
    try:
        if minutes <= 0:
            params: tuple[Any, ...] = (symbol,)
            where = "symbol = ?"
        else:
            params = (symbol, int((time.time() - minutes * 60) * 1000))
            where = "symbol = ? AND ts_ms >= ?"
        rows = [
            row_to_dict(row)
            for row in conn.execute(
                f"""
                SELECT *
                FROM {TABLE_NAME}
                WHERE {where}
                ORDER BY ts_ms ASC
                LIMIT 5000
                """,
                params,
            ).fetchall()
        ]
    finally:
        conn.close()
    return {"ok": True, "symbol": symbol, "minutes": minutes, "rows": rows, "health": health}


def build_ticker() -> JsonDict:
    health = read_health()
    conn = open_readonly()
    if conn is None or not health.get("schema_ok"):
        return {"ok": True, "symbols": MAJOR_SYMBOLS, "rows": [], "health": health}
    try:
        rows = read_latest_rows(conn)
    finally:
        conn.close()
    by_symbol = {row["symbol"]: row for row in rows}
    ticker = [by_symbol[symbol] for symbol in MAJOR_SYMBOLS if symbol in by_symbol]
    if not ticker:
        ticker = rows[: min(10, len(rows))]
    return {"ok": True, "symbols": MAJOR_SYMBOLS, "rows": ticker, "health": health}


def build_watchlist(symbols: list[str] | None = None, limit: int = 32) -> JsonDict:
    live = build_live(600)
    rows = live["rows"]
    by_symbol = {row["symbol"]: row for row in rows}
    requested = []
    for symbol in symbols or []:
        normalized = "".join(ch for ch in symbol.upper() if ch.isalnum())
        if normalized:
            requested.append(normalized)
    selected: list[JsonDict] = []
    seen = set()
    for symbol in requested + MAJOR_SYMBOLS:
        row = by_symbol.get(symbol)
        if row and symbol not in seen:
            selected.append({**row, "watch_source": "pinned" if symbol in requested else "major"})
            seen.add(symbol)
    for row in sorted(rows, key=lambda item: item["abs_basis_bps"], reverse=True):
        if row["symbol"] not in seen:
            selected.append({**row, "watch_source": "top_basis"})
            seen.add(row["symbol"])
        if len(selected) >= max(1, min(100, limit)):
            break
    return {"ok": True, "rows": selected[:limit], "count": len(selected[:limit]), "health": live["health"], "symbols": [row["symbol"] for row in selected[:limit]]}


def build_heatmap(limit: int = 300, mode: str = "basis") -> JsonDict:
    live = build_live(limit)
    if mode == "funding":
        rows = sorted(live["rows"], key=lambda row: abs(row["funding_rate"]), reverse=True)
    else:
        rows = sorted(live["rows"], key=lambda row: row["abs_basis_bps"], reverse=True)
    return {"ok": True, "rows": rows, "count": len(rows), "mode": mode, "health": live["health"]}


def build_opportunities() -> JsonDict:
    live = build_live(600)
    movers = build_movers(15)
    return {
        "ok": True,
        "health": live["health"],
        **opportunities_from_rows(live["rows"]),
        "basis_expansion": movers.get("top_basis_widening", []),
        "basis_compression": movers.get("top_basis_compression", []),
        "note": "Research-only signal board. No execution or account access.",
    }


def funding_from_rows(rows: list[JsonDict], changes: list[JsonDict] | None = None) -> JsonDict:
    positive = sorted(rows, key=lambda row: row["funding_rate"], reverse=True)[:50]
    negative = sorted(rows, key=lambda row: row["funding_rate"])[:50]
    values = [safe_float(row["funding_rate"]) * 100 for row in rows]
    bins = [{"from": round(-0.15 + i * (0.30 / 16), 4), "to": round(-0.15 + (i + 1) * (0.30 / 16), 4), "count": 0} for i in range(16)]
    for value in values:
        idx = int((value + 0.15) / 0.30 * len(bins))
        idx = max(0, min(len(bins) - 1, idx))
        bins[idx]["count"] += 1
    return {
        "ok": True,
        "positive": positive,
        "negative": negative,
        "distribution": bins,
        "changes": changes or [],
        "note": "Public Binance USD-M mark stream, research only.",
    }


def build_funding() -> JsonDict:
    live = build_live(600)
    movers = build_movers(15)
    changes = sorted(movers.get("rows", []), key=lambda row: abs(row.get("funding_change", 0.0)), reverse=True)[:30]
    return {**funding_from_rows(live["rows"], changes), "health": live["health"]}


def empty_movers(minutes: int) -> JsonDict:
    return {
        "ok": True,
        "minutes": minutes,
        "rows": [],
        "top_spot_up": [],
        "top_spot_down": [],
        "top_futures_up": [],
        "top_futures_down": [],
        "top_basis_widening": [],
        "top_basis_compression": [],
    }


def compute_movers_rows(conn: sqlite3.Connection, minutes: int) -> JsonDict:
    """Bounded movers computation over a single time window. No health read,
    no full scan: the window is filtered by the ts_ms index."""
    cutoff = int((time.time() - minutes * 60) * 1000)
    rows = conn.execute(
        f"""
        WITH points AS (
          SELECT symbol, MIN(ts_ms) AS first_ts, MAX(ts_ms) AS last_ts
          FROM {TABLE_NAME}
          WHERE ts_ms >= ?
          GROUP BY symbol
        )
        SELECT
          f.symbol,
          f.ts_ms AS first_ts_ms,
          l.ts_ms AS last_ts_ms,
          f.spot_bid AS first_spot_bid,
          f.spot_ask AS first_spot_ask,
          l.spot_bid AS last_spot_bid,
          l.spot_ask AS last_spot_ask,
          f.fut_bid AS first_fut_bid,
          f.fut_ask AS first_fut_ask,
          l.fut_bid AS last_fut_bid,
          l.fut_ask AS last_fut_ask,
          f.spot_to_perp_bps AS first_spot_to_perp_bps,
          l.spot_to_perp_bps AS last_spot_to_perp_bps,
          f.perp_to_spot_bps AS first_perp_to_spot_bps,
          l.perp_to_spot_bps AS last_perp_to_spot_bps,
          f.funding_rate AS first_funding_rate,
          l.funding_rate AS last_funding_rate
        FROM points p
        JOIN {TABLE_NAME} f ON f.symbol = p.symbol AND f.ts_ms = p.first_ts
        JOIN {TABLE_NAME} l ON l.symbol = p.symbol AND l.ts_ms = p.last_ts
        WHERE p.first_ts < p.last_ts
        LIMIT 1500
        """,
        (cutoff,),
    ).fetchall()

    out: list[JsonDict] = []
    for row in rows:
        first_spot_mid = (safe_float(row["first_spot_bid"]) + safe_float(row["first_spot_ask"])) / 2
        last_spot_mid = (safe_float(row["last_spot_bid"]) + safe_float(row["last_spot_ask"])) / 2
        first_fut_mid = (safe_float(row["first_fut_bid"]) + safe_float(row["first_fut_ask"])) / 2
        last_fut_mid = (safe_float(row["last_fut_bid"]) + safe_float(row["last_fut_ask"])) / 2
        first_abs = max(abs(safe_float(row["first_spot_to_perp_bps"])), abs(safe_float(row["first_perp_to_spot_bps"])))
        last_abs = max(abs(safe_float(row["last_spot_to_perp_bps"])), abs(safe_float(row["last_perp_to_spot_bps"])))
        out.append(
            {
                "symbol": row["symbol"],
                "first_ts_ms": row["first_ts_ms"],
                "last_ts_ms": row["last_ts_ms"],
                "spot_mid_change_pct": pct_change(first_spot_mid, last_spot_mid),
                "futures_mid_change_pct": pct_change(first_fut_mid, last_fut_mid),
                "basis_change_bps": last_abs - first_abs,
                "funding_change": safe_float(row["last_funding_rate"]) - safe_float(row["first_funding_rate"]),
                "last_abs_basis_bps": last_abs,
            }
        )
    return {
        "ok": True,
        "minutes": minutes,
        "rows": sorted(out, key=lambda row: abs(row["spot_mid_change_pct"] or 0), reverse=True)[:300],
        "top_spot_up": sorted(out, key=lambda row: row["spot_mid_change_pct"] or -999, reverse=True)[:30],
        "top_spot_down": sorted(out, key=lambda row: row["spot_mid_change_pct"] or 999)[:30],
        "top_futures_up": sorted(out, key=lambda row: row["futures_mid_change_pct"] or -999, reverse=True)[:30],
        "top_futures_down": sorted(out, key=lambda row: row["futures_mid_change_pct"] or 999)[:30],
        "top_basis_widening": sorted(out, key=lambda row: row["basis_change_bps"], reverse=True)[:30],
        "top_basis_compression": sorted(out, key=lambda row: row["basis_change_bps"])[:30],
    }


def build_movers(minutes: int) -> JsonDict:
    health = read_health()
    conn = open_readonly()
    if conn is None or not health.get("schema_ok"):
        return {**empty_movers(minutes), "health": health}
    try:
        data = compute_movers_rows(conn, minutes)
    finally:
        conn.close()
    return {**data, "health": health}


def regime_from_rows(rows: list[JsonDict], metrics: JsonDict) -> JsonDict:
    total = max(1, len(rows))
    positive_funding = sum(1 for row in rows if row.get("funding_rate", 0) > 0)
    negative_funding = sum(1 for row in rows if row.get("funding_rate", 0) < 0)
    elevated_basis = sum(1 for row in rows if row.get("abs_basis_bps", 0) >= 25)
    hot_basis = sum(1 for row in rows if row.get("abs_basis_bps", 0) >= 50)
    stale = sum(1 for row in rows if row.get("status") != "LIVE")
    funding_bias = (positive_funding - negative_funding) / total
    basis_pressure = elevated_basis / total
    stale_ratio = stale / total
    if stale_ratio > 0.5:
        regime = "DATA STALE"
    elif hot_basis >= 8 or basis_pressure > 0.25:
        regime = "BASIS ACTIVE"
    elif abs(funding_bias) > 0.35:
        regime = "FUNDING SKEWED"
    else:
        regime = "ORDERLY"
    signals = [
        {"label": "Funding bias", "value": funding_bias, "text": "positive" if funding_bias > 0 else "negative" if funding_bias < 0 else "neutral"},
        {"label": "Basis pressure", "value": basis_pressure, "text": f"{elevated_basis} symbols >= 25 bps"},
        {"label": "Hot basis", "value": hot_basis, "text": f"{hot_basis} symbols >= 50 bps"},
        {"label": "Stale ratio", "value": stale_ratio, "text": f"{stale} stale rows"},
    ]
    return {
        "ok": True,
        "regime": regime,
        "signals": signals,
        "scores": {
            "funding_bias": funding_bias,
            "basis_pressure": basis_pressure,
            "stale_ratio": stale_ratio,
            "median_abs_basis_bps": metrics.get("median_abs_basis_bps"),
            "p95_abs_basis_bps": metrics.get("p95_abs_basis_bps"),
        },
    }


def build_market_regime() -> JsonDict:
    summary = build_summary()
    live = build_live(600)
    payload = regime_from_rows(live.get("rows", []), summary.get("metrics", {}))
    payload["health"] = live.get("health")
    return payload


def build_enrichment(symbols: list[str] | None = None, limit: int = 12) -> JsonDict:
    if symbols:
        selected = symbols
    else:
        watchlist = build_watchlist(limit=limit)
        selected = watchlist.get("symbols", [])[:limit]
    try:
        from .web_enrich import enrich_symbols

        payload = enrich_symbols(selected, max_symbols=limit)
        payload["health"] = read_health()
        return payload
    except Exception as exc:  # noqa: BLE001 - optional public REST must not break dashboard
        return {
            "ok": False,
            "source": "Binance USD-M public REST",
            "rows": [],
            "count": 0,
            "requested_symbols": selected,
            "errors": [f"{type(exc).__name__}: {exc}"],
            "health": read_health(),
            "note": "Optional enrichment failed; core SQLite dashboard is still usable.",
        }


def build_debug() -> JsonDict:
    health = read_health()
    diagnostics = diagnose_db(DB_PATH, sample_limit=10)
    live_probe = build_live(10)
    summary_probe = build_summary()
    return {
        "ok": True,
        "health": health,
        **diagnostics,
        "live_probe": {
            "ok": live_probe.get("ok"),
            "count": live_probe.get("count", 0),
            "symbols": [row.get("symbol") for row in live_probe.get("rows", [])[:10]],
        },
        "summary_probe": {
            "ok": summary_probe.get("ok"),
            "total_symbols": summary_probe.get("metrics", {}).get("total_symbols", 0),
            "live_symbols": summary_probe.get("metrics", {}).get("live_symbols", 0),
        },
        "cache_keys": sorted(CACHE),
        "cache_size": len(CACHE),
        "required_columns": REQUIRED_COLUMNS,
        "table_name": TABLE_NAME,
        "major_symbols": MAJOR_SYMBOLS,
        "stale_after_sec": STALE_AFTER_SEC,
        "server_time_utc": utc_label(now_ms()),
    }


def build_selftest() -> JsonDict:
    diagnostics = diagnose_db(DB_PATH, sample_limit=10)
    live = build_live(20)
    summary = build_summary()
    has_collector_rows = diagnostics.get("total_rows_count", 0) > 0
    checks = [
        {"name": "db_exists", "ok": bool(diagnostics["db_exists"]), "detail": diagnostics["db_abs_path"]},
        {"name": "tables_readable", "ok": bool(diagnostics["table_exists"] and not diagnostics["error"]), "detail": ", ".join(diagnostics["sqlite_tables"]) or "none"},
        {"name": "schema_ok", "ok": bool(diagnostics["schema_ok"]), "detail": ", ".join(diagnostics["missing_columns"]) or "ok"},
        {
            "name": "latest_rows_present_if_written",
            "ok": (not has_collector_rows) or diagnostics["latest_rows_count"] > 0,
            "detail": f"latest_rows={diagnostics['latest_rows_count']} total_rows={diagnostics.get('total_rows_count', 0)}",
        },
        {
            "name": "live_endpoint_rows",
            "ok": (not has_collector_rows) or live.get("count", 0) > 0,
            "detail": f"rows={live.get('count', 0)}",
        },
        {
            "name": "summary_symbols",
            "ok": (not has_collector_rows) or summary.get("metrics", {}).get("total_symbols", 0) > 0,
            "detail": f"symbols={summary.get('metrics', {}).get('total_symbols', 0)}",
        },
    ]
    return {
        "ok": all(check["ok"] for check in checks),
        "checks": checks,
        "diagnostics": diagnostics,
        "health": read_health(),
        "live_count": live.get("count", 0),
        "summary_symbols": summary.get("metrics", {}).get("total_symbols", 0),
    }
