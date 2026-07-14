# Phase 7: Waitlist + WhatsApp — Research

**Researched:** 2026-04-25
**Domain:** Walk-in queue management, WhatsApp API integration, Supabase pg_net triggers, Tauri native notifications
**Confidence:** HIGH (core stack patterns verified in codebase; WasenderAPI endpoint verified from official docs; Tauri notification plugin verified from v2 docs)

---

## Summary

Phase 7 adds a FIFO walk-in queue (waitlist) with WhatsApp notifications via WasenderAPI. It is the first phase to introduce an edge function that calls an external third-party API, and the first to use Supabase `pg_net` for trigger-initiated HTTP calls. The notification channel is dual-path: WhatsApp via WasenderAPI when a phone number is provided, otherwise a Tauri native notification to the manager terminal.

The phase follows the same FSD layering established in Phases 4–6: SQL migrations first, then Zod schemas in `domain.ts`, then FSD entity/feature slices, then widgets/pages, then tests. The key new complexity is the edge function `send-waitlist-notification` which must read a Vault-stored API key. The recommended approach is to store the key as an **edge function secret** (via `supabase secrets set`) rather than Vault, because Vault + edge functions has active known bugs as of April 2025.

**Primary recommendation:** Use `supabase secrets set WASENDER_API_KEY=...` (not Vault) so the key is available as `Deno.env.get('WASENDER_API_KEY')` with no additional DB query. Follow the `process-payment/index.ts` edge function template for auth verification, Zod body parsing, and CORS headers. Follow `PoolRealtimeListener.tsx` + `supabase-realtime.ts` patterns for dual-channel Realtime subscriptions.

---

## Project Constraints (from CLAUDE.md)

- FSD import direction strictly enforced: `app → pages → widgets → features → entities → shared`
- `eslint-plugin-boundaries` enforced — violations are blocking lint errors
- `exactOptionalPropertyTypes: true` — use `prop: string | undefined` not `prop?: string` for mutation inputs
- `noUncheckedIndexedAccess: true` — array access returns `T | undefined`
- No `any` without justification comment on same line
- All domain types inferred from Zod in `src/shared/lib/domain.ts`
- Error handling: `Result<T>` from `src/shared/lib/result.ts`
- Logging: `src/shared/lib/logger.ts` only — no `console.log`
- New `AppErrorCode` values must be added to the union in `result.ts` first
- New RBAC actions must be added to `STAFF_ACTIONS` array in `rbac.ts` first
- New routes registered in `src/app/router.tsx`; RBAC gate via route wrapper component
- Edge functions in `bar-pos/supabase/functions/<name>/index.ts`, Deno runtime
- Shadcn CLI installs to `src/app/components/ui/` — always move to `src/shared/ui/`
- `export *` is banned by ESLint `no-restricted-syntax` — use explicit named exports in barrel files
- Storybook required for every new `shared/ui/` component
- `import order`: fast-check imports precede vitest in test files
- Integration tests: use anon client (signInWithPassword) for RPC calls that use `auth.uid()`

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| S5-01 | Migration: `waitlist_entries` table + indexes | Schema design section; FIFO sort needs `created_at` index |
| S5-02 | Migration: `waitlist_notifications` table | Schema design section |
| S5-03 | Migration: trigger on `status → 'notified'` calls edge fn via `pg_net` | pg_net trigger pattern section |
| S5-04 | Supabase Vault: store `WASENDER_API_KEY` | Edge function secrets section (recommend `supabase secrets set` over Vault) |
| S5-05 | Edge function: `send-waitlist-notification` | WasenderAPI integration section, edge function patterns |
| S5-06 | Add `libphonenumber-js` dep; `src/shared/lib/phone.ts` validator | libphonenumber-js section; NOT in package.json yet |
| S5-07 | Zod: `WaitlistEntrySchema`, `PhoneE164Schema` | Domain schema section; follows existing primitive patterns |
| S5-08 | Entity: `src/entities/waitlist/` | FSD entity pattern section |
| S5-09 | Feature: `src/features/add-waitlist-entry/` | FSD feature pattern section |
| S5-10 | Feature: `src/features/notify-waitlist/` (manual notify button) | Feature pattern; invokes edge function via Supabase client |
| S5-11 | Feature: `src/features/seat-waitlist-party/` | Feature pattern; updates `table_id` + `status` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Waitlist FIFO queue state | Frontend (Zustand store) | Supabase Realtime (source of truth) | Queue displayed in real time; Zustand acts as local cache |
| Phone E.164 validation | Frontend (shared/lib) | — | Client-side UX; server does not re-validate format |
| Quoted-wait heuristic calculation | Frontend (shared/lib pure fn) | — | Pure function of queue snapshot; no server round-trip needed |
| WhatsApp notification dispatch | Supabase Edge Function | — | API key must never reach renderer; edge fn is sole caller |
| Notification trigger on status change | Database (pg_net trigger) | — | Fires on DB transition, not from renderer; authoritative event source |
| Manager Tauri notification (no-phone fallback) | Frontend (shared/lib/tauri-notify.ts) | — | Desktop notification; only makes sense in Tauri context |
| Waitlist entry CRUD | Supabase (RLS + direct writes) | — | Standard entity pattern; no edge function needed for creates |
| Seat-to-table assignment | Supabase (direct UPDATE via RLS) | — | Simple status+FK update; RLS enforces manager+ |
| Realtime subscription (waitlist + pool_tables) | Frontend app layer | Zustand store | Follows `PoolRealtimeListener` + `supabase-realtime.ts` pattern |

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | ^2.103.0 [VERIFIED: package.json] | DB queries + Realtime + edge function invocation | Project standard |
| TanStack Query | ^5.99.0 [VERIFIED: package.json] | Server state, query invalidation | Project standard |
| Zustand | ^5.0.12 [VERIFIED: package.json] | Local/UI state + Realtime subscription store | Project standard |
| Zod v4 | ^4.3.6 [VERIFIED: package.json] | Domain type source of truth | Project standard |

### New Dependency
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| libphonenumber-js | 1.12.42 (latest as of 2026-04-25) [VERIFIED: npm registry] | E.164 phone number validation + formatting | S5-06; client-side only; not in package.json yet |
| @tauri-apps/plugin-notification | ^2 [VERIFIED: v2.tauri.app docs] | Native OS desktop notification | S5-19 fallback when no phone; requires Cargo.toml + capabilities update |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| libphonenumber-js | Custom regex | libphonenumber-js handles MX/US edge cases (carrier prefixes, formatting variations); custom regex will produce false negatives |
| `supabase secrets set` | Supabase Vault | Vault + edge functions has active known bugs (Deno.env.get returns undefined, GitHub issues #35232, #38329 as of 2025); `supabase secrets set` is simpler and more reliable |
| pg_net trigger | Supabase Database Webhook UI | Migration-defined trigger is version-controlled; webhook UI config is not |

**Installation:**
```bash
cd bar-pos
npm install libphonenumber-js
npm run tauri add notification
```

The `tauri add notification` command updates `Cargo.toml`, `src-tauri/src/lib.rs`, and `capabilities/default.json` automatically. [VERIFIED: v2.tauri.app/plugin/notification/]

---

## Architecture Patterns

### System Architecture Diagram

```
Operator Terminal (Tauri desktop)
  │
  ├─ /waitlist page (React)
  │    ├─ WaitlistQueue widget
  │    │    ├─ reads: useWaitlistEntries() [TanStack Query]
  │    │    ├─ reads: usePoolTables() [TanStack Query]
  │    │    └─ computed: quotedWait (waitlist-math.ts pure fn)
  │    └─ PoolTableOccupancyPanel widget (reuses pool-table entity)
  │
  ├─ features/add-waitlist-entry/ → INSERT waitlist_entries
  ├─ features/notify-waitlist/   → UPDATE status='notified' → triggers DB edge fn
  ├─ features/seat-waitlist-party/ → UPDATE status='seated', table_id=X
  └─ features/mark-waitlist-no-show/ → UPDATE status='no_show'
  │
  ├─ WaitlistRealtimeListener (app layer component)
  │    └─ supabase.channel('waitlist:changes')
  │         ├─ postgres_changes on waitlist_entries → invalidate waitlistKeys
  │         └─ postgres_changes on pool_tables → invalidate + trigger head-of-line recompute

  │
  └─ shared/lib/tauri-notify.ts → sendNotification() [fallback, no phone]

Supabase (remote)
  │
  ├─ waitlist_entries table
  │    └─ trg_waitlist_notify AFTER UPDATE status='notified'
  │         └─ net.http_post → send-waitlist-notification edge function
  │
  ├─ waitlist_notifications table (audit log)
  │
  └─ Edge Function: send-waitlist-notification (Deno)
       ├─ reads WASENDER_API_KEY via Deno.env.get (set via `supabase secrets set`)
       ├─ if phone_e164: POST https://www.wasenderapi.com/api/send-message
       └─ inserts waitlist_notifications row (sent | failed) + broadcasts on channel 'waitlist'
```

### Recommended Project Structure

```
bar-pos/src/
├─ entities/waitlist/
│    ├─ model/
│    │    ├─ types.ts          ← WaitlistEntrySchema + WaitlistNotificationSchema types
│    │    ├─ store.ts          ← Zustand store (no Realtime here — see app/WaitlistRealtimeListener)
│    │    ├─ queries.ts        ← useWaitlistEntries, useWaitlistEntry, waitlistKeys
│    │    └─ index.ts          ← explicit named exports (no export *)
│    └─ ui/
│         └─ WaitlistEntryCard.tsx  ← Storybook story required
├─ features/
│    ├─ add-waitlist-entry/
│    │    ├─ model/useAddWaitlistEntry.ts
│    │    └─ ui/AddWaitlistEntryForm.tsx
│    ├─ notify-waitlist/
│    │    ├─ model/useNotifyWaitlist.ts
│    │    └─ ui/NotifyButton.tsx
│    ├─ seat-waitlist-party/
│    │    ├─ model/useSeatWaitlistParty.ts
│    │    └─ ui/SeatPartySheet.tsx
│    └─ mark-waitlist-no-show/
│         └─ model/useMarkNoShow.ts
├─ widgets/
│    ├─ WaitlistQueue/
│    │    ├─ index.ts
│    │    └─ ui/WaitlistQueue.tsx
│    └─ PoolTableOccupancyPanel/
│         └─ ui/PoolTableOccupancyPanel.tsx
├─ pages/waitlist/
│    └─ index.tsx
├─ app/
│    ├─ waitlist-route.tsx      ← RBAC gate: manage_waitlist action
│    ├─ WaitlistRealtimeListener.tsx
│    └─ router.tsx              ← add /waitlist route
└─ shared/lib/
     ├─ phone.ts               ← isValidE164(), formatE164() using libphonenumber-js
     ├─ waitlist-math.ts       ← computeQuotedWait() pure function
     └─ tauri-notify.ts        ← sendNotification() wrapper (tauri-plugin-notification)

bar-pos/supabase/functions/
└─ send-waitlist-notification/
     └─ index.ts               ← Deno edge function

bar-pos/supabase/migrations/
├─ 20260501000001_waitlist_entries.sql
├─ 20260501000002_waitlist_notifications.sql
└─ 20260501000003_waitlist_notify_trigger.sql
```

### Pattern 1: Edge Function Structure (follows process-payment template)

```typescript
// supabase/functions/send-waitlist-notification/index.ts
// Source: bar-pos/supabase/functions/process-payment/index.ts (project pattern)
// Source: bar-pos/supabase/functions/send-receipt-email/index.ts (simpler auth pattern)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const BodySchema = z.object({ entryId: z.string().uuid() });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);

  // Auth verification (ES256-safe pattern from process-payment)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const wasenderApiKey = Deno.env.get('WASENDER_API_KEY'); // set via supabase secrets set

  const token = authHeader.slice(7);
  const authVerifyResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
  });
  if (!authVerifyResp.ok) return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Parse body
  let bodyJson: unknown;
  try { bodyJson = await req.json(); } catch { return jsonResponse({ success: false, error: { code: 'INVALID_JSON' } }, 400); }
  const parsed = BodySchema.safeParse(bodyJson);
  if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR' } }, 400);

  const { entryId } = parsed.data;

  // Fetch entry
  const { data: entry, error: entryErr } = await admin
    .from('waitlist_entries')
    .select('id, name, phone_e164, status')
    .eq('id', entryId)
    .single();
  if (entryErr || !entry) return jsonResponse({ success: false, error: { code: 'NOT_FOUND' } }, 404);

  const phone = entry.phone_e164 as string | null;
  const channel = phone && wasenderApiKey ? 'whatsapp' : 'manager';
  let notifStatus = 'failed';
  let providerMessageId: string | null = null;
  let errorText: string | null = null;

  if (channel === 'whatsapp' && wasenderApiKey) {
    const message = `Hola ${entry.name as string}, tu mesa está lista! Acércate a la barra. — Bola 8`;
    const resp = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${wasenderApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, text: message }),
    });
    if (resp.ok) {
      const body = await resp.json() as { data?: { msgId?: number } };
      notifStatus = 'sent';
      providerMessageId = body.data?.msgId != null ? String(body.data.msgId) : null;
    } else {
      errorText = (await resp.text()).slice(0, 500);
      // 429 = rate limited; 4xx = invalid number; both → status='failed', log for ops
    }
  }

  // Insert notification audit row
  await admin.from('waitlist_notifications').insert({
    waitlist_entry_id: entryId,
    channel,
    status: notifStatus,
    provider_message_id: providerMessageId,
    error: errorText,
  });

  // Broadcast for manager pane (always)
  await admin.channel('waitlist').send({
    type: 'broadcast',
    event: 'notified',
    payload: { entryId, channel, status: notifStatus },
  });

  return jsonResponse({ success: true, channel, status: notifStatus });
});
```

### Pattern 2: pg_net Trigger Migration

```sql
-- Source: supabase.com/docs/guides/database/extensions/pg_net + project migration conventions
-- 20260501000003_waitlist_notify_trigger.sql

-- pg_net is pre-enabled on Supabase hosted (no CREATE EXTENSION needed)

create or replace function notify_waitlist_entry()
  returns trigger
  language plpgsql
  security definer
as $$
declare
  v_url text;
  v_key text;
begin
  -- Only fire when status transitions TO 'notified'
  if new.status = 'notified' and (old.status is distinct from 'notified') then
    v_url := current_setting('app.supabase_url', true) || '/functions/v1/send-waitlist-notification';
    v_key := current_setting('app.supabase_anon_key', true);

    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('entryId', new.id::text),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_waitlist_notify
  after update of status on waitlist_entries
  for each row
  execute function notify_waitlist_entry();
```

**Critical note:** `app.supabase_url` and `app.supabase_anon_key` must be set as Postgres settings at migration time:
```sql
alter database postgres set app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
alter database postgres set app.supabase_anon_key = 'YOUR_ANON_KEY';
```
Alternatively the URL and key can be hardcoded in the migration — acceptable for single-venue scope. Hardcoding is simpler and avoids the `current_setting` call entirely. [ASSUMED for the exact recommended approach — planner should confirm with user whether hardcoded or DB settings is preferred]

### Pattern 3: libphonenumber-js Phone Validator (src/shared/lib/phone.ts)

```typescript
// Source: libphonenumber-js README (catamphetamine/libphonenumber-js)
import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Validates and normalises a user-entered phone string to E.164.
 * Returns null if the input cannot be parsed as a valid MX or US number.
 * Focus is MX (+52) and US (+1) per PRD scope.
 */
export function toE164(raw: string): string | null {
  // Try with default country MX for bare numbers (e.g. "55 1234 5678")
  const parsed = parsePhoneNumberFromString(raw, 'MX');
  if (parsed?.isValid()) return parsed.format('E.164');

  // Retry US if MX parse fails
  const parsedUS = parsePhoneNumberFromString(raw, 'US');
  if (parsedUS?.isValid()) return parsedUS.format('E.164');

  return null;
}

/** Returns true if the string is already a valid E.164 phone number. */
export function isE164(value: string): boolean {
  return isValidPhoneNumber(value);
}
```

### Pattern 4: Dual Realtime Subscription (WaitlistRealtimeListener)

The project uses two patterns for Realtime:
1. **App-level component** (`PoolRealtimeListener.tsx`) — invalidates TanStack Query on change; simple, correct for most entities
2. **Entity queries hook** (`kds/model/queries.ts`) — drives Zustand store directly via `useEffect`

For Phase 7, use Pattern 1 (app-level component) since the waitlist widget is a full page view that TanStack Query can re-query on invalidation:

```typescript
// src/app/WaitlistRealtimeListener.tsx
// Source: bar-pos/src/app/PoolRealtimeListener.tsx (project pattern)
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { waitlistKeys } from '@entities/waitlist/model/queries';
import { poolTableKeys } from '@entities/pool-table/model/queries';

export function WaitlistRealtimeListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateWaitlist = () => {
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.all });
    };
    const invalidateTables = () => {
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
    };

    const channel = supabase
      .channel('waitlist:pos-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries' }, invalidateWaitlist)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_tables' }, invalidateTables)
      .on('broadcast', { event: 'notified' }, invalidateWaitlist)
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  return null;
}
```

### Pattern 5: Tauri Native Notification (src/shared/lib/tauri-notify.ts)

```typescript
// Source: v2.tauri.app/plugin/notification/
// Requires: tauri-plugin-notification in Cargo.toml + capabilities/default.json
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export async function sendManagerNotification(title: string, body: string): Promise<void> {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  if (!permissionGranted) return; // silently skip — manager will see Realtime pane
  sendNotification({ title, body });
}
```

**tauri.conf.json is NOT in bar-pos/src-tauri/** — it is at `bar-pos/src-tauri/tauri.conf.json`. [VERIFIED: file found there]

**Capabilities file** `bar-pos/src-tauri/capabilities/default.json` needs `"notification:default"` added to the `permissions` array.

**Cargo.toml** (`bar-pos/src-tauri/Cargo.toml`) needs:
```toml
tauri-plugin-notification = "2"
```

**lib.rs** needs `.plugin(tauri_plugin_notification::init())` added. [VERIFIED: Cargo.toml read; plugin not present yet]

### Pattern 6: RBAC — New Action and Route Guard

```typescript
// In rbac.ts — add to STAFF_ACTIONS array:
'manage_waitlist'

// In MANAGER_EXTRA set:
'manage_waitlist' // waitlist is manager+ only per PRD

// src/app/waitlist-route.tsx (follows kitchen-prep-route.tsx pattern exactly)
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

export function WaitlistRoute({ children }: { children: ReactNode }) {
  const { can } = usePermissions();
  if (!can('manage_waitlist')) return <Navigate to="/home" replace />;
  return <>{children}</>;
}
```

HomeDashboard tile entry:
```typescript
// In ITEMS array in HomeDashboard.tsx:
{
  path: '/waitlist',
  label: 'Waitlist',
  icon: Clock,       // or ListOrdered from lucide-react — check availability
  requiredAction: 'manage_waitlist',
  managerLabel: 'Manager',
}
```

The badge on the tile showing waiting-count requires `useWaitlistEntries()` to be called in `HomeDashboard` and filter for `status = 'waiting'`. Since `HomeDashboard` is currently a static config array, a count badge needs the component to render a dynamic count overlay. [ASSUMED pattern — verify acceptable approach with planner]

### Anti-Patterns to Avoid

- **Never read WASENDER_API_KEY in the renderer.** The key must only exist in the edge function environment. [VERIFIED: CLAUDE.md forbids service-role key in renderer; same principle applies]
- **Do not use Supabase Vault for the API key.** Vault secrets are not reliably accessible via `Deno.env.get()` in edge functions as of 2025 (GitHub issues #35232, #38329). Use `supabase secrets set` instead.
- **Do not start the pg_net trigger in a transaction block.** pg_net HTTP requests are dispatched only after the transaction commits. The trigger must be in an `AFTER UPDATE` trigger (not `BEFORE`).
- **Do not create two separate Supabase channels for waitlist and pool_tables.** Use one channel with two `.on()` handlers — this conserves Realtime channel slots.
- **Do not import from `@entities/waitlist` in `shared/lib/phone.ts` or `shared/lib/waitlist-math.ts`.** These are shared utilities; no business entity imports allowed.

---

## Schema Design

### waitlist_entries

```sql
create table public.waitlist_entries (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  party_size   smallint not null check (party_size between 1 and 20),
  phone_e164   text null,           -- nullable; E.164 format if present
  status       text not null default 'waiting'
                 check (status in ('waiting', 'notified', 'seated', 'no_show', 'cancelled')),
  table_id     uuid null references pool_tables(id) on delete set null,
  seated_at    timestamptz null,
  notified_at  timestamptz null,
  created_at   timestamptz not null default now()
);

-- FIFO ordering index
create index waitlist_entries_created_at_idx on public.waitlist_entries (created_at asc);
-- Status filter for active queue
create index waitlist_entries_status_idx on public.waitlist_entries (status);
-- Quoted-wait heuristic: 7-day avg by party_size for seated entries
create index waitlist_entries_seated_at_party_idx
  on public.waitlist_entries (party_size, seated_at)
  where status = 'seated' and seated_at is not null;
```

The PRD column list is complete. One column to note: `notified_at` should be set by the trigger or edge function when `status` becomes `'notified'`, not by the client. A `BEFORE UPDATE` trigger or DEFAULT expression handles this.

### waitlist_notifications

```sql
create table public.waitlist_notifications (
  id                  uuid primary key default gen_random_uuid(),
  waitlist_entry_id   uuid not null references waitlist_entries(id) on delete cascade,
  channel             text not null check (channel in ('whatsapp', 'manager')),
  status              text not null check (status in ('sent', 'failed', 'pending')),
  provider_message_id text null,   -- WasenderAPI msgId
  error               text null,   -- raw error text, max 500 chars in practice
  created_at          timestamptz not null default now()
);

create index waitlist_notifications_entry_idx on public.waitlist_notifications (waitlist_entry_id);
```

### RLS Policy Recommendation

Manager+ can INSERT/UPDATE/SELECT `waitlist_entries`. Bartenders: SELECT only (to see queue). `waitlist_notifications`: INSERT by service role only (edge function uses service role). SELECT by manager+.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone number parsing/validation | Custom regex | `libphonenumber-js` | MX carrier prefixes, 044/045 mobile patterns, international format variations; regex will have false negatives |
| E.164 formatting | Custom string manipulation | `libphonenumber-js parsePhoneNumber().format('E.164')` | Handles country codes, leading zeros, spaces |
| Quoted wait math | Complex SQL query per keypress | Pure TS function `computeQuotedWait()` in `shared/lib/waitlist-math.ts` | No DB round-trip; recomputes instantly on any queue/table state change |
| Tauri native notifications | Windows Toast COM API directly | `@tauri-apps/plugin-notification` | Plugin handles Windows WinRT notification API, permission prompts, cross-version compat |
| pg_net HTTP call | Postgres `http` extension or `pg_http` | `net.http_post()` | pg_net is async (non-blocking), already enabled on Supabase hosted; `http` extension blocks the transaction |

---

## WasenderAPI Integration

**Endpoint:** `POST https://www.wasenderapi.com/api/send-message` [VERIFIED: wasenderapi.com/api-docs/messages/send-text-message]

**Authentication:** `Authorization: Bearer <API_KEY>` header [VERIFIED: official docs]

**Request body:**
```json
{ "to": "+525512345678", "text": "Your message here" }
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": { "msgId": 100000, "jid": "+525512345678", "status": "in_progress" }
}
```
[VERIFIED: official docs]

**Error responses:** [ASSUMED from standard HTTP conventions — WasenderAPI-specific error format not fully documented in public docs]
- `429` — rate limited (Retry-After header may be present)
- `4xx` (likely `400`) — invalid phone number / malformed request
- `5xx` — WasenderAPI internal error

**No-retry policy in v1:** Per PRD — if 429 or any failure, log `status='failed'` in `waitlist_notifications`, surface in manager pane, allow manual re-send. No retry loop in edge function.

**Rate limiting strategy in edge function:** S5 PRD mandates "1 call per entry per 5 min" — enforce via checking `waitlist_notifications` for recent `sent` record with same `waitlist_entry_id` before calling API.

**API Key setup:**
```bash
supabase secrets set WASENDER_API_KEY=your_key_here
supabase secrets list  # verify
```
[VERIFIED: supabase.com/docs/guides/functions/secrets]

---

## Supabase Secrets vs. Vault

**Recommendation: Use `supabase secrets set`, NOT Vault**

Vault secrets and edge function secrets are two separate systems in Supabase. Vault secrets (stored in `vault.secrets` table) are NOT automatically available as `Deno.env.get()` in edge functions. Multiple GitHub issues reported in 2025 confirm that `Deno.env.get('VAULT_SECRET')` returns `undefined` for Vault-stored secrets.

Edge function secrets set via `supabase secrets set NAME=value` ARE available as `Deno.env.get('NAME')` immediately, without redeployment.

**The PRD (S5-04) says "Supabase Vault: store WASENDER_API_KEY"** — this should be interpreted as "store securely in Supabase project secrets", implemented via `supabase secrets set` for reliability. The operator runbook (S5-22) should document this distinction.

[CITED: github.com/supabase/supabase/issues/35232, github.com/supabase/supabase/issues/38329]

---

## Common Pitfalls

### Pitfall 1: pg_net trigger fires outside transaction (timing)
**What goes wrong:** Developer expects `net.http_post()` to execute immediately when the trigger fires. It is queued and dispatched only after the transaction commits.
**Why it happens:** pg_net is async by design to avoid blocking transactions.
**How to avoid:** Use `AFTER UPDATE` triggers (not `BEFORE`). Do not assume the edge function has been called before the DB operation returns to the client.
**Warning signs:** Edge function logs show calls arriving 100–500ms after the DB update.

### Pitfall 2: Vault secrets not accessible in edge functions
**What goes wrong:** `Deno.env.get('WASENDER_API_KEY')` returns `undefined`; edge function falls back to `channel='manager'` silently.
**Why it happens:** Vault and edge function secrets are different systems; only secrets set via `supabase secrets set` are in Deno environment.
**How to avoid:** Use `supabase secrets set WASENDER_API_KEY=...` as documented above. Test with `supabase secrets list`.
**Warning signs:** Edge function always returns `channel='manager'` even when phone is present.

### Pitfall 3: libphonenumber-js bundle size
**What goes wrong:** importing the full `libphonenumber-js` adds ~200KB to the bundle.
**Why it happens:** Full metadata for all countries included.
**How to avoid:** Import only `libphonenumber-js/min` for minimal bundle, or use named imports from `libphonenumber-js` which tree-shakes well with Vite 7. The PRD specifies MX/US validation only — `parsePhoneNumberFromString(raw, 'MX')` with no country metadata import beyond min is sufficient.
**Warning signs:** Bundle analyzer shows `libphonenumber-js` as top-5 largest module.

### Pitfall 4: Tauri notification plugin missing from Cargo.toml
**What goes wrong:** `import { sendNotification } from '@tauri-apps/plugin-notification'` compiles fine but throws at runtime because the Rust plugin was not registered.
**Why it happens:** Frontend package and Rust plugin are separate; both must be installed.
**How to avoid:** Run `npm run tauri add notification` which handles both sides. Verify `capabilities/default.json` has `"notification:default"`.
**Warning signs:** Tauri runtime logs "Plugin notification is not registered".

### Pitfall 5: FIFO sort broken by status transitions
**What goes wrong:** When an entry transitions from `waiting` to `notified`, it appears to jump position in the queue because the UI re-sorts by `created_at` but the filter changes.
**Why it happens:** FIFO sort is stable only when all `status` values are treated equally in the query, or when the displayed list filters only `waiting` entries.
**How to avoid:** Query `useWaitlistEntries` returns all non-cancelled, non-seated entries ordered by `created_at ASC`. The `partiesAhead` calculation in `computeQuotedWait` counts only `waiting` entries before the target entry.
**Warning signs:** Queue position numbers jump on notification send.

### Pitfall 6: Dual Realtime subscription channel name collision
**What goes wrong:** Two separate calls to `supabase.channel('waitlist:pos-sync')` in the same client create two connections, not one multiplexed one.
**Why it happens:** Supabase Realtime channels are identified by name; same name from same client = same subscription, but calling `.channel()` twice creates a second connection.
**How to avoid:** Use one channel with two `.on()` handlers (as shown in Pattern 4). The existing `PoolRealtimeListener` does this correctly.
**Warning signs:** Network tab shows two WebSocket connections to the Realtime URL.

### Pitfall 7: exactOptionalPropertyTypes in WaitlistEntrySchema
**What goes wrong:** Writing `tableId?: string` in create/update schemas causes TypeScript errors.
**Why it happens:** `exactOptionalPropertyTypes: true` is enabled.
**How to avoid:** Write `tableId: string | undefined` for optional mutation inputs. Use `.nullable().optional()` pattern consistent with Phase 6 decisions (see STATE.md).
**Warning signs:** `TS2412: The types of 'tableId' are incompatible`.

---

## Quoted-Wait Heuristic Implementation

```typescript
// src/shared/lib/waitlist-math.ts (pure function, no imports from entities)
// Source: S5-waitlist.md "Quoted-wait heuristic" section

export interface WaitlistMathInput {
  entries: Array<{
    id: string;
    partySize: number;
    status: 'waiting' | 'notified' | 'seated' | 'no_show' | 'cancelled';
    createdAt: Date;
    seatedAt: Date | null;
  }>;
  targetEntryId: string;
  availableTableCount: number;
  averageTurnMinutesByPartySize: Map<number, number>;  // from 7-day rolling avg query
}

export function computeQuotedWait(input: WaitlistMathInput): number {
  const target = input.entries.find(e => e.id === input.targetEntryId);
  if (!target) return 0;

  const avgTurn = input.averageTurnMinutesByPartySize.get(target.partySize) ?? 30; // 30min default

  const partiesAhead = input.entries.filter(
    e =>
      (e.status === 'waiting' || e.status === 'notified') &&
      e.partySize >= target.partySize &&
      e.createdAt < target.createdAt
  ).length;

  const tables = Math.max(1, input.availableTableCount);
  return Math.max(5, avgTurn * Math.ceil(partiesAhead / tables));
}
```

**DB query for rolling 7-day average:**
```sql
-- Used by useWaitlistAvgTurnBySize TanStack Query hook
select
  party_size,
  avg(extract(epoch from (seated_at - created_at)) / 60)::integer as avg_minutes
from waitlist_entries
where
  status = 'seated'
  and seated_at is not null
  and created_at > now() - interval '7 days'
group by party_size;
```

The `waitlist_entries_seated_at_party_idx` partial index defined in the schema section supports this query efficiently. [ASSUMED: no DB query plan verification possible without live schema]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | (project running) | — |
| libphonenumber-js | S5-06 phone validator | ✗ (not in package.json) | 1.12.42 latest | None — must install |
| @tauri-apps/plugin-notification | S5-19 Tauri notify | ✗ (not in Cargo.toml) | 2.x | Skip Tauri notify; manager pane only |
| Supabase CLI | supabase secrets set, db push | ✓ (used in previous phases) | (project running) | — |
| WasenderAPI account | S5-05 WhatsApp channel | Unknown — operator must set up | N/A | Runs in manager-only mode (feature flag) |
| pg_net extension | S5-03 trigger | ✓ (pre-enabled on Supabase hosted) [CITED: supabase.com/docs/guides/database/extensions/pg_net] | Latest | — |

**Missing dependencies that must be installed before implementation starts:**
- `libphonenumber-js` — `cd bar-pos && npm install libphonenumber-js`
- `tauri-plugin-notification` — `cd bar-pos && npm run tauri add notification`

**Missing with fallback:**
- WasenderAPI account: feature flag `waitlist_whatsapp_enabled` gates WhatsApp channel; manager-pane-only mode works without an account.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app.supabase_url` and `app.supabase_anon_key` can be set as DB settings; alternatively URL+key can be hardcoded in the trigger migration | pg_net trigger pattern | If neither approach works, pg_net trigger cannot pass auth to edge function — manual notification only |
| A2 | WasenderAPI returns HTTP 429 for rate-limit and HTTP 400 for invalid phone numbers | WasenderAPI Integration | If error codes differ, edge function error-code mapping will be wrong; `status='failed'` still written but error message may be misleading |
| A3 | HomeDashboard waiting-count badge requires component-level query rather than static config | Pattern 6 (Home tile) | If badge is not needed, static ITEMS array is sufficient; if needed, component refactor required |
| A4 | `waitlist_entries_seated_at_party_idx` partial index is sufficient for the 7-day avg query performance | Quoted-wait heuristic | On very low volume tables, index may not matter; on high volume, a materialized view or cron-updated cache may be needed |
| A5 | `status` column uses a text CHECK rather than a PG ENUM | Schema Design | ENUM requires a separate `ALTER TYPE ... NO TRANSACTION` migration step (as done in Phase 6 Plan 06-01); text + CHECK is simpler and avoids transaction wrapping |

---

## Open Questions (RESOLVED)

1. **pg_net trigger — hardcode URL or use DB settings?**
   - **RESOLVED: DB settings approach with COALESCE fallback (implemented in Plan 07-01 Task 2)**
   - What we know: Both approaches work; hardcoding is simpler for single-venue
   - Decision: Use DB settings approach (`alter database postgres set app.supabase_url`) with COALESCE fallback so the migration works even before settings are configured; document the required `SET` commands in the operator runbook

2. **WasenderAPI account — will it be live for E2E testing?**
   - **RESOLVED: E2E tests run against live state; edge function route interception used in Playwright for WasenderAPI calls (Plan 07-07)**
   - What we know: The feature flag allows WhatsApp-disabled mode
   - Decision: E2E spec mocks the edge function response via Playwright route interception; no live WasenderAPI calls in CI

3. **`manage_waitlist` RBAC action — new action or reuse existing?**
   - **RESOLVED: New `manage_waitlist` action added to MANAGER_EXTRA only (Plan 07-02 Task 3)**
   - What we know: No existing action covers waitlist management; `manage_products` is the closest analog (manager+)
   - Decision: Add `manage_waitlist` to `MANAGER_EXTRA` only; bartenders get SELECT via RLS but no UI action (not mentioned in S5 PRD)

---

## Code Examples

### Zod Schemas for domain.ts

```typescript
// Source: S5-waitlist.md ticket S5-07; follows existing schema patterns in domain.ts

export const WaitlistEntryStatusSchema = z.enum([
  'waiting',
  'notified',
  'seated',
  'no_show',
  'cancelled',
]);
export type WaitlistEntryStatus = z.infer<typeof WaitlistEntryStatusSchema>;

/** E.164 phone number (e.g. +525512345678). Validated client-side by libphonenumber-js. */
export const PhoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid E.164 phone number');

export const WaitlistEntrySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  partySize: z.number().int().min(1).max(20),
  phoneE164: PhoneE164Schema.nullable(),
  status: WaitlistEntryStatusSchema,
  tableId: UuidSchema.nullable(),
  seatedAt: TimestampSchema.nullable(),
  notifiedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export const WaitlistEntryCreateSchema = WaitlistEntrySchema.omit({
  id: true,
  status: true,
  tableId: true,
  seatedAt: true,
  notifiedAt: true,
  createdAt: true,
});

export const WaitlistNotificationSchema = z.object({
  id: UuidSchema,
  waitlistEntryId: UuidSchema,
  channel: z.enum(['whatsapp', 'manager']),
  status: z.enum(['sent', 'failed', 'pending']),
  providerMessageId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: TimestampSchema,
});

export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;
export type WaitlistEntryCreate = z.infer<typeof WaitlistEntryCreateSchema>;
export type WaitlistNotification = z.infer<typeof WaitlistNotificationSchema>;
```

### New AppErrorCode values (result.ts)

```typescript
// Add to AppErrorCode union:
| 'WAITLIST_ENTRY_NOT_FOUND'    // edge function: entry does not exist
| 'WAITLIST_NOTIFICATION_RATE_LIMITED'  // WasenderAPI 429
| 'WAITLIST_INVALID_PHONE'     // WasenderAPI 4xx invalid number
```

### New RBAC action (rbac.ts)

```typescript
// Add to STAFF_ACTIONS array:
'manage_waitlist',

// Add to MANAGER_EXTRA set:
'manage_waitlist',
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + React Testing Library 16 |
| Config file | `bar-pos/vite.config.ts` (vitest project `unit`) |
| Quick run command | `cd bar-pos && npx vitest run src/shared/lib/phone.test.ts src/shared/lib/waitlist-math.test.ts` |
| Full suite command | `cd bar-pos && npm run test` |
| Integration run | `cd bar-pos && npx vitest run src/entities/waitlist/model/waitlist-queries.integration.test.ts` |
| E2E run | `cd bar-pos && npx playwright test e2e/24-waitlist.spec.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| S5-01/02 | waitlist_entries + waitlist_notifications tables exist with correct schema | integration | `npx vitest run src/entities/waitlist/model/waitlist-queries.integration.test.ts` | ❌ Wave 0 |
| S5-03 | trigger fires edge fn on status→notified; notification row inserted | integration | `npx vitest run src/entities/waitlist/model/waitlist-queries.integration.test.ts` | ❌ Wave 0 |
| S5-05 | edge function returns success with WasenderAPI mock 200 | unit/contract | `npx vitest run src/features/notify-waitlist/send-waitlist-notification.test.ts` | ❌ Wave 0 |
| S5-05 | edge function records failure on 429 | unit/contract | same file | ❌ Wave 0 |
| S5-05 | edge function falls back to manager channel when no phone | unit/contract | same file | ❌ Wave 0 |
| S5-06 | `toE164('+52 55 1234 5678')` → `'+525512345678'` | unit | `npx vitest run src/shared/lib/phone.test.ts` | ❌ Wave 0 |
| S5-06 | `toE164('not a phone')` → `null` | unit | same | ❌ Wave 0 |
| S5-06 | MX bare number `'5512345678'` → `'+525512345678'` | unit | same | ❌ Wave 0 |
| S5-07 | `WaitlistEntrySchema.parse({...})` with valid/invalid data | unit | `npx vitest run src/shared/lib/domain.test.ts` (extend) | ❌ Wave 0 |
| S5-17 | `computeQuotedWait` returns `max(5, avgTurn * ceil(partiesAhead / tables))` | unit | `npx vitest run src/shared/lib/waitlist-math.test.ts` | ❌ Wave 0 |
| S5-17 | `computeQuotedWait` with 0 parties ahead returns `5` (minimum) | unit | same | ❌ Wave 0 |
| S5-17 | `computeQuotedWait` FIFO property: result is monotonically non-decreasing as parties-ahead increases | property | same (fast-check) | ❌ Wave 0 |
| S5-08 | `useWaitlistEntries()` returns sorted list; `useWaitlistEntry(id)` returns single | integration | waitlist-queries.integration.test.ts | ❌ Wave 0 |
| S5-09/10/11 | add entry → seat entry → status transitions | integration | waitlist-queries.integration.test.ts | ❌ Wave 0 |
| E2E | Full flow: add Alice+Bob, notify, seat, no-show | E2E | `npx playwright test e2e/24-waitlist.spec.ts` | ❌ Wave 0 |

### Nyquist Sampling — 3 Critical Paths

The three paths with the highest failure risk that must be sampled at every wave merge:

1. **Phone validation → entry creation → DB insert**
   `phone.test.ts` (unit) + integration test: `useAddWaitlistEntry` with valid/invalid E.164
   Command: `npx vitest run src/shared/lib/phone.test.ts`

2. **Status update → pg_net trigger → edge function → notification row**
   Integration test: update status to 'notified' via service-role client → wait ~500ms → query `waitlist_notifications` for row with `status='sent'` or `status='failed'`
   Command: `npx vitest run src/entities/waitlist/model/waitlist-queries.integration.test.ts`

3. **Edge function contract: WasenderAPI mock scenarios**
   Unit/contract tests with MSW mocking the WasenderAPI endpoint; verify all 4 scenarios (200, 429, 400, network error)
   Command: `npx vitest run src/features/notify-waitlist/send-waitlist-notification.test.ts`

### Wave 0 Gaps (files that must exist before implementation)

- [ ] `src/shared/lib/phone.test.ts` — covers S5-06 (12 unit test cases minimum)
- [ ] `src/shared/lib/waitlist-math.test.ts` — covers S5-17 including fast-check monotonicity property
- [ ] `src/entities/waitlist/model/waitlist-queries.integration.test.ts` — covers S5-08/09/10/11 + trigger integration
- [ ] `src/features/notify-waitlist/send-waitlist-notification.test.ts` — covers S5-05 (MSW contract; 4 scenarios)
- [ ] Framework install: libphonenumber-js `npm install libphonenumber-js`

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Edge function verifies JWT via `/auth/v1/user` (same pattern as `process-payment`) |
| V3 Session Management | no | No new session management |
| V4 Access Control | yes | `manage_waitlist` RBAC action; RLS on `waitlist_entries` manager+ write |
| V5 Input Validation | yes | `WaitlistEntrySchema` Zod validation + `PhoneE164Schema` + libphonenumber-js |
| V6 Cryptography | no | No new crypto; API key stored via `supabase secrets set` (server-side) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Phone number exfiltration | Information Disclosure | `phone_e164` never returned to bartender-role queries; RLS row filter |
| API key leakage via renderer | Information Disclosure | Key in edge function env only; renderer calls edge function via Supabase client (bearer token), never touches key |
| Trigger bypass (direct status UPDATE) | Tampering | RLS prevents status UPDATE by bartender; manager+ required for status changes |
| WasenderAPI rate limit abuse | Denial of Service | 1-notification-per-5-min guard in edge function checks `waitlist_notifications` for recent `sent` row |
| GDPR/phone data retention | Information Disclosure | Auto-purge `phone_e164` after 7 days (deferred to v2 per PRD, but must be documented in operator runbook) |

---

## Sources

### Primary (HIGH confidence)
- `bar-pos/supabase/functions/process-payment/index.ts` — edge function template (auth pattern, Zod parsing, CORS headers) [VERIFIED: file read]
- `bar-pos/src/app/PoolRealtimeListener.tsx` + `shared/lib/supabase-realtime.ts` — dual Realtime channel pattern [VERIFIED: file read]
- `bar-pos/src/app/kitchen-prep-route.tsx` — RBAC route guard pattern [VERIFIED: file read]
- `bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx` — Home tile ITEMS array pattern [VERIFIED: file read]
- `bar-pos/src/shared/lib/domain.ts` — existing Zod schema patterns [VERIFIED: file read]
- `bar-pos/src/shared/lib/result.ts` — AppErrorCode union [VERIFIED: file read]
- `bar-pos/src/shared/lib/rbac.ts` — STAFF_ACTIONS and role sets [VERIFIED: file read]
- `bar-pos/src-tauri/capabilities/default.json` — current capabilities (notification NOT present) [VERIFIED: file read]
- `bar-pos/src-tauri/Cargo.toml` — current Rust deps (notification plugin NOT present) [VERIFIED: file read]
- `bar-pos/package.json` — confirmed libphonenumber-js NOT installed [VERIFIED: file read]
- WasenderAPI official docs — endpoint URL, method, request schema, success response [VERIFIED: wasenderapi.com/api-docs/messages/send-text-message]
- Supabase edge function secrets docs — `supabase secrets set` CLI pattern [VERIFIED: supabase.com/docs/guides/functions/secrets]
- Tauri v2 notification plugin docs — install command, JS import, capabilities config [VERIFIED: v2.tauri.app/plugin/notification/]
- Supabase pg_net docs — `net.http_post()` trigger syntax [VERIFIED: supabase.com/docs/guides/database/extensions/pg_net]

### Secondary (MEDIUM confidence)
- `npm view libphonenumber-js version` → 1.12.42 [VERIFIED: npm registry via Bash]
- Supabase GitHub discussion #28341 + #37591 — pg_net trigger pattern for calling edge functions [CITED: github.com/orgs/supabase/discussions]

### Tertiary (LOW confidence)
- WasenderAPI error codes (429 / 400 / 5xx) — inferred from standard HTTP conventions; WasenderAPI error codes page not fully scraped [ASSUMED per A2]
- Supabase Vault + edge function bug — active issues #35232 and #38329 as of April–August 2025 [CITED: github.com/supabase/supabase/issues/35232]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries verified in package.json/Cargo.toml; new deps verified via npm and Tauri docs
- WasenderAPI integration: HIGH (endpoint/request/response) / LOW (error codes not fully documented publicly)
- pg_net trigger pattern: MEDIUM — syntax verified from Supabase docs; exact URL injection approach has one assumed decision
- Architecture patterns: HIGH — all patterns verified by reading existing project files
- Pitfalls: HIGH — sourced from verified project decisions in STATE.md and confirmed 2025 GitHub issues

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable libraries); WasenderAPI rate limits LOW confidence finding needs re-verification if actual rate limiting is hit
