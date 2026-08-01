---
phase: 27-one-shot-inventory-cigarette-box-pattern
verified: 2026-08-01T04:20:00Z
status: passed
score: 4/4 success criteria verified
behavior_unverified: 0
overrides_applied: 0
re_verification: No — initial verification
---

# Phase 27: One-Shot Inventory (Cigarette-Box Pattern) Verification Report

**Phase Goal:** Support "open one unit, sell individually" inventory (e.g. cigarette box opened → loose
sticks) via an `open_units` table, a `consume_open_unit` SQL function, an admin Open-Units tab, and
reportable lifecycle tracking.
**Verified:** 2026-08-01
**Status:** passed
**Re-verification:** No — initial verification

## Method

This phase makes unusually strong, checkable claims (live-database pushes, live integration tests, a
live E2E run). Rather than trust SUMMARY.md narration, every claim below was re-executed independently
in this verification pass:

- Queried the **live remote Supabase project** (`shsrhxleopmovzpzqmex`, confirmed via `npx supabase
  projects list` as the linked `bar-pos` project) directly with `npx supabase db query --linked` for
  table columns, constraints, indexes, RLS status, and RPC existence — not inferred from migration
  files.
- Re-ran `npm run typecheck`, `npm run lint`, the full unit suite (`npm run test`), the two
  Supabase-backed integration test files, and the phase-specific unit test files, fresh, in this
  session.
- Started the real Tauri/Vite dev server and re-ran `e2e/49-open-units.spec.ts` headed against
  `google-chrome-stable` with a real display session (`DISPLAY=:0` was available in this environment,
  contrary to the "manual only" assumption baked into the original plan) — this is the automated
  substitution for the phase's Task 3 human-verification checkpoint, and it was independently
  re-executed here, not merely read as a SUMMARY claim.
- Cross-checked `audit_logs` on the live database directly for real `open_unit.*` rows produced by
  actual RPC calls (not just test assertions).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `open_units` table tracks opened-unit state (remaining count, parent product, opened-by/when) (SC-1) | ✓ VERIFIED | Live query against `shsrhxleopmovzpzqmex`: `open_units` table exists with columns `id, product_id, remaining_count, status, opened_by, opened_at, closed_by, closed_at, closed_reason, created_at, updated_at`; FKs `product_id -> products(id)`, `opened_by/closed_by -> profiles(id)`; CHECK constraints `remaining_count >= 0` and `status IN ('active','exhausted','void')`; RLS enabled (`relrowsecurity = true`). |
| 2 | `consume_open_unit` SQL function atomically decrements remaining count, auto-transitions to a new unit when exhausted (SC-2) | ✓ VERIFIED | `consume_open_unit` exists live (confirmed via `information_schema.routines`). Re-ran `src/entities/open-unit/model/consume-open-unit.integration.test.ts` fresh against the live schema: 6/6 passed, including the R1 concurrency race (two parallel sales on the last piece — exactly one succeeds, final count 0, no duplicate active row) and R2 unit-boundary crossing (quantity-3 line spans two units atomically, exactly one active row afterward). A genuine pre-existing bug found during 27-03 (override-bypass path violating `inventory`'s non-negative CHECK) was fixed and is live (`20260730000001_consume_open_unit_fix_negative_inventory_floor.sql`, confirmed present in `npx supabase migration list` LOCAL+REMOTE). |
| 3 | Admin Open-Units tab shows currently open units and lets staff manually open a new one (SC-3) | ✓ VERIFIED | `src/widgets/OpenUnitsTab.tsx` exists, mounted inside `InventoryPagePanel.tsx` as a second `TabsContent` (no new route; `grep` confirms exactly 2 `<TabsTrigger>`/`<TabsContent>` pairs and neither is role-gated). `OpenUnitButton` (bartender+, no PIN, D-11) and `CorrectOpenUnitDialog`/`VoidOpenUnitDialog` (manager+, PIN-gated via `ManagerPinDialog requiredAction="adjust_inventory"`, D-12) are wired and per-control gated with `ProtectedAction`. `open_open_unit`, `correct_open_unit`, `void_open_unit` RPCs confirmed live. Re-ran `open-unit-lifecycle.integration.test.ts` fresh: 8/8 passed (open path, D-08 duplicate rejection with live count, D-12/T-27-09 bartender-calls-manager-RPC-directly rejection, correction bounds, void, freed-index re-open, voided-row-never-resurrected). Re-ran the full UI/E2E path (`e2e/49-open-units.spec.ts`, headed, real dev server, real Supabase project) in this session: **1 passed (2.4 min)** — independently confirms the tab renders, opening/selling/exhaustion/override/correct/void/RBAC-tier/D-06/audit all work through the real browser. |
| 4 | Lifecycle (opened → depleting → exhausted) reportable via `audit_logs` (Phase 14) (SC-4) | ✓ VERIFIED | All 6 `open_unit.*` action strings (`open_unit.open`, `open_unit.deplete`, `open_unit.exhaust`, `open_unit.void`, `open_unit.correct`, `open_unit.override`) are registered in `AuditActionSchema`/`AuditAction` in `src/shared/lib/audit-actions.ts`, and a live query of `audit_logs` on the remote project confirms **all six appear as distinct actions with real rows already written** by actual RPC calls (not merely asserted by a test) — `SELECT DISTINCT action FROM audit_logs WHERE action LIKE 'open_unit.%'` returned all 6. Every lifecycle RPC (`consume_open_unit`, `open_open_unit`, `correct_open_unit`, `void_open_unit`) calls `record_audit()`, never the legacy singular `audit_log` table (grep-confirmed absent in all phase-27 migrations). |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260729000001_open_units_table.sql` | table + partial unique index + RLS | ✓ VERIFIED | File exists; table, index (`open_units_one_active_per_product ON open_units(product_id) WHERE status='active'`), and RLS confirmed live. |
| `supabase/migrations/20260729000002_products_open_unit_columns.sql` | `units_per_package`, `parent_product_id` | ✓ VERIFIED | Both columns confirmed live on `products` via `information_schema.columns`. |
| `supabase/migrations/20260729000003_consume_open_unit_rpc.sql` (+ `20260730000001` fix) | atomic decrement + auto-transition | ✓ VERIFIED | Function exists live; integration tests exercising concurrency/boundary/override/refund pass fresh. |
| `supabase/migrations/20260729000004_deplete_for_order_item_v5_open_units.sql` | chokepoint branch | ✓ VERIFIED | `deplete_for_order_item` confirmed live; tracer + hardening tests drive depletion exclusively through this function (grep-verified no direct `consume_open_unit` client call site). |
| `supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql` | `open_open_unit`, `correct_open_unit`, `void_open_unit` | ✓ VERIFIED | All 3 confirmed live via `information_schema.routines`; RBAC guards proven with real bartender/manager role clients (not service-role). |
| `src/entities/open-unit/` | Zod schemas + entity queries | ✓ VERIFIED | `useOpenUnits` + 3 RPC-backed mutation hooks; zero `.insert()/.update()/.delete()` in the file (grep-confirmed); `queries.test.ts` — part of the 65 tests re-run in this session, all passing. |
| `src/features/{open-open-unit,correct-open-unit,void-open-unit}/` | 3 self-contained action features | ✓ VERIFIED | All present; `CorrectOpenUnitDialog.tsx` read directly — confirms mutation dispatch happens only inside `handlePinSuccess`, gated behind `ManagerPinDialog`. |
| `src/widgets/OpenUnitsTab.tsx` + `.test.tsx` | admin tab UI | ✓ VERIFIED | Read directly; D-06 boundary comment + no threshold-styling code confirmed by direct read (not just grep). |
| `src/widgets/InventoryPagePanel.tsx` (tabs refactor) | Stock tab preserved + Open Units tab added | ✓ VERIFIED | `grep` confirms exactly 2 `<TabsTrigger>`, 2 `<TabsContent>`, pre-existing elements (`batchAdjustmentTitle`, `changeLogTitle`, `onHandLevelsTitle`, `downloadInventoryCsv`, 2× `<ProtectedAction`) all still present. |
| `e2e/49-open-units.spec.ts` | automated substitution for the Task 3 human-verify checkpoint | ✓ VERIFIED | File exists (34KB); **re-executed in this session** headed against a real display session and a real Chrome install (contrary to the plan's assumption that no display session would be available) — 1 passed in 2.4 min. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| order-entry | `open_units` row | `create_order_with_items` → `deplete_for_order_item` → `consume_open_unit` | ✓ WIRED | Live integration test drives depletion exclusively through `deplete_for_order_item`; a grep of the test file finds no direct `consume_open_unit` RPC call. |
| `consume_open_unit` auto-open | `inventory` row (package stock) | `FOR UPDATE` lock + decrement | ✓ WIRED | Confirmed by R2 test (package stock reaches exactly 0 after one auto-open from a stock of 1) and live E2E run. |
| all lifecycle RPCs | `audit_logs` | `record_audit()` | ✓ WIRED | Confirmed live: `SELECT DISTINCT action FROM audit_logs WHERE action LIKE 'open_unit.%'` returns all 6 actions with real rows already present. |
| `ProductForm` | `products.units_per_package` / `.parent_product_id` | `ProductCreateSchema`/`ProductUpdateSchema` | ✓ WIRED | `mapProductRow`/`productUpdateToRow`/`useMutationCreateProduct` all read/write both columns (grep + direct read confirmed); E2E spec Steps 1-2 create and persist both fields through the real form. |
| `CorrectOpenUnitDialog`/`VoidOpenUnitDialog` | manager-gated RPCs | `ManagerPinDialog requiredAction="adjust_inventory"` → `onSuccess` | ✓ WIRED | Direct file read confirms the primary button only sets `pinOpen=true`; the mutation call exists solely inside the PIN dialog's `onSuccess` handler. |
| `OpenUnitButton` | `open_open_unit` RPC | no gate (D-11) | ✓ WIRED | Direct file read + grep confirm no `ProtectedAction`/`canAccess`/`usePermissions` wrapper. |

### Requirements Coverage

REQUIREMENTS.md does not exist for this milestone (confirmed absent again in this pass, consistent with
Phases 14/16/17's prior findings) — ROADMAP.md's 4 Success Criteria (SC-1..SC-4) are the requirement
set, as documented in 27-CONTEXT.md and 27-RESEARCH.md.

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| SC-1 | 27-02, 27-04, 27-05, 27-06 | ✓ SATISFIED | Table + columns live; entity schemas + admin form fields wired. |
| SC-2 | 27-02, 27-03 | ✓ SATISFIED | `consume_open_unit` live; concurrency/boundary/override/refund hardening tests pass fresh. |
| SC-3 | 27-04, 27-05, 27-06, 27-07, 27-08 | ✓ SATISFIED | Tab live, wired, RBAC-correct; E2E re-run confirms end-to-end. |
| SC-4 | 27-02, 27-03, 27-04, 27-08 | ✓ SATISFIED | 6 audit actions registered and confirmed with real rows on the live database. |

No orphaned requirements — every SC is claimed by at least one plan's `requirements:` frontmatter, and
the union of all 8 plans' `requirements:` fields covers SC-1..SC-4 exactly.

### Anti-Patterns Found

A grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across every file this phase created/modified found
exactly one hit:

- `src/entities/open-unit/model/queries.ts:2` — `// TODO(27-05): Remove this eslint-disable and the
  \`db\` cast below once ...` — this is the CLAUDE.md-documented, project-sanctioned "missing generated
  types workaround" (identical pattern already used in `entities/inventory/model/queries.ts` and
  `ModifierGroupEditor.tsx` pre-dating this phase), names its own removal trigger
  (`npx supabase gen types typescript`), and is not a debt marker requiring a tracked issue — it is the
  established codebase convention for a not-yet-regenerated Supabase types file. Not a blocker.

No other TODO/FIXME/placeholder/stub patterns, no empty-implementation stubs, no hardcoded-empty-array
returns feeding UI, found in any phase-27 file.

### Behavioral Spot-Checks / Live Re-Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Migrations applied to live remote project | `npx supabase migration list` | All 6 phase-27 timestamps (`20260729000001`-`...05`, `20260730000001`) present in both LOCAL and REMOTE | ✓ PASS |
| `open_units` table shape matches design | `npx supabase db query --linked` (columns, constraints, indexes, RLS) | Exact match to 27-01's locked schema shape | ✓ PASS |
| `products` columns live | `npx supabase db query --linked` | `units_per_package`, `parent_product_id` both present | ✓ PASS |
| All RPCs live | `npx supabase db query --linked` (`information_schema.routines`) | `consume_open_unit`, `open_open_unit`, `correct_open_unit`, `void_open_unit`, `deplete_for_order_item`, `record_audit` all present | ✓ PASS |
| `npm run typecheck` | fresh run | clean, 0 errors | ✓ PASS |
| `npm run lint` | fresh run | clean (0 errors; only pre-existing unrelated `boundaries` config warning) | ✓ PASS |
| `npm run test` (full unit suite) | fresh run | 149/151 files passed (2 skipped), 1369/1384 tests passed, 15 todo, 0 failed | ✓ PASS |
| Phase-27 integration tests (live DB) | `npx vitest run --reporter=dot src/entities/open-unit/model/{consume-open-unit,open-unit-lifecycle}.integration.test.ts` | 14/14 passed against the live remote schema | ✓ PASS |
| Phase-27 unit/component tests | `npx vitest run --project unit --reporter=dot src/entities/open-unit src/features/{open-open-unit,correct-open-unit,void-open-unit} src/widgets/OpenUnitsTab.test.tsx src/shared/lib/domain.open-unit-schema.test.ts src/shared/lib/__tests__/audit-actions.test.ts src/entities/product` | 7/7 files, 65/65 tests passed | ✓ PASS |
| Full phase E2E, headed, real browser, real project | `npx playwright test e2e/49-open-units.spec.ts --headed` | 1 passed (2.4 min) | ✓ PASS |
| `audit_logs` real rows for all 6 lifecycle actions | live `db query` | All 6 `open_unit.*` actions have real rows | ✓ PASS |

### Human Verification Required

None. The phase's original `checkpoint:human-verify` (Task 3 of 27-08) was substituted, with explicit
human authorization documented in 27-08-SUMMARY.md, by an automated Playwright spec
(`e2e/49-open-units.spec.ts`) covering all 12 steps of the manual checklist. This verification pass did
not accept that substitution on the SUMMARY's word alone — the spec was re-executed independently in
this session (headed, real display session, real Chrome, real dev server, real Supabase project) and
passed. No further human verification items remain outstanding.

### Gaps Summary

No gaps found. Every one of the 4 ROADMAP success criteria is independently verified against the live
remote database and a fresh re-run of every automated test in the phase, including a live re-execution
of the E2E spec that substituted for the phase's human-verification checkpoint. Five genuine
pre-existing bugs unrelated to this phase's own scope (i18n locale persistence, product-creation flow,
inventory-mapper crash, negative-stock override) were found and fixed during 27-08's E2E work — these
are documented in 27-08-SUMMARY.md and confirmed still fixed in this session's fresh test runs.

One minor, non-blocking staleness note: `.planning/STATE.md`'s `last_activity_desc` field still reads
"Phase 27 Plan 06 complete" even though plans 07 and 08 (and the phase overall, per ROADMAP.md's own
"8/8 plans executed" line) are complete. This is a documentation-freshness nit in project tracking
metadata, not a phase-goal deficiency, and does not affect any of the 4 success criteria.

---

_Verified: 2026-08-01_
_Verifier: Claude (gsd-verifier)_
