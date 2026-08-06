---
created: 2026-08-04T00:00:00.000Z
title: Offline queue only syncs one of two orders placed against the same tab while offline
area: offline-sync
severity: major
files:
  - src/app/OfflineQueueProcessor.tsx:90-155 (replayQueue — STALE_VERSION discard path)
  - src/entities/tab/model/queries.ts:726-745 (useMutationAddOrder onSuccess — expectedVersion capture)
  - e2e/11-offline.spec.ts:69 (T5: three offline actions — no error toasts, sync on reconnect)
---

## Problem

Discovered during Phase 39 plan 39-04 while triaging `e2e/11-offline.spec.ts:69`
("T5: three offline actions — no error toasts, sync on reconnect").

Reproduced live (twice — initial attempt and Playwright's automatic retry,
both failed identically): the test places two separate orders against the
same tab while `page.context().setOffline(true)`, then reconnects and polls
`getOrderCount(tabId)` for 60s expecting `>= 2`. It consistently observes
only `1`.

```
Error: expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 2
Received:    1
Call Log:
- Timeout 60000ms exceeded while waiting on the predicate
```

The "all actions synced" toast (or a generically-matching "offline" text —
see Note below) appears before the poll times out, meaning
`OfflineQueueProcessor.replayQueue` believes it finished the queue, not that
it's stuck.

## Suspected mechanism (not confirmed — filed per D-03, not fixed inline)

`useMutationAddOrder`'s `onSuccess` handler (queries.ts:726-745) captures
`expectedVersion` for a queued `place-order` offline action from the
**tab's own cached `version`** at the moment the mutation is attempted
offline:

```ts
const cachedTab = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(variables.tabId));
const expectedVersion = cachedTab?.ok && typeof cachedTab.data.version === 'number'
  ? cachedTab.data.version
  : 0;
useTabStore.getState().enqueueOfflineAction({ type: 'place-order', payload: variables, expectedVersion });
```

`OfflineQueueProcessor.replayQueue` (OfflineQueueProcessor.tsx:90-155) then
replays queued actions **sequentially**, and on `STALE_VERSION` /
`NOT_FOUND_VERSIONED` it silently **drops** the action (`dropAndAudit`) and
only surfaces a single batched `toast.error(formatDiscardedSummary(...))` —
no per-action failure surfaces to the E2E assertion at line 94
(`getByRole('alert').filter({ hasText: /error|failed/i })` — that check
already passed by the time this discard would fire, since it's asserted
*before* reconnect).

If placing the first queued order bumps the tab's `version` server-side
(Phase 15's optimistic-concurrency `version` column + `STALE_VERSION`
pattern, used elsewhere on `tabs`/`pool_sessions`/`caja_sessions`), then the
**second** queued `place-order` action — captured with the tab's
pre-first-order cached version, since both actions were queued back-to-back
while still offline — would fail `STALE_VERSION` on replay and be silently
discarded, exactly matching this symptom (1 of 2 orders synced, no visible
error in the UI's primary success-toast path).

This has not been confirmed against the actual RPC (`add_order`/equivalent)
to verify it does bump `tabs.version` — that check plus a fix are explicitly
deferred per D-03 (real product bugs discovered during Phase 39 triage are
filed, not fixed inline).

## Why this matters

This directly touches this project's stated core value ("orders and pool-table
billing must stay correct even under concurrent terminal edits and flaky
connectivity" — `.planning/PROJECT.md`). If confirmed, a bartender who adds
two orders while briefly offline could lose the second order silently on
reconnect, with only a generic discard toast (if even distinguishable from
the "synced" toast a user might not read carefully).

## Solution

TBD — needs confirmation first. Options to evaluate once confirmed:
- If `add_order`/place-order genuinely doesn't need `tabs.version` for its
  own concurrency check (it's an insert into a child table, not a tab
  mutation), stop threading `expectedVersion` through `place-order` offline
  actions entirely — it may be a copy-paste of the tab-mutation pattern
  applied somewhere it doesn't apply.
- If it does need version-checked concurrency, re-capture (or refresh)
  `expectedVersion` for each queued action against the **queue's own running
  state** at replay time (i.e., the version the tab would be at *after* prior
  actions in this same batch have applied), not the pre-offline cached
  snapshot for every action in the batch.
- At minimum, make a discard due to `STALE_VERSION` during offline-queue
  replay surface as loud and specific to the user as a lost order deserves —
  today it's one batched summary toast, easy to miss.

## Note on the test's own assertion

`e2e/11-offline.spec.ts:97`'s regex `/all actions synced|offline/i` is broad
enough it could pass on stale "offline" banner text rather than a genuine
sync-complete signal — worth tightening once the underlying sync bug above
is resolved, so the assertion can't mask a partial-discard scenario the same
way it may have here.
