from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import web_app  # noqa: E402
from bslab import web_queries  # noqa: E402
from bslab import web_cache  # noqa: E402


def yes_no(value: Any) -> str:
    return "yes" if bool(value) else "no"


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect the dashboard SQLite read path safely.")
    parser.add_argument("--db", default=web_app.DB_PATH, help="SQLite DB path")
    parser.add_argument("--json", action="store_true", help="Print the full safe diagnostic JSON")
    args = parser.parse_args()

    web_app.DB_PATH = args.db
    web_queries.DB_PATH = args.db
    web_app.CACHE.clear()
    diagnostics = web_app.diagnose_db(args.db)
    live = web_app.build_live(10)
    summary = web_app.build_summary()
    # Exercise the in-memory cache read path the live dashboard actually uses.
    web_cache.CACHE.reset()
    cache_snapshot = web_cache.CACHE.refresh()
    cache_metrics = web_cache.CACHE.metrics()
    status_ok = (
        diagnostics.get("db_exists")
        and diagnostics.get("schema_ok")
        and not diagnostics.get("error")
        and (diagnostics.get("total_rows_count", 0) == 0 or live.get("count", 0) > 0)
        and (diagnostics.get("total_rows_count", 0) == 0 or summary.get("metrics", {}).get("total_symbols", 0) > 0)
    )
    if args.json:
        print(json.dumps({
            "status": "OK" if status_ok else "FAIL",
            "diagnostics": diagnostics,
            "live_probe": live,
            "summary_probe": summary,
            "cache_metrics": cache_metrics,
            "cache_live_rows": len(cache_snapshot.get("live", [])),
        }, indent=2, sort_keys=True, default=str))
        return 0 if diagnostics.get("ok") else 1

    print(f"status: {'OK' if status_ok else 'FAIL'}")
    print(f"cwd: {diagnostics['cwd']}")
    print(f"DB path exists: {yes_no(diagnostics['db_exists'])}")
    print(f"absolute DB path: {diagnostics['db_abs_path']}")
    print(f"sqlite tables: {', '.join(diagnostics['sqlite_tables']) or 'none'}")
    print(f"schema columns: {', '.join(diagnostics['columns']) or 'none'}")
    print(f"schema ok: {yes_no(diagnostics['schema_ok'])}")
    if diagnostics["missing_columns"]:
        print(f"missing columns: {', '.join(diagnostics['missing_columns'])}")
    print(f"latest timestamp: {diagnostics['latest_ts_ms'] or 'none'}")
    print(f"latest timestamp UTC: {diagnostics['latest_update_utc'] or 'none'}")
    print(f"total rows: {diagnostics.get('total_rows_count', 0)}")
    print(f"total recent rows: {diagnostics.get('recent_rows_count', 0)}")
    print(f"total symbols: {diagnostics.get('total_symbols_count', 0)}")
    print(f"latest rows: {diagnostics['latest_rows_count']}")
    print(f"latest symbols: {diagnostics['latest_symbols_count']}")
    print("first 5 latest rows:")
    for row in diagnostics["first_5_latest_rows"]:
        print(
            "  "
            f"{row['symbol']} "
            f"spot={row['spot_bid']:g}/{row['spot_ask']:g} "
            f"fut={row['fut_bid']:g}/{row['fut_ask']:g} "
            f"spot_to_perp_bps={row['spot_to_perp_bps']:.4f} "
            f"perp_to_spot_bps={row['perp_to_spot_bps']:.4f} "
            f"funding_rate={row['funding_rate']:.8f} "
            f"spot_age_sec={row['spot_age_sec']:.3f} "
            f"fut_age_sec={row['fut_age_sec']:.3f}"
        )
    if not diagnostics["first_5_latest_rows"]:
        print("  none")
    print("internal live query:")
    print(f"  ok={live.get('ok')} count={live.get('count', 0)} symbols={', '.join(row.get('symbol', '') for row in live.get('rows', [])[:10]) or 'none'}")
    print("internal summary query:")
    metrics = summary.get("metrics", {})
    print(f"  ok={summary.get('ok')} total_symbols={metrics.get('total_symbols', 0)} live_symbols={metrics.get('live_symbols', 0)}")
    print("in-memory cache refresh:")
    print(
        f"  live_rows={len(cache_snapshot.get('live', []))} "
        f"last_refresh_ms={cache_metrics.get('last_refresh_ms')} "
        f"row_count={cache_metrics.get('row_count')} "
        f"symbol_count={cache_metrics.get('symbol_count')} "
        f"failed={cache_metrics.get('failed_refresh_count')} "
        f"last_error={cache_metrics.get('last_error') or 'none'}"
    )
    if diagnostics["error"]:
        print(f"error: {diagnostics['error']}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
