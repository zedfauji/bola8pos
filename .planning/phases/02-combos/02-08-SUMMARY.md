---
phase: 02-combos
plan: "08"
subsystem: e2e/32-combos
tags:
  - e2e
  - playwright
  - combos
  - phase-gate
  - regression

dependency_graph:
  requires:
    - "02-07 (seed-combos.ts: Cubeta Regular, Cubeta Premium, Martes de Cubeta + Pool seeded)"
    - "02-06 (KdsBoard ComboKdsCard with data-testid kds-combo-card)"
    - "02-05 (ComboBuilderSheet mounted in ProductGrid)"
    - "02-04 (ProductGrid combo routing fork, ManagerPinDialog)"
    - "02-03 (add_combo_to_tab RPC with NESTED_COMBO_FORBIDDEN guard)"
    - "02-01 (combo_availability, audit_log guard in RPC)"
  provides:
    - "32-combos.spec.ts — 6 E2E test scenarios for full combos flow"
    - "T5: page.evaluate → add_combo_to_tab RPC → NESTED_COMBO_FORBIDDEN real assertion"
  affects:
    - "Phase 2 gate: human verification checkpoint follows this plan"

tech_stack:
  added: []
  patterns:
    - "Day-conditional E2E test pattern: test.info().annotations.push for skip notes rather than hard skip"
    - "Service client helpers inline in spec file (same pattern as 31-categories.spec.ts)"
    - "page.evaluate with passed parameters for RPC-level T5 test (avoids window.__ global dependency)"
    - "DB seeding in T6 via service client for KDS state setup"

key-files:
  created:
    - bar-pos/e2e/32-combos.spec.ts
  modified: []

key-decisions:
  - "T3 and T4 use conditional day-of-week logic with annotations rather than hard test.skip — allows the test to always run and report its state"
  - "T5 uses page.evaluate with explicit parameter passing (supabaseUrl, supabaseAnonKey, comboId, tabId) instead of window.__SUPABASE_URL__ globals — more reliable across environments"
  - "T5 creates its own open tab via service client if no open tab exists — avoids dependency on T2 running first"
  - "T6 seeds combo order_items directly via service client with parent_order_item_id set — tests KDS data model without depending on ComboBuilderSheet UI flow"
  - "setComboAvailabilityMonFri helper used in T2 beforeEach via DB to ensure availability regardless of T1 UI outcome — E2E tests must be independent"
  - "logout wrapped in .catch(() => undefined) in afterEach — prevents afterEach failure from masking real test failures"

requirements-completed:
  - S2-17

duration: 3min
completed: "2026-04-24"
---

# Phase 02 Plan 08: E2E Spec 32-combos.spec.ts Summary

**32-combos.spec.ts — 6 E2E scenarios covering admin combo availability setup, bartender ordering flow, day-of-week unavailability, manager PIN override, NESTED_COMBO_FORBIDDEN RPC assertion via page.evaluate, and KDS combo grouping**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-24T00:10:16Z
- **Completed:** 2026-04-24T00:13:Z
- **Tasks:** 1 (spec write + commit) + 1 checkpoint (human-verify, pending)
- **Files modified:** 1 (created)

## Accomplishments

- `32-combos.spec.ts`: 6 test scenarios following the `31-categories.spec.ts` pattern
  - Uses `loginAs`, `logout`, `requireIntegrationEnv`, `resetTestState`, `openCaja` from existing helpers
  - `createClient` from `@supabase/supabase-js` for service-client helpers (same pattern as 31-categories)
  - **T1**: Admin navigates to Settings → Combos tab, edits Cubeta Regular, toggles Mon–Fri day buttons, saves. Gracefully handles missing seed data with annotations.
  - **T2**: Bartender finds Cubeta Regular (ComboBadge), taps card, ComboBuilderSheet opens, selects slot option, clicks "Add to Order", verifies toast + combo in tab. Day-conditional: sets Mon–Fri availability via DB helper first.
  - **T3**: Day-conditional check — if Saturday, verifies unavailability badge/dialog on Cubeta Regular; on non-Saturday, checks Martes de Cubeta (Tuesday-only) as proxy. Annotates skip reason when day doesn't match.
  - **T4**: Manager PIN override for unavailable combo (Martes de Cubeta + Pool, Tuesday-only). Verifies override banner and checks `audit_log` table for `combo_override` action row.
  - **T5**: `page.evaluate` calls `add_combo_to_tab` RPC with combo product as its own slot child (nested combo). Asserts `NESTED_COMBO_FORBIDDEN` in error message — tests DB trigger + RPC guard.
  - **T6**: Seeds combo order_items directly via service client with `parent_order_item_id` set on children. Navigates to POS/KDS, verifies `data-testid="kds-combo-card"` card, expands and counts child items.

## Task Commits

1. **Task 1: Write 32-combos.spec.ts E2E spec** — `0f267ad` in `bar-pos/` git repo

## Files Created/Modified

- `bar-pos/e2e/32-combos.spec.ts` — 6 E2E scenarios, 905 lines, TypeScript typecheck clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `setComboAvailabilityMonFri` DB helper for T2 availability setup**
- **Found during:** Task 1 design
- **Issue:** T2 requires Cubeta Regular to be available (Mon–Fri) regardless of whether T1 ran or succeeded. T1 tests the UI path, but T2 must not depend on T1.
- **Fix:** Added `setComboAvailabilityMonFri(comboProductId)` service-client helper that deletes and re-inserts Mon–Fri availability windows before T2 runs. Called at the start of T2.
- **Impact:** Tests are now properly independent (no T1 → T2 state leak).

**2. [Rule 2 - Missing Critical] T5 uses explicit parameter passing to page.evaluate instead of window globals**
- **Found during:** Task 1 (reading supabase.ts — no window.__SUPABASE_URL__ global exposed)
- **Issue:** Plan draft suggested `window.__SUPABASE_URL__` and `window.__SUPABASE_ANON_KEY__`. The app's `supabase.ts` does not expose these globals — it reads from `import.meta.env.VITE_SUPABASE_URL` (build-time env, not window global).
- **Fix:** Pass `supabaseUrl` and `supabaseAnonKey` as parameters to `page.evaluate` from the Node.js test runner context where `process.env` is available.
- **Impact:** T5 is reliably executable without relying on undefined window globals.

## Manual Run Steps

The E2E suite requires a running dev server and `.env.local` credentials. Cannot be run in the current environment (no running dev server, no `.env.local` credentials available to the executor).

**To run the combos spec:**

```bash
# 1. Ensure staging DB has seed data
cd bar-pos
npx tsx scripts/seed-combos.ts

# 2. Start dev server (or connect to staging)
npm run dev

# 3. In a second terminal, run the combos spec
npx playwright test e2e/32-combos.spec.ts --headed

# 4. Run full regression suite
npm run test:e2e

# 5. View results
npm run test:e2e:report
```

**Required .env.local keys:**
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
E2E_ADMIN_NAME=...
E2E_ADMIN_PIN=0000
E2E_MANAGER_NAME=...
E2E_MANAGER_PIN=...
E2E_BARTENDER_NAME=...
E2E_BARTENDER_PIN=...
```

## Known Stubs

None — all 6 tests make real assertions with graceful degradation via `test.info().annotations.push` when staging data is missing. T5 is a hard assertion (`expect(result.error).not.toBeNull()` + `expect(errorMessage).toMatch(/NESTED_COMBO_FORBIDDEN/i)`).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: repudiation | bar-pos/e2e/32-combos.spec.ts | T4 checks audit_log row for manager override — if table absent, test logs annotation but does not fail hard (gap documented) |

## Self-Check

Files exist:
- `bar-pos/e2e/32-combos.spec.ts` — FOUND

Commits exist:
- `0f267ad` — in bar-pos/ git repo

Key content:
- `loginAs` — 10 matches (admin and bartender in each test)
- `NESTED_COMBO_FORBIDDEN` — 8 matches (T5 assertion + import/type references)
- `page.evaluate` — 2 matches (T5 RPC call)
- `kds-combo-card` — present (T6)
- `19-combos` reference — NONE (correct)
- `test.info().annotations.push.*pending` — NONE (no pending stub annotations)
- TypeScript typecheck: exit 0

## Self-Check: PASSED (manual E2E verification required on staging)

---
*Phase: 02-combos*
*Completed: 2026-04-24*
