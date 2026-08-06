---
created: 2026-08-05T01:30:00.000Z
title: Notify-waitlist UPDATE fails outright — "net" schema does not exist (pg_net not enabled)
area: waitlist
severity: major
files:
  - src/features/notify-waitlist/model/useNotifyWaitlist.ts
  - .planning/phases/39-ai-slob-technical-debt-remediation/39-06-LEDGER.md (evidence — T2 finding)
---

## Problem

Clicking "Notify" on a waiting party fails completely — not a UI-refresh
cosmetic issue, the underlying database write itself is rejected:

```
[browser][error] .../rest/v1/waitlist_entries?id=eq.<id>: 400
waitlist.notify.failed {
  "entryId": "<id>",
  "error": { "code": "3F000", "message": "schema \"net\" does not exist" }
}
```

`useNotifyWaitlist.ts`'s mutation runs a plain `UPDATE waitlist_entries SET
status = 'notified', notified_at = now() WHERE id = ...` against the live
project this E2E suite connects to (the same `.env.local`-configured remote
Supabase project the rest of the app uses). The code comment above the
update says "pg_net trigger fires edge function automatically" — a
database trigger on `waitlist_entries` is expected to call into the `net`
schema (Supabase's `pg_net` extension, used for async outbound HTTP calls,
presumably to send the WhatsApp/notification edge function request).
Postgres error `3F000` (`invalid_schema_name`) means the `net` schema does
not exist in this database at all — so the trigger raises an exception,
and because a trigger exception aborts the whole statement in Postgres,
**the entire UPDATE is rolled back**: `status` never actually changes to
`'notified'`, confirmed by polling the row directly after the click (still
`'waiting'` after 5s).

This means the Notify feature is completely non-functional against the
live project right now, not merely showing a stale badge — the entry's
status genuinely never transitions, and the UI (correctly) shows an error
toast per `onSuccess`'s error branch, though the test suite hadn't been
asserting that path.

Discovered via `e2e/24-waitlist.spec.ts` T2 during Phase 39 E2E triage.

## Solution

TBD — needs a DBA/infra decision, not a client-code fix:
1. Enable the `pg_net` extension (`CREATE EXTENSION IF NOT EXISTS pg_net;`)
   on the project if the trigger's async-HTTP pattern is the intended
   design, or
2. If the trigger predates a since-changed notification architecture (e.g.
   moved to a different delivery mechanism that doesn't need `pg_net`),
   find and drop/rewrite the offending trigger on `waitlist_entries` so
   plain status updates no longer depend on a schema that isn't installed.

Either way, this blocks the whole notify-waitlist flow for every waiting
party, in every environment pointed at this project — high-severity for a
FIFO queue feature the app markets as WhatsApp-notification-driven
(CLAUDE.md "Implemented Features": `add-waitlist-entry`, `notify-waitlist`,
... "FIFO waitlist queue with WhatsApp notifications").
