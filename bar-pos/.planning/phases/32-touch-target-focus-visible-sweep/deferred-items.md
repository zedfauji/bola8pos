# Deferred Items — Phase 32 (touch-target-focus-visible-sweep)

## Plan 32-01

- **Pre-existing typecheck errors (out of scope, not caused by this plan):**
  - `src/entities/tab/model/queries.ts(780,11)`: `Type 'number | null' is not assignable to type 'number | undefined'.`
  - `src/shared/lib/agent/rag.ts(60,7)`: `Type 'number[]' is not assignable to type 'string'.`
  - Both predate this plan (documented repeatedly in `.planning/STATE.md` session log, e.g. Phase 17-03, Phase 11-02). Neither file is in this plan's `files_modified` list. Not fixed — out of scope per SCOPE BOUNDARY (fix only issues directly caused by the current task's changes).
