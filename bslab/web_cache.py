"""In-memory market cache for the dashboard.

Architecture: the collector writes SQLite; this module reads SQLite *once* per
refresh in the background and precomputes every payload the dashboard needs;
HTTP endpoints then serve those precomputed structures straight from memory.

No HTTP request scans SQLite. A single bounded "recent rows" read (ts_ms index,
hard LIMIT) replaces the old per-request `GROUP BY symbol` / `COUNT(*)` full
scans that pinned EC2 CPU at 100% and pushed latency to tens of seconds.
"""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import threading
import time
from typing import Any, Optional

from . import web_queries as q

JsonDict = dict[str, Any]

REFRESH_INTERVAL_SEC = float(os.environ.get("BSLAB_CACHE_REFRESH_SEC", "1.5"))
MOVERS_INTERVAL_SEC = float(os.environ.get("BSLAB_CACHE_MOVERS_SEC", "15"))
# Endpoints trigger a synchronous refresh only if the background loop has not
# kept the cache within this age (covers startup races / test clients with no
# running loop). In production the loop keeps it fresh and this never fires.
MAX_STALE_SEC = max(REFRESH_INTERVAL_SEC * 3.0, 4.0)
MOVER_WINDOWS = (1, 5, 15, 60)
MAJORS = set(q.MAJOR_SYMBOLS)


def q_num(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return float("-inf")


def _combined_spread(row: JsonDict) -> float:
    return q.safe_float(row.get("spot_spread_bps")) + q.safe_float(row.get("futures_spread_bps"))


def _filter_rows(rows: list[JsonDict], f: str) -> list[JsonDict]:
    """Server-side radar filters mirroring the frontend chips (payload shrinks
    for narrow filters). Search + sort stay client-side for interactivity."""
    if not f or f == "all":
        return rows
    if f == "spot":
        return [r for r in rows if r["spot_ask"] < r["fut_bid"] and r["spot_to_perp_bps"] > 0]
    if f == "perp":
        return [r for r in rows if r["fut_ask"] < r["spot_bid"] and r["perp_to_spot_bps"] > 0]
    if f == "fundpos":
        return [r for r in rows if r["funding_rate"] > 0]
    if f == "fundneg":
        return [r for r in rows if r["funding_rate"] < 0]
    if f in {"25", "50", "100"}:
        threshold = float(f)
        return [r for r in rows if r["abs_basis_bps"] >= threshold]
    if f == "fresh":
        return [r for r in rows if r["status"] == "LIVE"]
    if f == "stale":
        return [r for r in rows if r["status"] != "LIVE"]
    if f == "major":
        return [r for r in rows if r["symbol"] in MAJORS]
    if f == "alts":
        return [r for r in rows if r["symbol"] not in MAJORS]
    if f == "wide":
        return [r for r in rows if _combined_spread(r) >= 10]
    if f == "tight":
        return [r for r in rows if _combined_spread(r) < 5]
    return rows


class MarketCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._snapshot: Optional[JsonDict] = None
        self._state_json: str = ""
        self._lite: Optional[JsonDict] = None
        self._lite_json: str = ""
        self._sizes: dict[str, int] = {}
        self._movers: dict[int, JsonDict] = {}
        self._db_path: Optional[str] = None
        self._task: Optional[asyncio.Task] = None
        # metrics
        self.last_refresh_ms: float = 0.0
        self.last_refresh_utc: Optional[str] = None
        self._last_refresh_monotonic: float = 0.0
        self._last_movers_monotonic: float = 0.0
        self.row_count: int = 0
        self.symbol_count: int = 0
        self.latest_ts_ms: Optional[int] = None
        self.last_error: str = ""
        self.refresh_count: int = 0
        self.failed_refresh_count: int = 0

    # ---- lifecycle --------------------------------------------------------
    async def start(self) -> None:
        # Prime the cache synchronously so the very first page paint has data.
        await asyncio.to_thread(self.refresh)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
            self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(REFRESH_INTERVAL_SEC)
                await asyncio.to_thread(self.refresh)
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001 - loop must never die
                self._record_failure(f"loop: {type(exc).__name__}: {exc}")

    def reset(self) -> None:
        with self._lock:
            self._snapshot = None
            self._state_json = ""
            self._movers = {}
            self._db_path = None
            self._last_refresh_monotonic = 0.0
            self._last_movers_monotonic = 0.0
            self.latest_ts_ms = None
            self.last_error = ""

    # ---- refresh ----------------------------------------------------------
    def refresh(self) -> JsonDict:
        with self._lock:
            return self._refresh_locked()

    def refresh_if_stale(self, max_age: float | None = None) -> JsonDict:
        max_age = MAX_STALE_SEC if max_age is None else max_age
        snapshot = self._snapshot
        if (
            snapshot is not None
            and self._db_path == q.current_db_path()
            and (time.monotonic() - self._last_refresh_monotonic) <= max_age
        ):
            return snapshot
        with self._lock:
            if (
                self._snapshot is not None
                and self._db_path == q.current_db_path()
                and (time.monotonic() - self._last_refresh_monotonic) <= max_age
            ):
                return self._snapshot
            return self._refresh_locked()

    def _record_failure(self, message: str) -> None:
        self.failed_refresh_count += 1
        self.last_error = message

    def _refresh_locked(self) -> JsonDict:
        start = time.perf_counter()
        db_path = q.current_db_path()
        self._db_path = db_path

        conn = None
        try:
            conn = q.open_readonly(db_path)
        except (OSError, sqlite3.Error) as exc:
            self._record_failure(f"open: {type(exc).__name__}: {exc}")
            return self._snapshot or self._store(self._compose([], None, 0, 0, db_exists=False))

        if conn is None:  # DB file does not exist yet
            return self._store(self._compose([], None, 0, 0, db_exists=False))

        try:
            table_exists, _columns, missing = q.schema_state(conn)
            if not table_exists:
                return self._store(
                    self._compose([], None, 0, 0, table_exists=False, schema_ok=False,
                                  error="basis_snapshots table not found")
                )
            raw = q.read_recent_raw(conn)
            latest = q.dedupe_latest(raw)
            live = [q.row_to_dict(row) for row in latest]
            live.sort(key=lambda row: row["abs_basis_bps"], reverse=True)
            latest_ts_ms = raw[0]["ts_ms"] if raw else None
            cutoff = int((time.time() - q.DEFAULT_HISTORY_MINUTES * 60) * 1000)
            recent_count = sum(1 for row in raw if row["ts_ms"] >= cutoff)
            rowcount_row = conn.execute(f"SELECT MAX(_rowid_) AS n FROM {q.TABLE_NAME}").fetchone()
            row_count = int(rowcount_row["n"] or 0) if rowcount_row else 0

            if (
                not self._movers
                or (time.monotonic() - self._last_movers_monotonic) >= MOVERS_INTERVAL_SEC
            ):
                self._movers = {m: q.compute_movers_rows(conn, m) for m in MOVER_WINDOWS}
                self._last_movers_monotonic = time.monotonic()
        except sqlite3.OperationalError as exc:
            # Busy / locked / slow read: keep the last good snapshot.
            self._record_failure(f"{type(exc).__name__}: {exc}")
            return self._snapshot or self._store(self._compose([], None, 0, 0))
        except sqlite3.Error as exc:
            self._record_failure(f"{type(exc).__name__}: {exc}")
            return self._snapshot or self._store(self._compose([], None, 0, 0))
        finally:
            try:
                conn.close()
            except sqlite3.Error:
                pass

        snapshot = self._compose(live, latest_ts_ms, recent_count, row_count, missing=missing)
        self.last_refresh_ms = round((time.perf_counter() - start) * 1000, 2)
        self.last_refresh_utc = q.utc_label(q.now_ms())
        self._last_refresh_monotonic = time.monotonic()
        self.refresh_count += 1
        self.last_error = ""
        self.row_count = row_count
        self.symbol_count = len(live)
        self.latest_ts_ms = latest_ts_ms
        return self._store(snapshot)

    def _store(self, snapshot: JsonDict) -> JsonDict:
        self._snapshot = snapshot
        live = snapshot.get("live", [])
        # Compact payload the frontend polls every ~1.5s: header + metrics +
        # ticker + a 50-row radar preview. Kept small (< 100 KB) on purpose.
        lite = {
            "ok": True,
            "generated_ms": snapshot.get("generated_ms"),
            "health": snapshot.get("health", {}),
            "cache": snapshot.get("cache", {}),
            "metrics": snapshot.get("summary", {}).get("metrics", {}),
            "ticker": snapshot.get("ticker", []),
            "radar_top": live[:50],
            "symbol_count": len(live),
        }
        self._lite = lite
        try:
            self._state_json = json.dumps(snapshot, default=str)
        except (TypeError, ValueError):
            self._state_json = ""
        try:
            self._lite_json = json.dumps(lite, default=str)
        except (TypeError, ValueError):
            self._lite_json = ""
        self._sizes = {
            "state_bytes": len(self._state_json),
            "state_lite_bytes": len(self._lite_json),
        }
        return snapshot

    # ---- payload assembly -------------------------------------------------
    def _compose(
        self,
        live: list[JsonDict],
        latest_ts_ms: int | None,
        recent_count: int,
        row_count: int,
        *,
        db_exists: bool = True,
        table_exists: bool = True,
        schema_ok: bool = True,
        missing: list[str] | None = None,
        error: str = "",
    ) -> JsonDict:
        missing = missing or []
        health = q.health_from_rows(
            live,
            latest_ts_ms,
            recent_count,
            db_exists=db_exists,
            table_exists=table_exists,
            schema_ok=schema_ok and not missing,
            missing_columns=missing,
            error=error or (f"missing columns: {', '.join(missing)}" if missing else ""),
        )
        summary = q.summary_from_rows(live, health)
        metrics = summary.get("metrics", {})
        movers15 = self._movers.get(15, {})
        opportunities = {
            "ok": True,
            **q.opportunities_from_rows(live),
            "basis_expansion": movers15.get("top_basis_widening", []),
            "basis_compression": movers15.get("top_basis_compression", []),
            "note": "Research-only signal board. No execution or account access.",
        }
        changes = sorted(
            movers15.get("rows", []),
            key=lambda row: abs(row.get("funding_change", 0.0)),
            reverse=True,
        )[:30]
        funding = q.funding_from_rows(live, changes)
        majors = {row["symbol"]: row for row in live}
        ticker = [majors[s] for s in q.MAJOR_SYMBOLS if s in majors] or live[:10]
        symbols = sorted({row["symbol"] for row in live})
        regime = q.regime_from_rows(live, metrics)
        cache_metrics = self.metrics(row_count=row_count, symbol_count=len(live), latest_ts_ms=latest_ts_ms)
        data_quality = {**health, "total_rows": row_count, "cache": cache_metrics}

        return {
            "ok": True,
            "generated_ms": q.now_ms(),
            "health": health,
            "summary": {"ok": True, "metrics": metrics, "health": health},
            "live": live,
            "ticker": ticker,
            "opportunities": opportunities,
            "funding": funding,
            "symbols": symbols,
            "regime": regime,
            "data_quality": data_quality,
            "cache": cache_metrics,
        }

    def metrics(self, row_count: int | None = None, symbol_count: int | None = None,
                latest_ts_ms: int | None = None) -> JsonDict:
        age = (
            round(time.monotonic() - self._last_refresh_monotonic, 3)
            if self._last_refresh_monotonic
            else None
        )
        return {
            "last_refresh_ms": self.last_refresh_ms,
            "last_refresh_utc": self.last_refresh_utc,
            "cache_age_seconds": age,
            "refresh_interval_sec": REFRESH_INTERVAL_SEC,
            "row_count": self.row_count if row_count is None else row_count,
            "symbol_count": self.symbol_count if symbol_count is None else symbol_count,
            "latest_ts_ms": self.latest_ts_ms if latest_ts_ms is None else latest_ts_ms,
            "last_error": self.last_error,
            "refresh_count": self.refresh_count,
            "failed_refresh_count": self.failed_refresh_count,
            "db_path": self._db_path or q.current_db_path(),
            "db_abs_path": str(q.db_abs_path(self._db_path)),
        }

    # ---- accessors (memory only) -----------------------------------------
    def _ensure(self) -> JsonDict:
        return self.refresh_if_stale()

    def state(self) -> JsonDict:
        return self._ensure()

    def state_json(self) -> str:
        self._ensure()
        return self._state_json or json.dumps(self._snapshot or {"ok": False}, default=str)

    def state_lite(self) -> JsonDict:
        self._ensure()
        return dict(self._lite or {"ok": False})

    def state_lite_json(self) -> str:
        self._ensure()
        return self._lite_json or json.dumps(self._lite or {"ok": False}, default=str)

    def radar(self, limit: int = 300, symbol_filter: str = "all") -> JsonDict:
        snap = self._ensure()
        rows = _filter_rows(snap.get("live", []), symbol_filter)
        sliced = rows[: max(1, min(1500, limit))] if limit else rows
        return {
            "ok": True,
            "rows": sliced,
            "count": len(sliced),
            "total": len(snap.get("live", [])),
            "filter": symbol_filter,
            "health": snap.get("health", {}),
        }

    def health(self) -> JsonDict:
        return dict(self._ensure().get("health", {}))

    def summary(self) -> JsonDict:
        snap = self._ensure()
        return {**snap.get("summary", {}), **q.opportunities_from_rows(snap.get("live", []))}

    def live(self, limit: int = 300) -> JsonDict:
        snap = self._ensure()
        rows = snap.get("live", [])
        sliced = rows[: max(1, min(1500, limit))] if limit else rows
        return {"ok": True, "rows": sliced, "count": len(sliced), "health": snap.get("health", {})}

    def ticker(self) -> JsonDict:
        snap = self._ensure()
        return {"ok": True, "symbols": q.MAJOR_SYMBOLS, "rows": snap.get("ticker", []), "health": snap.get("health", {})}

    def opportunities(self) -> JsonDict:
        snap = self._ensure()
        return {**snap.get("opportunities", {}), "health": snap.get("health", {})}

    def funding(self) -> JsonDict:
        snap = self._ensure()
        return {**snap.get("funding", {}), "health": snap.get("health", {})}

    def heatmap(self, mode: str = "basis", limit: int = 320) -> JsonDict:
        snap = self._ensure()
        rows = list(snap.get("live", []))
        if mode == "funding":
            rows.sort(key=lambda row: abs(q.safe_float(row.get("funding_rate"))), reverse=True)
        else:
            rows.sort(key=lambda row: row.get("abs_basis_bps", 0.0), reverse=True)
        rows = rows[: max(1, min(600, limit))]
        return {"ok": True, "rows": rows, "count": len(rows), "mode": mode, "health": snap.get("health", {})}

    def symbols(self) -> JsonDict:
        snap = self._ensure()
        syms = snap.get("symbols", [])
        return {"ok": True, "symbols": syms, "count": len(syms), "health": snap.get("health", {})}

    def regime(self) -> JsonDict:
        snap = self._ensure()
        return {**snap.get("regime", {}), "health": snap.get("health", {})}

    def watchlist(self, requested: list[str] | None = None, limit: int = 32) -> JsonDict:
        snap = self._ensure()
        rows = snap.get("live", [])
        by_symbol = {row["symbol"]: row for row in rows}
        requested = [s for s in (requested or []) if s]
        selected: list[JsonDict] = []
        seen: set[str] = set()
        for symbol in requested + q.MAJOR_SYMBOLS:
            row = by_symbol.get(symbol)
            if row and symbol not in seen:
                selected.append({**row, "watch_source": "pinned" if symbol in requested else "major"})
                seen.add(symbol)
        for row in rows:
            if row["symbol"] not in seen:
                selected.append({**row, "watch_source": "top_basis"})
                seen.add(row["symbol"])
            if len(selected) >= max(1, min(100, limit)):
                break
        selected = selected[:limit]
        return {
            "ok": True,
            "rows": selected,
            "count": len(selected),
            "symbols": [row["symbol"] for row in selected],
            "health": snap.get("health", {}),
        }

    def movers(self, minutes: int) -> JsonDict:
        snap = self._ensure()
        health = snap.get("health", {})
        if minutes in self._movers:
            return {**self._movers[minutes], "health": health}
        # Non-standard window: one bounded query (rare; movers tab only).
        conn = q.open_readonly()
        if conn is None or not health.get("schema_ok"):
            return {**q.empty_movers(minutes), "health": health}
        try:
            data = q.compute_movers_rows(conn, minutes)
        finally:
            conn.close()
        return {**data, "health": health}

    def data_quality(self) -> JsonDict:
        return dict(self._ensure().get("data_quality", {}))

    _SORT_KEYS = {
        "symbol", "status", "spot_bid", "spot_ask", "spot_mid", "fut_bid", "fut_ask",
        "futures_mid", "spot_spread_bps", "futures_spread_bps", "spot_to_perp_bps",
        "perp_to_spot_bps", "abs_basis_bps", "funding_rate", "age_seconds", "opportunity_score",
    }
    _SORT_ALIASES = {
        "abs_basis": "abs_basis_bps",
        "score": "opportunity_score",
        "funding": "funding_rate",
        "age": "age_seconds",
        "perp_mid": "futures_mid",
        "perp_bid": "fut_bid",
        "perp_ask": "fut_ask",
        "perp_spread": "futures_spread_bps",
        "spot_spread": "spot_spread_bps",
    }

    def page(self, page: int = 1, page_size: int = 50, sort: str = "abs_basis_bps",
             direction: str = "desc", symbol_filter: str = "all", query: str = "") -> JsonDict:
        snap = self._ensure()
        rows = _filter_rows(snap.get("live", []), symbol_filter)
        q = (query or "").strip().upper()
        if q:
            rows = [r for r in rows if q in r["symbol"]]
        sort = self._SORT_ALIASES.get(sort, sort)
        key = sort if sort in self._SORT_KEYS else "abs_basis_bps"
        reverse = str(direction).lower() != "asc"
        if key in {"symbol", "status"}:
            rows = sorted(rows, key=lambda r: str(r.get(key, "")), reverse=reverse)
        else:
            rows = sorted(rows, key=lambda r: q_num(r.get(key)), reverse=reverse)
        total = len(rows)
        page_size = max(1, min(200, int(page_size)))
        pages = max(1, (total + page_size - 1) // page_size)
        page = max(1, min(pages, int(page)))
        start = (page - 1) * page_size
        sliced = rows[start:start + page_size]
        return {
            "ok": True, "rows": sliced, "page": page, "pages": pages, "page_size": page_size,
            "total": total, "sort": key, "direction": "desc" if reverse else "asc",
            "filter": symbol_filter, "query": q, "health": snap.get("health", {}),
        }

    def search(self, query: str, limit: int = 20) -> JsonDict:
        snap = self._ensure()
        q = (query or "").strip().upper()
        rows = snap.get("live", [])
        if not q:
            matched = rows[:limit]
        else:
            def base(symbol: str) -> str:
                for quote in ("USDT", "USDC", "BUSD", "FDUSD"):
                    if symbol.endswith(quote):
                        return symbol[: -len(quote)]
                return symbol

            def subseq(needle: str, haystack: str) -> bool:
                it = iter(haystack)
                return all(ch in it for ch in needle)

            def score(row: JsonDict) -> tuple[int, float, str]:
                sym = row["symbol"]
                b = base(sym)
                if sym == q or b == q:
                    rank = 0
                elif sym.startswith(q) or b.startswith(q):
                    rank = 1
                elif q in sym or q in b:
                    rank = 2
                elif subseq(q, sym) or subseq(q, b):
                    rank = 3
                else:
                    rank = 9
                return (rank, -q_num(row.get("abs_basis_bps")), sym)

            matched = [r for r in sorted(rows, key=score) if score(r)[0] < 9][:limit]
        results = [
            {"symbol": r["symbol"], "spot_mid": r["spot_mid"], "abs_basis_bps": r["abs_basis_bps"],
             "funding_rate": r["funding_rate"], "status": r["status"]}
            for r in matched
        ]
        return {"ok": True, "query": q, "results": results, "count": len(results)}

    def symbol(self, sym: str) -> JsonDict:
        snap = self._ensure()
        clean = "".join(ch for ch in (sym or "").upper() if ch.isalnum())
        row = next((r for r in snap.get("live", []) if r["symbol"] == clean), None)
        return {"ok": True, "symbol": clean, "row": row, "health": snap.get("health", {})}

    def perf(self) -> JsonDict:
        snap = self._ensure()
        return {
            "ok": True,
            "cache": self.metrics(),
            "payload_sizes": dict(self._sizes),
            "health_status": snap.get("health", {}).get("status"),
            "live_rows": len(snap.get("live", [])),
            "movers_windows": sorted(self._movers.keys()),
            "note": "All core endpoints serve precomputed in-memory snapshots; no per-request SQLite scan.",
        }


# Module-level singleton used by web_app.
CACHE = MarketCache()
