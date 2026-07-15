---
phase: 35
slug: guardrails-tokens-doc-drift-lint
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 (unit) — no dedicated test framework for lint config itself; ESLint IS the validation surface for LINT-01 |
| **Config file** | `vitest.config.ts` (unchanged this phase) |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run typecheck && npm run lint && npm run test` |
| **Estimated runtime** | ~60-120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run typecheck && npm run lint && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-01/02 | 01 | 1 | DOCS-01 | — | N/A | manual diff / smoke | `npm run docs:tokens && git diff DESIGN-TOKENS.md` (empty after clean run) | ✓ | ⬜ pending |
| 35-03-01 | 03 | 3 | LINT-01 (rule fires) | T-35-SC | N/A | lint functional smoke | disposable fixture with 1 violation/category, `npx eslint <fixture> --no-ignore` exits non-zero, fixture deleted, not committed — runs before wiring rules into eslint.config.js | ✓ | ⬜ pending |
| 35-03-02 | 03 | 3 | LINT-01 (zero false positives) | — | N/A | lint regression | `npm run lint` | ✓ (35-02 fixes the one known pre-existing violation first) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] A disposable ESLint-rule fixture (created + asserted + deleted within one task, not committed) proving each of the 5 selectors actually fires — planned as 35-03 Task 1, ahead of eslint.config.js wiring
- [x] `scripts/generate-design-tokens.ts` — planned as 35-01

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification (lint exit code, doc-diff smoke check, disposable fixture smoke test).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-15 (gsd-plan-checker VERIFICATION PASSED, 0 blockers)
