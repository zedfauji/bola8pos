# Phase 15: Tabs Version (Optimistic Concurrency) - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This is a **gap-closure pass**, not new feature work. Phase 15 (optimistic concurrency via `version` column + `STALE_VERSION` conflict handling on tabs/pool_sessions/caja_sessions) shipped and was marked complete on 2026-04-28, with `VERIFICATION.md` recording a `PASS-WITH-CARRYFORWARD` verdict and 4 non-blocking carry-forward gaps. This phase closes those carry-forwards — no new capability, no re-litigating the original design (server-side schema/trigger/RPC guard layer is done and correct).

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Expand scope beyond VERIFICATION.md's literal 3 named items — re-verify all Group-B call sites for `handleVersionError` wiring, not just the 6 originally-named feature-layer hooks, because live-codebase investigation during this discussion found VERIFICATION.md's claims don't fully match current code (see Specifics below).

### Edge function envelope
- **D-02:** Wire `expectedVersion` through the `process-payment` edge function into `process_payment_atomic`'s `p_expected_version` param now, rather than deferring again. The RPC param is null-tolerant (already true today, no correctness regression either way) but this closes the last uncovered conflict-prone path from the original phase goal.

### E2E spec
- **D-03:** Author `e2e/39-concurrent-edits.spec.ts` fresh in this phase (it does not exist on disk — see Specifics). Match the pattern used by other phases in this project: write the spec to contract as a normal task, then gate the "run it live and confirm green" step behind a `checkpoint:human-verify` (or equivalent blocking checkpoint) since it needs a live dev server + Supabase this sandbox can't provide. Do not attempt to fake-pass it.

### Claude's Discretion
- Exact wiring pattern for each `handleVersionError` call site — follow the existing pattern in `src/entities/caja/model/queries.ts` and `src/entities/resource/model/queries.ts` (the 2 currently-correct Group-B entity-layer references).
- Whether `void-order`, `add-combo-to-tab`, and `assign-pool-session-to-tab` need any change at all — investigation during this discussion could not find direct Supabase mutation code in those 3 feature directories (they may route through RPCs that are already server-guarded, or through entity-layer hooks that already have the guard). Confirm during planning/execution rather than assuming a gap exists.
- Whether to also close the 3 `.eq('version', ...)` sites found in `src/shared/lib/agent/tools/posTools.ts` (the AI agent chat tool layer) in this same pass, or leave as a separately-tracked follow-up — this path was not part of Phase 15's original scope or VERIFICATION.md's carry-forward list; it was discovered fresh during this discussion. Default to noting it as a discovered gap in the plan's deferred/carry-forward section rather than fixing it, unless the planner judges it trivially in-scope alongside the other wiring.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Original phase verification (source of the carry-forward gaps)
- `.planning/phases/15-tabs-version-optimistic-concurrency/VERIFICATION.md` — the 4 original carry-forward gaps (§"Carry-forward gaps (non-blocking)"); gap 4 (`useCloseTab.test.ts:95` pre-existing failure) is explicitly confirmed unrelated to Phase 15 and OUT OF SCOPE for this gap-closure phase.
- `.planning/phases/15-tabs-version-optimistic-concurrency/15-0{1..6}-SUMMARY.md` — historical record of the original 6 plans. Note: commit hashes cited in these files (and in `STATE.md`'s Phase-15 session-log entries) do not resolve in current git history — this repo's history was rewritten at some point (plausibly the Windows→Ubuntu migration, Phase 36). Treat SUMMARY.md prose as historical intent, not as a guarantee the described code still exists — verify against the live file tree, as this discussion did.

### Pattern references (already-correct Group-B wiring to replicate)
- `src/shared/lib/version-error.ts` — `handleVersionError` helper (invalidate + toast + best-effort audit).
- `src/shared/ui/VersionConflictToast.tsx` — toast UI component.
- `src/entities/caja/model/queries.ts` (~line 234) — reference Group-B wiring pattern.
- `src/entities/resource/model/queries.ts` (~lines 529, 694) — reference Group-B wiring pattern (formerly `pool_sessions`, renamed in Phase 26).

### Project conventions
- `CLAUDE.md` §"E2E Test Suite" — `39-concurrent-edits` is listed as one of 26 required specs; must be authored to match this list.
- `CLAUDE.md` §"TypeScript Gotchas" — `exactOptionalPropertyTypes`, `AppErrorCode` union rules apply to any new error-handling code touched.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `handleVersionError` (`src/shared/lib/version-error.ts`) — drop-in error handler, already used in 4 places; no new abstraction needed, just call-site wiring.
- `queries.concurrent.test.ts` (`src/entities/tab/model/queries.concurrent.test.ts`) — the fast-check property test from the original phase survives and passes; the missing piece is only the Playwright E2E spec, not the underlying test infrastructure pattern.

### Established Patterns
- Group A (RPC-guarded, e.g. `process_payment_atomic`, `create_order_with_items`): server enforces via `p_expected_version` + `FOR UPDATE`, raises `P0V01`/`P0V02`. Already correct/complete for the 2 RPCs that use it.
- Group B (hook-guarded): TanStack mutation hook does `.eq('version', expected)` client-side pre-check, 0-row UPDATE result triggers `staleVersionError` → `handleVersionError`. This is the pattern with real gaps.

### Integration Points — confirmed candidates for D-01 (Group-B wiring audit)
Files confirmed to already have the `.eq('version', expected)` guard but **not** call `handleVersionError` on failure (mechanical fix — add the call in the mutation's `onError`):
- `src/features/close-tab/index.ts` (line ~61)
- `src/features/transfer-tab/useTransferPoolSession.ts` (line ~74)
- `src/features/stop-and-move-table/useStopAndMoveSession.ts` (line ~62) — not in VERIFICATION.md's original 6-item list; discovered during this discussion, same gap shape.

Files/paths needing investigation (no direct Supabase mutation code found in the feature directory itself — likely route through RPC or a shared entity hook, or the wiring may be named differently than expected):
- `void-order`, `process-refund`, `add-combo-to-tab`, `assign-pool-session-to-tab`
- `src/entities/tab/model/queries.ts` — VERIFICATION.md claims "tabs status" and "tabs close-on-payment" Group-B paths were wired here; no `handleVersionError` import found in this file as of this discussion. Confirm whether the wiring exists under a different name/location, was lost, or was never actually done.

Discovered but out of original scope:
- `src/shared/lib/agent/tools/posTools.ts` (lines ~326, ~658, ~704) — 3 `.eq('version', ...)` sites in the AI agent chat tool layer, no `handleVersionError` calls found nearby. See Claude's Discretion above.

</code_context>

<specifics>
## Specific Ideas

**Live-codebase verification performed during this discussion (2026-08-07), superseding stale claims in VERIFICATION.md:**
1. `e2e/39-concurrent-edits.spec.ts` does not exist on disk (confirmed via `find`/`ls`) — VERIFICATION.md described it as "authored to contract but not green due to seed data"; reality is it was never actually committed, or was lost. Must be authored from scratch, not "fixed."
2. `entities/tab/model/queries.ts` has no `handleVersionError` wiring despite VERIFICATION.md's claim that "tabs status" and "tabs close-on-payment" were among the 4 wired Group-B entity paths. Only `entities/caja` and `entities/resource` (renamed from `pool_sessions`) show the wiring today.
3. Git history for the commit hashes cited in Phase 15's `SUMMARY.md` files and `STATE.md` session-log entries does not resolve (`git log --all` finds nothing for `6e875ad`, `ca8deb0`, etc.) — historical audit trail is unreliable for this phase; live file-tree state is the only trustworthy source.

</specifics>

<deferred>
## Deferred Ideas

- **`posTools.ts` (AI agent tool layer) version-guard wiring** — 3 conflict-prone call sites discovered during this discussion, outside Phase 15's original scope. Left to planner's discretion (see Claude's Discretion); if not folded into this phase, should be tracked as a new backlog item.
- **`useCloseTab.test.ts:95` pre-existing test failure** — explicitly confirmed unrelated to Phase 15 in the original VERIFICATION.md. Not part of this gap-closure phase.

### Reviewed Todos (not folded)
None — no pending todos matched this phase during cross-reference.

</deferred>

---

*Phase: 15-tabs-version-optimistic-concurrency*
*Context gathered: 2026-08-07*
