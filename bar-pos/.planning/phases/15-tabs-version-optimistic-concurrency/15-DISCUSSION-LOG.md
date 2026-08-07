# Phase 15: Tabs Version (Optimistic Concurrency) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 15-tabs-version-optimistic-concurrency
**Areas discussed:** Scope of Group-B wiring audit, process-payment edge function envelope, e2e/39-concurrent-edits.spec.ts

---

## Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Expand scope | Re-verify all Group-B entity/feature call sites for handleVersionError wiring, not just the 6 feature-layer hooks VERIFICATION.md named — close whatever's actually missing. | ✓ |
| Strict scope | Fix only the exact items VERIFICATION.md listed (6 feature-layer hooks + edge function envelope + E2E spec), trust its other claims as-is. | |

**User's choice:** Expand scope (recommended option accepted).
**Notes:** Prompted by live-codebase verification during this discussion finding VERIFICATION.md's claim that `entities/tab/model/queries.ts` has Group-B wiring for "tabs status"/"tabs close-on-payment" does not hold — no `handleVersionError` import found there.

---

## Edge fn gap

| Option | Description | Selected |
|--------|-------------|----------|
| Wire it now | Add expectedVersion to the edge function payload and pass it through to the RPC call — closes the last uncovered conflict-prone path. | ✓ |
| Formally defer | Document as an accepted-risk carry-forward again (2nd time) rather than fixing — no code change to the edge function this phase. | |

**User's choice:** Wire it now (recommended option accepted).
**Notes:** RPC param is null-tolerant, so this is closing a coverage gap rather than fixing a live bug.

---

## E2E spec

| Option | Description | Selected |
|--------|-------------|----------|
| Author it now | Write the spec to contract in this phase; mark the run-and-confirm-green step as a human/live-environment checkpoint, same pattern used for other phases in this project. | ✓ |
| Defer entirely | Skip the E2E spec in this gap-closure pass — track it as a separate follow-up item instead. | |

**User's choice:** Author it now (recommended option accepted).
**Notes:** File does not exist on disk at all — bigger gap than VERIFICATION.md's "authored but not green" framing suggested.

---

## Claude's Discretion

- Exact wiring pattern for each `handleVersionError` call site (follow `entities/caja`/`entities/resource` reference pattern).
- Whether `void-order`, `add-combo-to-tab`, `assign-pool-session-to-tab` need any change (no direct Supabase mutation code found in those directories during this discussion — may already be covered via RPC, or wiring lives elsewhere).
- Whether to fold the 3 newly-discovered `posTools.ts` (AI agent tool layer) version-guard gaps into this phase or defer them as a new backlog item — these were outside Phase 15's original scope entirely.

## Deferred Ideas

- `posTools.ts` AI-agent-tool-layer version-guard wiring (3 sites) — discovered fresh during this discussion, not part of original Phase 15 scope.
- `useCloseTab.test.ts:95` pre-existing test failure — explicitly confirmed unrelated to Phase 15 in the original VERIFICATION.md; not part of this gap-closure phase.
