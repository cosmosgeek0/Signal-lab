# SPRINT 2 — MERGE VERDICT (2026-07-05 director)
- [x] A. Top bar IA v2 — SHIPPED (Global/Crypto popups, currency restored, tape cleaned)
- [x] B. Global front page — SHIPPED structurally (TV-markets sections, news rail redesigned). BUG kept open below.
- [x] C. Search modal — shipped (report s2-search)
- [x] D. Settings — 1Password clone killed (report s2-settings)
- [x] E. Asset page de-boxed (report s2-asset)
- [x] F. De-lining pass — ran EARLY (protocol violation, but report+refs OK; included in gates)
# ROUND 3 QUEUE (from merge findings):
- [ ] R3-1. Index rows: 6/7 quotes empty with tripled "Chart Chart Chart" buttons — stale Yahoo must render ONE compact stale chip per row, never placeholder button spam (rescue law)
- [ ] R3-2. Crypto section: prices table renders 0 rows headless — verify live, fix source or honest empty state
- [ ] R3-3. AUDIT REWRITE: click_audit + deep_audit still test the pre-IA-v2 DOM (28 stale checks, deep crashes at old selector). Rewrite both against the new structure — never delete coverage, retarget it.
