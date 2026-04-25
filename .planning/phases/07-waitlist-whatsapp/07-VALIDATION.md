---
phase: 7
slug: waitlist-whatsapp
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 + fast-check v4 + Playwright v1.59 |
| **Config file** | `bar-pos/vitest.config.ts` |
| **Quick run command** | `cd bar-pos && npx vitest run src/shared/lib/phone.test.ts src/shared/lib/waitlist-math.test.ts` |
| **Full suite command** | `cd bar-pos && npm run test` |
| **Estimated runtime** | ~15 seconds (unit) / ~3 min (full E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd bar-pos && npm run typecheck && npm run test`
- **After every plan wave:** Run `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (unit suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | S5-01 | T-7-01 / — | waitlist_entries migration applied | manual | `supabase db push` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 2 | S5-06 | — | Phone E.164 validation rejects bad input | unit | `npx vitest run src/shared/lib/phone.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 2 | S5-07 | — | WaitlistEntrySchema round-trip | unit | `npx vitest run src/shared/lib/domain.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-03 | 02 | 2 | S5-17 | — | quotedWait invariants (partiesAhead=0 → min 5min) | unit | `npx vitest run src/shared/lib/waitlist-math.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 3 | S5-08 | — | useWaitlistEntries returns sorted FIFO list | unit | `npx vitest run src/entities/waitlist/` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 4 | S5-05 | T-7-02 | API key not logged, Vault read success | contract | `npx vitest run src/features/notify-waitlist/` | ❌ W0 | ⬜ pending |
| 7-05-01 | 05 | 5 | S5-09 | — | add-waitlist-entry mutation creates DB row | integration | `npx vitest run src/features/add-waitlist-entry/` | ❌ W0 | ⬜ pending |
| 7-05-02 | 05 | 5 | S5-21 | — | Full E2E waitlist flow | e2e | `cd bar-pos && npx playwright test e2e/24-waitlist.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bar-pos/src/shared/lib/phone.test.ts` — stubs for S5-06 (phone validation: valid MX, US, bad input)
- [ ] `bar-pos/src/shared/lib/waitlist-math.test.ts` — stubs for S5-17 (quotedWait formula: 0-ahead, N-ahead, no-tables edge case)
- [ ] `bar-pos/src/entities/waitlist/model/queries.test.ts` — stubs for S5-08 entity queries
- [ ] `bar-pos/e2e/24-waitlist.spec.ts` — E2E spec skeleton with `test.todo()` for all 9 scenarios

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WasenderAPI key stored in Supabase secrets | S5-04 | Requires live Supabase project access | Run `supabase secrets set WASENDER_API_KEY=...` and verify via `supabase secrets list` |
| Tauri native notification fires | S5-19 | Requires desktop Tauri dev build | `npm run tauri dev`, trigger table-free event, verify OS notification appears |
| Realtime dual-subscription (two browser tabs) | S5-08/S5-18 | Browser Realtime is not testable in Vitest | Open `/waitlist` in two tabs; update pool_table status in one; verify other tab reacts |
| pg_net trigger calls edge function | S5-03 | Requires Supabase network access + live edge function | Update entry status to 'notified'; verify waitlist_notifications row appears with channel='whatsapp' or 'manager' |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
