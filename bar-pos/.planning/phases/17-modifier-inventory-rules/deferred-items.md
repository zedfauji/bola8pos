# Phase 17 — Deferred Items (out of scope for 17-03)

Discovered during 17-03 Task 1 while running `npm run typecheck` as part of the task's
acceptance criteria. Not fixed because they fall outside this plan's `<files>` scope
(`src/shared/lib/supabase.types.ts` only) and are unrelated to the `modifier_inventory_rules`
type transcription added in this task.

## 1. `src/entities/tab/model/queries.ts(778,11)` — TS2322

`Type 'number | null' is not assignable to type 'number | undefined'.` Pre-existing, last
touched by Phase 14 commit `9929c41` (rewire `useMutationUpdateTabStatus` to call `close_tab`
RPC), unrelated to Phase 17 modifier work.

## 2. `src/shared/lib/agent/rag.ts(60,7)` — TS2322

`Type 'number[]' is not assignable to type 'string'.` Pre-existing, last touched by Phase 15
commits (`3737c72`, `48f43e7`), unrelated to Phase 17 modifier work.

Neither error is caused by or related to the `modifier_inventory_rules` table block added to
`supabase.types.ts` in 17-03 Task 1. Confirmed via `git log` — both files were last modified in
Phase 14/15, before this plan started. Recommended: address in a future tech-debt cleanup pass
(candidate for Phase 10's AI-slob-technical-debt audit follow-up).
