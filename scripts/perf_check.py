"""Measure dashboard endpoint latency against a running server.

Usage:
    .venv/bin/python scripts/perf_check.py --base http://127.0.0.1:8501

Calls the core endpoints a few times each and reports best/median/worst latency.
Exits non-zero (FAIL) if any core endpoint exceeds the threshold (default 1000 ms).
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request

# (path, target latency ms) — the frontend hot path is health + state-lite + radar.
CORE = [
    ("/api/health", 100.0),
    ("/api/state-lite", 200.0),
    ("/api/radar?limit=300", 300.0),
    ("/api/summary", 200.0),
    ("/api/live?limit=300", 300.0),
]


def time_get(url: str, timeout: float) -> tuple[float, int, int]:
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        body = resp.read()
        status = resp.getcode()
    return (time.perf_counter() - start) * 1000.0, status, len(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Dashboard latency PASS/FAIL check.")
    parser.add_argument("--base", default="http://127.0.0.1:8501")
    parser.add_argument("--threshold-ms", type=float, default=None,
                        help="Override all per-endpoint targets with a single ceiling.")
    parser.add_argument("--rounds", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=15.0)
    args = parser.parse_args()

    base = args.base.rstrip("/")
    overall_ok = True
    print(f"perf_check: {base}  rounds={args.rounds}")
    print(f"{'endpoint':26s} {'best':>8s} {'median':>8s} {'worst':>8s} {'bytes':>9s} {'target':>8s}  result")

    for path, target in CORE:
        target_ms = args.threshold_ms if args.threshold_ms is not None else target
        url = f"{base}{path}"
        samples: list[float] = []
        size = 0
        status = 0
        error = ""
        for _ in range(max(1, args.rounds)):
            try:
                ms, status, size = time_get(url, args.timeout)
                samples.append(ms)
            except (urllib.error.URLError, OSError, ValueError) as exc:
                error = f"{type(exc).__name__}: {exc}"
                break
        if not samples or status != 200 or error:
            overall_ok = False
            print(f"{path:26s} {'--':>8s} {'--':>8s} {'--':>8s} {'--':>9s} {target_ms:7.0f}m  FAIL ({error or ('HTTP ' + str(status))})")
            continue
        samples.sort()
        best = samples[0]
        worst = samples[-1]
        median = samples[len(samples) // 2]
        ok = worst <= target_ms
        overall_ok = overall_ok and ok
        print(f"{path:26s} {best:7.1f}m {median:7.1f}m {worst:7.1f}m {size:9d} {target_ms:7.0f}m  {'PASS' if ok else 'FAIL'}")

    # Surface cache metrics if available (non-fatal).
    try:
        with urllib.request.urlopen(f"{base}/api/perf", timeout=args.timeout) as resp:
            perf = json.loads(resp.read().decode("utf-8"))
        cache = perf.get("cache", {})
        print(
            "cache: "
            f"last_refresh_ms={cache.get('last_refresh_ms')} "
            f"age={cache.get('cache_age_seconds')}s "
            f"rows={cache.get('row_count')} symbols={cache.get('symbol_count')} "
            f"refreshes={cache.get('refresh_count')} fails={cache.get('failed_refresh_count')}"
        )
    except (urllib.error.URLError, OSError, ValueError):
        pass

    print(f"\nRESULT: {'PASS' if overall_ok else 'FAIL'}")
    return 0 if overall_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
