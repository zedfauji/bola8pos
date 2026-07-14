---
phase: 14
slug: audit-logs-table
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.4 (unit) + Playwright v1.59.1 (E2E) |
| **Config file** | `vitest.config.ts` (unit), `playwright.config.ts` (E2E) — both pre-existing, no changes needed |
| **Quick run command** | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` |
| **Full suite command** | `npm run test` (unit) / `npm run test:e2e -- e2e/38-audit-logs.spec.ts` (E2E, requires `.env.local` E2E creds) |
| **Estimated runtime** | ~30s unit quick / several minutes for full E2E |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed-test-file>` + `npm run typecheck`
- **After every plan wave:** `npm run test` (full unit suite, ~1147+ tests) + `npm run lint`
- **Before `/gsd-verify-work`:** `npm run test:e2e -- e2e/38-audit-logs.spec.ts` green (requires live Supabase + `.env.local` E2E creds)
- **Max feedback latency:** 30s (unit quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-0X-01 | TBD | 0 | SC1 (migration push) | — | Live Supabase has `audit_logs` table + `record_audit()` | manual/integration | live Supabase smoke check (`SELECT record_audit(...)`) | ❌ W0 gap |
| 14-0X-02 | TBD | 0 | SC2 (append-only RLS) | V4 | UPDATE/DELETE on `audit_logs` denied for authenticated non-service-role user | integration | new test | ❌ W0 gap |
| 14-0X-03 | TBD | 1 | SC3 (RPC coverage) | — | Every target RPC's migration contains `PERFORM record_audit` | CI grep (extend existing) | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` | ⚠️ partial — extend |
| 14-0X-04 | TBD | 1 | SC4 (edge fn coverage) | — | Sensitive Edge Functions import+call `recordAudit(` | new test | new grep test over `supabase/functions/*/index.ts` | ❌ W0 gap |
| 14-0X-05 | TBD | 1 | SC5 (action enum) | — | Existing enum/CI test | unit (existing) | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` | ✅ exists |
| 14-0X-06 | TBD | 2 | SC6 (/audit page) | V4 | Filters + infinite scroll + diff viewer render | E2E (existing, will fail until page built) | `npx playwright test e2e/38-audit-logs.spec.ts` | ⚠️ exists, currently red |
| 14-0X-07 | TBD | 2 | SC7 (entity/widget/page/route) | V4 | `AuditRoute` gates non-manager+, `AuditLogTable` renders rows | unit (RTL, new) | new component tests | ❌ W0 gap |
| 14-0X-08 | TBD | 2 | SC8 (E2E full coverage incl. order.void) | — | order.void test restored per D-07 | E2E (existing, needs update) | `npx playwright test e2e/38-audit-logs.spec.ts` | ⚠️ needs D-07 update |
| 14-0X-09 | TBD | 1 | SC9 (AUDIT_WRITE_FAILED + truncation) | V5 | Truncation banner renders on `_truncated: true` | unit (existing enum) + new (banner) | grep `result.ts:199` (manual) + new component test | ✅ enum / ⚠️ banner test gap |
| 14-0X-10 | TBD | 1 | Security: PostgREST filter injection | V5 | `filters.search` escaped before `.or()` interpolation | unit (new) | new test on `useAuditLogs` search filter | ❌ W0 gap — real bug found in research |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — Plan/Wave/Task IDs to be finalized by planner; this table is a requirement→test map, not final plan numbering.*

---

## Wave 0 Requirements

- [ ] Extend `src/shared/lib/__tests__/audit-actions.test.ts` (or add new test) to assert `PERFORM record_audit` appears at least once per target RPC's migration file — not just that used action labels are valid
- [ ] New integration test: RLS denial on `UPDATE`/`DELETE` against `audit_logs` as an authenticated (non-service-role) user
- [ ] New unit test(s) for `AuditLogTable`, `AuditRoute`, and the `_truncated` extraction logic feeding `JsonDiffViewer`
- [ ] New test asserting a defined allowlist of "sensitive" Edge Functions all import and call `recordAudit`
- [ ] New unit test for `useAuditLogs` free-text search filter escaping (security gap found in research — real, not hypothetical)
- [ ] `e2e/38-audit-logs.spec.ts` header + Test 2 updated per D-07 once `order.void` is wired (remove documented substitution)
- [ ] **[BLOCKING]** Verify live Supabase migration push status for `20260511000001_audit_logs_table.sql` and `20260511000002_rpc_audit_wiring.sql` before any new RPC wiring work begins
- [ ] **[BLOCKING]** Verify whether the `void-order` Edge Function exists live on Supabase despite being absent from git/repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Live migration push confirmation | SC1 | No automated way to query remote Supabase migration history from this repo | Run `supabase migration list` against remote project, or query `SELECT to_regclass('public.audit_logs')` via a connected client |
| `void-order` Edge Function live existence | Open Question (BLOCKING) | Not in git/repo; may exist only as a deployed artifact | `supabase functions list` against remote project, or check Supabase dashboard |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** confirmed by gsd-plan-checker (14 plans, PASS with 2 non-blocking warnings) — 2026-07-03
