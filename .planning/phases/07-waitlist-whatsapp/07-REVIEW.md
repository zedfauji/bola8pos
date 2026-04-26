---
phase: 07-waitlist-whatsapp
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql
  - bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql
  - bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql
  - bar-pos/supabase/functions/send-waitlist-notification/index.ts
  - bar-pos/src/shared/lib/phone.ts
  - bar-pos/src/shared/lib/waitlist-math.ts
  - bar-pos/src/shared/lib/tauri-notify.ts
  - bar-pos/src/shared/lib/domain.ts
  - bar-pos/src/shared/lib/result.ts
  - bar-pos/src/shared/lib/rbac.ts
  - bar-pos/src/entities/waitlist/model/types.ts
  - bar-pos/src/entities/waitlist/model/queries.ts
  - bar-pos/src/entities/waitlist/model/store.ts
  - bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.tsx
  - bar-pos/src/entities/waitlist/index.ts
  - bar-pos/src/app/WaitlistRealtimeListener.tsx
  - bar-pos/src/features/add-waitlist-entry/model/useAddWaitlistEntry.ts
  - bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx
  - bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts
  - bar-pos/src/features/notify-waitlist/ui/NotifyButton.tsx
  - bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts
  - bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx
  - bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts
  - bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts
  - bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx
  - bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx
  - bar-pos/src/pages/waitlist/index.tsx
  - bar-pos/src/app/waitlist-route.tsx
  - bar-pos/src/app/router.tsx
  - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 7 introduces the waitlist + WhatsApp notification feature across three DB migrations, one Deno edge function, shared utilities, a complete entity slice, five feature hooks/UIs, two widgets, a page, and route wiring. The overall structure is sound and follows FSD conventions well. The `any` casts are correctly gated behind `eslint-disable` comments with regeneration notes.

Two critical issues require fixes before release: the `/waitlist` route is not registered in `router.tsx` (the feature is completely inaccessible at runtime), and the `pool_tables` DB query in `SeatPartySheet` selects a column (`name`) that does not exist in the `pool_tables` schema, causing a runtime Supabase error when the seat sheet opens.

Six warnings cover missing status-guard logic (double-notifying / double-seating), the rate-limit audit-row insert error going silently swallowed, unhandled `seatParty` mutation rejection, and the `computeQuotedWait` floor being bypassed in the card. Four info items note the hardcoded average-turn map, duplicate `usePoolTables` hooks, and a minor `noUncheckedIndexedAccess` footgun.

---

## Critical Issues

### CR-01: `/waitlist` route not registered — page is unreachable

**File:** `bar-pos/src/app/router.tsx:1-133`
**Issue:** `WaitlistPage` and `WaitlistRoute` are never imported or added to the `<Routes>` tree. The Waitlist tile on the home dashboard navigates to `/waitlist`, but that path falls through to nothing (no 404 handler exists either — the user sees a blank screen). The `WaitlistRoute` guard and `WaitlistRealtimeListener` are also never mounted because there is no route entry to trigger them.
**Fix:**
```tsx
// In router.tsx — add these imports at the top
import { WaitlistRoute } from './waitlist-route';
const WaitlistPage = lazy(() => import('../pages/waitlist'));

// Add this <Route> block inside <Routes>, alongside the other protected routes
<Route
  path="/waitlist"
  element={
    <ProtectedRoute>
      <WaitlistRoute>
        <WaitlistPage />
      </WaitlistRoute>
    </ProtectedRoute>
  }
/>
```

### CR-02: `SeatPartySheet` queries non-existent `name` column on `pool_tables`

**File:** `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx:38-46`
**Issue:** The inline `usePoolTables` hook selects `id, name, status` from `pool_tables`. The `pool_tables` schema (defined in `domain.ts` `PoolTableSchema`) has a `label` field and a `number` field — there is no `name` column. The same mismatch exists in `WaitlistQueue`'s `usePoolTablesCount` (line 32). The Supabase query will succeed (PostgREST ignores unknown column names for `select('id,name,status')` only when the column actually exists; otherwise it returns a PostgREST error). At runtime the table picker in `SeatPartySheet` will show blank names and the seat action will set `tableName: undefined` in the toast.
**Fix:**
```tsx
// SeatPartySheet.tsx — line 25, 38-39
type PoolTable = {
  id: string;
  label: string;   // was: name
  number: number;  // add — needed for a useful display name
  status: string;
};

// line 38
.select('id, label, number, status')

// line 88-89 in handleSeat
tableName: `Table ${String(table.number)} – ${table.label}`,

// Apply the same fix to WaitlistQueue's usePoolTablesCount (line 32) and
// PoolTableOccupancyPanel's usePoolTables (line 21):
.select('id, label, number, status')
```

---

## Warnings

### WR-01: No guard against notifying an already-notified entry — status is overwritten silently

**File:** `bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts:26-32`
**Issue:** The mutation updates `status → 'notified'` unconditionally. If a manager clicks "Notify" twice in quick succession (or the first click is slow), two `UPDATE` calls fire. The DB trigger `trg_waitlist_notify` fires on every `UPDATE OF status`, so the condition `NEW.status = 'notified' AND OLD.status IS DISTINCT FROM 'notified'` protects against re-triggering the edge function. However the client-side rate-limit in the edge function logs a `failed` audit row and returns 429, which the feature hook does not check — the WhatsApp toast fires as `success` even when the edge function returned 429 because the hook only checks whether the Supabase UPDATE succeeded.

Additionally, entries with `status = 'notified'` still show the "Notify via WhatsApp" button (it is hidden only when `status !== 'waiting'`), so repeated clicking is easy.
**Fix:**
```ts
// In useNotifyWaitlist.ts mutationFn, add a guard before the UPDATE:
// Option A: client-side — disable button when status !== 'waiting' (already done via notifySlot
// only rendered for 'waiting' entries in WaitlistEntryCard line 195, but the button's own hook
// has no guard). Add to mutationFn:
// (already protected at the widget layer — acceptable as-is if WR-02 is addressed)

// Option B (recommended): check the edge function response via broadcast/realtime and surface
// 429 errors as toast.error. At minimum, document that the DB trigger prevents double-send.
```

### WR-02: `seatParty` `mutateAsync` rejection is unhandled in `WaitlistQueue`

**File:** `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx:133-135`
**Issue:** `markNoShow` and `markCancelled` are called with `void` (acceptable because TanStack Query catches rejections internally). But for `onSeat`, the widget calls `setSeatEntryId(id)` and opens `SeatPartySheet`. Inside `SeatPartySheet.handleSeat` (line 80), `seatParty` is awaited and `mutateAsync` is used — if the network is offline or Supabase errors, `mutateAsync` throws. The `catch` is missing; an unhandled promise rejection will propagate. The `useSeatWaitlistParty` hook returns the result through `onSuccess`, but `mutateAsync` with a `Result<void>` pattern means the thrown error bypasses `onSuccess` entirely if the Supabase call itself throws rather than returning an error object.
**Fix:**
```ts
// SeatPartySheet.tsx handleSeat — wrap in try/catch
async function handleSeat() {
  if (!selectedTableId || isPending) return;
  const table = tables.find((t) => t.id === selectedTableId);
  if (!table) return;
  try {
    const result = await seatParty({ ... });
    if (result.ok) handleClose();
  } catch {
    // toast is shown by onSuccess(err), but mutateAsync can still throw
    // if TanStack Query propagates the rejection
  }
}
```

### WR-03: Rate-limit audit-row INSERT error is silently swallowed in edge function

**File:** `bar-pos/supabase/functions/send-waitlist-notification/index.ts:96-103`
**Issue:** When the rate-limit guard fires, the code inserts a `failed/rate_limited` audit row but never checks the insert's error return. If the service-role INSERT into `waitlist_notifications` itself fails (e.g. FK violation if the entry was deleted between the check and the insert), the error is silently dropped and the function returns 429 anyway.
**Fix:**
```ts
const { error: rateLimitAuditErr } = await admin.from('waitlist_notifications').insert({ ... });
if (rateLimitAuditErr) {
  console.error('rate-limit audit insert failed', rateLimitAuditErr.message);
  // non-blocking — still return 429
}
return jsonResponse({ success: false, error: { code: 'RATE_LIMITED' } }, 429);
```

### WR-04: `computeQuotedWait` returns `0` for an unknown `targetEntryId` — WaitlistEntryCard ignores it

**File:** `bar-pos/src/shared/lib/waitlist-math.ts:32-33` and `bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.tsx:143`
**Issue:** `computeQuotedWait` returns `0` when the `targetEntryId` is not found in the `entries` array. In `WaitlistEntryCard`, the display logic is `const displayWait = Math.max(5, quotedWait)`, which masks a `0` return with `5`. However the card always shows "~5 min wait" for any entry that has not been found, which is misleading. More importantly, `WaitlistQueue` calls `computeQuotedWait` inside a `getQuotedWait` function (line 64), which passes the result directly to the card — if `entries` has been stale-fetched and a card receives a new `entryId` before the list refreshes, it silently shows 5 minutes. The real issue is the caller does not distinguish between "computed 0 parties ahead = instant" vs "entry not found".
**Fix:**
```ts
// waitlist-math.ts: return null when entry not found, to distinguish from 0 wait
export function computeQuotedWait(input: WaitlistMathInput): number | null {
  const target = input.entries.find(e => e.id === input.targetEntryId);
  if (!target) return null;
  // ... rest unchanged
}
// WaitlistQueue.getQuotedWait: treat null as unknown (show floor)
// WaitlistEntryCard: accept quotedWait: number | null and render "~5 min wait" only when non-null
```

### WR-05: `WaitlistRealtimeListener` not mounted — no Realtime invalidation

**File:** `bar-pos/src/app/router.tsx:1-133` (absence of mount point)
**Issue:** `WaitlistRealtimeListener` is defined in `src/app/WaitlistRealtimeListener.tsx` but is never imported or rendered anywhere in the app. It is not mounted in `router.tsx`, in any layout component, or in `WaitlistPage`. Without it, Supabase Realtime changes to `waitlist_entries` will not trigger query invalidation — the queue will only update on manual refetch or staleTime expiry (30 s). This degrades the real-time UX significantly.
**Fix:**
```tsx
// Mount alongside other app-level listeners, e.g. in App.tsx or router.tsx:
import { WaitlistRealtimeListener } from './WaitlistRealtimeListener';

// Inside the Router function, adjacent to <HelpSheet />:
<WaitlistRealtimeListener />
```

### WR-06: `pool_tables` query in `SeatPartySheet` uses wrong status values for filtering

**File:** `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx:72-73`
**Issue:** The component filters available tables by `status === 'available' || status === 'idle' || status === 'free'`. The canonical `PoolTableStatus` enum in `domain.ts` only includes `'available' | 'occupied' | 'reserved' | 'maintenance'`. The values `'idle'` and `'free'` do not exist in the DB schema. Any table whose status is `'reserved'` or `'maintenance'` will appear in the occupied list (correct), but tables with `status = 'available'` will always be shown correctly. The bug is that filtering by phantom values adds dead code that does nothing, and if the schema ever adds `'maintenance'` it will be categorised as occupied — which is probably fine — but `'reserved'` tables will also be marked occupied and clickable. The same pattern exists in `WaitlistQueue` (line 59) and `PoolTableOccupancyPanel` (line 39, 75).
**Fix:**
```ts
// Use the canonical set — remove 'idle' and 'free':
const availableTables = tables.filter((t) => t.status === 'available');
```

---

## Info

### IN-01: Average-turn map is hardcoded — quoted wait is always wrong for party sizes outside {2, 4}

**File:** `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx:62`
**Issue:** `avgTurnMap` is hardcoded to `Map([[2, 30], [4, 45]])`. Any party size that is not 2 or 4 falls back to the 30-minute default in `computeQuotedWait`. The code comment acknowledges this ("real avg would come from useWaitlistAvgTurnBySize"), but no such hook exists yet. This means the quoted-wait display is placeholder data for all real-world party sizes. Not a bug per se, but should be tracked as a follow-up before launch.

### IN-02: Duplicate `usePoolTables` inline query in three places

**File:** `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx:33-47`, `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx:28-41`, `bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx:17-30`
**Issue:** Three separate components define an identical inline `usePoolTables` hook querying `pool_tables` with `queryKey: ['pool_tables']`. They share the same TanStack Query key, so they hit the cache, but the three function definitions are pure duplication and each one selects slightly different columns (`id, name, status` vs `id, label, number, status` after the fix in CR-02). Once `pool_tables` has a proper entity slice, these should be extracted.

### IN-03: `tauri-notify.ts` — `sendNotification` return value is unawaited

**File:** `bar-pos/src/shared/lib/tauri-notify.ts:21`
**Issue:** `sendNotification({ title, body })` is a Tauri async call but its return value is not awaited. The function signature `async function sendManagerNotification` implies async work, but the last call is fire-and-forget. In the Tauri plugin, `sendNotification` is `void`-returning in the JS bindings, so this is not a correctness bug — but it is worth noting that permission errors from `sendNotification` will be silently dropped.

### IN-04: `noUncheckedIndexedAccess` footgun in `useWaitlistLastNotificationsMap`

**File:** `bar-pos/src/entities/waitlist/model/queries.ts:164-167`
**Issue:** The loop accesses `row['waitlist_entry_id'] as string` without a null-check. With `noUncheckedIndexedAccess: true`, `row['waitlist_entry_id']` is `unknown`, and the `as string` cast bypasses the check. If the DB ever returns a row where `waitlist_entry_id` is null (which the schema allows to cascade to null on delete), `entryId` will be `null`, and `!(null in map)` will be true — inserting a `null` key into the map. The downstream `notificationsMap[entry.id] ?? null` access would never match, so no data corruption occurs, but the stale null-keyed entry accumulates.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
