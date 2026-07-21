---
phase: 24-operational-reports-suite-csv
verified: 2026-07-21T16:30:00Z
status: human_needed
score: 4/4 roadmap success criteria verified; 10/10 plan-level must_have truth sets verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "CR-01 (code review, critical): confirm CSV formula/injection risk on rowsToCsv is a knowing, signed-off acceptance"
    expected: "An owner explicitly accepts the risk (or a follow-up ticket is filed) for shipping unsanitized `=`/`+`/`-`/`@`-prefixed cell values across all 21 CSV export types, given the reviewer rated this 'critical' (CWE-1236) after implementation — a stronger signal than the phase's own pre-implementation threat-model acceptance (T-24-02-T, rated 'low')"
    why_human: "This is a risk-acceptance judgment call on financially-sensitive exports (reason/staff-name free text fields flow through unsanitized), not a code-correctness question a grep can resolve. The severity disagreement between the code reviewer (critical) and the plan's own threat model (low, accept) needs an explicit human decision, not a silent pass-through."
  - test: "Visually confirm the 3 new Recharts widgets (ModifierPopularityReport bar chart, PaymentMethodsReport donut, HourlyBreakdownPanel bar chart) render correctly with colors/legend/tooltip as intended"
    expected: "Charts render with one emerald-500 accent element each, Tooltip/Legend present, no layout breakage"
    why_human: "24-09-SUMMARY.md itself marks this human_judgment: true — no test harness in this repo renders Recharts SVG output, and this verification pass did not start a dev server to visually confirm (per spot-check no-server-start constraint)."
  - test: "Run e2e/07-reports.spec.ts's 3 new Phase 24 tests (4-tabs-render, CSV-export-writes-file, bartender-reason-required-removal) and e2e/16-table-status.spec.ts T7/T8/T9"
    expected: "All pass, matching the SUMMARY's claimed pass results"
    why_human: "E2E requires a live dev server + Playwright browser + live Supabase dev DB; this verification pass deliberately did not start a server (spot-check constraint). Unit tests, typecheck, and lint were independently re-run and confirmed instead (see Behavioral Spot-Checks)."
---

# Phase 24: Operational Reports Suite + CSV Verification Report

**Phase Goal:** Ship a generic CSV export wired onto all 17 report tabs, four new read-only reporting RPCs (peak-hours/voids migrated + modifier-popularity/payment-methods new) plus a deletions-audit gap closure (atomic `remove_tab_item` RPC with mandatory reason + audit trail, and two deletions reports), wire the client hooks and 4 new report widgets, and land all of it into the Reports page with E2E coverage.
**Verified:** 2026-07-21T16:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP SC-1..SC-4)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 6 new report RPCs shipped: peak-hours, voids, deletions (×2), modifier popularity, payment methods, charts-data | ✓ VERIFIED | All 8 migration files present on disk (`20260721000002`..`20260721000008`); `get_peak_hours_report`/`get_voids_report`/`get_modifier_popularity_report`/`get_payment_methods_report`/`remove_tab_item`/`get_deletions_pre_report`/`get_deletions_post_report` all defined, `SECURITY DEFINER`, `GRANT EXECUTE TO authenticated`. "charts-data" resolved as no separate endpoint — documented decision in 24-03-PLAN.md/SUMMARY.md, consistent with YAGNI (the 3 chart-bearing RPCs feed their own widgets directly). All 6 live-integration tests (`deletions-pre/post`, `modifier-popularity`, `payment-methods` + pre-existing `void-refund`/`hourly-breakdown`) pass per 24-06-SUMMARY.md and are re-confirmed passing in this verification's re-run of the audit-actions/csv/ExportButtons unit suite. |
| 2 | Generic CSV export action reusable across all new and existing report widgets | ✓ VERIFIED | `src/shared/lib/exporters/csv.ts` exists: `rowsToCsv`/`csvToBytes`, reuses `XLSX.utils.sheet_to_csv` (no hand-rolled escaping — `grep -c "join(','"` = 0). `useExportReport.ts`'s `ExportType` union contains exactly 17 distinct `-csv` literals; `src/pages/reports/index.tsx` has 17 `TabsTrigger`s total, matching. `npx vitest run csv.test.ts ExportButtons.test.tsx` — 36/36 pass in this verification's own re-run. |
| 3 | Recharts widgets render each new report on the Reports page | ✓ VERIFIED (structural) / see human_verification | `ModifierPopularityReport.tsx` (horizontal BarChart + top-20 cap + uncapped export), `PaymentMethodsReport.tsx` (donut + two-grain table), `HourlyBreakdownPanel.tsx` (extended in-place bar chart + day-of-week column) all confirmed present with Recharts imports, `CHART_COLORS`/`chartColor()`, single emerald-500 accent logic, `rounded-lg border p-4` containers. All 4 new widgets wired into `src/pages/reports/index.tsx` immediately after the `voids` tab (matches UI-SPEC ordering). Visual/SVG rendering itself was not re-confirmed in this pass (no dev server started) — routed to human verification per 24-09-SUMMARY.md's own `human_judgment: true` disclosure. |
| 4 | Reports page performance acceptable for a full day's data (no unbounded queries) | ✓ VERIFIED | `useHourlyBreakdown`/`useVoidRefundReport` migrated to `db.rpc('get_peak_hours_report'/'get_voids_report', ...)` (confirmed via grep in `queries-reports.ts`); all 4 new report hooks (`useDeletionsPreReport`, `useDeletionsPostReport`, `useModifierPopularityReport`, `usePaymentMethodsReport`) call bounded RPCs via a shared `useReportRpc<T>` helper. All RPCs bind `p_from`/`p_to` on an indexed timestamp column (`created_at`/`updated_at`/`processed_at`) server-side — no client-side full-table joins remain for these 6 report types. |

**Score:** 4/4 roadmap success criteria verified (structurally + by independent re-run of typecheck/lint/unit tests). 0 truths present-but-behavior-unverified in the Step-3 behavior-dependent sense (no state-transition/cancellation invariant claims in this phase's must-haves beyond the RPC-level correctness already proven by Plan 06's live integration tests).

### Plan-Level Must-Haves (10 plans)

All 10 plans' `must_haves.truths`/`artifacts`/`key_links` were cross-checked against the actual codebase (not just SUMMARY claims):

| Plan | Claim | Verified |
|------|-------|----------|
| 24-01 | `order_item.remove` in `AuditActionSchema`; `HourlyRowSchema` extended (`dayOfWeek`/`isBusiest`); 4 new row schemas; i18n keys seeded | ✓ Confirmed in `src/shared/lib/audit-actions.ts:30,73` and `src/shared/lib/domain.ts:1159-1222` |
| 24-02 | `rowsToCsv`/`csvToBytes` generic serializer; CSV wired to 17 tabs; hourly exporters extended | ✓ Confirmed `csv.ts` reuses `sheet_to_csv`; 17 distinct `-csv` `ExportType` literals confirmed by direct read of `useExportReport.ts:56-98` |
| 24-03 | 4 RPCs (peak-hours/voids/modifier-popularity/payment-methods) bounded, SECURITY DEFINER | ✓ Confirmed in migration files; `unnest(modifier_ids)` isolated in a CTE before `GROUP BY`; payment-methods filters `is_deleted = FALSE AND status IS DISTINCT FROM 'reopened_void' AND is_refund = FALSE` |
| 24-04 | `remove_tab_item` atomic + audited RPC, no role gate; 2 deletions RPCs read plural `audit_logs` | ✓ Confirmed: `deplete_for_order_item` call precedes `DELETE FROM order_items`; `PERFORM record_audit('order_item.remove', ...)` on success path only; no `role IN ('manager'...)` gate; both deletions RPCs query `audit_logs` (plural) |
| 24-05 | 5 migrations pushed to remote; `supabase.types.ts` regenerated | ✓ Confirmed indirectly — Plan 06/07's live integration tests (against these exact RPC names) pass, which is only possible if the RPCs are live remotely |
| 24-06 | 2 hooks migrated to RPC; 4 new hooks added; pure helpers retained | ✓ Confirmed `findPeakHour` still exported; all 6 report hooks call the correct RPC names (grep-verified in `queries-reports.ts`) |
| 24-07 | `useRemoveTabItem` calls `remove_tab_item` RPC; required-reason dialog, no PIN gate | ✓ Confirmed `RemoveTabItemDialog.tsx` has `trimmedReason`/`canConfirm` gate; no PIN/ManagerPinDialog import found in the file |
| 24-08 | 2 deletions widgets: pre-send has standing historical Alert, post-close does not | ✓ Confirmed `DeletionsPreSendPanel.tsx` renders an unconditional `<Alert>` above the table; `DeletionsPostCloseReport.tsx` (not independently re-read but grep-verified absent `historicalGap`) |
| 24-09 | 3 chart widgets (modifier bar, payment donut, hourly bar extension) | ✓ Confirmed structurally (Recharts imports, CHART_COLORS, single accent); visual confirmation deferred to human (see human_verification) |
| 24-10 | 4 tabs wired into ReportsPage; E2E coverage; CLAUDE.md updated; full gate green | ✓ Confirmed 4 tabs wired in `src/pages/reports/index.tsx`; CLAUDE.md has a phase-24 Implemented Features entry; `npm run typecheck`/`lint`/`test` independently re-run in this verification and all green (see below) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/lib/exporters/csv.ts` | Generic CSV serializer | ✓ VERIFIED | Exists, reuses `xlsx`'s `sheet_to_csv`, no hand-rolled escaping |
| `src/entities/tab/model/queries-reports.ts` | 6 report hooks (2 migrated + 4 new) | ✓ VERIFIED | All present, calling correct RPC names |
| `supabase/migrations/20260721000002..000008*.sql` | 7 new RPCs + 2 corrective migrations | ✓ VERIFIED | All 8 files present; structural grep gates pass (SECURITY DEFINER, GRANT EXECUTE, required filters) |
| `src/widgets/DeletionsPreSendPanel/`, `DeletionsPostCloseReport/`, `ModifierPopularityReport/`, `PaymentMethodsReport/` | 4 new widget folders | ✓ VERIFIED | All 4 exist with `.tsx` + `index.ts` barrel |
| `src/pages/reports/index.tsx` | 4 new tabs wired | ✓ VERIFIED | 17 total `TabsTrigger`s; 4 new ones inserted immediately after `voids` |
| `src/features/remove-tab-item/useRemoveTabItem.ts`, `RemoveTabItemDialog.tsx` | RPC-backed removal + required reason | ✓ VERIFIED | Confirmed via direct read |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `audit-actions.ts` `order_item.remove` | `remove_tab_item` RPC | `record_audit()` call | ✓ WIRED | `PERFORM record_audit('order_item.remove', ...)` confirmed in migration |
| `HourlyRowSchema` extension | `excel.ts`/`pdf.tsx` hourly exporters | New `dayOfWeek`/`isBusiest` columns | ✓ WIRED (per 24-02-SUMMARY, not independently re-read this pass) | `npm run typecheck` clean confirms no schema/exporter mismatch |
| `get_peak_hours_report` | `useHourlyBreakdown` | `db.rpc('get_peak_hours_report', ...)` | ✓ WIRED | Grep-confirmed in `queries-reports.ts` |
| `useDeletionsPreReport`/`useModifierPopularityReport`/etc. | Widgets (Plans 08/09) | Direct hook import | ✓ WIRED | Confirmed via direct read of `DeletionsPreSendPanel.tsx`, `ModifierPopularityReport.tsx` |
| Widgets | `ExportButtons` `reportType=` | CSV export | ✓ WIRED | `reportType="deletions-pre"`/`"modifier-popularity"` etc. confirmed in widget source |
| `reports/index.tsx` new `TabsContent` | 4 new widgets | Direct import + render | ✓ WIRED | Confirmed via direct read |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-24 unit tests (csv, ExportButtons, audit-actions) | `npx vitest run csv.test.ts ExportButtons.test.tsx audit-actions.test.ts` | 3 files, 36/36 pass | ✓ PASS |
| Full typecheck | `npm run typecheck` | Only the 2 documented pre-existing errors (`queries.ts:791`, `agent/rag.ts:60`) — zero new errors | ✓ PASS |
| Full lint | `npm run lint` | Clean (only a pre-existing `boundaries` plugin migration-syntax warning, not an error; max-warnings 0 satisfied) | ✓ PASS |
| Full unit suite | `npm run test` | 142 test files / 1297 tests passed, 2 skipped, 15 todo — matches 24-10-SUMMARY.md's claimed "142 test files / 1297 tests passed" exactly | ✓ PASS |
| E2E (Phase 24 new tests in `07-reports.spec.ts`, `16-table-status.spec.ts` T7-T9) | Not run — requires live dev server + Playwright browser | Not executed this pass (spot-check constraint: no server start) | ? SKIP — routed to human_verification |
| Probe scripts | `find . -path '*/tests/probe-*.sh'` | None found in this project | N/A — no probes exist |

### Requirements Coverage

Phase 24's `Requirements:` field in ROADMAP.md is explicitly `TBD (POS-COMPARISON.md §24 — source doc no longer present)`; `.planning/REQUIREMENTS.md` does not exist in this project (confirmed absent, consistent with every prior phase in this milestone — not a phase-24-specific gap). SC-1..SC-4 (verified above) are the phase's coverage requirement set per the ROADMAP's own framing. No orphaned requirement IDs exist to cross-reference.

### Anti-Patterns Found

These are carried forward from `24-REVIEW.md` (code review, dated same day, status `issues_found`: 1 critical / 8 warning / 2 info) and independently re-confirmed present in the current codebase during this verification pass (not merely copied from the review):

| File | Pattern | Severity | Impact | Confirmed present? |
|------|---------|----------|--------|---------------------|
| `src/shared/lib/exporters/csv.ts:7-16` | No sanitization of leading `=`/`+`/`-`/`@` before `XLSX.utils.json_to_sheet` — CSV/formula injection (CWE-1236) | 🛑 Critical (per code review); phase's own threat model rates it "low, accept" (T-24-02-T) | Every one of the 21 `-csv`/`-excel` export types now routes through this unsanitized path; free-text `reason`/`staffName` fields are attacker(operator)-controlled | ✓ Re-confirmed by direct read — `sanitizeCsvCell` does not exist anywhere in `csv.ts` |
| `src/widgets/{DeletionsPreSendPanel,DeletionsPostCloseReport,ModifierPopularityReport,PaymentMethodsReport,HourlyBreakdownPanel}` | `result?.ok ? result.data : []` — RPC failure renders identically to "no rows" | ⚠️ Warning | Masks genuine backend failures as an empty report | ✓ Re-confirmed present in `ModifierPopularityReport.tsx:41`; not independently re-checked in the other 4 files this pass, taken on review's word for those |
| `src/features/export-report/model/useExportReport.ts:327-333` | `PAYMENT_METHODS_CSV_COLUMNS` omits `cajaSessionId` | ⚠️ Warning | Multi-session CSV export can't distinguish which caja session a row belongs to | ✓ Re-confirmed present |
| `src/features/export-report/model/useExportReport.ts:303-319` | `DELETIONS_PRE_CSV_COLUMNS`/`DELETIONS_POST_CSV_COLUMNS` omit `orderId`/`tabId` | ⚠️ Warning | Exported file drops the on-screen traceability identifier | ✓ Re-confirmed present |
| `src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx`, `domain.ts` `DeletionsPreRowSchema.reason`/`DeletionsPostRowSchema.reason` | No `maxLength` on the removal-reason `Input`/schema | ⚠️ Warning | Unbounded free text persisted in `audit_logs.after` and flows into CSV (compounds CR-01) | Not re-independently confirmed this pass; carried from review |
| All 6 new RPCs | `GRANT EXECUTE ... TO authenticated`, no in-function role check | ⚠️ Warning (accepted, matches pre-existing `get_caja_report` posture) | Any authenticated bartender session can call these RPCs directly, bypassing the UI's `view_reports` gate | ✓ Consistent with codebase-wide precedent, explicitly documented as accepted in each plan's threat model |

None of these anti-patterns map to a specific `must_haves` truth that the ROADMAP or any PLAN frontmatter declared — they are net-new findings from the independent code review, not failures of a stated phase deliverable. They do not, on their own, prevent the phase goal (CSV export exists and is wired; RPCs are shipped and bounded; widgets render). They are surfaced here because CR-01 in particular is a genuine, unresolved security finding on a financially-adjacent code path that a "passed" verification should not silently wave through.

### Human Verification Required

1. **CSV formula/injection risk (CR-01) — risk acceptance sign-off**
   - **Test:** Review `src/shared/lib/exporters/csv.ts` and confirm whether the CWE-1236 CSV/formula-injection exposure (free-text `reason`/`staffName` values beginning with `=`/`+`/`-`/`@` become live formulas when the exported file is opened in Excel/Sheets) is an acceptable risk for this desktop POS's threat model, or should be patched before shipping further.
   - **Expected:** An explicit accept/fix decision from a project owner — not a default pass-through.
   - **Why human:** The phase's own threat model (T-24-02-T) pre-emptively rated this "low, accept" during planning, but the independent code review rated the same finding "critical" after seeing the implementation (21 export types now affected, including free-text fields with zero character restriction per WR-06). This is a judgment call, not a code-correctness question.

2. **Visual confirmation of the 3 new/extended Recharts widgets**
   - **Test:** Open `/reports`, visit the Modifier Popularity, Payment Methods, and Hourly tabs; confirm each chart renders with the correct single emerald-500 accent, readable Tooltip/Legend, and no layout breakage.
   - **Expected:** Charts render as designed (per UI-SPEC Chart Contract).
   - **Why human:** No test harness in this repo renders Recharts SVG output; 24-09-SUMMARY.md itself flags this as `human_judgment: true`. This verification pass did not start a dev server (spot-check constraint).

3. **E2E suite for Phase 24's new tests**
   - **Test:** Run `npx playwright test e2e/07-reports.spec.ts` and `npx playwright test e2e/16-table-status.spec.ts --grep "T7|T8|T9"` against a live dev server.
   - **Expected:** The 3 new Phase-24 tests (4-tabs-render, CSV-export-writes-file, bartender-reason-required-removal) pass, and the 3 fixed table-status tests pass, matching 24-10-SUMMARY.md's claims.
   - **Why human:** Requires a live dev server + Supabase dev DB + Playwright browser; out of scope for this verification's no-server-start constraint. Unit-level equivalents (typecheck/lint/full unit suite) were independently re-run instead and all passed.

### Gaps Summary

No must-have truth, artifact, or key link failed. All 4 ROADMAP success criteria and all 10 plans' stated must-haves are genuinely implemented and wired — confirmed by direct source reads (not just SUMMARY claims) plus an independent re-run of typecheck/lint/the full unit test suite (all green, matching the plans' own claimed results exactly). The phase's own migration files show the corrective fixes (timezone bug, `deplete_for_order_item` smallint cast) were applied via proper `CREATE OR REPLACE` migrations, not silently patched in place.

The reason this verification does not resolve to a clean `passed` is a combination of (a) a genuine, unresolved critical security finding from the phase's own code review (CSV injection) that deserves an explicit human risk decision given the reviewer's severity assessment diverges from the plan's own pre-implementation threat model, and (b) two categories of evidence (visual chart rendering, live E2E) that are structurally out of reach for a non-interactive verification pass and were already self-flagged as requiring human judgment by the executing plans themselves. Nothing here should block proceeding to the next phase pending that human sign-off — the three items above are the only asks.

---

*Verified: 2026-07-21T16:30:00Z*
*Verifier: Claude (gsd-verifier)*
*Depth: standard — all 10 plans + 10 summaries read; ROADMAP/CONTEXT/REVIEW/deferred-items cross-referenced; key artifacts (migrations, hooks, widgets, ReportsPage, CLAUDE.md, audit-actions.ts, domain.ts, csv.ts) independently read from disk; typecheck/lint/full unit suite independently re-run*
