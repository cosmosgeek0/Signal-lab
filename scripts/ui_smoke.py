#!/usr/bin/env python3
"""Browser smoke check: FAIL if the app boots to a blank page.

    python scripts/ui_smoke.py --base http://127.0.0.1:8765

Runs headless Chrome against the live server and fails (exit 1) if:
  * the body is empty or the #app root has no rendered children,
  * "CosmosGeek Radar" is not visible in the DOM,
  * the boot-failure panel (#cg-boot-error) appeared,
  * the console logged an uncaught error / module failure.

Skips with exit 0 (and a warning) when Chrome is not installed, so CI boxes
without a browser can still run the pytest layer (tests/test_boot.py).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome", "chromium-browser", "chromium",
]

CONSOLE_FATALS = ("Uncaught", "SyntaxError", "does not provide an export",
                  "Failed to load module", "net::ERR_")


def find_chrome() -> str | None:
    for cand in CHROME_CANDIDATES:
        if cand.startswith("/"):
            if shutil.os.path.exists(cand):
                return cand
        elif shutil.which(cand):
            return cand
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Blank-page browser smoke check.")
    parser.add_argument("--base", default="http://127.0.0.1:8765")
    parser.add_argument("--paths", default="/,/radar,/heatmap,/bubbles,/funding,/movers")
    args = parser.parse_args()

    chrome = find_chrome()
    if not chrome:
        print("ui_smoke: SKIP (no Chrome/Chromium found; pytest layer still covers the shell)")
        return 0

    failures = []
    for path in [p.strip() for p in args.paths.split(",") if p.strip()]:
        url = args.base.rstrip("/") + path
        try:
            proc = subprocess.run(
                [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
                 "--virtual-time-budget=8000", "--enable-logging=stderr", "--v=0",
                 "--dump-dom", url],
                capture_output=True, text=True, timeout=60,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            failures.append(f"{path}: chrome failed to run ({exc})")
            continue
        dom, console = proc.stdout, proc.stderr

        checks = []
        if "CosmosGeek Radar" not in dom:
            checks.append("brand 'CosmosGeek Radar' not visible")
        if '<main id="view"' not in dom:
            checks.append("app root did not mount <main id=view>")
        if 'id="cg-boot-error"' in dom:
            checks.append("boot-failure panel rendered")
        body = dom.split("<body", 1)[-1]
        if len(body.strip()) < 500:
            checks.append(f"body suspiciously small ({len(body)} chars)")
        fatal = [ln.strip() for ln in console.splitlines() if any(k in ln for k in CONSOLE_FATALS)]
        if fatal:
            checks.append("console errors: " + " | ".join(fatal[:3]))

        if checks:
            failures.append(f"{path}: " + "; ".join(checks))
            print(f"ui_smoke: FAIL {path} -> " + "; ".join(checks))
        else:
            print(f"ui_smoke: OK   {path} (root mounted, brand visible, console clean)")

    if failures:
        print(f"\nui_smoke RESULT: FAIL ({len(failures)} page(s))")
        return 1
    print("\nui_smoke RESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
