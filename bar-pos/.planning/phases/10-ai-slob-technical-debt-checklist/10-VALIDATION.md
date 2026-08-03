---
phase: 10
slug: ai-slob-technical-debt-checklist
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 (unit), Playwright v1.59 (E2E) — both pre-existing, unchanged by this phase |
| **Config file** | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e` |
| **Estimated runtime** | ~seconds (unit) / several minutes (E2E, requires display + Chrome) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` (adding devDependencies + config files must not break typecheck)
- **After every plan wave:** Run the full 7-check audit script once (lint/typecheck/test/e2e + knip/jscpd/madge), before writing CHECKLIST.md
- **Before `/gsd-verify-work`:** Full suite must be green; CHECKLIST.md's stated finding counts must reconcile against the raw tool JSON reports
- **Max feedback latency:** N/A — this is a one-off audit/documentation phase, not an iterative feature-behavior loop

---

## Per-Task Verification Map

This phase has no `REQUIREMENTS.md` entries (`phase_req_ids` is null — `.planning/REQUIREMENTS.md` does not exist in this project). There is no feature behavior to unit-test; the phase's "correctness" is that `CHECKLIST.md` accurately reflects the 7 tools' actual output.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | N/A (no REQUIREMENTS.md) | — | N/A | smoke | `npm run lint && npm run typecheck && npm run test` re-run after adding knip/jscpd/madge devDependencies + config files — baseline must stay green | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | N/A (no REQUIREMENTS.md) | — | N/A | smoke (manual reconciliation, one-time) | Per-tool JSON finding count (e.g. `jq '.results | length' <tool-report>.json`) diffed against CHECKLIST.md's stated severity-table counts | N/A — one-off audit-completion check | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None: existing test infrastructure (Vitest + Playwright) fully covers this phase's minimal test-adjacent needs (baseline-preservation smoke checks only). No new test files are needed since this phase produces no new application code — only devDependencies, tool config files, and CHECKLIST.md.*

---

## Manual-Only Verifications

*None: all phase behaviors have automated verification (baseline-preservation smoke checks + finding-count reconciliation, both scriptable).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — none)
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (one-off audit checks, not an iterative loop)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
