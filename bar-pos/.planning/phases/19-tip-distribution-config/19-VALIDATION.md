---
phase: 19
slug: tip-distribution-config
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-08
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit) + Playwright 1.59 (E2E) |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` |
| **Quick run command** | `npx vitest run src/path/to.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60s (unit), ~5min (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled in by the planner per-task as PLAN.md files are authored.*

---

## Wave 0 Requirements

- `supabase/migrations/*_tip_distribution_entries_table.sql` — new table + RLS (append-only, no update/delete policy)
- `close_caja_session` RPC replacement — bundles the missed `version` bump fix (see 19-RESEARCH.md pitfall) alongside tip computation
- `settings` table `key='tip_distribution'` row — no new table needed, reuses existing generic config pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Settings panel 3-way split adjustment (admin) | SC-3 | Visual/interactive percentage inputs, real-time sum validation | Log in as admin, open Settings -> Tip Distribution tab, adjust floor/bar/kitchen %, verify sum-to-100 validation and save |
| Close-caja report shows computed distribution | SC-4 | Requires live caja session with payments/tips, then close and inspect report | Open caja, run a tab with tip, close caja, verify report shows tip_distribution_entries breakdown matching configured %s |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08 (via /gsd-plan-phase plan-checker pass)
