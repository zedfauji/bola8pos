---
phase: 3
slug: ingredient-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 3 — Validation Strategy

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 |
| **Config file** | `bar-pos/vitest.config.ts` |
| **Quick run command** | `cd bar-pos && npm run typecheck && npm run lint && npm run test` |
| **Full suite command** | `cd bar-pos && npm run test && npm run test:e2e` |
| **Estimated runtime** | ~30 seconds (unit); ~3 min (full + E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **After every plan wave:** Run full suite above + `npm run test:e2e` (manual gate)
- **Before `/gsd-verify-work`:** All unit + property tests green; E2E `33-ingredients.spec.ts` passing
- **Max feedback latency:** 30 seconds (unit run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | S3a-01 | — | N/A | manual DB | `supabase db push` then inspect schema | ❌ Wave 0 (SQL migration) | ⬜ pending |
| 03-01-02 | 01 | 1 | S3a-02 | — | Idempotency index prevents duplicate depletion | integration | `npx vitest run src/entities/ingredient/model/rpc.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-01-03 | 01 | 1 | S3a-03 | — | RPC atomic; INVENTORY_NEGATIVE on negative balance | integration | `npx vitest run src/entities/ingredient/model/rpc.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-02-01 | 02 | 1 | S3a-04 | — | Zod schemas parse valid rows; reject invalid | unit | `npx vitest run src/shared/lib/domain.test.ts` | ✅ (extend existing) | ⬜ pending |
| 03-02-02 | 02 | 1 | S3a-05 | — | UOM round-trip identity (P5 property test) | property | `npx vitest run src/shared/lib/uom.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-02-03 | 02 | 1 | S3a-05 | — | UOM toBase/fromBase unit tests | unit | `npx vitest run src/shared/lib/uom.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-03-01 | 03 | 2 | S3a-06 | — | Entity query hooks return mapped types | unit RTL | `npx vitest run src/entities/ingredient/model/queries.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-04-01 | 04 | 2 | S3a-07 | — | Ingredient CRUD in Settings UI | E2E | `npx playwright test e2e/33-ingredients.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 03-04-02 | 04 | 2 | S3a-08 | — | CSV import: valid rows inserted; invalid rows reported | integration | `npx vitest run src/features/import-ingredients-csv/*.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-05-01 | 05 | 3 | P4 | — | Ledger invariant: sum(deltas) = quantity_on_hand | property | `npx vitest run src/shared/lib/ledger.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/lib/uom.ts` — UOM conversion utility (new file, must create with tests)
- [ ] `src/shared/lib/uom.test.ts` — P5 round-trip property test + unit tests
- [ ] `src/shared/lib/ledger.test.ts` — P4 ledger invariant property test
- [ ] `src/entities/ingredient/model/queries.test.ts` — query hook unit tests
- [ ] `src/entities/ingredient/model/rpc.test.ts` — idempotency + atomic RPC integration tests
- [ ] `src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx` — CSV validation unit test
- [ ] `e2e/33-ingredients.spec.ts` — full E2E spec (stub created in Wave 0, filled in final wave)

*Wave 0 test stubs must be created before or alongside the first plan that implements the corresponding feature.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `ingredients` table columns, CHECKs, indexes are correct in remote DB | S3a-01 | SQL schema; no automated DB inspection tool in CI | Run `supabase db push`, then inspect via Supabase Studio or `\d ingredients` in psql |
| Low-stock row highlight appears in IngredientsTable | S3a-07 | Visual regression; no visual test configured | Set `quantity_on_hand <= reorder_point` for a test ingredient; confirm `bg-pos-danger/10` row class in browser DevTools |
| CSV import sheet opens, parses file, shows preview, inserts rows | S3a-08 | File picker interaction requires browser automation with file upload | Open Settings → Ingredients → Import CSV; upload valid CSV; verify preview + confirm |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
