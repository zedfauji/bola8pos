# Phase 7: Waitlist + WhatsApp — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 19 new/modified files
**Analogs found:** 18 / 19

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260501000001_waitlist_entries.sql` | migration | CRUD | `supabase/migrations/20260429000001_prep_productions_table.sql` | exact |
| `supabase/migrations/20260501000002_waitlist_notifications.sql` | migration | CRUD | `supabase/migrations/20260429000001_prep_productions_table.sql` | role-match |
| `supabase/migrations/20260501000003_waitlist_notify_trigger.sql` | migration | event-driven | `supabase/migrations/20260429000003_prep_productions_trigger.sql` | role-match |
| `supabase/functions/send-waitlist-notification/index.ts` | edge-function | request-response | `supabase/functions/process-payment/index.ts` | exact |
| `src/shared/lib/phone.ts` | utility | transform | `src/shared/lib/domain-helpers.ts` (pure fn pattern) | role-match |
| `src/shared/lib/waitlist-math.ts` | utility | transform | `src/shared/lib/domain-helpers.ts` (computeDepletion pure fn) | exact |
| `src/shared/lib/tauri-notify.ts` | utility | event-driven | No existing analog | none |
| `src/entities/waitlist/model/types.ts` | model | CRUD | `src/entities/recipe/model/types.ts` | exact |
| `src/entities/waitlist/model/queries.ts` | model | CRUD | `src/entities/prep/model/queries.ts` | exact |
| `src/entities/waitlist/model/store.ts` | model | event-driven | `src/entities/tab/model/store.ts` | role-match (lightweight — no offline queue needed) |
| `src/entities/waitlist/index.ts` | barrel | — | `src/entities/prep/index.ts` | exact |
| `src/entities/waitlist/ui/WaitlistEntryCard.tsx` | component | request-response | `src/entities/prep/ui/PrepOnHandCard.tsx` + `src/entities/pool-table/ui/PoolTableCard.tsx` | role-match |
| `src/features/add-waitlist-entry/model/useAddWaitlistEntry.ts` | feature-hook | CRUD | `src/entities/prep/model/queries.ts` (`useMutationCreatePrepProduction`) | exact |
| `src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` | feature-ui | request-response | `src/features/produce-prep-batch/ui/PrepProductionForm.tsx` (Sheet variant) | role-match |
| `src/features/notify-waitlist/model/useNotifyWaitlist.ts` | feature-hook | request-response | `src/features/void-order/model/useVoidOrder.ts` | exact |
| `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` | feature-hook | CRUD | `src/features/void-order/model/useVoidOrder.ts` | role-match |
| `src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` | feature-hook | CRUD | `src/features/void-order/model/useVoidOrder.ts` | role-match |
| `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | widget | CRUD | `src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx` | exact |
| `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | widget | CRUD | `src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx` (structure) + pool-table entity | role-match |
| `src/pages/waitlist/index.tsx` | page | request-response | `src/pages/kitchen-prep/index.tsx` | exact |
| `src/app/WaitlistRealtimeListener.tsx` | app-component | event-driven | `src/app/PoolRealtimeListener.tsx` | exact |
| `src/app/waitlist-route.tsx` | route-guard | request-response | `src/app/kitchen-prep-route.tsx` | exact |
| `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (modified) | widget | request-response | self | — |

---

## Pattern Assignments

### `supabase/migrations/20260501000001_waitlist_entries.sql` (migration, CRUD)

**Analog:** `bar-pos/supabase/migrations/20260429000001_prep_productions_table.sql`

**Core migration pattern** (lines 1–34):
```sql
-- Migration: <table_name> table + RLS + indexes
-- Idempotent: IF NOT EXISTS / OR REPLACE guards throughout

CREATE TABLE IF NOT EXISTS <table_name> (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Read policy (authenticated)
CREATE POLICY "<table>_select_authenticated" ON <table_name>
  FOR SELECT TO authenticated USING (true);

-- Write policy (role-gated)
CREATE POLICY "<table>_insert_manager" ON <table_name>
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('manager', 'admin'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_<table>_created_at
  ON <table_name> (created_at ASC);
```

**Key differences for waitlist_entries:** Uses `text CHECK` for `status` (not an enum — avoids `ALTER TYPE ... NO TRANSACTION` wrapper). Also needs a `partial index` on `(party_size, seated_at) WHERE status = 'seated'` for the quoted-wait 7-day avg query.

---

### `supabase/migrations/20260501000003_waitlist_notify_trigger.sql` (migration, event-driven)

**Analog:** `bar-pos/supabase/migrations/20260429000003_prep_productions_trigger.sql`

**Trigger function pattern** (lines 1–86 of analog):
```sql
CREATE OR REPLACE FUNCTION fn_<name>()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: only fire on specific transition
  IF NEW.status = 'notified' AND (OLD.status IS DISTINCT FROM 'notified') THEN
    -- fire pg_net HTTP POST
  END IF;
  RETURN NEW;
END;
$$;

-- Drop-and-recreate pattern for idempotency
DROP TRIGGER IF EXISTS trg_<name> ON <table>;

CREATE TRIGGER trg_<name>
  AFTER UPDATE OF status ON waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_<name>();
```

**Key difference:** Uses `net.http_post()` (pg_net, async) instead of `PERFORM record_stock_movement()`. Must be `AFTER UPDATE` (not `AFTER INSERT`) and guard with `OLD.status IS DISTINCT FROM 'notified'` to prevent duplicate calls on other UPDATE events.

---

### `supabase/functions/send-waitlist-notification/index.ts` (edge-function, request-response)

**Analog:** `bar-pos/supabase/functions/process-payment/index.ts`

**Imports pattern** (lines 1–3):
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
```

**CORS headers + jsonResponse helper** (lines 48–58):
```typescript
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
```

**Entry point + CORS preflight** (lines 81–88):
```typescript
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }
```

**Auth verification pattern — ES256-safe** (lines 90–119):
```typescript
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, error: { code: 'CONFIG', message: 'Server misconfigured' } }, 500);
  }

  // admin.auth.getUser() fails with ES256 tokens — use direct HTTP call instead
  const token = authHeader.slice(7);
  const authVerifyResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
  });
  if (!authVerifyResp.ok) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }, 401);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
```

**Body parsing pattern** (lines 122–143):
```typescript
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse({ success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, 400);
  }

  const parsed = BodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonResponse(
      { success: false, error: { code: 'VALIDATION_ERROR', message: JSON.stringify(parsed.error.flatten().fieldErrors) } },
      400
    );
  }
```

**Env var for API key** (new — no analog; follows Deno.env.get pattern):
```typescript
  const wasenderApiKey = Deno.env.get('WASENDER_API_KEY'); // set via: supabase secrets set WASENDER_API_KEY=...
```

---

### `src/shared/lib/phone.ts` (utility, transform)

**Analog:** `src/shared/lib/domain-helpers.ts` (pure function pattern — no imports from entities)

**Pattern:** Pure export functions, no default export, no entity imports. Pattern from `computeDepletion` in `domain-helpers.ts` confirmed via `depletion.test.ts` lines 1–52:
```typescript
// Zero imports from entities or features
// Named function exports only
// Returns typed value or null (no Result<T> — pure transform, not DB operation)

export function toE164(raw: string): string | null { ... }
export function isE164(value: string): boolean { ... }
```

---

### `src/shared/lib/waitlist-math.ts` (utility, transform)

**Analog:** `src/shared/lib/domain-helpers.ts` (`computeDepletion` pattern)

**Test file pattern** (`src/shared/lib/depletion.test.ts` lines 1–7):
```typescript
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
// fast-check import PRECEDES vitest import (project ESLint rule)

describe('computeQuotedWait', () => {
  it('...', () => { ... });
  // Property-based test with fc.assert(fc.property(...))
});
```

**Pure function shape:** Takes a plain input struct; returns a number. No `Result<T>` — pure computation. Export named function only, no default.

---

### `src/shared/lib/tauri-notify.ts` (utility, event-driven)

**No existing analog** — first Tauri plugin integration in the codebase. Use the pattern from RESEARCH.md Pattern 5 directly:
```typescript
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
  if (!permissionGranted) return; // silently skip
  sendNotification({ title, body });
}
```

---

### `src/entities/waitlist/model/types.ts` (model, CRUD)

**Analog:** `src/entities/recipe/model/types.ts`

**Full file pattern** (lines 1–24 — complete file, re-exports from domain.ts only):
```typescript
/**
 * entities/waitlist/model/types.ts
 *
 * Re-exports from domain.ts. Single source of truth is domain.ts;
 * this file exists to keep FSD layer imports consistent.
 */
export type {
  WaitlistEntry,
  WaitlistEntryCreate,
  WaitlistNotification,
  WaitlistEntryStatus,
} from '@shared/lib/domain';

export {
  WaitlistEntrySchema,
  WaitlistEntryCreateSchema,
  WaitlistNotificationSchema,
  WaitlistEntryStatusSchema,
  PhoneE164Schema,
} from '@shared/lib/domain';
```

No logic in this file — it is a pure re-export barrel.

---

### `src/entities/waitlist/model/queries.ts` (model, CRUD)

**Analog:** `src/entities/prep/model/queries.ts`

**Imports pattern** (lines 1–14 of analog):
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/waitlist/model/queries.ts
 *
 * TanStack Query hooks for waitlist data.
 * Uses `const db = supabase as any` pre-regen cast — waitlist_entries table
 * not yet in supabase.types.ts. Regenerate after migrations applied.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WaitlistEntrySchema, WaitlistNotificationSchema } from '@shared/lib/domain';
import type { WaitlistEntry, WaitlistEntryCreate } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;
```

**Query key factory pattern** (lines 14–18 of analog):
```typescript
export const waitlistKeys = {
  all: ['waitlist_entries'] as const,
  lists: () => [...waitlistKeys.all, 'list'] as const,
  detail: (id: string) => [...waitlistKeys.all, 'detail', id] as const,
  waitingCount: () => [...waitlistKeys.all, 'waiting-count'] as const,
};
```

**useQuery hook pattern** (lines 51–68 of analog):
```typescript
export function useWaitlistEntries() {
  return useQuery({
    queryKey: waitlistKeys.lists(),
    queryFn: async (): Promise<WaitlistEntry[]> => {
      const { data, error } = await db
        .from('waitlist_entries')
        .select('*')
        .not('status', 'in', '("seated","cancelled")')
        .order('created_at', { ascending: true }); // FIFO
      if (error) {
        logger.error('useWaitlistEntries: query failed', { error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapWaitlistEntryRow);
    },
    staleTime: 30 * 1000,
  });
}
```

**useMutation pattern** (lines 70–114 of analog — `useMutationCreatePrepProduction`):
```typescript
export function useMutationUpdateWaitlistStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; status: WaitlistEntryStatus; tableId?: string }): Promise<Result<WaitlistEntry>> => {
      const { data, error } = await db
        .from('waitlist_entries')
        .update({ status: input.status, table_id: input.tableId ?? null })
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        logger.error('useMutationUpdateWaitlistStatus: update failed', { error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message?: string }).message ?? '' });
      }

      const parsed = WaitlistEntrySchema.safeParse(mapWaitlistEntryRow(data as Record<string, unknown>));
      if (!parsed.success) {
        return err({ code: 'VALIDATION_ERROR', message: 'Invalid waitlist entry returned' });
      }
      return ok(parsed.data);
    },
    onSuccess: (result) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });
}
```

---

### `src/entities/waitlist/index.ts` (barrel, —)

**Analog:** `src/entities/prep/index.ts` (lines 1–5 — complete file)

```typescript
export { waitlistKeys, useWaitlistEntries, useWaitlistEntry, useWaitlistWaitingCount,
         useMutationAddWaitlistEntry, useMutationUpdateWaitlistStatus } from './model/queries';
export type { WaitlistEntry, WaitlistEntryCreate, WaitlistNotification, WaitlistEntryStatus } from './model/types';
export { WaitlistEntrySchema, WaitlistEntryCreateSchema } from './model/types';
export { WaitlistEntryCard } from './ui/WaitlistEntryCard';
```

**Rule:** No `export *` (banned by ESLint `no-restricted-syntax`). All exports must be explicit named exports.

---

### `src/entities/waitlist/ui/WaitlistEntryCard.tsx` (component, request-response)

**Analog 1:** `src/entities/prep/ui/PrepOnHandCard.tsx` — card layout, border colors using CSS variables
**Analog 2:** `src/entities/pool-table/ui/PoolTableCard.tsx` — action buttons in CardFooter, StatusBadge usage

**Imports pattern** (from PrepOnHandCard lines 1–2 + PoolTableCard lines 1–8):
```typescript
import type { WaitlistEntry, WaitlistNotification } from '@shared/lib/domain';
import { cn } from '@shared/lib/utils';
import { StatusBadge } from '@shared/ui';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@shared/ui/card';
import { BellRing, CheckSquare, Phone, PhoneOff, UserX, Users, X } from 'lucide-react';
```

**Card + status-based border pattern** (PrepOnHandCard lines 18–24):
```typescript
const cardClass =
  `rounded-lg border p-4 flex flex-col gap-2 min-h-[80px] ` +
  (entry.status === 'no_show'
    ? 'border-pos-danger bg-pos-danger/5'
    : entry.status === 'notified'
      ? 'border-pos-accent/50'
      : 'border-border');
```

**Storybook story file** must be co-located at `src/entities/waitlist/ui/WaitlistEntryCard.stories.tsx`. Import from `@storybook/react-vite` (not `@storybook/react`). See `src/entities/prep/ui/PrepOnHandCard.stories.tsx` for the exact story structure.

---

### `src/features/add-waitlist-entry/model/useAddWaitlistEntry.ts` (feature-hook, CRUD)

**Analog:** `src/entities/prep/model/queries.ts` (`useMutationCreatePrepProduction`, lines 70–114)

**Pattern:** Feature-layer hooks that only do DB mutations wrap the entity mutation; they add toast orchestration and error-code mapping. See `src/features/produce-prep-batch/model/useProducePrepBatch.ts` (lines 1–48) for the exact orchestration layer:

```typescript
import { toast } from 'sonner';
import { useMutationAddWaitlistEntry } from '@entities/waitlist';
import type { WaitlistEntryCreate } from '@entities/waitlist';
import type { Result } from '@shared/lib/result';

export function useAddWaitlistEntry() {
  const mutation = useMutationAddWaitlistEntry();

  async function addEntry(input: WaitlistEntryCreate): Promise<Result<WaitlistEntry>> {
    const result = await mutation.mutateAsync(input);
    if (result.ok) {
      toast.success(`${input.name} added to the waitlist.`);
      return result;
    }
    // error-code switch → toast.error(...)
    return result;
  }

  return { addEntry, isPending: mutation.isPending };
}
```

---

### `src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` (feature-ui, request-response)

**Analog:** `src/features/produce-prep-batch/ui/PrepProductionForm.tsx`

**Key pattern differences:** Phase 7 uses `Sheet` (not `Dialog`) — wider form, `side="right"`. The state management, `useReducer` + `RESET` action, and `handleClose` + `handleSubmit` pattern are identical.

**Imports pattern** (lines 1–23 of analog):
```typescript
import { useReducer } from 'react';
import { FormField, Input, Label, LoadingSpinner, POSButton } from '@shared/ui';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { useAddWaitlistEntry } from '../model/useAddWaitlistEntry';
```

**State + reducer pattern** (lines 26–50 of analog):
```typescript
type State = {
  name: string;
  partySize: number;
  phoneRaw: string;
  phoneError: boolean;
};

type Action =
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_PARTY_SIZE'; size: number }
  | { type: 'SET_PHONE'; raw: string }
  | { type: 'SET_PHONE_ERROR'; error: boolean }
  | { type: 'RESET' };
```

**isValid gate + submit pattern** (lines 86–100 of analog):
```typescript
const isValid =
  state.name.trim().length >= 1 &&
  (state.phoneRaw === '' || toE164(state.phoneRaw) !== null);

async function handleSubmit() {
  if (!isValid) return;
  const parsed = WaitlistEntryCreateSchema.safeParse({
    name: state.name.trim(),
    partySize: state.partySize,
    phoneE164: state.phoneRaw ? toE164(state.phoneRaw) : null,
  });
  if (!parsed.success) return;
  const result = await addEntry(parsed.data);
  if (result.ok) { handleClose(); }
}
```

**Footer buttons pattern** (lines 180–207 of analog):
```typescript
<SheetFooter className="px-6 pb-6 flex gap-3">
  <POSButton
    type="button"
    touchSize="large"
    variant="outline"
    disabled={isPending}
    onClick={handleClose}
  >
    Discard
  </POSButton>
  <POSButton
    type="button"
    touchSize="xl"
    disabled={!isValid || isPending}
    onClick={() => { void handleSubmit(); }}
  >
    {isPending ? <LoadingSpinner size={20} className="p-0" /> : 'Add to waitlist'}
  </POSButton>
</SheetFooter>
```

---

### `src/features/notify-waitlist/model/useNotifyWaitlist.ts` (feature-hook, request-response)

**Analog:** `src/features/void-order/model/useVoidOrder.ts`

**Full pattern** (lines 1–119 of analog):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { waitlistKeys } from '@entities/waitlist/model/queries';
import { logger } from '@shared/lib/logger';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { sendManagerNotification } from '@shared/lib/tauri-notify';

type NotifyWaitlistInput = {
  entryId: string;
  entryName: string;
  hasPhone: boolean;
};

export function useNotifyWaitlist() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: NotifyWaitlistInput): Promise<Result<void>> => {
      // UPDATE status → 'notified'; pg_net trigger fires edge function
      const { error } = await (supabase as any)
        .from('waitlist_entries')
        .update({ status: 'notified', notified_at: new Date().toISOString() })
        .eq('id', input.entryId);

      if (error) {
        logger.error('waitlist.notify.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }

      // Tauri fallback notification if no phone
      if (!input.hasPhone) {
        await sendManagerNotification('Party ready', `${input.entryName} is ready to be seated.`);
      }

      logger.info('waitlist.notify.succeeded', { entryId: input.entryId });
      return ok(undefined);
    },
    onSuccess: (_result) => {
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
    },
  });

  return {
    notifyEntry: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
```

---

### `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` (feature-hook, CRUD)

**Analog:** `src/features/void-order/model/useVoidOrder.ts` (mutation + invalidation shape)

**Core mutation shape** (from analog lines 37–119):
```typescript
export function useSeatWaitlistParty() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: { entryId: string; tableId: string }): Promise<Result<void>> => {
      const { error } = await (supabase as any)
        .from('waitlist_entries')
        .update({ status: 'seated', table_id: input.tableId, seated_at: new Date().toISOString() })
        .eq('id', input.entryId);

      if (error) {
        logger.error('waitlist.seat.failed', { ...input, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }
      logger.info('waitlist.seat.succeeded', input);
      return ok(undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });

  return { seatParty: mutation.mutateAsync, isPending: mutation.isPending };
}
```

---

### `src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` (feature-hook, CRUD)

**Analog:** `src/features/void-order/model/useVoidOrder.ts` (same mutation shape, simpler — no auxiliary calls)

Same pattern as `useSeatWaitlistParty` above but updates `status: 'no_show'` with no `table_id`. The `useMarkCancelled` hook (if separate) updates `status: 'cancelled'`.

---

### `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` (widget, CRUD)

**Analog:** `src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx`

**Imports pattern** (lines 1–9 of analog):
```typescript
import { Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddWaitlistEntryForm } from '@features/add-waitlist-entry';
import { SeatPartySheet } from '@features/seat-waitlist-party';
import { useWaitlistEntries, WaitlistEntryCard } from '@entities/waitlist';
import { usePoolTables } from '@entities/pool-table';
import { EmptyState, LoadingSkeletons, POSButton } from '@shared/ui';
import { computeQuotedWait } from '@shared/lib/waitlist-math';
```

**Section header + primary CTA button pattern** (lines 83–100 of analog):
```typescript
<div className="mb-4 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Users className="h-5 w-5" aria-hidden />
    <h2 className="text-lg font-semibold">Queue</h2>
  </div>
  <POSButton
    type="button"
    touchSize="large"
    aria-label="Add to waitlist"
    onClick={() => { setSheetOpen(true); }}
  >
    <Plus className="mr-2 h-4 w-4" aria-hidden />
    Add to waitlist
  </POSButton>
</div>
```

**Empty state pattern** (lines 101–107 of analog):
```typescript
{entries.length === 0 && !isLoading ? (
  <EmptyState
    icon={Users}
    title="No one waiting"
    description="Add a walk-in party using the 'Add to waitlist' button."
  />
) : isLoading ? (
  <LoadingSkeletons count={3} />
) : (
  // render entry cards
)}
```

---

### `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` (widget, CRUD)

**Analog:** `src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx` (structure) + `src/entities/pool-table/model/queries.ts` (data)

Reads from `usePoolTables()` (already exists — no new query needed). Renders a summary grid with available/occupied counts. Uses `--pos-accent` for available and `--pos-danger` for occupied (same CSS vars as `PrepOnHandCard`).

```typescript
import { usePoolTables } from '@entities/pool-table';
import { EmptyState } from '@shared/ui';
import { Table2 } from 'lucide-react';

export function PoolTableOccupancyPanel() {
  const { data: tables = [], isLoading } = usePoolTables();
  const available = tables.filter(t => t.status === 'available');
  const occupied = tables.filter(t => t.status !== 'available');
  ...
}
```

---

### `src/pages/waitlist/index.tsx` (page, request-response)

**Analog:** `src/pages/kitchen-prep/index.tsx` (lines 1–15 — complete file)

```typescript
import { WaitlistQueue } from '@widgets/WaitlistQueue';
import { PoolTableOccupancyPanel } from '@widgets/PoolTableOccupancyPanel';
import { BackToHomeButton, PageContainer } from '@shared/ui';

export default function WaitlistPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Waitlist">
          <div className="flex gap-8">
            <div className="flex-1">
              <WaitlistQueue />
            </div>
            <div className="min-w-[200px]">
              <PoolTableOccupancyPanel />
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
```

---

### `src/app/WaitlistRealtimeListener.tsx` (app-component, event-driven)

**Analog:** `src/app/PoolRealtimeListener.tsx` (lines 1–32 — complete file)

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { waitlistKeys } from '@entities/waitlist/model/queries';
import { poolTableKeys } from '@entities/pool-table/model/queries';
import { supabase } from '@shared/lib/supabase';

export function WaitlistRealtimeListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateWaitlist = () => {
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.all });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    };
    const invalidateTables = () => {
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
    };

    // One channel, multiple .on() handlers — do NOT create two separate channels
    const channel = supabase
      .channel('waitlist:pos-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries' }, invalidateWaitlist)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_tables' }, invalidateTables)
      .on('broadcast', { event: 'notified' }, invalidateWaitlist)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
```

---

### `src/app/waitlist-route.tsx` (route-guard, request-response)

**Analog:** `src/app/kitchen-prep-route.tsx` (lines 1–15 — complete file)

```typescript
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type WaitlistRouteProps = {
  children: ReactNode;
};

export function WaitlistRoute({ children }: WaitlistRouteProps) {
  const { can } = usePermissions();
  if (!can('manage_waitlist')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
```

---

### `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (modified widget, request-response)

**Self-analog** — modification of `src/widgets/HomeDashboard/ui/HomeDashboard.tsx`

**ITEMS array addition pattern** (lines 35–75 of HomeDashboard.tsx):
```typescript
// Add to ITEMS array — same shape as existing kitchen-prep entry (lines 57–62):
{
  path: '/waitlist',
  label: 'Waitlist',
  icon: ListOrdered,   // already imported in this file for use elsewhere; if not: import from lucide-react
  requiredAction: 'manage_waitlist',
  managerLabel: 'Manager',
},
```

**Waiting-count badge overlay pattern** — uses same `absolute` positioning as the existing `Lock` icon overlay (lines 131–137 of HomeDashboard.tsx):
```typescript
// Lock icon overlay (lines 131–137) — copy this pattern for the count badge:
{isGated && (
  <Lock
    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"
    aria-hidden="true"
    data-testid="lock-icon"
  />
)}

// Waiting-count badge: same absolute positioning, different corner
{isWaitlistTile && waitingCount > 0 && (
  <Badge
    variant="destructive"
    className="absolute -right-1 -top-1 h-5 min-w-[20px] rounded-full px-1 text-sm"
    aria-label={`Waitlist: ${String(waitingCount)} parties waiting`}
  >
    {waitingCount > 99 ? '99+' : waitingCount}
  </Badge>
)}
```

The `useWaitlistWaitingCount()` hook is called at the top of the `HomeDashboard` component (after the existing `usePermissions` + `useStaffStore` calls). It queries `count` on `waitlist_entries` where `status='waiting'`.

---

## Shared Patterns

### Result<T> Error Handling
**Source:** `src/shared/lib/result.ts`
**Apply to:** All feature mutation hooks (`useAddWaitlistEntry`, `useNotifyWaitlist`, `useSeatWaitlistParty`, `useMarkNoShow`)

All async mutation functions return `Result<T>` (`Ok(value)` / `Err(error)`). Pattern from `useVoidOrder.ts` lines 41–107:
```typescript
mutationFn: async (input): Promise<Result<void>> => {
  // ... operation ...
  if (error) {
    return err({ code: 'SUPABASE_ERROR', message: error.message });
  }
  return ok(undefined);
},
```

New `AppErrorCode` values to add to `result.ts` union before use:
- `'WAITLIST_ENTRY_NOT_FOUND'`
- `'WAITLIST_NOTIFICATION_RATE_LIMITED'`
- `'WAITLIST_INVALID_PHONE'`

### Logger Pattern
**Source:** `src/shared/lib/logger.ts` (or `logger-instance.ts`)
**Apply to:** All feature hooks and edge function

```typescript
// Renderer-side (features, entities)
import { logger } from '@shared/lib/logger';
logger.info('waitlist.seat.succeeded', { entryId });
logger.error('waitlist.notify.failed', { entryId, error });

// Edge function (Deno) — no logger import available; use console.error sparingly
// or omit (not required in edge functions per project rules)
```

### Toast Pattern
**Source:** `src/features/produce-prep-batch/model/useProducePrepBatch.ts` (lines 1–48)
**Apply to:** All feature-layer hooks (`useAddWaitlistEntry`, `useNotifyWaitlist`, `useSeatWaitlistParty`, `useMarkNoShow`)

```typescript
import { toast } from 'sonner';
// Success
toast.success(`${name} added to the waitlist.`);
// Error
toast.error('Something went wrong. Check your connection and try again.');
```

### supabase as any Pre-regen Cast
**Source:** `src/entities/recipe/model/queries.ts` line 17 + `src/entities/prep/model/queries.ts` line 12
**Apply to:** `src/entities/waitlist/model/queries.ts`, `src/features/notify-waitlist/model/useNotifyWaitlist.ts`, `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts`, `src/features/mark-waitlist-no-show/model/useMarkNoShow.ts`

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// Pre-regen cast — remove once supabase.types.ts is regenerated after waitlist migrations
const db = supabase as any;
```

### RBAC Action Registration
**Source:** `src/shared/lib/rbac.ts`
**Apply to:** `src/shared/lib/rbac.ts` (modification)

Before using `'manage_waitlist'` anywhere, it must be added to `STAFF_ACTIONS` array and to the `MANAGER_EXTRA` set. Pattern matches existing action additions (`produce_prep_batch`, `manage_settings`, etc.).

### Route Registration
**Source:** `src/app/router.tsx`
**Apply to:** `src/app/router.tsx` (modification)

New route must be added using the `WaitlistRoute` guard component, following the `kitchen-prep` route pattern in `router.tsx`.

### exactOptionalPropertyTypes Guard
**Apply to:** `WaitlistEntryCreate` schema + all mutation input types

Never write `tableId?: string`. Write `tableId: string | undefined`. This applies to all Zod schema definitions in `domain.ts` for the new waitlist schemas.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shared/lib/tauri-notify.ts` | utility | event-driven | No existing Tauri plugin integration in codebase. This is the first use of `@tauri-apps/plugin-notification`. Use RESEARCH.md Pattern 5 directly. Also requires Cargo.toml + capabilities/default.json updates (`npm run tauri add notification`). |

---

## Metadata

**Analog search scope:** `bar-pos/src/` (all FSD layers), `bar-pos/supabase/functions/`, `bar-pos/supabase/migrations/`
**Files scanned:** 22
**Pattern extraction date:** 2026-04-25
