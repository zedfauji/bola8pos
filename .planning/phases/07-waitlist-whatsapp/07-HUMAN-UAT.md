---
status: partial
phase: 07-waitlist-whatsapp
source: [07-VERIFICATION.md]
started: "2026-04-25T00:00:00.000Z"
updated: "2026-04-25T00:00:00.000Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full add → notify → seat flow
expected: With dev server + live Supabase running — add a walk-in party, send notification (triggers pg_net → edge function → Realtime broadcast), observe WaitlistEntryCard status update, then seat the party by selecting a pool table shown as "Table N – Label"
result: [pending]

### 2. WhatsApp message delivery
expected: With WASENDER_API_KEY set via `supabase secrets set` and a real phone number — notification action results in a WhatsApp message delivered to the party's phone
result: [pending]

### 3. Tauri native notification (no-phone path)
expected: Running `npm run tauri dev` — when notifying a party with no phone number, a native OS notification fires via the Tauri notification plugin
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
