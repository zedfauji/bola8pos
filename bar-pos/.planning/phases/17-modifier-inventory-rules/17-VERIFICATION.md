---
phase: 17-modifier-inventory-rules
verified: 2026-07-07T20:58:36Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

**Post-verification update (2026-07-07):** The migration-ledger desync flagged below as a human-verification item has been resolved: `npx supabase migration repair --status applied 20260707000001 20260707000002` + `npx supabase migration repair --status reverted 20260707204352 20260707204745` reconciled the remote `supabase_migrations.schema_migrations` ledger with the checked-in filenames. `npx supabase migration list --linked` now shows both versions matching (local = remote); `npx supabase db push --dry-run` reports "Remote database is up to date." Re-confirmed via direct query that `pg_get_functiondef` still contains `GROUP BY ingredient_id` post-repair (repair is bookkeeping-only, does not touch schema/function bodies). Status upgraded from `human_needed` to `passed`.

# Phase 17: Modifier → Inventory Rules Verification Report

**Phase Goal:** Let modifiers (e.g. "extra cheese", "no ice") drive inventory depletion. Add a `modifier_inventory_rules` join table, extend the `deplete_for_order_item` RPC to account for selected modifiers, and add an admin UI inside `manage-modifier-groups` to configure the rules.
**Verified:** 2026-07-07T20:58:36Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Context for this verification

Phase 17 originally shipped (plans 17-01 through 17-05, all SUMMARY.md dated 2026-07-07) with a critical bug (CR-01) found by a subsequent code review (`17-REVIEW.md`, reviewed 2026-07-07T20:40:36Z): two modifiers on the same order item targeting the same ingredient collided on the `(ref_type, ref_id, ingredient_id)` partial unique index on `stock_movements` and raised an unhandled `unique_violation` that aborted the **entire** `deplete_for_order_item` RPC call — including the already-succeeded recipe loop. This was fixed **after** all 5 SUMMARY.md files were written, via two follow-up migrations and code commits (`37b0ae5` fix(17) CR-01, `e01d091` fix(17) WR-01) not documented in any plan SUMMARY. This verification specifically re-checks that those fixes are actually live and tested, in addition to the standard goal-backward check of the phase's 4 roadmap success criteria.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `modifier_inventory_rules` table maps modifier options to ingredient deltas (SC-1) | ✓ VERIFIED | Live schema query confirms `id, modifier_id, ingredient_id, delta, created_at` columns; `CHECK (delta <> 0)` signed delta; `UNIQUE(modifier_id, ingredient_id)`. Table + RLS live per `20260706000002_modifier_inventory_rules_table.sql`. |
| 2 | `deplete_for_order_item` applies modifier-driven deltas atomically alongside base recipe depletion, without aborting on same-ingredient collisions (SC-2) | ✓ VERIFIED | Live `pg_get_functiondef('public.deplete_for_order_item(uuid, smallint, boolean)'::regprocedure)` queried directly against remote Supabase (`shsrhxleopmovzpzqmex`) contains `SELECT ingredient_id, SUM(delta) AS delta FROM modifier_inventory_rules WHERE modifier_id = ANY(v_modifier_ids) GROUP BY ingredient_id` — the CR-01 fix is live, not just authored in a migration file. |
| 3 | Two modifiers on one order_item targeting the same ingredient aggregate into a single stock_movements row instead of aborting the RPC (CR-01 regression) | ✓ VERIFIED | `depletion.integration.test.ts` test `I7` executed live against remote Supabase (`npx vitest run ...depletion.integration.test.ts`) — **7/7 tests passed**, including I7 asserting exactly 1 aggregated row with `quantity_delta ≈ -4` (3+1) and 2 unaffected recipe rows for the same order_item. |
| 4 | Recipe-less product with a modifier still depletes (D-04) | ✓ VERIFIED | Integration test I6 passed live; asserts 1 `order_item_modifier` row and 0 `order_item` rows for a recipe-less product. |
| 5 | Existing recipe-only depletion (no modifiers selected) unchanged (SC-4) | ✓ VERIFIED | Integration tests I1–I4 passed live and unmodified; I7 additionally proves the modifier loop doesn't disturb the 2 recipe rows on a shared order_item. |
| 6 | Admin UI inside the modifier-management settings area lets managers configure per-modifier ingredient rules with N rows and a signed delta, persisting via the entity mutation (SC-3) | ✓ VERIFIED | `ModifierIngredientRulesDialog.tsx` inspected: `useReducer` row-list, `type="number" step="0.001"` delta input with no `min` (no MoneyInput clamp), wired via `CatalogModifiersTab.tsx`'s per-row `FlaskConical` button. `e2e/24-modifier-inventory-rules.spec.ts` executed live (`npx playwright test`, real dev server via Playwright's `webServer`) — **1 passed (40.9s)** — add positive + negative delta rows, save, reopen, confirms `-1` round-trips (not clamped to `0`), dirty/clean Save gating, row remove. |
| 7 | Rules list rendering order is deterministic (WR-01 fix) | ✓ VERIFIED | `modifier_inventory_rules.created_at timestamptz NOT NULL DEFAULT now()` column live in remote schema; both `useModifierInventoryRules` and the mutation's re-select in `queries.ts` use `.order('created_at')`. The e2e spec matches rows by ingredient identity rather than position, consistent with this fix. |
| 8 | 17-REVIEW.md exists and documents the original CR-01 finding | ✓ VERIFIED | `.planning/phases/17-modifier-inventory-rules/17-REVIEW.md` exists (reviewed 2026-07-07T20:40:36Z, `status: issues_found`, `findings.critical: 1`), with a full CR-01 write-up (root cause, the exact SQL collision, and the aggregation fix that was subsequently applied). |
| 9 | Phase code quality gates pass (typecheck/lint/unit) | ✓ VERIFIED | `npm run typecheck` — only the 2 pre-existing, documented, out-of-scope errors (`tab/model/queries.ts:778`, `agent/rag.ts:60`, both predate Phase 17). `npx eslint` on all Phase-17 touched files — 0 errors. `npx vitest run domain.test.ts depletion.test.ts` — 68/68 passed. |

**Score:** 9/9 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260706000002_modifier_inventory_rules_table.sql` | table + RLS | ✓ VERIFIED | Live; matches file. |
| `supabase/migrations/20260706000003_deplete_for_order_item_v3.sql` | v3 RPC (modifier loop added) | ✓ VERIFIED (superseded live by v4) | v3 authored correctly but its un-aggregated modifier loop is the CR-01 bug; live function body is now v4 (see next row). |
| `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` | v4 RPC — `GROUP BY ingredient_id` fix | ✓ VERIFIED LIVE | Confirmed via direct `pg_get_functiondef` query against remote DB — contains `GROUP BY ingredient_id`. ⚠️ See migration-history WARNING below — this file's version is not recorded in remote's applied-migrations ledger even though its effect is live. |
| `supabase/migrations/20260707000002_modifier_inventory_rules_created_at.sql` | `created_at` column | ✓ VERIFIED LIVE | Confirmed via `information_schema.columns` query — `created_at timestamptz NOT NULL DEFAULT now()` present. Same ledger caveat as above. |
| `src/entities/modifier-inventory-rule/model/queries.ts` | typed CRUD hooks | ✓ VERIFIED | `useModifierInventoryRules`, `useMutationSaveModifierInventoryRules`, `.order('created_at')` present on both selects. |
| `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` | admin dialog | ✓ VERIFIED | Row-list editor, signed delta input, no MoneyInput, UI-SPEC copy present. |
| `src/features/manage-products/ui/CatalogModifiersTab.tsx` | per-row "Ingredient rules" button | ✓ VERIFIED, WIRED | `FlaskConical` button + `rulesModifier` state + `<ModifierIngredientRulesDialog>` rendered. |
| `src/entities/tab/model/depletion.integration.test.ts` | I1–I7 | ✓ VERIFIED, WIRED, DATA FLOWING | 7/7 passed against live remote Supabase. |
| `e2e/24-modifier-inventory-rules.spec.ts` | automated UAT | ✓ VERIFIED, WIRED | 1 passed (40.9s) against a real dev server. |
| `.planning/phases/17-modifier-inventory-rules/17-REVIEW.md` | code review record | ✓ VERIFIED | Exists, documents CR-01 + 5 warnings + 2 info findings. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `deplete_for_order_item` (live) | `modifier_inventory_rules` | `SELECT ingredient_id, SUM(delta) FROM modifier_inventory_rules WHERE modifier_id = ANY(v_modifier_ids) GROUP BY ingredient_id` | ✓ WIRED | Confirmed live via `pg_get_functiondef`. |
| `deplete_for_order_item` modifier loop | `record_stock_movement` | `PERFORM record_stock_movement(..., 'order_item_modifier', ...)` (one call per aggregated ingredient) | ✓ WIRED | Confirmed live; I5/I6/I7 all pass. |
| `CatalogModifiersTab.tsx` | `ModifierIngredientRulesDialog.tsx` | `import { ModifierIngredientRulesDialog } from '@features/manage-modifier-inventory-rules'` | ✓ WIRED | Present; e2e spec drives this path end-to-end and passes. |
| `ModifierIngredientRulesDialog.tsx` | `entities/modifier-inventory-rule` | `useModifierInventoryRules(modifierId)` / `useMutationSaveModifierInventoryRules()` | ✓ WIRED | Present; e2e save/reopen round-trip confirms data flows through to the DB and back. |
| local migration files `20260707000001`/`20260707000002` | remote `supabase_migrations.schema_migrations` ledger | `npx supabase db push` | ⚠️ NOT RECORDED | `npx supabase migration list --linked` shows these two versions as **local-only** (no remote counterpart); remote instead has two unlabeled versions `20260707204352` / `20260707204745` with no corresponding local files. `npx supabase db push --dry-run` fails with "Remote migration versions not found in local migrations directory." The *effects* of both migrations are confirmed live (function body + column), so runtime behavior is correct, but the migration ledger is desynced. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ModifierIngredientRulesDialog` row list | `state.rows` (from `savedRules`) | `useModifierInventoryRules(modifierId)` → live `modifier_inventory_rules` table | Yes — e2e spec reopens the dialog and asserts the exact persisted `2` / `-1` values round-trip | ✓ FLOWING |
| `deplete_for_order_item` modifier loop | `v_mod_item` | live `modifier_inventory_rules` table, `GROUP BY ingredient_id` | Yes — I5/I6/I7 assert exact `quantity_delta` values computed from real rows | ✓ FLOWING |

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live RPC body contains CR-01 fix | `pg_get_functiondef('public.deplete_for_order_item(uuid,smallint,boolean)'::regprocedure)` via `npx supabase db query --linked` | Contains `GROUP BY ingredient_id`, `'order_item_modifier'`, kitchen-role guard | ✓ PASS |
| Integration suite (I1–I7) | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | 7 passed (1 test file) | ✓ PASS |
| Unit suite (schema + pure helper) | `npx vitest run src/shared/lib/domain.test.ts src/shared/lib/depletion.test.ts` | 68 passed | ✓ PASS |
| Admin UI e2e (add/save/reopen/round-trip) | `npx playwright test e2e/24-modifier-inventory-rules.spec.ts --reporter=line` | 1 passed (40.9s) | ✓ PASS |
| Typecheck | `npm run typecheck` | 2 pre-existing, documented, out-of-scope errors only | ✓ PASS (no new errors) |
| Lint | `npx eslint <phase-17 files>` | 0 errors (1 pre-existing config warning) | ✓ PASS |
| Migration ledger consistency | `npx supabase db push --dry-run` | FAILS: "Remote migration versions not found in local migrations directory" | ✗ FAIL (operational, not functional) |

### Requirements Coverage

Requirement IDs are `TBD (POS-COMPARISON.md §17 — source doc no longer present)`; the phase tracks scope via `.planning/PROJECT.md`'s checklist line and `17-CONTEXT.md`, and requirements via ROADMAP.md's 4 numbered Success Criteria (treated as the requirement contract per `17-CONTEXT.md`'s explicit note). `PROJECT.md` line 34 lists `- [ ] Modifier → inventory depletion rules — Phase 17` still unchecked in the master checklist (a PROJECT.md bookkeeping item, not a functional gap — recommend checking it off now that the phase, including the CR-01 fix, is verified).

| Requirement | Source | Description | Status | Evidence |
|---|---|---|---|---|
| SC-1 | ROADMAP.md §Phase 17 | `modifier_inventory_rules` table maps modifier options to ingredient deltas | ✓ SATISFIED | Table + RLS live, schema confirmed. |
| SC-2 | ROADMAP.md §Phase 17 | `deplete_for_order_item` RPC applies modifier-driven deltas atomically alongside base recipe depletion | ✓ SATISFIED | Live RPC (v4) confirmed with `GROUP BY` fix; I5/I6/I7 pass. |
| SC-3 | ROADMAP.md §Phase 17 | Admin UI lets managers configure per-modifier inventory rules | ✓ SATISFIED | Dialog wired into `CatalogModifiersTab.tsx` (the "Modifiers" tab of Settings → Products, alongside `ModifierGroupEditor.tsx`'s "Modifier Groups" tab); e2e passed live. Note: roadmap text says "inside `manage-modifier-groups`" but rules are correctly attached per-*modifier*, not per-*group* — placing the button in `CatalogModifiersTab` (the modifier CRUD surface) rather than `ModifierGroupEditor` (the group CRUD surface) is the semantically correct choice and both live in the same Settings → Products area. Not treated as a gap. |
| SC-4 | ROADMAP.md §Phase 17 | Existing recipe-only depletion (no modifiers selected) behavior unchanged | ✓ SATISFIED | I1–I4 unmodified and passing; I7 additionally proves no cross-contamination. |

No orphaned requirement IDs found beyond the 4 roadmap SCs.

### Anti-Patterns Found

None. `grep -rn "TBD|FIXME|XXX"` across all Phase-17-touched files (migrations, entity, feature, integration test, e2e spec) returns no matches. No stub returns, no empty handlers, no hardcoded-empty data flowing to render.

Unresolved code-review **Warnings** (from `17-REVIEW.md`, all classified `Warning`/`Info`, not `Blocker`, and not part of any plan's `must_haves` — left open by design, not silently dropped):

| File | Finding | Severity | Status |
|------|---------|----------|--------|
| `ModifierIngredientRulesDialog.tsx:114-126` | WR-02: incomplete rows (ingredient set, delta left at `0`) are silently filtered out on save with no warning | Warning | Unresolved |
| `entities/modifier-inventory-rule/model/queries.ts` | WR-03: `ModifierInventoryRuleCreateSchema` never `.parse()`d on the write path — `multipleOf(0.001)` unenforced client-side | Warning | Unresolved |
| `entities/modifier-inventory-rule/model/queries.ts:18` | WR-04: `const db = supabase as any` comment is stale — `supabase.types.ts` already has a typed `modifier_inventory_rules` entry | Warning | Unresolved |
| `features/manage-products/ui/CatalogModifiersTab.tsx:4` | WR-05: feature→feature import (`@features/manage-modifier-inventory-rules` from `features/manage-products`) — FSD boundary violation, mirrors an existing precedent (`CatalogProductsTab` → `@features/manage-recipe`) | Warning | Unresolved |
| `features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts:23` | IN-02: raw Postgres error text surfaced to end users on constraint violation | Info | Unresolved |

None of these block the phase goal (all are pre-existing-pattern-consistent or cosmetic); flagged for visibility only, consistent with their own `17-REVIEW.md` classification as non-blocking.

### Human Verification Required

None. The migration-ledger item originally listed here was resolved post-verification — see the note at the top of this report.

### Gaps Summary

No functional gaps. All 4 roadmap Success Criteria (SC-1–SC-4) are verified live against the remote Supabase project with passing automated integration and e2e tests, superseding the SUMMARY.md narratives (which predate the CR-01 fix and could not have known about it). The CR-01 blocker identified by the 2026-07-07T20:40:36Z code review is confirmed fixed and live, with a dedicated regression test (I7) that reproduces the exact original failure mode and passes.

The sole open item is operational, not functional: the remote Supabase migration ledger is out of sync with the two follow-up migration files added to fix CR-01/WR-01, which will block future `supabase db push` runs until repaired. This is escalated as a human-verification/decision item rather than a code gap, per the Escalation Gate pattern.

---

*Verified: 2026-07-07T20:58:36Z*
*Verifier: Claude (gsd-verifier)*
