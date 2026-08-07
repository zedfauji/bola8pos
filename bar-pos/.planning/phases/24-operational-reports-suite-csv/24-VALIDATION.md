---
phase: 24
slug: operational-reports-suite-csv
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit) / Playwright 1.59 (E2E) |
| **Config file** | vitest.config.ts / playwright.config.ts |
| **Quick run command** | `npx vitest run src/path/to.test.ts` |
| **Full suite command** | `npm run test` (unit) / `npm run test:e2e` (E2E) |
| **Estimated runtime** | ~90 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <affected test file(s)>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-T1 | 01 | 1 | SC-1 | T-24-01-R | order_item.remove enumerated before any RPC uses it | unit | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` | ✅ extend | ✅ green |
| 24-01-T2 | 01 | 1 | SC-1/SC-3 | — | HourlyRow + 4 new row schemas parse | unit/typecheck | `npx vitest run src/shared/lib/domain.test.ts` / `tsc --noEmit` | ✅/scaffold | ✅ green |
| 24-01-T3 | 01 | 1 | SC-2/SC-3 | — | all new i18n keys valid JSON, both locales | scripted | `node -e "...JSON.parse each catalog..."` | ✅ | ✅ green |
| 24-02-T1 | 02 | 2 | SC-2 | T-24-02-T | rowsToCsv RFC-4180 escaping via xlsx | unit | `npx vitest run src/shared/lib/exporters/csv.test.ts` | ❌ NEW (Wave 0) | ✅ green |
| 24-02-T2 | 02 | 2 | SC-2 | — | hourly exporters carry D-04 columns | typecheck+grep | `tsc --noEmit && grep dayOfWeek excel.ts` | ✅ extend | ✅ green |
| 24-02-T3 | 02 | 2 | SC-2 | T-24-02-I | 17 CSV branches + dropdown items | unit | `npx vitest run src/features/export-report/ui/ExportButtons.test.tsx` | ❌ create/extend (Wave 0) | ✅ green |
| 24-03-T1..3 | 03 | 1 | SC-1/SC-4 | T-24-03-D/I | bounded SECURITY DEFINER RPCs; reopened_void + unnest-CTE filters | migration grep | `node -e "structural grep on each .sql"` | ✅ scripted | ✅ green |
| 24-04-T1 | 04 | 2 | SC-1 | T-24-04-R/E | remove_tab_item audits + no role gate + restore-before-delete | migration grep | `node -e "grep remove_tab_item .sql"` | ✅ scripted | ✅ green |
| 24-04-T2 | 04 | 2 | SC-1/SC-4 | T-24-04-I | deletions RPCs read audit_logs (plural) | migration grep | `node -e "grep audit_logs, not singular"` | ✅ scripted | ✅ green |
| 24-05-T1 | 05 | 3 | SC-1 | T-24-05-T | 5 migrations applied to remote (human-gated) | manual+list | `npx supabase migration list` | ✅ | ✅ green |
| 24-05-T2 | 05 | 3 | SC-1 | — | types regenerated, 7 RPCs present | typecheck+grep | `node -e "grep 7 fns" && tsc --noEmit` | ✅ | ✅ green |
| 24-06-T1 | 06 | 4 | SC-1/SC-4 | T-24-06-V | hook bodies call RPCs; helpers retained | unit/typecheck | `npx vitest run queries-reports.test.ts` | ✅ extend | ✅ green |
| 24-06-T2 | 06 | 4 | SC-1 | T-24-06-I | deletions hooks return shaped rows (live) | integration | `npx vitest run deletions-*-report.integration.test.ts` | ❌ NEW (Wave 0) | ✅ green |
| 24-06-T3 | 06 | 4 | SC-1 | — | modifier/payment hooks (live, no double-count) | integration | `npx vitest run modifier-*/payment-*.integration.test.ts` | ❌ NEW (Wave 0) | ✅ green |
| 24-07-T1 | 07 | 4 | SC-1 | T-24-07-R | removal via one RPC, no direct delete | typecheck+grep | `tsc --noEmit && grep rpc('remove_tab_item'` | ✅ | ✅ green |
| 24-07-T2 | 07 | 4 | SC-1 | T-24-07-E | reason required, no PIN gate | unit | `npx vitest run RemoveTabItemDialog.test.tsx` | ❌ NEW (Wave 0) | ✅ green |
| 24-08-T1 | 08 | 5 | SC-3 | T-24-08-M | pre-send DataTable + standing gap Alert | typecheck+grep | `tsc --noEmit && grep AlertTriangle/historicalGap` | scaffold | ✅ green |
| 24-08-T2 | 08 | 5 | SC-3 | T-24-08-I | post-close DataTable, no banner | typecheck+grep | `tsc --noEmit && grep !historicalGap` | scaffold | ✅ green |
| 24-09-T1 | 09 | 5 | SC-3 | T-24-09-M | modifier bar + top-20 cap, uncapped export | typecheck+grep | `tsc --noEmit && grep slice(0, 20)` | scaffold | ✅ green |
| 24-09-T2 | 09 | 5 | SC-3 | T-24-09-I | payment donut + rollup pinned | typecheck+grep | `tsc --noEmit && grep innerRadius/border-t-2` | scaffold | ✅ green |
| 24-09-T3 | 09 | 5 | SC-3 | — | hourly bar chart + dow column | typecheck+grep | `tsc --noEmit && grep BarChart/dayOfWeek` | scaffold | ✅ green |
| 24-10-T1 | 10 | 6 | SC-1/SC-3 | T-24-10-I | 4 new tabs wired, gated by ReportsRoute | typecheck+grep | `tsc --noEmit && grep 4 tab values` | ✅ extend | ✅ green |
| 24-10-T2 | 10 | 6 | SC-2/SC-3 | T-24-10-E | E2E new tabs + CSV export + bartender removal | e2e | `npx playwright test e2e/07-reports.spec.ts` | ✅ extend | ✅ green |
| 24-10-T3 | 10 | 6 | SC-1..4 | — | full phase gate green | gate | `npm run typecheck; npm run lint && npm run test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files that must be created before/with their implementation task (co-located test-first
or `tdd="true"`), since they are MISSING today:

- [ ] `src/shared/lib/exporters/csv.test.ts` — generic `rowsToCsv()` serializer, incl. embedded comma/quote/newline (SC-2) — created in **24-02 T1** (tdd)
- [ ] `src/features/export-report/ui/ExportButtons.test.tsx` — CSV dropdown item renders for every reportType (SC-2) — created/extended in **24-02 T3**
- [ ] `src/entities/tab/model/deletions-pre-report.integration.test.ts` + `deletions-post-report.integration.test.ts` (SC-1) — created in **24-06 T2** (live, post-push)
- [ ] `src/entities/tab/model/modifier-popularity-report.integration.test.ts` + `payment-methods-report.integration.test.ts` (SC-1) — created in **24-06 T3** (live, post-push)
- [ ] Extend `src/shared/lib/__tests__/audit-actions.test.ts` TARGET_RPCS with `remove_tab_item`→`order_item.remove` (SC-1) — done in **24-01 T1**
- [ ] `src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx` — reason required blocks submit (D-07) — created in **24-07 T2** (tdd)

Note: the voids/peak-hours migrations extend existing tests (`queries-reports.test.ts`,
`void-refund-report.integration.test.ts`) rather than needing new files.

---

## Manual-Only Verifications

- **SC-4 bounded-query query plan** — `EXPLAIN ANALYZE` on each new RPC to confirm the
  `created_at BETWEEN` filter uses an index scan (not a seq scan). Not a CI gate; document
  the query plan in the phase verification / PR description (per RESEARCH.md Validation
  Architecture, SC-4 row).
- **24-05 T1 [BLOCKING] `supabase db push`** — human-gated (`autonomous: false`); a human may
  need to intervene if the CLI prompts for auth that the linked session cannot satisfy.
  Verified via `npx supabase migration list` divergence check.
- **Visual chart spot-check** — the single-emerald-accent rule and donut/bar rendering are
  visually confirmed during the Plan 10 E2E / UAT (the automated grep gates prove structure,
  not pixels).

---

## spec-less probe fallback

⚠ spec-less probe fallback skipped: phase has no requirement IDs to probe (visible skip, not
a silent drop). must_haves were derived from the 4 ROADMAP Success Criteria + the 16 CONTEXT
decisions + the RESEARCH/PATTERNS pitfalls (audit_logs plural vs singular, reopened_void
exclusion, deplete-before-delete ordering, unnest-CTE), per the planning-context instruction.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (unit/grep gates; integration/e2e run per-wave)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-07-21 (execution will flip task Status cells to ✅/❌)

---

## Validation Audit 2026-08-07

Retroactive `/gsd-validate-phase 24` audit (State A: VALIDATION.md existed in `draft` status
with all 22 task rows still `⬜ pending` from plan-time seeding, despite the phase having since
executed — SUMMARY files and `04-*-SUMMARY.md` coverage blocks confirm all work completed).
Cross-referenced all 22 Per-Task Verification Map rows against actual test file existence,
content/grep checks, and each plan's recorded `coverage:` pass output (live execution of
integration/E2E specs skipped — this worktree has no `node_modules`; trusted on SUMMARY-recorded
pass results plus static file/content confirmation).

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Rows confirmed COVERED | 22 / 22 |
| — fully automated (unit/integration/e2e/typecheck+grep) | 19 |
| — structural-only by original design (`human_judgment: true` migration greps) | 3 |
| — manual-only, human-gated by design (24-05-T1 `supabase db push`) | 1 |

All 3 post-implementation UAT hardening fixes (CSV formula-injection `sanitizeCsvCell`,
`MoneyDisplay` double-`$` bug, `HourlyBreakdownPanel` explicit bar `fill`) have regression
coverage in their respective test files. No new Wave 0 gaps identified. `nyquist_compliant: true`
reconfirmed — no MISSING requirements remain.
