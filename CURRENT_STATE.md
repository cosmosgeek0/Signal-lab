# CURRENT_STATE.md — signallab (SHORT TRUTH · read FIRST · update after EVERY run · max 80 lines)
Updated: 2026-07-05 (global-first recovery)

## Repo
- Python/Starlette + no-build ES modules (bslab/static/app). PROJECT_CONTEXT.md at root = purpose bible (Global-first, kill Binance bias).
- Run: BSLAB_DB=data/binance_signal_lab.sqlite .venv/bin/python -m uvicorn web_app:app --port 8765 (venv scripts have stale shebangs — always `python -m`).

## App/UI status
- Gates: node --check market.js/movers.js + .venv/bin/python -m pytest -q (59) + ui_smoke PASS + click_audit PASS (74/74) + deep_audit PASS (48/48).
- Last run: Global-first front page recovery; ASSET_VERSION r269; screenshots refreshed at design/screenshots/global-market-light.png and global-market-dark.png.
- Last known-good: / opens on Global; category nav starts Global; crypto/exchange tape is hidden until Crypto/Binance-only; Global/Indices use one compact tape, not triple repeated grids; visible index marks use word logos instead of "500"/"100"/"30" badge junk.
- Top diseases (bible §2-§8): Yahoo world-market quote lane can warm empty; news rail still starts in loading/warming state; logo scale beyond visible Global/Indices tape remains incomplete; glossy dark-mode accents still need reduction; old Binance wording may remain in deep backend/source internals.

## Next 5 tasks
1. Add resilient native quote cache for world indices/rates/FX so Global cards do not warm empty when Yahoo stalls.
2. Finish real logo/wordmark scale for every index, ETF, stock, futures, FX and bond row beyond the visible Global tape.
3. Redesign the news rail loading/freshness state so it reads like a live desk even while sources warm.
4. Replace TradingView iframe fallback with native global chart when keyless sources are strong enough.
5. Keep this file ≤80 lines; update after every run.

## Read first / Never touch
- Read: PROJECT_CONTEXT.md → this file → design/DESIGN_LOOP.md. TASTE_LOG.md: read LAST ENTRY only (full file = history archive).
- Never: fake data, key-required sources, Binance-led surfaces, watermark spam, ?v= stamps on ES-module imports.

## Latest known good
- All gates green 2026-07-05 on http://127.0.0.1:8767; screenshots: design/screenshots/global-market-light.png + global-market-dark.png.
