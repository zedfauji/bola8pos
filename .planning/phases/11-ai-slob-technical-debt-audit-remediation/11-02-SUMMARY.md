---
phase: 11
plan: 02
subsystem: shared/lib/agent
tags: [lint, testing, debt-remediation, typescript, agent]
depends_on: [11-01]
dependency_graph:
  requires: [11-01-supabase-types-regen]
  provides: [lint-green-baseline, test-green-baseline]
  affects: [src/shared/lib/agent/, src/shared/lib/telemetry.ts]
tech_stack:
  added: []
  patterns:
    - "vi.hoisted() for mock variables referenced in vi.mock() factories"
    - "Scoped eslint-disable block with comment justification for dynamic table access"
    - "String() cast for number-in-template-expression lint compliance"
    - "JSON.stringify() for object interpolation in log fields"
key_files:
  created: []
  modified:
    - bar-pos/src/shared/lib/supabase.types.ts
    - bar-pos/src/shared/lib/telemetry.ts
    - bar-pos/src/shared/lib/agent/rag.ts
    - bar-pos/src/shared/lib/agent/rag.test.ts
    - bar-pos/src/shared/lib/agent/brain.ts
    - bar-pos/src/shared/lib/agent/brain.test.ts
    - bar-pos/src/shared/lib/agent/tools/diagnosticTools.ts
    - bar-pos/src/shared/lib/agent/tools/guardTools.ts
    - bar-pos/src/shared/lib/agent/tools/menuTools.ts
    - bar-pos/src/shared/lib/agent/tools/posTools.ts
    - bar-pos/src/shared/lib/agent/tools/reportTools.ts
    - bar-pos/src/shared/lib/agent/tools/systemTools.ts
decisions:
  - "Manual supabase.types.ts extension used (Docker WSL pipe unavailable for supabase start)"
  - "posTools.ts assertExists uses scoped eslint-disable block for dynamic table name — justified cast, caller validates table names"
  - "menuTools.ts/posTools.ts as-any casts removed; use TablesInsert<>/TablesUpdate<> casts and supabase.rpc() directly"
  - "cancelAction and bulkImportProducts made synchronous (no await expressions) to satisfy require-await"
  - "rag.test.ts mockLogWarn moved to vi.hoisted() to avoid unbound-method lint rule"
  - "brain.test.ts: executeTool IS called for pending actions (returns {pending:true}); removed incorrect not.toHaveBeenCalled assertions"
metrics:
  duration: 45min
  completed: "2026-04-27"
  tasks: 4
  files: 12
---

# Phase 11 Plan 02: Lint Green + Test Green Baseline Summary

Drove `npm run lint` from 211 errors to 0 and `npm run test` from 1 failure to all passing (1107 tests). Establishes the green baseline required for the CI pipeline (Plan 03).

## What Was Built

Plan 02 executes Wave 1 of the debt remediation: auto-fixing mechanical import/order errors, manually fixing all remaining typed-lint errors across the agent subsystem, and correcting the `brain.test.ts` mock contract mismatch.

**Also executed Plan 01 work (prerequisite):** Plan 01 SUMMARY did not exist — its tasks were executed inline as a prerequisite. Manually extended `supabase.types.ts` with `agent_audit_log`, `pos_error_log`, `pos_codebase_index` tables and `match_codebase_chunks` RPC. Removed `const db = supabase as any` from `telemetry.ts`, `rag.ts`, and `diagnosticTools.ts`.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| Plan 01 (prereq) | supabase.types.ts extension + cast removal | 84007dc |
| Task 1 | eslint --fix + menuTools/posTools cast removal | 031f9b6 |
| Task 2 | Manual fixes for all remaining typed-lint errors | 45e2c0b |
| Task 3 | brain.test.ts confirm-token mock contract fix | 70be490 |
| Task 4 | Full lint + test gate verification | (inline) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 01 prerequisite not completed**
- **Found during:** Task 1 start (lint showed 211 errors, types not regenerated)
- **Issue:** 11-01-SUMMARY.md did not exist; supabase.types.ts still missing agent tables; all as-any casts still in place
- **Fix:** Executed Plan 01 tasks inline before starting Plan 02 tasks
- **Files modified:** supabase.types.ts, telemetry.ts, rag.ts, diagnosticTools.ts
- **Commit:** 84007dc

**2. [Rule 1 - Bug] menuTools.ts and posTools.ts had as-any casts beyond original 3 files**
- **Found during:** Task 1 (eslint --fix revealed 50+ unsafe-* errors in menuTools + posTools)
- **Issue:** Research identified only 3 files with casts; menuTools.ts and posTools.ts also had `const db = supabase as any`
- **Fix:** Removed casts; used TablesInsert<>/TablesUpdate<> casts for menuTools; supabase.rpc() directly for posTools; scoped eslint-disable for assertExists dynamic table
- **Commit:** 031f9b6

**3. [Rule 1 - Bug] More lint errors than research anticipated (110 after --fix, not 30)**
- **Found during:** Task 2 (110 errors after --fix, research said ~30 manual fixes)
- **Issue:** menuTools/posTools no-unsafe-* errors + additional restrict-template-expressions and no-unnecessary-condition errors in diagnosticTools, reportTools
- **Fix:** Fixed all errors file by file; made cancelAction and bulkImportProducts synchronous
- **Commit:** 45e2c0b

**4. [Rule 2 - Missing functionality] posTools.ts assertExists needs justified cast**
- **Found during:** Task 2
- **Issue:** assertExists takes a dynamic `table: string` parameter — cannot be statically typed. Scoped eslint-disable block added with justification comment
- **Fix:** Block disable with justification: "Dynamic table name cannot be statically typed — justified cast (caller validates table names)"
- **Commit:** 45e2c0b

## Success Criteria Verification

- `npm run lint` exits 0: PASS (0 errors, 0 warnings)
- `npm run test` exits 0: PASS (1107 passed, 2 todo, 0 failed)
- No new eslint-disable directives (beyond 1 justified block in posTools.ts assertExists): PASS
- No .skip() added: PASS
- Tests >= 1106: PASS (1107)
- brain.test.ts confirm_token: PASS
- brain.test.ts pendingConfirmation.token: PASS
- brain.test.ts removed toolsExecuted.toHaveLength(0): PASS
- brain.test.ts removed mockExecuteTool.not.toHaveBeenCalled: PASS

## Known Stubs

None — no stubs added in this plan.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- 84007dc: `git log --oneline --all | grep 84007dc` — FOUND
- 031f9b6: `git log --oneline --all | grep 031f9b6` — FOUND
- 45e2c0b: `git log --oneline --all | grep 45e2c0b` — FOUND
- 70be490: `git log --oneline --all | grep 70be490` — FOUND
- supabase.types.ts contains pos_error_log: FOUND
- npm run lint: exit 0 CONFIRMED
- npm run test: 1107 passed, 0 failed CONFIRMED
