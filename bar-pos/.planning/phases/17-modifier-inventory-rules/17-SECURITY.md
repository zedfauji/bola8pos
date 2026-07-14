---
phase: 17
slug: modifier-inventory-rules
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-07
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| PostgREST client → `modifier_inventory_rules` | Any authenticated client can attempt writes to the new table via the auto-generated REST API. | modifier→ingredient signed-delta rows |
| Order-mutation RPC → `record_stock_movement` | `deplete_for_order_item` (SECURITY DEFINER) writes to the append-only stock ledger and mutates `ingredients.quantity_on_hand`. | stock movement deltas, override audit entries |
| Migration apply → remote Postgres | DDL + SECURITY DEFINER function replacement applied to the live production database. | schema + function body |
| React client → `modifier_inventory_rules` (PostgREST) | Entity hooks issue authenticated REST reads/writes to the new table; RLS governs writes. | rule rows (read + delete-all-then-insert write) |
| Manager (browser) → dialog → entity mutation → PostgREST | Admin input crosses into a manager-gated write path; additionally governed by table RLS. | user-entered ingredient/delta rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering (V5) | `ModifierInventoryRuleSchema` | mitigate | `src/shared/lib/domain.ts:1673-1680` — `z.number().multipleOf(0.001).refine(v => v !== 0, ...)`, UUID FK fields | closed |
| T-17-02 | Tampering | `computeModifierDepletion` | accept | Pure function, no privilege/persistence, not called from production code paths | closed |
| T-17-SC (x5) | Tampering | package installs | accept | Zero `package.json`/`package-lock.json` diffs across all 10 Phase-17 commits (`0a64013`, `829c869`, `31f03a1`, `52c98e8`, `ad9098a`, `ed03b83`, `b3279c7`, `64a19d1`, `37b0ae5`, `e01d091`) | closed |
| T-17-03 | Elevation of Privilege (V4) | `modifier_inventory_rules` writes | mitigate | `supabase/migrations/20260706000002_modifier_inventory_rules_table.sql:38-41` — `modifier_inventory_rules_write_manager` RLS policy (`WITH CHECK (get_user_role() IN ('manager','admin'))`); confirmed live via `pg_policies` query in 17-VALIDATION.md | closed |
| T-17-04 | Tampering (V5) | `modifier_inventory_rules.delta` | mitigate | `...20260706000002...sql:21-27` — `CHECK (delta <> 0)` + `NOT NULL REFERENCES` FKs on `modifier_id`/`ingredient_id` | closed |
| T-17-05 | Tampering | fabricated `order_items.modifier_ids` | accept | `modifier_id = ANY(v_modifier_ids)` (both v3 and live v4 RPC) matches zero rows on a foreign/nonexistent modifier — verified no-op; field was pre-existing client-writable | closed |
| T-17-06 | Repudiation | manager negative-stock override | mitigate | `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql:160-171` (modifier loop) + `:102-114` (recipe loop) — identical `audit_log 'stock_override'` insert in SECURITY DEFINER context, present in both loops | closed |
| T-17-07 | Elevation of Privilege | kitchen role calling `deplete_for_order_item` | mitigate | Kitchen guard (`get_user_role() = 'kitchen'` RAISE) preserved verbatim in both v3 and the live v4 body (`...20260707000001...sql:46-49`); confirmed live via `pg_get_functiondef` in 17-VALIDATION.md | closed |
| T-17-08 | Tampering / DoS | `deplete_for_order_item` `CREATE OR REPLACE` on live DB | mitigate | 17-03 blocking checkpoint verified v3 live at push time; the live function was subsequently superseded by v4 (CR-01 fix) and independently re-verified live via `pg_get_functiondef` in 17-VALIDATION.md — still contains `order_item_modifier` + kitchen guard | closed |
| T-17-09 | Elevation of Privilege (V4) | new table RLS live | mitigate | 17-VALIDATION.md confirms both `modifier_inventory_rules_select_authenticated` and `modifier_inventory_rules_write_manager` present via live `pg_policies` query | closed |
| T-17-10 | Tampering (V5) | `useModifierInventoryRules` row mapping | mitigate | `src/entities/modifier-inventory-rule/model/queries.ts:33-40` — `mapModifierInventoryRuleRow` calls `ModifierInventoryRuleSchema.parse`; used on both the read query (line 63) and the mutation's re-select (line 132) | closed |
| T-17-11 | Information Disclosure | `db = supabase as any` cast | mitigate | `queries.ts` — every Supabase error path logs via `logger.error` (lines 60, 97, 112, 126) and returns `err({code:'SUPABASE_ERROR',...})` (lines 100, 115, 129); cast bypasses typing only, not error handling | closed |
| T-17-12 | Elevation of Privilege (V4) | save mutation replace strategy under bartender session | accept | Delete-all-then-insert governed server-side by `modifier_inventory_rules_write_manager` RLS (confirmed live) regardless of client role | closed |
| T-17-13 | Tampering (V5) | signed delta input in UI | mitigate | Fixed 2026-07-07 (secure-phase remediation): `useMutationSaveModifierInventoryRules` (`src/entities/modifier-inventory-rule/model/queries.ts`) now runs every rule through `ModifierInventoryRuleCreateSchema.safeParse()` before mapping to insert rows, returning `err({code:'VALIDATION_ERROR',...})` on the first failure — closing the gap flagged by WR-03/`17-REVIEW.md`. All 3 declared layers now present: client filter, schema re-parse, DB `CHECK (delta <> 0)`. `npm run typecheck`/`lint` clean on the changed file; `npm run test` shows no new regressions (1 pre-existing unrelated failure in `useCloseTab.test.ts`, confirmed present on `main` before this change). | closed |
| T-17-14 | Elevation of Privilege (V4) | UI reachable outside manager scope | mitigate | `src/widgets/SettingsTabsPanel/tabs/ProductsSettingsTab.tsx:14` — `<ProtectedAction action="manage_products" currentRole={currentRole}>` wraps the entire tab set including `CatalogModifiersTab`; RLS independently confirmed (T-17-03/T-17-09) | closed |
| T-17-15 | Denial of Service | stale dialog state across modifiers | accept | `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx:247-253` — `key={modifierId}` remount, form rendered only when `open && modifierId != null` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02 | T-17-02 | `computeModifierDepletion` is a pure function with no I/O, no privilege context, and no persistence; a defect surfaces only as a failing property test, never as a live data-integrity issue since it is not called from any production code path today. | Plan 17-01 threat model | 2026-07-06 |
| AR-SC | T-17-SC (x5) | Zero npm/pip/cargo package installs across all 5 plans of this phase — no supply-chain surface introduced. Verified by absence of `package.json`/`package-lock.json` diffs in every Phase-17 commit. | Plans 17-01..17-05 threat models | 2026-07-06/07 |
| AR-05 | T-17-05 | `order_items.modifier_ids` was already a client-writable field pre-Phase-17. A fabricated/foreign modifier id simply matches zero `modifier_inventory_rules` rows in the RPC's `WHERE modifier_id = ANY(...)` clause — a verified no-op, not a new attack surface. | Plan 17-02 threat model | 2026-07-06 |
| AR-12 | T-17-12 | The delete-all-then-insert save mutation is a client-side convenience; actual authorization is enforced server-side by the `modifier_inventory_rules_write_manager` RLS policy (confirmed live), independent of what a bartender-session client attempts to send. | Plan 17-04 threat model | 2026-07-07 |
| AR-15 | T-17-15 | Worst case of stale dialog state is a client-only UI re-render glitch (wrong modifier's rows briefly visible before remount); no persistence or cross-tenant impact, since the save mutation always sends the `modifierId` captured at save time and RLS/DB constraints gate the actual write. | Plan 17-05 threat model | 2026-07-07 |

*T-17-13 is not an accepted risk — remediated in code, see Threat Register.*

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

No `## Threat Flags` section was found in any of the 5 SUMMARY.md files for this phase (verified via grep across the phase directory).

The following new-attack-surface item surfaced via code review (`17-REVIEW.md`, not the SUMMARY.md `## Threat Flags` mechanism) after the plan-time threat register was authored — logged here for traceability, not a blocker since it is already remediated and re-verified live:

| Flag | Category | Description | Status |
|------|----------|--------------|--------|
| CR-01 (code review) | Tampering / availability | v3's un-aggregated modifier loop: two different modifiers on one order_item targeting the same ingredient raised an unhandled `unique_violation` that aborted the *entire* `deplete_for_order_item` call, including the already-succeeded recipe loop — no inventory recorded for that line despite a completed sale. No corresponding threat ID existed in any plan's `<threat_model>` block. | REMEDIATED — fixed via `20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` (`GROUP BY ingredient_id`/`SUM(delta)`), covered by new integration test I7, confirmed live via `pg_get_functiondef` in 17-VALIDATION.md. |

Other code-review findings (WR-01 fixed via `created_at` ordering; WR-02 silent-drop-incomplete-row UX gap, WR-04 stale `as any` comment, WR-05 FSD feature→feature import, IN-02 raw Postgres error surfaced to manager-role users) do not map to STRIDE categories against an external/untrusted actor and are not treated as security threats in this register — they remain open as non-blocking code-quality items per `17-VALIDATION.md`.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-07 | 16 | 15 | 1 | gsd-security-auditor |
| 2026-07-07 | 16 | 16 | 0 | secure-phase remediation (T-17-13 fix) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** phase 17 threat-secure. T-17-13 remediated 2026-07-07 by adding `ModifierInventoryRuleCreateSchema.safeParse()` to the write path in `useMutationSaveModifierInventoryRules` (`src/entities/modifier-inventory-rule/model/queries.ts`).
