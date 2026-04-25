---
phase: 07-waitlist-whatsapp
plan: 03
subsystem: edge-functions
tags: [deno, whatsapp, wasenderapi, supabase-edge, rate-limiting, realtime]
dependency_graph:
  requires:
    - "07-01 (waitlist_entries + waitlist_notifications migrations)"
    - "07-02 (RBAC manage_waitlist action, domain schemas)"
  provides:
    - "send-waitlist-notification Deno edge function"
    - "WasenderAPI integration with rate-limit guard"
    - "Realtime broadcast on waitlist channel"
  affects:
    - "waitlist_notifications table (inserts)"
    - "waitlist Realtime channel (broadcasts)"
tech_stack:
  added: []
  patterns:
    - "Deno edge function with ES256-safe JWT auth (process-payment pattern)"
    - "Rate-limit guard via waitlist_notifications query before external API call"
    - "Manager channel fallback when no phone or no API key"
    - "Realtime broadcast after notification for UI invalidation"
key_files:
  created:
    - bar-pos/supabase/functions/send-waitlist-notification/index.ts
  modified: []
decisions:
  - "Used Deno.env.get for WASENDER_API_KEY (not Vault) — avoids known Supabase Vault+edge function bugs (issues #35232, #38329)"
  - "Manager channel notifStatus set to 'sent' (not 'failed') — broadcast-only delivery is successful delivery"
  - "Rate-limit guard inserts a failed audit row before returning 429 — ensures all attempts are logged"
  - "channel typed as 'whatsapp' | 'manager' literal union for type safety in conditional branches"
metrics:
  duration: "55 seconds"
  completed: "2026-04-25T19:29:55Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 07 Plan 03: Send-Waitlist-Notification Edge Function Summary

**One-liner:** Deno edge function with ES256-safe JWT auth, WasenderAPI WhatsApp dispatch, 5-minute rate-limit guard via DB query, always-insert audit row, and Realtime broadcast on manager channel fallback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create send-waitlist-notification edge function | 3308da5 | bar-pos/supabase/functions/send-waitlist-notification/index.ts |

## Implementation Details

The edge function implements all 10 requirements from the plan:

1. **Standard boilerplate** — Deno imports for `@supabase/supabase-js@2.49.1` and `zod@v3.23.8/mod.ts`, CORS headers, `jsonResponse` helper
2. **Auth verification (ES256-safe)** — direct `fetch` to `/auth/v1/user` with bearer token; avoids `admin.auth.getUser()` which fails with ES256 tokens
3. **Body parsing** — Zod `BodySchema = z.object({ entryId: z.string().uuid() })` with `safeParse`
4. **Entry fetch** — queries `waitlist_entries` for `id, name, phone_e164, status` via admin client
5. **Rate-limit guard** — queries `waitlist_notifications` for any `sent` row within last 5 minutes for same `entryId`; if found, inserts a `failed` audit row with `error: 'rate_limited'` and returns 429
6. **Channel decision** — `const channel: 'whatsapp' | 'manager' = phone && wasenderApiKey ? 'whatsapp' : 'manager'`
7. **WhatsApp call** — POST to `https://www.wasenderapi.com/api/send-message` with `Authorization: Bearer` header; extracts `body.data?.msgId` as `providerMessageId` on 200; captures first 500 chars of error body on failure
8. **Audit row INSERT** — always inserted into `waitlist_notifications` with `channel`, `status`, `provider_message_id`, `error`
9. **Realtime broadcast** — `admin.channel('waitlist').send({ type: 'broadcast', event: 'notified', payload: { entryId, channel, status: notifStatus } })`
10. **Response** — `{ success: true, channel, status: notifStatus }`

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the full code block provided in the plan task exactly.

## Security Review

All threat model mitigations are implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-7-07 (WASENDER_API_KEY disclosure) | Key read from `Deno.env.get('WASENDER_API_KEY')` only — never in source, DB, or renderer | IMPLEMENTED |
| T-7-08 (WasenderAPI rate limits / DoS) | Rate-limit guard queries `waitlist_notifications` for recent `sent` row; 429 stored as failed notification | IMPLEMENTED |
| T-7-09 (pg_net trigger spoofing) | JWT validated via `/auth/v1/user` — any spoof requires valid session JWT | IMPLEMENTED |
| T-7-10 (WhatsApp send repudiation) | Audit row inserted for every attempt with error text | IMPLEMENTED |

## Known Stubs

None — all functionality fully implemented.

## Threat Flags

None — no new trust boundaries introduced beyond those in the plan's threat model.

## Self-Check: PASSED

- [x] `bar-pos/supabase/functions/send-waitlist-notification/index.ts` exists
- [x] Commit `3308da5` exists in git log
- [x] `Deno.serve` handler present
- [x] `WASENDER_API_KEY` read from `Deno.env.get`
- [x] `rate_limited` string present in rate-limit guard
- [x] `waitlist_notifications` referenced (3 occurrences: rate-limit check, rate-limit insert, audit insert)
- [x] `admin.channel` broadcast present
