---
phase: 29
slug: ui-drift-audit
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — `scripts/` has no Vitest coverage (established pattern: `indexCodebase.ts`, `seed-*.ts` are also untested) |
| **Config file** | none — no test file expected for this script |
| **Quick run command** | `npx tsx scripts/audit-ui-drift.ts` |
| **Full suite command** | `npm run typecheck` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx scripts/audit-ui-drift.ts`, confirm printed counts match the verified baseline (20 button / 8 input / 3 hex / 0 spacing / 17 routes / 14 CLAUDE.md rows)
- **After every plan wave:** Run `npm run typecheck` (confirms `scripts/audit-ui-drift.ts` compiles under strict TS)
- **Before `/gsd-verify-work`:** `DRIFT-AUDIT.md` exists, committed, counts match baseline (or documented delta if repo changed)
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | AUDIT-01 | — / N/A | Script identifies raw button/input/hex-rgb/arbitrary-spacing violations, file-attributed, matching verified baseline (20/8/3/0) | manual | `npx tsx scripts/audit-ui-drift.ts` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | AUDIT-01 | — / N/A | Route-count cross-check computes both counts (not hardcoded), prints diff (17 vs 14, 3 missing routes) | manual | `npx tsx scripts/audit-ui-drift.ts` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | AUDIT-02 | — / N/A | `DRIFT-AUDIT.md` is a Markdown checklist grouped by file, committed at `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` | manual | read file, confirm format | ❌ W0 | ⬜ pending |
| 29-01-04 | 01 | 1 | AUDIT-01, AUDIT-02 | — / N/A | Script compiles under strict TS (`scripts/` included in tsconfig) | automated | `npm run typecheck` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework or fixtures needed — this phase's "test" is the script's own printed output compared against the verified baseline table in RESEARCH.md, plus `npm run typecheck` as the only automated gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Violation counts match verified baseline | AUDIT-01 | Read-only, one-shot audit script producing a static artifact for human/planner consumption, not a runtime code path with regression risk — a snapshot test would just re-encode the same baseline table already in RESEARCH.md | Run `npx tsx scripts/audit-ui-drift.ts`, diff printed summary against 20 button / 8 input / 3 hex / 0 spacing / 17 routes / 14 CLAUDE.md rows |
| `DRIFT-AUDIT.md` format/content | AUDIT-02 | Markdown checklist quality (grouped by file, usable as backlog) is a human judgment call, not a scriptable assertion | Open `DRIFT-AUDIT.md`, confirm one entry per file per violation category, grouped and readable |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (typecheck automated; violation-count checks manual-only per justification above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (task 4 is automated, interleaved)
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
