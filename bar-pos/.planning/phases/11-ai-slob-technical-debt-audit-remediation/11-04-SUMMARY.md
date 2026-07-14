---
phase: 11
plan: "04"
subsystem: security-documentation
tags: [security, cve, xlsx, risk-acceptance, documentation]
dependency_graph:
  requires: [11-03]
  provides: [TECH-DEBT-CVE-DOC]
  affects: [bar-pos/src/shared/lib/exporters/excel.ts]
tech_stack:
  added: []
  patterns: [risk-acceptance-decision-record, inline-security-comment]
key_files:
  created:
    - .planning/decisions/xlsx-cve-risk-accept.md
  modified:
    - bar-pos/src/shared/lib/exporters/excel.ts
decisions:
  - "Accept xlsx CVE risk (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9): outbound-only export path; no XLSX.read() on untrusted input; residual supply-chain vector mitigated by lockfile + CI audit gate"
metrics:
  duration: 8min
  completed: "2026-04-27"
  tasks: 2
  files: 2
---

# Phase 11 Plan 04: xlsx CVE Risk Documentation Summary

**One-liner:** Inline SECURITY comment + decision record converting undocumented xlsx CVEs into acknowledged, scoped risk with explicit accept rationale.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add SECURITY comment to excel.ts | 6e65b69 | bar-pos/src/shared/lib/exporters/excel.ts |
| 2 | Create risk-acceptance decision record | 7f78957 | .planning/decisions/xlsx-cve-risk-accept.md |

## What Was Built

### Task 1 — SECURITY comment in excel.ts

Inserted a 4-line `// SECURITY:` comment block at the very top of `bar-pos/src/shared/lib/exporters/excel.ts` (before all imports), citing both CVE IDs and cross-referencing the decision record. This makes the known risk visible to every code reviewer who opens the file.

### Task 2 — Risk-acceptance decision record

Created `.planning/decisions/xlsx-cve-risk-accept.md` with all required sections:
- **Context** — both advisories described (Prototype Pollution + ReDoS), installed version `^0.18.5` noted, no upstream fix available
- **Consumer Scope** — 1 production file + 2 test files; usage is write-only (no `XLSX.read()`)
- **Threat Model** — 3-row table; parse-path vectors rated NOT APPLICABLE; supply-chain residual risk noted with existing mitigations
- **Decision** — Accept; track exceljs replacement as future debt
- **Mitigations in Place** — SECURITY comment, CI audit gate from Plan 03, no untrusted input
- **Revisit Triggers** — new write-path advisory, xlsx-import feature added, exceljs migration scheduled

## Verification

- `head -5 bar-pos/src/shared/lib/exporters/excel.ts | grep -c "SECURITY: xlsx"` → 1
- `grep -c "GHSA-4r6h-8v6p-xvw6" bar-pos/src/shared/lib/exporters/excel.ts` → 1
- `grep -c "GHSA-5pgg-2g8v-p4x9" bar-pos/src/shared/lib/exporters/excel.ts` → 1
- `grep -c "GHSA-4r6h-8v6p-xvw6" .planning/decisions/xlsx-cve-risk-accept.md` → 1
- `grep -c "GHSA-5pgg-2g8v-p4x9" .planning/decisions/xlsx-cve-risk-accept.md` → 1
- `grep -ci "Status:.*Accepted" .planning/decisions/xlsx-cve-risk-accept.md` → 1
- `cd bar-pos && npm run lint` → EXIT 0

## Deviations from Plan

None — plan executed exactly as written.

Note: `.planning/decisions/` did not exist; created it. File staged with `git add -f` because `.planning/` is in `.gitignore` but existing planning files are tracked (consistent with project convention).

## Known Stubs

None.

## Threat Flags

None — this plan adds documentation only; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `bar-pos/src/shared/lib/exporters/excel.ts` — FOUND (modified, SECURITY comment at line 1)
- `.planning/decisions/xlsx-cve-risk-accept.md` — FOUND (created)
- Commit 6e65b69 — FOUND
- Commit 7f78957 — FOUND
