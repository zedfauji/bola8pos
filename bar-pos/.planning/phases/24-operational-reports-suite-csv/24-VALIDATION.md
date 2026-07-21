---
phase: 24
slug: operational-reports-suite-csv
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit) / Playwright 1.59 (E2E) |
| **Config file** | vitest.config.ts / playwright.config.ts |
| **Quick run command** | `npx vitest run src/path/to.test.ts` |
| **Full suite command** | `npm run test` (unit) / `npm run test:e2e` (E2E) |
| **Estimated runtime** | ~90 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <affected test file(s)>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Filled in by the planner when PLAN.md task IDs exist.*

---

## Wave 0 Requirements

*To be determined by the planner based on RESEARCH.md findings (RPC migrations, Recharts integration, generic CSV serializer, `order_item.remove` audit action).*

---

## Manual-Only Verifications

*To be determined by the planner.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
