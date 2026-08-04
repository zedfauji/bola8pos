# Phase 39: AI Slob Technical Debt Remediation - Pattern Map

**Mapped:** 2026-08-03
**Nature of phase:** Subtractive (dead-code deletion) + test triage. No new files are created. This document maps deletion/edit patterns and dynamic-usage sanity-check patterns, per the phase brief.

## File Classification

Not applicable in the create-new-file sense. Instead, classify the *touch types* this phase performs:

| Touch type | Target | Data flow | Example target |
|---|---|---|---|
| Whole-file deletion | knip "unused files" (61) | n/a (file removed) | `scripts/audit-ui-drift.ts` |
| Partial export/type deletion | knip "unused exports/types" (137 files) | n/a (line edit) | `src/shared/lib/domain-helpers.ts:197` |
| Registry line-item review | `domain.ts`, `edge-function-contracts.ts` (181 findings) | n/a | see Registry pattern below |
| devDependency addition | `package.json` | n/a | add `@testing-library/user-event` |
| E2E spec edit | `e2e/*.spec.ts` | test/seed logic | un-skip or fix assertion |

## FSD Import-Boundary Deletion Discipline

This codebase enforces `app → pages → widgets → features → entities → shared` via `eslint-plugin-boundaries`. When scoping a deletion:

1. **Whole-file deletion is safe when the file has zero in-edges from the TS module graph** (knip's basis) *and* it is not one of the dynamic-usage categories below. `grep -rn "from '.*<basename>'" src/ scripts/` as a final sanity check before `git rm`.
2. **Partial export deletion (delete one export, keep the file)** — only remove the flagged `export` keyword/declaration, never delete the whole file if other exports in it are still used. Example target: `src/shared/lib/domain-helpers.ts:197` — `getTabOpenMinutes` is flagged unused; the fix is deleting just that function, not the file (the file has other live exports like `getTabTotal`, etc.).
3. **Paired Zod schema/type exports** (`domain.ts` shape: `export const XSchema = z.object({...}); export type X = z.infer<typeof XSchema>;`) — if only one half is flagged, confirm via grep before deleting either half; deleting the type while the schema is still used elsewhere is a common false-cut.

## Pattern: Dynamic Route Registration (router.tsx) — knip false-negative risk

**File:** `src/app/router.tsx` (lines 1-30 read this session)

Routes are declared via `lazy(() => import('../pages/<name>'))` then referenced inside JSX `<Route path=... element={...} />` further down the file (not shown above the fold, but this is the pattern). A page module (`src/pages/<name>/index.tsx`) will show as "unused" to knip's module-graph analysis **only if it's dead-code truly unreferenced by any `lazy()` call in this file** — but a page that's still registered here is a false negative for knip's other findings (unused *exports within* the page component are real, the page file itself being registered here is not deletable).

```typescript
// Source: src/app/router.tsx:14-30, read this session
const LoginPage = lazy(() => import('../pages/login'));
const HomePage = lazy(() => import('../pages/home'));
const PosPage = lazy(() => import('../pages/pos'));
// ... one lazy() line per page, ~18 total
```

**Sanity-check step for any `src/pages/**` deletion candidate:** `grep -n "pages/<candidate-dir>" src/app/router.tsx` before deleting. If it appears, it is registered and NOT dead — knip should not have flagged the whole directory (if it did, it's a knip false positive worth noting per D-07, not deleting).

## Pattern: RBAC String-Keyed Action Lookups (rbac.ts) — knip false-negative risk

**File:** `src/shared/lib/rbac.ts` (read this session, full file is short)

`STAFF_ACTIONS` is a const array of string literals; `canAccess(role, action: string)` casts the incoming string to `StaffAction` at runtime (`ROLE_SET[role].has(action as StaffAction)`) rather than requiring a statically-typed enum member at every call site. This means an action string can be referenced from JSX/RBAC-gate call sites (`useHasPermission('manage_settings')`, `<RbacGate action="void_order">`, etc.) as a **plain string literal**, which knip's static export-usage analysis can miss if the string never round-trips through a typed import.

```typescript
// Source: src/shared/lib/rbac.ts, read this session
export const STAFF_ACTIONS = [
  'create_order', 'view_own_tabs', 'view_all_tabs', 'start_pool_timer',
  'stop_pool_timer', 'clock_in', 'clock_out', 'close_tab', 'void_order',
  'view_reports', 'adjust_inventory', 'manage_products', 'manage_staff',
  'manage_settings', 'delete_tab', 'view_all_shifts', 'manage_caja',
  'transfer_tab', 'view_kds', 'view_kds_bar', 'process_refund',
  'produce_prep_batch', 'manage_waitlist', 'view_audit_log',
  'edit_paid_tab', 'reopen_tab',
] as const;

export type StaffAction = (typeof STAFF_ACTIONS)[number];

export function canAccess(role: StaffRole | null | undefined, action: string): boolean {
  if (role == null) return false;
  return ROLE_SET[role].has(action as StaffAction);
}
```

**Sanity-check step:** If knip flags a `StaffAction` string literal or a `STAFF_ACTIONS` entry as "unused," `grep -rn "'<action_name>'" src/` (not just import-based search) across the whole `src/` tree — the consumer is very likely a plain string argument to `canAccess(...)`/`isStaffAction(...)`/a JSX prop, not an imported symbol. Do not delete an RBAC action string based on knip alone.

## Pattern: Supabase Edge Function Invocation by URL — knip false-negative risk

**Files:** `supabase/functions/*/index.ts` (14 files flagged in 10-CHECKLIST.md), e.g. `supabase/functions/create-staff/index.ts` (read this session)

These are Deno HTTP entry points (`Deno.serve(async (req) => {...})`), invoked over the network via the Supabase Functions gateway (client calls `supabase.functions.invoke('create-staff', {...})`) or via `fetch()` from another edge function. They have **zero TypeScript `import` in-edges** from `src/`, so knip's module-graph flags every one of them as an unused file. This is a confirmed false-positive category (Pitfall 1 in RESEARCH.md), not a real deletion candidate.

```typescript
// Source: supabase/functions/create-staff/index.ts:1-10, read this session
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { recordAudit } from '../_shared/audit.ts'

Deno.serve(async (req) => {
  const { name, role, pin } = await req.json()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  // ...
})
```

**Sanity-check step:** ANY `supabase/functions/*/index.ts` or `supabase/functions/_shared/*.ts` flagged "unused" by knip must be cross-checked against `grep -rn "functions.invoke('<function-name>'" src/` and/or `grep -rn "'<function-name>'" src/shared/lib/edge-function-contracts.ts` (the contracts registry documents every invocable edge function by name-string, not import). Do NOT delete — per D-07/Pitfall 1, either (a) leave alone with an explicit "confirmed false positive, not deleted" note, or (b) add to `knip.json`'s `entry` array (config fix, out of this phase's stated scope unless trivial to bundle).

## Pattern: Registry File Review (domain.ts / edge-function-contracts.ts)

**Files:** `src/shared/lib/domain.ts` (2164 lines, 151 findings), `src/shared/lib/edge-function-contracts.ts` (1358 lines, 30 findings) — 181 combined findings, one dedicated review plan per RESEARCH.md.

These are intentional wide-surface registries (CLAUDE.md: "Single source of truth is `src/shared/lib/domain.ts` (Zod schemas)"). The paired-export shape to check for every flagged item:

```typescript
// Representative domain.ts shape (Zod schema + inferred type pair)
export const TabSchema = z.object({ /* ... */ });
export type Tab = z.infer<typeof TabSchema>;
```

**Sanity-check step per flagged export/type in these two files:** `grep -rn "\b<ExportName>\b" src/ supabase/functions/` (not `--include` limited to `.ts` imports only — also check `.tsx`, and check whether the name appears as a `z.infer<typeof X>` target elsewhere in the same file before deleting either half of a pair). Batch findings by whether they're genuinely zero-hit across the whole repo, not just zero-import.

## Pattern: Clean Partial-Export Deletion (non-registry file)

**Analog:** `src/shared/lib/domain-helpers.ts:197` — flagged export `getTabOpenMinutes`, one function among many exports in the file.

This is the majority-shape (137 of 198 distinct files): the file is NOT dead, only one exported symbol in it is. The mechanical fix is:
1. `grep -rn "getTabOpenMinutes" src/` — confirm zero call sites outside its own declaration/JSDoc.
2. Delete only that function's declaration (and its named export), leaving the rest of the file's exports intact.
3. Re-run `npm run typecheck` — a removed export that's still referenced anywhere fails immediately.

Other same-shape examples surfaced this session (each is a candidate for the same treatment, one file = one small diff, not a full-file deletion):
- `src/entities/tab/model/store.ts:260` — unused `selectOpenTabs` (namespaced export)
- `src/shared/lib/test-utils.tsx:79-81` — unused re-exports of `act`, `cleanup`, `fireEvent`
- `src/shared/lib/rappi-webhook-payload.ts:17` — unused `RappiWebhookBodySchema`

## Pattern: Whole-File Deletion (mechanical, non-registry, non-edge-function)

**Analog:** `scripts/audit-ui-drift.ts` — knip default-mode "unused files" entry, zero exports/types/dependencies flagged within it (i.e., the whole file is dead, not just parts of it).

```json
// Source: .audit-tmp/knip-report.json:1-16, read this session — the shape of a whole-file-dead finding
{
  "file": "scripts/audit-ui-drift.ts",
  "files": [{ "name": "scripts/audit-ui-drift.ts" }],
  "exports": [], "types": [], "unlisted": [], "dependencies": [], "devDependencies": [], "duplicates": []
}
```

**Mechanical steps:**
1. `grep -rn "audit-ui-drift" . --include="*.ts" --include="*.tsx" --include="*.json" --include="*.sh"` — confirm zero references anywhere (including `package.json` scripts, CI workflow, other scripts).
2. `git rm scripts/audit-ui-drift.ts`.
3. Re-run `npm run typecheck && npm run test`.

**Exclusion filter before applying this pattern to any candidate:** skip if the path matches `supabase/functions/**` (edge-function pattern above) or `src/shared/ui/**`/Storybook stories (D-08, Medium-tier, out of scope this phase).

## Pattern: E2E Skip-Reason Triage (Track A2)

**File shape:** `e2e/*.spec.ts`, `test.skip(true, '<reason>')` call sites (136 found across the suite).

Cross-check each skip reason string against CLAUDE.md's "Implemented Features" list (features shipped: `void-order`, `transfer-tab`, `split-tab`, `reopen-tab`, etc.) before deciding to un-skip. After un-skipping, always run the single spec:

```bash
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/spec-result.json npx playwright test e2e/<spec>.spec.ts --reporter=json
```

Do not count an un-skip as fixed without this run (Pitfall 4).

## Pattern: E2E Failure Triage (Track A3)

**File shape:** `.audit-tmp/e2e-per-spec/<NN-name>.json`, Playwright JSON reporter output.

```json
// Source: .audit-tmp/e2e-per-spec/03-tab-order.json, read this session
{
  "stats": { "expected": 6, "skipped": 2, "unexpected": 1, "flaky": 0 },
  "suites": [{ "suites": [{ "specs": [{ "tests": [{ "status": "unexpected",
    "results": [{ "status": "failed", "error": { "message": "Error: expect(locator).toBeHidden() failed..." } }] }] }] }] }]
}
```

Navigate `suites[].suites[].specs[].tests[].results[].error.message` for the real error (title alone is insufficient per D-04). Batch by spec file — most specs share one root cause across multiple failing tests (Pitfall 3).

## Shared Patterns

### Re-verification loop (apply after every wave/plan)
**Source:** `scripts/run-tech-debt-audit.sh`, `npm run audit:tech-debt`
```bash
npx knip --reporter json > .audit-tmp/knip-report.json
npx knip --production --reporter json > .audit-tmp/knip-production.json
npm run typecheck && npm run test
```
Apply to: every knip deletion plan (Track B) and every unit-test-adjacent E2E fix.

### devDependency fix (Track B1)
**Source:** RESEARCH.md Code Examples
```diff
   "devDependencies": {
+    "@testing-library/user-event": "^14.6.1",
     "@testing-library/jest-dom": "^6.9.1",
```

## No Analog Found / Not Applicable

This phase creates no new files, so there is no "closest analog for a new file" table. All patterns above are deletion/verification patterns, not creation patterns.

## Metadata

**Analog search scope:** `src/app/router.tsx`, `src/shared/lib/rbac.ts`, `supabase/functions/create-staff/index.ts`, `src/shared/lib/domain-helpers.ts`, `.audit-tmp/knip-report.json`, `.audit-tmp/e2e-per-spec/03-tab-order.json`
**Files scanned:** 6 direct reads + 2 knip-JSON queries this session
**Pattern extraction date:** 2026-08-03
</content>
