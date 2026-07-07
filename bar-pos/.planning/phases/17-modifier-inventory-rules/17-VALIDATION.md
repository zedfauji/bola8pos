---
phase: 17
slug: modifier-inventory-rules
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-06
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 (unit + integration, `--project unit`) + Playwright v1.59 (E2E, optional this phase) |
| **Config file** | `bar-pos/vitest.config.ts` |
| **Quick run command** | `npx vitest run src/shared/lib/depletion.test.ts` |
| **Full suite command** | `npm run test` (unit) — `src/entities/tab/model/depletion.integration.test.ts` requires live Supabase creds (`SUPABASE_SERVICE_ROLE_KEY`) and is `describe.skipIf(skip)` |
| **Estimated runtime** | ~30s unit, ~60s integration (when creds present) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/shared/lib/depletion.test.ts`
- **After every plan wave:** Run `npm run test` + `npx vitest run src/entities/tab/model/depletion.integration.test.ts`
- **Before `/gsd-verify-work`:** Full suite green + `npm run typecheck` + `npm run lint`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | SC-1 | V5 | Zod rejects malformed rule (bad FK shape, non-numeric delta) | unit | `npx vitest run src/shared/lib/domain.test.ts` | ❌ Wave 0 |
| 17-01-02 | 01 | 0 | SC-2 | V4 | `computeModifierDepletion` scales delta by quantity, sign inverts on refund | unit + property | `npx vitest run src/shared/lib/depletion.test.ts` | ❌ Wave 0 |
| 17-02-01 | 02 | 1 | SC-2 | V4 | `deplete_for_order_item` writes modifier deltas via `ref_type='order_item_modifier'`, no collision with recipe rows | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | ✅ EXISTS — extend |
| 17-02-02 | 02 | 1 | SC-4 | — | Regression: recipe-only order (no modifiers) still writes exactly 2 rows, `ref_type='order_item'` | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | ✅ EXISTS — I1–I4 must still pass unmodified |
| 17-03-01 | 03 | 2 | SC-4 | V4 | RLS on `modifier_inventory_rules`: read all authenticated, write manager/admin only | manual (SQL check) | `supabase db` role-switch query per RLS pattern in `recipe_items` | ✅ pattern exists |
| 17-04-01 | 04 | 3 | SC-1/SC-2 | — | `entities/modifier-inventory-rule/` slice + integration cases I5/I6 (modifier-driven depletion, mixed recipe+modifier) | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | ✅ EXISTS — extend |
| 17-05-03 | 05 | 4 | SC-3 | — | Admin UI in `CatalogModifiersTab.tsx` lets manager add/remove N ingredient-rule rows per modifier | manual (UAT) | N/A — no `.test.tsx` precedent for this admin surface | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/lib/domain.test.ts` — add `ModifierInventoryRuleSchema`/`ModifierInventoryRuleCreateSchema` parse tests (valid/invalid delta, missing FK fields)
- [ ] `src/shared/lib/depletion.test.ts` — add `computeModifierDepletion` describe block mirroring existing `computeDepletion` property test (linear scaling, sign inversion sale↔refund, empty-rules → empty map)

*Existing integration test scaffolding (`beforeAll`/`afterAll` in `depletion.integration.test.ts`) is reused, not rebuilt.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin UI ingredient-rule rows in `CatalogModifiersTab.tsx` (add/remove/save per modifier) | SC-3 | No `.test.tsx` precedent for this admin surface (`ModifierGroupEditor.tsx`/`CatalogModifiersTab.tsx` currently untested — consistent existing project pattern) | Log in as manager, open Settings → Products → Modifiers, add an ingredient rule with positive and negative delta to a modifier, save, reload, confirm persisted |
| RLS enforcement on `modifier_inventory_rules` writes | SC-3, SC-4 | RLS policy behavior is best confirmed against live Supabase role context, not mockable in unit tests | Attempt insert as bartender role (should fail), then as manager (should succeed) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-06 (gsd-plan-checker sign-off, 0 blockers)
