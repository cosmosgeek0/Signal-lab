# ⚡ PARALLEL RESCUE ACTIVE: you are ONE of several agents, each owning ONE page.
# - Touch ONLY your assigned page's files + append page-scoped CSS at the END of the
#   shared stylesheet under a marker: /* ===== PAGE RESCUE: <page> ===== */
# - NEVER edit shared components (header/nav/footer/lib) unless they ARE your page.
# - NEVER edit shared state files (CURRENT_STATE/TASTE_LOG/FEATURE_QUEUE/SITE_MAP/
#   PHOTO_QUEUE). Write design/reports/<page-slug>.md instead (format: reports/README.md).
# - Use the port assigned in your task card so parallel servers never collide.
# - Director runs the merge pass + full gates afterwards.

# DESIGN LOOP — signallab · ⚠ RESCUE MODE ACTIVE (polish mode is SUSPENDED)

The site is not ready for photo polish. It is dirty: dashes, dead panels, repeated
"waiting/warming" placeholders, duplicate source warnings, giant blank sections,
pages that look good far away and collapse close-up. Until the rescue queue in
FEATURE_QUEUE.md is done, every run is a RESCUE RUN. Owner screenshots+comments
resume final polish ONLY after rescue completes.

## MEMORY DISCIPLINE
Read ../CURRENT_STATE.md FIRST (short truth), then ../PROJECT_CONTEXT.md (purpose
bible), DESIGN_CONTEXT.md (reference wall), FEATURE_QUEUE.md (rescue order),
SITE_MAP.md. TASTE_LOG.md = archive: read last entry only. At run end update
CURRENT_STATE.md + SITE_MAP.md status + append TASTE_LOG.md.

## A RESCUE RUN (one full page/surface, taken from the top of the rescue queue)
1. Open the LIVE page in the browser. Screenshot BEFORE (light + dark).
2. List its top visible failures (close-up: dashes, dead cards, repeated status
   labels, placeholder panels, duplicated source/status UI, useless sections).
3. REMOVE / HIDE / COMPRESS dead UI. Missing data never gets a giant fake panel —
   it gets a compact honest source chip or a small designed empty state.
4. Rebuild the page hierarchy: title → subtitle → filters → primary data →
   secondary data → footer. Nothing else.
5. Fix spacing, font scale, alignment, rhythm across the WHOLE page.
6. Keep every piece of USEFUL data visible; data-first, chrome last.
7. Compare against the reference wall (DESIGN_CONTEXT.md) for THIS page type.
8. Minimum FIVE meaningful, visible page-level changes.
9. Screenshot AFTER (light + dark) into design/screenshots/.
10. Update state files. Stop.

## RUN FAILURE CONDITIONS (any one = the run FAILED, say so honestly)
- Only state files / logs / asset version / one tiny widget changed.
- The page still has big dead panels, dash-filled cards, or repeated warnings.
- It polished mud: prettier chrome around the same broken content.
- Fewer than 5 visible improvements, or no before/after screenshots.

## GATES DURING RESCUE (light on purpose)
Per run: python -m compileall-equivalent sanity (import check), render/screenshot
check, scripts/ui_smoke.py. FULL suite (pytest + click_audit + deep_audit) every
3rd rescue run — count runs in CURRENT_STATE.md. Never leave an obviously broken
page regardless of gate policy. ES-module imports stay unstamped. Bump ASSET_VERSION.

## STANDING LAWS (unchanged, apply within every rescue)
No fake data · keyless sources only · no Binance-led surfaces (bible §2) ·
watermarks/attribution once, footer only · thin type, exact scale, 200% zoom check ·
no word-soup status lines · whitespace+hairlines carry structure, gloss is rare ·
alive: real numbers tick/flash, controls respond · plain-words file headers ·
hill-climb: try, keep if better, revert if not.
