---
sprint: S5
title: Waitlist + WhatsApp Notifications
duration: 2 weeks
tokens: 140k ± 20k
depends_on: [S1]
unlocks: [S6]
status: can_start_after_S1
---

# S5 — Waitlist

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Walk-in queue with FIFO ordering, party size tracking, and per-party notification on table-available events. Notification channel: WhatsApp via WasenderAPI when phone provided; Realtime manager pane + Tauri native notification otherwise. Single-venue scope.

## Scope

### In
1. `waitlist_entries` + `waitlist_notifications` tables
2. Edge function `send-waitlist-notification` (WasenderAPI integration)
3. Supabase Vault secret for WasenderAPI key
4. `libphonenumber-js` dependency (validation only, client-side)
5. `/waitlist` page + nav tile on Home
6. Realtime subscription on `waitlist_entries` + `pool_tables`
7. Manager notification pane: highlights head-of-line when a table frees
8. Auto-notify trigger when `status → 'notified'`
9. Seat-to-table flow (assigns `table_id`, status → seated)
10. Quoted wait calculation (simple: avg turn × parties-ahead)
11. E2E spec `24-waitlist.spec.ts`

### Out
- SMS fallback (C2 deferred)
- Multi-venue waitlist
- Reservation (pre-booked) entries — this is walk-in only
- Waitlist from customer-side app (phone self-check-in)

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S5-01 | Migration: waitlist_entries + indexes | migration | S |
| S5-02 | Migration: waitlist_notifications | migration | S |
| S5-03 | Migration: trigger on status→'notified' calls edge fn (via pg_net) | migration | M |
| S5-04 | Supabase Vault: store `WASENDER_API_KEY` | supabase CLI | XS |
| S5-05 | Edge function: `send-waitlist-notification` | `supabase/functions/send-waitlist-notification/` | L |
| S5-06 | Add libphonenumber-js dep; create `src/shared/lib/phone.ts` validator | package.json + shared/lib | S |
| S5-07 | Zod: WaitlistEntrySchema, PhoneE164Schema | domain.ts | S |
| S5-08 | Entity: `src/entities/waitlist/` | new FSD slice | M |
| S5-09 | Feature: `src/features/add-waitlist-entry/` | new FSD slice | M |
| S5-10 | Feature: `src/features/notify-waitlist/` (manual notify button) | new FSD slice | M |
| S5-11 | Feature: `src/features/seat-waitlist-party/` | new FSD slice | M |
| S5-12 | Feature: `src/features/mark-waitlist-no-show/` | new FSD slice | S |
| S5-13 | Widget: WaitlistQueue with sort, filters, realtime updates | `src/widgets/WaitlistQueue/` | L |
| S5-14 | Widget: PoolTableOccupancyPanel (reuse existing pool grid, overlay ETAs) | `src/widgets/PoolTableOccupancyPanel/` | M |
| S5-15 | Page: `/waitlist` + route registration + RBAC | page + router | M |
| S5-16 | Home tile: Waitlist (manager+) with waiting count badge | HomePage | S |
| S5-17 | Quoted-wait heuristic: avg turn × parties-ahead-same-size | `src/shared/lib/waitlist-math.ts` | M |
| S5-18 | Realtime: on pool_table status change, recompute and highlight head | widget logic | M |
| S5-19 | Tauri native notification for manager when table frees (no phone case) | `src/shared/lib/tauri-notify.ts` | M |
| S5-20 | Contract tests for edge function (MSW mock for WasenderAPI) | tests | M |
| S5-21 | E2E `24-waitlist.spec.ts` | e2e | L |
| S5-22 | Docs: operator runbook for WhatsApp setup (vault + WasenderAPI onboarding) | docs/waitlist-setup.md | S |

## Edge function — `send-waitlist-notification`

```typescript
// Pseudocode
const { entryId } = await req.json()
const entry = await supabase.from('waitlist_entries').select('*').eq('id', entryId).single()

let channel: 'whatsapp' | 'manager' = 'manager'
if (entry.phone_e164 && featureFlag('waitlist_whatsapp_enabled')) channel = 'whatsapp'

let result
if (channel === 'whatsapp') {
  const apiKey = await getSecret('WASENDER_API_KEY')
  const message = `Hola ${entry.name}, tu mesa está lista! Acércate a la barra. — Bola 8`
  result = await fetch('https://api.wasenderapi.com/v1/send-message', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: entry.phone_e164, text: message })
  })
  // handle rate-limit (429), invalid number (4xx), success (2xx)
}

await supabase.from('waitlist_notifications').insert({
  waitlist_entry_id: entryId,
  channel,
  status: result?.ok ? 'sent' : 'failed',
  provider_message_id: result?.ok ? (await result.json()).id : null,
  error: !result?.ok ? await result.text() : null
})

// Realtime broadcast for manager pane (always, even on WhatsApp success — manager still needs to know)
await supabase.channel('waitlist').send({ type: 'broadcast', event: 'notified', payload: { entryId, channel } })
```

**Security:** API key lives in Vault. Edge function is the only caller. Renderer never touches the key.

## Quoted-wait heuristic

```
averageTurnMinutes = rolling 7-day average of (seated_at → tab closed) for matching party_size
partiesAhead = count of waiting entries with same or larger party_size created before this one
quotedWait = max(5, averageTurnMinutes × ceil(partiesAhead / availableTables))
```

Recompute on any waitlist change or table status change. Surface as time-to-ready badge. Display "recalculating..." during transitions.

## UI flow
See [04-navigation-ui-flows.md § Waitlist](../04-navigation-ui-flows.md).

## Testing

### Unit
- Phone validation: valid MX, US, bad input
- Quoted wait computation with varying queue states
- FIFO sort stability across status changes

### Contract (edge function)
- Mock WasenderAPI with MSW:
  - 200 success → `status='sent'`, message_id saved
  - 429 rate limit → `status='failed'`, retry logic (decision: no retry in v1; log and manual resend)
  - 400 invalid phone → `status='failed'`, error recorded
  - Network error → `status='failed'`, fallback to manager channel

### Integration
- Add entry with phone → notify → WhatsApp call made, notification row present
- Add entry without phone → notify → no WhatsApp call, Tauri notification fired
- Concurrent entries: FIFO sort correct under 20 simultaneous inserts
- Seat entry → status flips, table_id set, pool_table status updated realtime

### E2E `24-waitlist.spec.ts`
1. Manager opens `/waitlist`
2. Adds walk-in "Alice" party of 4 with phone +52 55 1234 5678 → validation passes
3. Adds "Bob" party of 2, no phone
4. Mocks WasenderAPI edge function response (success)
5. Table frees (simulate pool_tables update) → Alice auto-notified; manager pane flashes with notification badge
6. Seats Alice at Table 3 → status=seated, table_id set, removed from queue
7. Bob becomes head-of-line, different pool table frees → Tauri native notification fires (no WhatsApp because no phone); manager pane flashes
8. Seats Bob
9. Mark a fictitious entry as no_show → status updated

## Definition of Done

- [ ] Migrations applied; types regenerated
- [ ] WasenderAPI key in Supabase Vault; edge function reads it correctly
- [ ] `/waitlist` route live, RBAC enforced (manager+)
- [ ] Home tile with waiting-count badge
- [ ] Realtime subscriptions working (verified via two browser tabs)
- [ ] Phone validation visible + blocks save on bad input
- [ ] Quoted wait updates when tables free
- [ ] Edge function contract tests green
- [ ] E2E `24-waitlist.spec.ts` green
- [ ] Tauri native notification fires on dev build
- [ ] typecheck + lint clean
- [ ] Operator runbook documented (how to set up WasenderAPI account, add phone number, test)

## Risks

| Risk | Mitigation |
|---|---|
| WasenderAPI account setup delays launch | Unblock with manager-channel-only mode initially; flip feature flag when account live |
| Phone validation false negatives for rare MX formats | libphonenumber-js is canonical; accept any passing validation; manual override not provided |
| Realtime flicker under high queue churn | Debounce UI updates (200ms); store update is source of truth |
| Message costs spike | Rate-limit edge function to 1 call per entry per 5 min; log attempts for cost tracking |
| GDPR/data: phone retention | Auto-purge `phone_e164` from entries older than 7 days via scheduled job (v2 if needed) |

## Notes

- **No SMS fallback in v1.** If WhatsApp fails, fall back to manager pane + Tauri notify. Adding SMS requires a second provider (Twilio) and consent flow — deferred.
- **Feature flag:** `waitlist_whatsapp_enabled` — admins can run in manager-only mode while WasenderAPI is being set up.
- **No customer self check-in** — operator adds entries. Keeps surface minimal.
