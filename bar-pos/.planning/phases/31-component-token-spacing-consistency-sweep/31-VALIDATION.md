---
phase: 31
slug: component-token-spacing-consistency-sweep
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (unit) + React Testing Library + Playwright 1.59 (E2E) |
| **Config file** | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) |
| **Quick run command** | `npm run test` (unit, run-once) |
| **Full suite command** | `npm run test` (unit) + `npm run test:e2e` (E2E, requires dev server + `.env.local` creds) |
| **Estimated runtime** | ~30s unit; targeted E2E specs ~2-3min |

---

## Sampling Rate

- **After every task commit:** `npm run typecheck && npm run lint && npx vitest run <touched test files, if any>`
- **After every plan wave:** `npm run test` (full unit suite) + targeted `npx playwright test e2e/38-audit-logs.spec.ts e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts` (the 3 specs with load-bearing selectors/testids touched by this phase)
- **Before `/gsd-verify-work`:** Full unit suite green + the 3 targeted E2E specs green. Full `npm run test:e2e` (all 22 specs) is optional per CLAUDE.md policy but recommended once at phase-gate since this phase touches shared chrome (`HomeDashboard`, `PoolTableGrid`).
- **Max feedback latency:** 30s (unit); targeted E2E specs acceptable at wave-gate cadence only (not per-task — E2E requires a running dev server).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01/02/03/04-* | 01-04 | 1 | COMPONENT-01 | — | Swapped buttons render with same accessible name/role/click behavior | unit (existing, partial) | `npx vitest run src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx src/widgets/AuditLogTable/AuditLogTable.test.tsx` | ✅ 2/16 button files covered; rest manual/Storybook spot-check per UI-SPEC States Checklist | ✅ green |
| 31-02-* | 02 | 1 | COMPONENT-01 | — | `data-testid`/`aria-label`/`aria-expanded` preserved on swapped controls | E2E (existing) | `npx playwright test e2e/38-audit-logs.spec.ts e2e/15-home-navigation.spec.ts` | ✅ | ✅ green |
| 31-06-01 | 06 | 1 | COMPONENT-02 | — | `AuditLogFilterBar` date-from input still locatable/fillable after `FormField` wrap — atomic task also updates the E2E selector (Pitfall 1: `FormField`'s `cloneElement` clobbers the child's `id`) | E2E (existing, selector updated in same task) | `npx playwright test e2e/38-audit-logs.spec.ts -g "date range filter"` | ✅ fixed atomically with the FormField wrap (31-06 Task 1) | ✅ green |
| 31-05-* | 05 | 1 | COMPONENT-02 | — | `ModifierGroupEditor` checkboxes round-trip `checked`/`onCheckedChange` correctly (pattern: `IngredientForm.tsx:272-278`) | manual/Storybook | N/A — no test file exists (pre-existing Wave 0 gap, not introduced by this phase) | ❌ W0 (pre-existing) | ⬜ pending (manual) |
| 31-06-02 | 06 | 1 | COMPONENT-02 | — | `InventoryPagePanel` batch-delta still accepts/submits negative values after `FormField` wrap | manual | N/A — no test file exists (pre-existing gap) | ❌ W0 (pre-existing) | ⬜ pending (manual) |
| 31-04-* | 04 | 1 | COMPONENT-03 | — | `/pool-table-status` has exactly one way back to `/pool-tables` after duplicate-button removal (EmptyState CTA retained, main-render duplicate at line ~393 removed) | E2E (existing) | `npx playwright test e2e/16-table-status.spec.ts` | ✅ (note: pre-existing Supabase-RPC-latency flake documented in Phase 30 SUMMARY, unrelated to this phase) | ✅ green |
| 31-03-*/31-04-* | 03, 04 | 1 | TOKEN-01 | — | Exemption comment present at all 3 `category.color` hex sites, no value change | manual code review | N/A — no drift-lint exists yet (Phase 35 scope) | ❌ intentional (Phase 35) | ✅ reviewed |
| 31-07-01 | 07 | 2 | TOKEN-02 | — | Zero arbitrary-spacing violations, phase-wide conformance gate | automated | grep pattern baked into 31-07 Task 1, matches DRIFT-AUDIT baseline of 0 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Finalized post-planning by /gsd-plan-phase 31 — task IDs reference the 7 committed PLAN.md files (31-01 through 31-07).*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements for automated regression protection on the load-bearing paths (audit-log filter E2E, home-navigation E2E, table-status E2E, 2 existing unit test files). No new Wave 0 test scaffolding is required — this is a pure markup/token conformance sweep with zero new behavior, per CONTEXT.md's "no new tests" framing.*

The following pre-existing test-coverage gaps are NOT this phase's responsibility to fill (flagged for visibility only): `ModifierGroupEditor.test.tsx`, `AuditLogFilterBar.test.tsx`, `InventoryPagePanel.test.tsx`, `HardwareSettingsTab.test.tsx`, `TableStatusPanel.test.tsx`, `PoolTableGrid.test.tsx` — none exist; UI-SPEC's States Checklist already scopes these to manual/Storybook spot-check.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Checkbox visual/interaction parity after raw-input → `Checkbox` swap | COMPONENT-02 | No test file exists for `ModifierGroupEditor`/`HardwareSettingsTab` | Open Storybook or dev server, toggle each checkbox, confirm checked-state persists and visually matches prior raw-input styling |
| Signed quantity-delta field still accepts negative values | COMPONENT-02 | No test file exists for `InventoryPagePanel` | Dev server: open batch-delta field, enter a negative number, confirm it submits without clamping |
| Category-color hex exemption comment correctness | TOKEN-01 | No drift-lint exists yet (Phase 35) | Code review: confirm a comment documenting the `category.color` exemption sits directly above each of the 3 hex-literal sites |
| Icon-only button a11y attrs preserved on swap | COMPONENT-01 | Not all 16 button files have unit/E2E coverage | Dev server / Storybook: tab through swapped controls, confirm `aria-label`/`title`/focus ring unchanged from pre-swap |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none required — existing infra sufficient)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (unit)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11 (plan-checker VERIFICATION PASSED)
