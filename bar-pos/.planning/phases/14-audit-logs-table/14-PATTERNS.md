# Phase 14: Audit Logs Table - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 14 (mix of new files, modified migrations, and modified frontend files)
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<new>_record_audit_add_terminal_id.sql` | migration | transform (DDL, CREATE OR REPLACE FUNCTION) | `supabase/migrations/20260511000001_audit_logs_table.sql` (record_audit def) | exact |
| `supabase/migrations/<new>_caja_open_rpc.sql` | migration | CRUD (INSERT wrapper) | `supabase/migrations/20260511000002_rpc_audit_wiring.sql` (`close_caja_session`) | role-match (direct-INSERT→RPC wrapper, no exact precedent exists in-repo — closest is the close_caja_session UPDATE+audit shape) |
| `supabase/migrations/<new>_close_tab_rpc.sql` (or client-side Pattern 3) | migration / service | CRUD | `src/entities/tab/model/queries.ts` `useMutationUpdateTabStatus` (lines ~752-867, version-guard) + `process_payment_atomic` audit block | role-match |
| `supabase/migrations/<new>_produce_prep_batch_rpc.sql` | migration | CRUD | `supabase/migrations/20260511000002_rpc_audit_wiring.sql` (`add_combo_to_tab`) | role-match |
| `supabase/migrations/<new>_wire_transfer_tab_audit.sql` | migration | CRUD (PATCH existing fn) | `supabase/migrations/20260511000002_rpc_audit_wiring.sql` (`process_refund`, `close_caja_session` — same PERFORM pattern) | exact |
| `supabase/migrations/<new>_wire_record_stock_movement_audit.sql` | migration | CRUD (PATCH existing fn) | same file, same PERFORM pattern | exact |
| `supabase/functions/_shared/audit.ts` (MODIFY: add `actorId`) | utility (service) | request-response | itself (already read in full) | exact — extend in place |
| `supabase/functions/void-order/index.ts` (build or recover) | route (edge function) | request-response | `supabase/functions/process-payment/index.ts` (closest sensitive-mutation edge fn — not read here but is the standard shape referenced by `_shared/audit.ts` docstring) | role-match — must be located/read by planner before writing |
| `src/app/audit-route.tsx` | route guard (provider) | request-response | `src/app/reports-route.tsx` | exact |
| `src/pages/audit/index.tsx` | route (page) | request-response | `src/pages/reports/index.tsx` | role-match (Reports uses Tabs of many panels; Audit is a single filtered table — closer in shape to a single-panel page, but Reports is the only page-level analog with `BackToHomeButton` + filter-driven panel composition) |
| `src/widgets/AuditLogTable/AuditLogTable.tsx` | component (widget) | streaming (infinite scroll) | No existing infinite-scroll widget analog in codebase (per RESEARCH.md — `useInfiniteQuery` is net-new). Closest structural analog: `src/widgets/RefundsRegister` or `src/widgets/IngredientsTable` (filter bar + table list) | role-match, data-flow gap (no infinite-scroll precedent) |
| `src/widgets/AuditLogTable/AuditLogFilterBar.tsx` | component | request-response | `src/pages/reports/index.tsx` `DateRangePicker` usage + `Select` filter patterns in `RefundSheet.tsx` (reason Select) | role-match |
| `src/widgets/AuditLogTable/AuditLogDetailSheet.tsx` | component | request-response | `src/features/process-refund/ui/RefundSheet.tsx` (full Sheet structure) | exact |
| `src/shared/lib/rbac.ts` (MODIFY: add `view_audit_log` StaffAction) | config | CRUD | itself — `STAFF_ACTIONS` array + `MANAGER_EXTRA` set | exact |
| `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (MODIFY: switch tile gating) | component | request-response | itself (existing `/reports`, `/inventory` tiles using `requiredAction`) | exact |
| `src/app/router.tsx` (MODIFY: add `/audit` route) | route | request-response | itself — `/rbac` route block (`RbacRoute` wrapping lazy page) | exact |

## Pattern Assignments

### `supabase/migrations/<new>_wire_transfer_tab_audit.sql` and `<new>_wire_record_stock_movement_audit.sql` (migration, CRUD-patch)

**Analog:** `supabase/migrations/20260511000002_rpc_audit_wiring.sql` (all 4 wired RPCs use the identical shape)

**Core pattern** (verbatim, lines 190-198, from `process_payment_atomic`'s payment.process wiring — copy this shape into `transfer_tab` and `record_stock_movement`):
```sql
-- AUDIT: record successful payment (Phase 14-03)
SELECT to_jsonb(p) INTO v_payment_row FROM payments p WHERE p.id = v_payment_id;
PERFORM record_audit(
  'payment.process',
  'payment',
  v_payment_id,
  NULL,
  v_payment_row,
  'rpc'
);
-- immediately followed by the success-path RETURN, never inside an EXCEPTION block
```

**Rule (from RESEARCH.md, verified against all 4 existing call sites):** `PERFORM record_audit(<action>, <entity_type>, <entity_id>, <before_jsonb_or_NULL>, <after_jsonb>, 'rpc')` is called once, immediately before the success-path `RETURN`. Validation-error early-returns are never audited. Capture `before` via `SELECT to_jsonb(row) INTO v_before ... WHERE id = ...` prior to the mutating statement when an existing-row diff is needed (e.g. `close_caja_session`); use `NULL` for `before` when the entity is newly created in this same call (e.g. `payment.process`).

**Header comment convention** (top of `20260511000002_rpc_audit_wiring.sql`, lines 1-7) — copy this preamble style for the new migration files:
```sql
-- Phase 14-03: Wire record_audit() into sensitive SECURITY DEFINER RPCs
--
-- This migration patches 4 sensitive RPCs to call record_audit() post-mutation,
-- ...
-- record_audit() catches its own exceptions and returns NULL.
```

---

### `supabase/migrations/<new>_record_audit_add_terminal_id.sql` (migration, additive signature change)

**Analog:** `supabase/migrations/20260511000001_audit_logs_table.sql` lines 73-115 (current `record_audit` definition)

**Exact current signature to extend (do not break existing 4 call sites — new param must be `DEFAULT NULL`):**
```sql
CREATE OR REPLACE FUNCTION record_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid        DEFAULT NULL,
  p_before      jsonb       DEFAULT NULL,
  p_after       jsonb       DEFAULT NULL,
  p_source      text        DEFAULT 'rpc'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ ... $$;
```
Note: `src/app/OfflineQueueProcessor.tsx` (lines 37-45) already calls `supabase.rpc('record_audit', { p_action, p_entity_type, p_entity_id, p_before, p_after, p_terminal_id: TERMINAL_ID, p_user_id: null })` with `p_terminal_id`/`p_user_id` params that **do not exist yet** in the deployed signature (cast via `as never` to bypass TS). This confirms the intended future shape — match these exact param names (`p_terminal_id`, and decide whether `p_user_id` is also needed vs. relying on `auth.uid()`) when writing the migration, so this existing call site starts working instead of silently failing.

---

### `src/app/audit-route.tsx` (route guard)

**Analog:** `src/app/reports-route.tsx` (full file, 16 lines) — copy verbatim, swap the permission string.

```typescript
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type ReportsRouteProps = {
  children: ReactNode;
};

export function ReportsRoute({ children }: ReportsRouteProps) {
  const { can } = usePermissions();
  if (!can('view_reports')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
```
For `AuditRoute`, use `can('view_audit_log')` (new StaffAction — see rbac.ts pattern below). Per RESEARCH.md, the E2E spec expects a toast/message matching `/restricted to managers and admins/i` on redirect — `ReportsRoute`/`RbacRoute` do NOT currently show a toast, only `<Navigate>`; planner must add a `toast.error(...)` call before/with the redirect (see `sonner`'s `toast` import pattern already used in `RefundSheet.tsx` line 8: `import { toast } from "sonner";`).

---

### `src/app/router.tsx` (MODIFY — add `/audit` route)

**Analog:** the existing `/rbac` block (lines 155-164) — identical shape (lazy import + ProtectedRoute + custom Route guard wrapper).

```typescript
const RbacPage = lazy(() => import('../pages/rbac'));
...
<Route
  path="/rbac"
  element={
    <ProtectedRoute>
      <RbacRoute>
        <RbacPage />
      </RbacRoute>
    </ProtectedRoute>
  }
/>
```
Copy this exactly for `/audit` + `AuditRoute` + `AuditPage` (add `import { AuditRoute } from './audit-route';` alongside the other route-guard imports at the top, lines 6-9).

---

### `src/widgets/AuditLogTable/AuditLogDetailSheet.tsx` (component, request-response)

**Analog:** `src/features/process-refund/ui/RefundSheet.tsx` (full file read — 336 lines)

**Imports pattern** (lines 24-31):
```typescript
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shared/ui/sheet";
```

**Structural pattern** (lines 201-323): `Sheet` controlled by `open`/`onOpenChange` props from parent (the table row-click handler), `SheetContent side="right"` with `SheetHeader`/`SheetTitle`/`SheetDescription`, scrollable body `div`, and a `handleOpenChange` wrapper that resets local state on close:
```typescript
function handleOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    setReason("");
    // reset any local sheet state here
  }
  onOpenChange(nextOpen);
}
```
For `AuditLogDetailSheet`, no footer action buttons/mutation are needed (read-only view) — reuse the `Sheet`/`SheetContent`/`SheetHeader` shell only, and render `<JsonDiffViewer before={row.before} after={row.after} truncated={isTruncated} />` in place of the item list. Truncation detection logic (per RESEARCH.md, not yet wired anywhere):
```typescript
const isTruncated =
  (row.before as { _truncated?: boolean } | null)?._truncated === true ||
  (row.after as { _truncated?: boolean } | null)?._truncated === true;
```

---

### `src/widgets/AuditLogTable/AuditLogTable.tsx` (widget, streaming/infinite-scroll)

**Analog (data hook only, reuse verbatim — do not rewrite):** `src/entities/audit-log/model/queries.ts` (full file, 79 lines) — already implements `useAuditLogs(filters)` via `useInfiniteQuery`, all 5 filters, page size 50.

```typescript
export function useAuditLogs(filters: AuditLogFilters) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<AuditLog[]> => { /* .range(pageParam, pageParam+49), 5 filters */ },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}
```

**No structural widget analog exists for the "load more" UI** (RESEARCH.md confirms this is the first `useInfiniteQuery` usage in the codebase) — planner must choose IntersectionObserver-on-sentinel-row or a manual "Load more" button; no in-repo pattern to copy for this part specifically.

**Security note to carry into implementation:** the `filters.search` branch (queries.ts lines 65-69) does raw string interpolation into a PostgREST `.or()` filter expression:
```typescript
if (filters.search) {
  query = query.or(
    `entity_id::text.ilike.%${filters.search}%,action.ilike.%${filters.search}%`,
  );
}
```
This is a known injection-risk gap flagged in RESEARCH.md (V5) — commas/periods in user input can alter the filter structure. Any new filter-bar wiring should sanitize/escape `,`/`.` before this ships, per RESEARCH.md's Security Domain section.

---

### `src/shared/lib/rbac.ts` (MODIFY — add `view_audit_log` StaffAction, discretionary per D-06/Pitfall 8)

**Analog:** itself — existing `STAFF_ACTIONS` array (lines 13-36) and `MANAGER_EXTRA` set (lines 52-62)

```typescript
export const STAFF_ACTIONS = [
  'create_order',
  // ...
  'manage_waitlist',
  // ADD: 'view_audit_log',
] as const;

const MANAGER_EXTRA: ReadonlySet<StaffAction> = new Set([
  'close_tab',
  'void_order',
  'view_reports',
  // ...
  'manage_waitlist',
  // ADD: 'view_audit_log',
]);
```

---

### `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (MODIFY — tile gating consistency, discretionary)

**Analog:** itself — existing `/reports` tile definition (line 49) uses `requiredAction: 'view_reports'`, vs. the current `/audit` tile (line 91) which uses `visibleToRoles: ['manager', 'admin']`. If the user opts for consistency (Pitfall 8), swap the `/audit` tile's config key from `visibleToRoles` to `requiredAction: 'view_audit_log'` — the tile's gating-check logic already handles either key (lines 113-144), no other change needed. `data-testid="home-tile-audit"` (line 155) must be preserved regardless.

---

### `supabase/functions/_shared/audit.ts` (MODIFY — add `actorId`)

**Analog:** itself (full file, 55 lines, already read)

**Current shape to extend:**
```typescript
export interface AuditParams {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  source?: 'rpc' | 'edge' | 'client' | 'trigger';
}

export async function recordAudit(
  supabase: SupabaseClient,
  params: AuditParams
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
      source: params.source ?? 'edge',
    });
    if (error) {
      console.error('[audit] Failed to write audit log:', error.message, { ... });
    }
  } catch (err) {
    console.error('[audit] Unexpected error writing audit log:', err);
  }
}
```
Add `actorId?: string | null` to `AuditParams` and `actor_id: params.actorId ?? null` to the insert object. Preserve the fire-and-forget, try/catch-swallows-everything error handling exactly as-is — this is the established non-fatal-audit-write contract used everywhere else in this phase.

## Shared Patterns

### Non-fatal, post-mutation audit write (DB tier)
**Source:** `supabase/migrations/20260511000002_rpc_audit_wiring.sql` (all 4 wired RPCs) + `record_audit()`'s own internal `EXCEPTION` handler in `20260511000001_audit_logs_table.sql`
**Apply to:** Every new/patched SECURITY DEFINER RPC in this phase (`transfer_tab`, `record_stock_movement`, `caja_open`, `close_tab`-wrapper, `produce_prep_batch`-wrapper, `force_pin_change`).
**Rule:** `PERFORM record_audit(...)` immediately before the success-path `RETURN`; never call it from inside an `EXCEPTION` block; never let an audit failure abort the primary mutation (the function already catches its own exceptions internally, so callers don't need extra guards).

### Client-side direct `record_audit` RPC call (lighter-weight alternative)
**Source:** `src/app/OfflineQueueProcessor.tsx` lines 34-49 (`writeDiscardAuditAsync`)
**Apply to:** `update_role_permission` wiring if Pattern 3 (non-atomic, client-side) is chosen over Pattern 2 (new wrapper RPC) — see RESEARCH.md Open Question 3.
```typescript
const res = await supabase.rpc('record_audit', {
  p_action: 'offline.discarded_stale',
  p_entity_type: ENTITY_BY_ACTION_TYPE[action.type],
  p_entity_id: payloadEntityId(action),
  p_before: { ... },
  p_after: null,
  p_terminal_id: TERMINAL_ID,
  p_user_id: null,
} as never);
if (res.error) {
  logger.warn('offline.queue.replay.audit_failed', { actionId: action.id, message: res.error.message });
}
```

### Route guard (manager+/admin-only page)
**Source:** `src/app/reports-route.tsx`, `src/app/rbac-route.tsx` (both identical shape)
**Apply to:** `src/app/audit-route.tsx`
```typescript
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

export function AuditRoute({ children }: { children: ReactNode }) {
  const { can } = usePermissions();
  if (!can('view_audit_log')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
```
Note: neither analog currently shows a toast on redirect; the E2E spec for `/audit` expects one (`/restricted to managers and admins/i`) — add `toast.error(...)` from `sonner` (see `RefundSheet.tsx` line 8 for the import convention) as a deviation from the two existing route guards.

### Sheet-based detail view
**Source:** `src/features/process-refund/ui/RefundSheet.tsx`, `src/features/split-tab/ui/SplitTabSheet.tsx` (per RESEARCH.md, second reference implementation not separately read here — same import block)
**Apply to:** `AuditLogDetailSheet.tsx`

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/widgets/AuditLogTable/` infinite-scroll trigger (sentinel row / "Load more") | component | streaming | No `useInfiniteQuery` consumer exists anywhere else in the codebase (confirmed by RESEARCH.md) — planner must design from TanStack Query v5 docs, no in-repo copy source |
| `supabase/functions/void-order/` (if it must be built from scratch — Open Question 2, BLOCKING) | route (edge function) | request-response | No existing edge function in `supabase/functions/` was read in this pass as a structural template; planner should read `supabase/functions/process-payment/index.ts` directly before authoring, since it is the other sensitive-mutation edge function referenced by `_shared/audit.ts`'s own docstring |
| `force_pin_change` RPC + UI gate (net-new feature, no existing analog for "must change PIN" login-flow gate) | route + component | request-response | Zero implementation anywhere per RESEARCH.md Pitfall 5 — no `ChangePinDialog`/`ForcePinChangeDialog` exists; planner should look at `src/features/manager-pin-gate/` (`ManagerPinDialog`, used in `RefundSheet.tsx` line 10 and 324-331) as the closest PIN-entry-modal analog, though it serves a different purpose (approval gate, not forced-change flow) |

## Metadata

**Analog search scope:** `src/app/`, `src/pages/`, `src/widgets/`, `src/features/process-refund/`, `src/entities/audit-log/`, `src/shared/lib/rbac.ts`, `supabase/migrations/2026051100000{1,2}*.sql`, `supabase/functions/_shared/audit.ts`, `src/app/OfflineQueueProcessor.tsx`, `src/app/router.tsx`
**Files scanned:** 12 read in full or targeted excerpt (reports-route.tsx, rbac-route.tsx, RefundSheet.tsx, router.tsx, reports/index.tsx, HomeDashboard.tsx (grep), rbac.ts (partial), audit-logs migrations x2 (grep + excerpt), _shared/audit.ts, entities/audit-log/model/queries.ts, OfflineQueueProcessor.tsx)
**Pattern extraction date:** 2026-07-03
