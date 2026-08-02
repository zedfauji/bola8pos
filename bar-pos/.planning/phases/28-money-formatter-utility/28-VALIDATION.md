---
phase: 28
slug: money-formatter-utility
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.4` [VERIFIED: package.json] |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run src/shared/lib/format.test.ts` |
| **Full suite command** | `npm run test` (`vitest run --project unit --reporter=dot`) |
| **Estimated runtime** | ~10 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/shared/lib/format.test.ts` (and `npm run lint` once the ESLint rule task lands)
- **After every plan wave:** Run `npm run test` + `npm run lint` + `npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green (`npm run typecheck && npm run lint && npm run test`)
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-TBD | TBD | 0 | D-01 | — | `formatMoney` renders `MX$12.50` for es-MX, `$12.50` for en-US, same amount | unit | `npx vitest run src/shared/lib/format.test.ts -t "locale symbol"` | ❌ Wave 0 | ⬜ pending |
| 28-01-TBD | TBD | 0 | D-01 | — | Digit grouping uses `Intl.NumberFormat(locale)` (not hardcoded), verified for a 4+ digit amount (e.g. 1234.5) | unit | same file | ❌ Wave 0 | ⬜ pending |
| 28-01-TBD | TBD | 0 | D-04 | — | `parseMoneyInput` returns `null` for `'12.5.3'`, `'abc'`, `''` | unit | same file | ❌ Wave 0 | ⬜ pending |
| 28-01-TBD | TBD | 0 | D-06 | — | `formatMoney(amount, {showSign: true})` prefixes `+` for positive amounts; negative amounts unaffected by `showSign` (still `-`) | unit | same file | ❌ Wave 0 | ⬜ pending |
| 28-01-TBD | TBD | 0 | D-08 | T-28-01 / V5 | `no-raw-money-format` selectors flag `.toFixed(2)`, `` `$${...}` `` template literals, and JSX raw-`$`-adjacent patterns | lint | `npm run lint -- eslint-rules/` (no fixture-based lint-rule test harness exists in this repo — `no-ui-drift.js` has none either; manual verification is the established precedent) | ❌ Wave 0 (no harness) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are placeholders — the planner assigns final plan/task IDs; this map's rows are the requirement→test contract those tasks must satisfy.*

---

## Wave 0 Requirements

- [ ] `src/shared/lib/format.test.ts` — new file, covers D-01, D-04, D-06 (no existing test file to extend)
- [ ] No shared fixture/conftest needed — reuse the existing `i18n.changeLanguage()` pattern from `src/shared/lib/i18n/index.test.ts` directly in the new test file
- [ ] Framework install: none — Vitest already configured and running in this repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `no-raw-money-format` ESLint rule correctly flags/passes real call sites | D-08 | No fixture-based lint-rule test harness exists in this repo (same gap as the pre-existing `no-ui-drift.js` rule) | Run `npm run lint` after the rule lands and after each migrated call site; confirm no false positives/negatives against the 3 known files (`MoneyDisplay.tsx`, `receipt-format.ts`, `ResourceIllustration.tsx`) plus the newly-found `pdf.tsx:44` site |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
