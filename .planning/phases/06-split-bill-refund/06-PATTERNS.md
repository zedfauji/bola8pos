# Phase 6: Split Bill + Refund — Pattern Map

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

**Mapped:** 2026-04-24
**Files analyzed:** 20 new files + 9 modified files
**Analogs found:** 25 / 29

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260427000001_split_bill_schema.sql` | migration | batch | `supabase/migrations/20260426000001_ingredients_table.sql` | role-match |
| `supabase/migrations/20260427000002_split_tab_rpcs.sql` | migration | request-response | `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` | exact |
| `supabase/migrations/20260427000003_process_refund_rpc.sql` | migration | request-response | `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` | exact |
| `supabase/migrations/20260427000004_parent_auto_close_trigger.sql` | migration | event-driven | `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` | partial |
| `src/entities/refund/model/types.ts` | model | CRUD | `src/entities/combo/model/types.ts` | exact |
| `src/entities/refund/model/queries.ts` | model | CRUD | `src/entities/ingredient/model/queries.ts` | exact |
| `src/entities/refund/index.ts` | model | CRUD | `src/entities/ingredient/index.ts` | exact |
| `src/features/split-tab/ui/SplitTabSheet.tsx` | component | request-response | `src/features/add-combo-to-tab/ui/ComboBuilderSheet.tsx` | role-match |
| `src/features/split-tab/index.ts` | config | — | `src/features/add-combo-to-tab/index.ts` | exact |
| `src/features/process-refund/ui/RefundSheet.tsx` | component | request-response | `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` | role-match |
| `src/features/process-refund/index.ts` | config | — | `src/features/add-combo-to-tab/index.ts` | exact |
| `src/widgets/RefundsList/index.tsx` | component | CRUD | `src/widgets/StockMovementsList/index.tsx` | exact |
| `src/shared/ui/SubTabColumn/SubTabColumn.tsx` | component | CRUD | `src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` | role-match |
| `src/shared/ui/SubTabColumn/SubTabColumn.stories.tsx` | test | — | `src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx` | exact |
| `src/shared/ui/PersonCard/PersonCard.tsx` | component | CRUD | `src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` | role-match |
| `src/shared/ui/PersonCard/PersonCard.stories.tsx` | test | — | `src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx` | exact |
| `src/shared/lib/split-math.ts` | utility | transform | `src/shared/lib/pool-billing.ts` | role-match |
| `src/shared/lib/split-math.test.ts` | test | — | `src/shared/lib/pool-billing.test.ts` | exact |
| `e2e/34-split-bill.spec.ts` | test | request-response | `e2e/33-ingredients.spec.ts` | exact |
| `e2e/35-refund.spec.ts` | test | request-response | `e2e/33-ingredients.spec.ts` | exact |
| `src/shared/lib/domain.ts` (modify) | model | CRUD | self | exact |
| `src/shared/lib/result.ts` (modify) | utility | — | self | exact |
| `src/shared/lib/rbac.ts` (modify) | utility | — | self | exact |
| `src/entities/tab/model/queries.ts` (modify) | model | CRUD | self (existing `tabKeys` + `useTabs` pattern) | exact |
| `src/entities/tab/model/types.ts` (modify) | model | CRUD | `src/entities/combo/model/types.ts` | exact |
| `src/entities/payment/model/types.ts` (modify) | model | CRUD | self | exact |
| `src/pages/payments/index.tsx` (modify) | component | request-response | self | exact |
| `src/widgets/PaymentPane/ui/PaymentPane.tsx` (modify) | component | request-response | `src/features/void-order/ui/VoidOrderDialog.tsx` | role-match |
| `src/widgets/OrderPanel/` (modify) | component | request-response | `src/features/add-combo-to-tab/ui/ComboBuilderSheet.tsx` | partial |

---

## Pattern Assignments

### `supabase/migrations/20260427000001_split_bill_schema.sql` (migration, batch)

**Analog:** `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql`

**Migration wrapper pattern** (lines 12-13):
```sql
-- UP:
BEGIN;
-- ... DDL changes ...
COMMIT;
```

**CRITICAL EXCEPTION for this file:** The `ALTER TYPE tab_status ADD VALUE IF NOT EXISTS 'split'` statement **must NOT be wrapped in `BEGIN/COMMIT`**. PostgreSQL forbids `ALTER TYPE ADD VALUE` inside a transaction. Use `-- supabase migrate: no-transaction` header, or place the ENUM extension in a separate migration file that runs before the schema file.

**Recommended split:** Put the ENUM-only statement in a separate file (`20260427000000_tab_status_split_enum.sql`) with no transaction wrapper, then `20260427000001_split_bill_schema.sql` can use `BEGIN/COMMIT` for all other DDL.

**Pattern for constraint drop + recreate** (from research Pattern 1 + 3):
```sql
BEGIN;

-- 1. ENUM extension handled in separate migration (see 20260427000000)

-- 2. tabs extensions
ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS parent_tab_id uuid REFERENCES tabs(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS split_mode    text CHECK (split_mode IN ('item','evenly','by_person','by_amount')),
  ADD COLUMN IF NOT EXISTS split_label   text;

CREATE INDEX IF NOT EXISTS idx_tabs_parent_tab_id ON tabs(parent_tab_id)
  WHERE parent_tab_id IS NOT NULL;

-- 3. Drop and recreate closed_at constraint to allow 'split' status
ALTER TABLE tabs DROP CONSTRAINT IF EXISTS closed_at_requires_closed_status;
ALTER TABLE tabs ADD CONSTRAINT closed_at_requires_closed_status CHECK (
  (closed_at IS NULL AND status IN ('open', 'split')) OR
  (closed_at IS NOT NULL AND status IN ('closed', 'paid', 'voided'))
);

-- 4. New refunds / refund_items tables
CREATE TABLE IF NOT EXISTS refunds ( ... );
CREATE TABLE IF NOT EXISTS refund_items ( ... );

-- 5. payments extensions
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS is_refund boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES refunds(id) ON DELETE RESTRICT;

-- 6. Fix amount_positive CHECK to allow refund negative rows
ALTER TABLE payments DROP CONSTRAINT IF EXISTS amount_positive;
ALTER TABLE payments ADD CONSTRAINT amount_positive
  CHECK (amount > 0 OR is_refund = true);

COMMIT;
```

---

### `supabase/migrations/20260427000002_split_tab_rpcs.sql` (migration, request-response)

**Analog:** `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql`

**RPC header pattern** (lines 1-30):
```sql
-- =============================================================================
-- S4-0X: <function_name>
--
-- Description of what the RPC does.
-- SECURITY DEFINER: runs as function owner; auth.uid() is preserved by JWT.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION <function_name>(
  p_<param> <type>
)
RETURNS <type>
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id  uuid;
BEGIN
  v_staff_id := auth.uid();
  ...
END;
$$;

COMMIT;
```

**Auth guard pattern** (lines 33-38 of record_stock_movement_rpc.sql):
```sql
-- Capture calling user (SECURITY DEFINER preserves auth.uid() via JWT claims)
v_staff_id := auth.uid();
```

**NOT FOUND guard pattern**:
```sql
IF NOT FOUND THEN
  RAISE EXCEPTION 'ENTITY_NOT_FOUND: ... does not exist', p_id;
END IF;
```

**Error code convention:** All `RAISE EXCEPTION` messages use `'ERROR_CODE: human readable message'` format (e.g., `'PARENT_TAB_PAID: tab has already been paid'`). The frontend maps these via `error.message.includes('CODE')`.

---

### `supabase/migrations/20260427000003_process_refund_rpc.sql` (migration, request-response)

**Analog:** `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql`

Same RPC header + auth guard pattern as above. Key extra patterns from research:

**Manager role check pattern** (unique to this RPC):
```sql
SELECT id INTO v_staff_id FROM profiles
WHERE id = auth.uid()
  AND role IN ('manager', 'admin');
IF NOT FOUND THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required';
END IF;
```

**Graceful fallback for undefined function** (Phase 4 stub):
```sql
IF (v_item->>'restock')::boolean THEN
  BEGIN
    PERFORM deplete_for_order_item((v_item->>'order_item_id')::uuid, -1);
  EXCEPTION WHEN undefined_function THEN
    NULL;  -- Phase 4 not yet deployed; log and continue
  END;
END IF;
```

**Graceful fallback for undefined table** (audit_log):
```sql
BEGIN
  INSERT INTO audit_log (...) VALUES (...);
EXCEPTION WHEN undefined_table THEN
  NULL;
END;
```

---

### `supabase/migrations/20260427000004_parent_auto_close_trigger.sql` (migration, event-driven)

**Analog:** `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql` (SECURITY DEFINER function pattern)

**Trigger function + CREATE TRIGGER pattern** (from research Pattern 4):
```sql
BEGIN;

CREATE OR REPLACE FUNCTION check_parent_tab_auto_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard: skip refund payment rows
  IF NEW.is_refund THEN
    RETURN NEW;
  END IF;
  ...
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_payment_insert_check_parent_close
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION check_parent_tab_auto_close();

COMMIT;
```

---

### `src/entities/refund/model/types.ts` (model, CRUD)

**Analog:** `bar-pos/src/entities/combo/model/types.ts` (lines 1-20 — entire file)

**Full pattern** (copy verbatim, changing exported names):
```typescript
// src/entities/refund/model/types.ts
// Re-export all refund types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
export type {
  Refund,
  RefundCreate,
  RefundItem,
  RefundReason,
} from '@shared/lib/domain';
export {
  RefundSchema,
  RefundItemSchema,
  RefundReasonSchema,
  RefundCreateSchema,
} from '@shared/lib/domain';
```

---

### `src/entities/refund/model/queries.ts` (model, CRUD)

**Analog:** `bar-pos/src/entities/ingredient/model/queries.ts` (entire file)

**Imports pattern** (lines 1-17):
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/refund/model/queries.ts
 *
 * TanStack Query hooks for refund data.
 * Uses `const db = supabase as any` pre-regen cast — refunds table not yet
 * in supabase.types.ts. Regenerate after migrations applied:
 *   npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts
 */
import { useQuery } from '@tanstack/react-query';
import { RefundSchema } from '@shared/lib/domain';
import type { Refund } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;
```

**Query key factory pattern** (lines 23-29 of ingredient queries):
```typescript
export const refundKeys = {
  all: ['refunds'] as const,
  lists: () => [...refundKeys.all, 'list'] as const,
  byPayment: (paymentId: string) => [...refundKeys.all, 'by-payment', paymentId] as const,
  detail: (id: string) => [...refundKeys.all, 'detail', id] as const,
};
```

**Query hook pattern with enabled guard + row mapper** (lines 78-94 of ingredient queries):
```typescript
export function useRefunds() {
  return useQuery({
    queryKey: refundKeys.lists(),
    queryFn: async (): Promise<Refund[]> => {
      const { data, error } = await db
        .from('refunds')
        .select('*, refund_items(*)')
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('useRefunds: query failed', { error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapRefundRow);
    },
  });
}

export function useRefundsByPayment(paymentId: string | null) {
  return useQuery({
    queryKey: refundKeys.byPayment(paymentId ?? ''),
    enabled: paymentId != null && paymentId.length > 0,
    queryFn: async (): Promise<Refund[]> => {
      if (!paymentId) return [];
      const { data, error } = await db
        .from('refunds')
        .select('*, refund_items(*)')
        .eq('original_payment_id', paymentId)
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('useRefundsByPayment: query failed', { error, paymentId });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapRefundRow);
    },
  });
}
```

---

### `src/entities/refund/index.ts` (model, CRUD)

**Analog:** `bar-pos/src/entities/ingredient/index.ts` (entire file)

**Full pattern** (lines 1-34 of ingredient/index.ts):
```typescript
/**
 * Refund entity public API.
 *
 * Import from here: `import { useRefunds } from '@entities/refund'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export {
  useRefunds,
  useRefundsByPayment,
  refundKeys,
} from './model/queries';
export type {
  Refund,
  RefundCreate,
  RefundItem,
  RefundReason,
} from './model/types';
export {
  RefundSchema,
  RefundItemSchema,
  RefundReasonSchema,
  RefundCreateSchema,
} from './model/types';
```

---

### `src/features/split-tab/ui/SplitTabSheet.tsx` (component, request-response)

**Analog:** `bar-pos/src/features/add-combo-to-tab/ui/ComboBuilderSheet.tsx` (entire file)

**Imports pattern** (lines 1-27 of ComboBuilderSheet.tsx):
```typescript
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Tab } from '@shared/lib/domain';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Button } from '@shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs';
import { useSplitTab } from '../model/useSplitTab';
```

**Sheet open/close pattern** (lines 160-167 of ComboBuilderSheet.tsx):
```typescript
<Sheet
  open={open}
  onOpenChange={isOpen => {
    if (!isOpen) handleCancel();
  }}
>
  <SheetContent side="bottom" className="h-[85vh]">
```

**Disabled confirm button pattern** (lines 207-211 of ComboBuilderSheet.tsx):
```typescript
<Button
  className="flex-1"
  disabled={!isValid || mutation.isPending}
  onClick={handleConfirm}
>
  Confirm Split
</Button>
```

**Toast on success/error pattern** (lines 131-151 of ComboBuilderSheet.tsx):
```typescript
mutation.mutate(
  { ... },
  {
    onSuccess: () => {
      toast.success('Tab split into N checks.');
      resetState();
      onClose();
    },
    onError: (error) => {
      if (error.message.includes('PARENT_TAB_PAID'))
        toast.error('This tab has already been paid and cannot be split.');
      else
        toast.error('Could not complete split. Check your connection and try again.');
    },
  }
);
```

---

### `src/features/split-tab/index.ts` (config)

**Analog:** `bar-pos/src/features/add-combo-to-tab/index.ts` (entire file, 2 lines)

**Full pattern**:
```typescript
export { SplitTabSheet } from './ui/SplitTabSheet';
export { useSplitTab } from './model/useSplitTab';
```

---

### `src/features/process-refund/ui/RefundSheet.tsx` (component, request-response)

**Analog:** `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (entire file) — right-side Sheet with multi-state flow + confirm pattern.

**Imports pattern** (lines 1-30 of CsvImportSheet.tsx):
```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ManagerPinDialog } from '@features/manager-pin-gate';
import type { Refund } from '@entities/refund';
import { refundKeys } from '@entities/refund';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { QuantityControl } from '@shared/ui/QuantityControl';
import { Button } from '@shared/ui/button';
import { Checkbox } from '@shared/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';
```

**Right-side Sheet pattern** (line 204 of CsvImportSheet.tsx):
```typescript
<Sheet open={open} onOpenChange={handleOpenChange}>
  <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
```

**Multi-state type pattern** (lines 47-55 of CsvImportSheet.tsx — adapt for RefundSheet):
```typescript
type RefundState =
  | { step: 'selecting' }
  | { step: 'configuring'; selectedItems: RefundItemState[]; reason: string }
  | { step: 'awaiting_pin' }
  | { step: 'submitting' };
```

**ManagerPinDialog integration pattern** (from `src/features/manager-pin-gate/ui/ManagerPinDialog.tsx` lines 17-22 and from `VoidOrderDialog.tsx` pattern):
```typescript
const [pinOpen, setPinOpen] = useState(false);

<ManagerPinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  requiredAction="process_refund"
  onSuccess={() => {
    setPinOpen(false);
    void handleSubmitRefund();
  }}
/>
```

---

### `src/features/process-refund/index.ts` (config)

**Analog:** `bar-pos/src/features/add-combo-to-tab/index.ts` (entire file)

**Full pattern**:
```typescript
export { RefundSheet } from './ui/RefundSheet';
export { useProcessRefund } from './model/useProcessRefund';
```

---

### `src/widgets/RefundsList/index.tsx` (component, CRUD)

**Analog:** `bar-pos/src/widgets/StockMovementsList/index.tsx` (entire file — read-only DataTable widget, no Storybook)

**Imports pattern** (lines 1-10 of StockMovementsList/index.tsx):
```typescript
import type { ColumnDef } from '@tanstack/react-table';
import { ReceiptText } from 'lucide-react';
import { useRefunds } from '@entities/refund';
import type { Refund } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { EmptyState } from '@shared/ui/EmptyState';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Badge } from '@shared/ui/badge';
```

**Column definition pattern** (lines 59-90 of StockMovementsList/index.tsx):
```typescript
const columns: ColumnDef<Refund>[] = [
  {
    id: 'created_at',
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  // ... more columns
];
```

**DataTable read-only pattern** (lines 116-133 of StockMovementsList/index.tsx):
```typescript
<DataTable
  columns={columns}
  data={refunds ?? []}
  isLoading={isLoading}
  enableSorting
  initialSorting={[{ id: 'created_at', desc: true }]}
  searchable={false}
  emptyState={
    <EmptyState
      icon={ReceiptText}
      title="No refunds yet"
      description="Refunds processed on paid orders will appear here."
    />
  }
/>
```

---

### `src/shared/ui/SubTabColumn/SubTabColumn.tsx` (component, CRUD)

**Analog:** `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` (entire file)

**Imports pattern** (lines 1-20 of ComboSlotCard.tsx):
```typescript
import type { OrderItem } from '@shared/lib/domain';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { X } from 'lucide-react';
```

**Props interface pattern** (lines 21-34 of ComboSlotCard.tsx):
```typescript
export interface SubTabColumnProps {
  label: string;
  items: OrderItem[];
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemoveItem: (itemId: string) => void;
}
```

**Conditional border/ring pattern for selected state** (lines 84-90 of ComboSlotCard.tsx):
```typescript
<div
  className={cn(
    'flex flex-col min-w-[140px] bg-card rounded-lg border',
    isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
  )}
>
```

**Storybook import convention** (line 1 of ComboSlotCard.stories.tsx):
```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
// NOT '@storybook/react' — project ESLint rule storybook/no-renderer-packages
```

---

### `src/shared/ui/SubTabColumn/SubTabColumn.stories.tsx` (test)

**Analog:** `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx` (entire file)

**Meta declaration pattern** (lines 1-12 of ComboSlotCard.stories.tsx):
```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { OrderItem } from '@shared/lib/domain';
import { SubTabColumn } from './SubTabColumn';

const meta: Meta<typeof SubTabColumn> = {
  title: 'shared/ui/SubTabColumn',
  component: SubTabColumn,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof SubTabColumn>;
```

**Story variants required per UI-SPEC:** `Empty`, `Selected` (ring-primary), `WithItems` (3 items), `SingleItem`

**Named export story pattern** (lines 121-130 of ComboSlotCard.stories.tsx):
```typescript
export const Empty: Story = {
  args: {
    label: 'Sub-tab 1',
    items: [],
    total: 0,
    isSelected: false,
    onSelect: () => undefined,
    onRemoveItem: () => undefined,
  },
};
```

---

### `src/shared/ui/PersonCard/PersonCard.tsx` (component, CRUD)

**Analog:** `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` — composition extension of SubTabColumn

**Props extension pattern** (from UI-SPEC):
```typescript
// PersonCard extends SubTabColumn by replacing 'label' with 'name' + 'onNameChange'
interface PersonCardProps extends Omit<SubTabColumnProps, 'label'> {
  name: string;
  onNameChange: (name: string) => void;
}
```

**Inline editable input replacing static label** (from UI-SPEC component spec):
```typescript
// Replace the static <span>{label}</span> header with:
<Input
  value={name}
  onChange={e => onNameChange(e.target.value)}
  placeholder="Person name"
  className="text-sm font-semibold h-7 border-0 px-1 bg-transparent focus-visible:ring-1"
  maxLength={30}
/>
```

---

### `src/shared/ui/PersonCard/PersonCard.stories.tsx` (test)

**Analog:** `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx`

Same Storybook meta pattern. Story variants: `DefaultName`, `CustomName`, `Selected`, `WithItems`.

---

### `src/shared/lib/split-math.ts` (utility, transform)

**Analog:** `bar-pos/src/shared/lib/pool-billing.ts` (pure utility — transform function with no side effects)

**Pure utility export pattern** (analogous to pool-billing's export shape):
```typescript
/**
 * split-math.ts
 *
 * Pure utility functions for split-bill calculations.
 * No Supabase, no React — testable in isolation.
 * Used by features/split-tab and tested by P8, P9 property tests.
 */

/**
 * Calculate N-way even split amounts.
 * Returns per_payment_amount (floor to cent) and cents_remainder.
 * Last payment absorbs the remainder.
 * Invariant: base * (n-1) + last = totalCents exactly (P9).
 */
export function computeEvenSplit(totalCents: number, n: number): {
  baseAmount: number;   // per-payment, floored to cent
  lastAmount: number;   // absorbs remainder; >= baseAmount
} {
  const base = Math.floor(totalCents / n);
  const last = totalCents - base * (n - 1);
  return { baseAmount: base, lastAmount: last };
}
```

---

### `src/shared/lib/split-math.test.ts` (test)

**Analog:** `bar-pos/src/shared/lib/pool-billing.test.ts` (fast-check property test pattern)

**Vitest + fast-check imports pattern** (lines 1-3 of pool-billing.test.ts):
```typescript
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeEvenSplit } from './split-math';
```

**Property test structure pattern** (lines 5-35 of pool-billing.test.ts):
```typescript
describe('split-math', () => {
  // P9: N-way even split sums exactly to original
  it('P9: evenly split N payments sum exactly to original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 9 }),
        fc.integer({ min: 1, max: 1_000_00 }),
        (n, totalCents) => {
          const { baseAmount, lastAmount } = computeEvenSplit(totalCents, n);
          const payments = Array.from({ length: n - 1 }, () => baseAmount).concat(lastAmount);
          expect(payments.reduce((a, b) => a + b, 0)).toBe(totalCents);
        }
      )
    );
  });

  // P8: conservation — sub-tab totals ± 1 cent
  it('P8: split conservation within 1 cent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100_00 }), { minLength: 2, maxLength: 6 }),
        (itemPrices) => {
          const total = itemPrices.reduce((a, b) => a + b, 0);
          // ... test grouping + sum vs total
        }
      )
    );
  });
});
```

---

### `e2e/34-split-bill.spec.ts` (test, request-response)

**Analog:** `bar-pos/e2e/33-ingredients.spec.ts` (entire file)

**E2E spec header pattern** (lines 1-23 of 33-ingredients.spec.ts):
```typescript
/* eslint-disable */
/**
 * E2E spec: Phase 6 — Split Bill
 *
 * Tickets: S4-03, S4-04, S4-18
 *
 * Covers:
 *  T1: Evenly split — N=3, confirm, N payments created
 *  T2: By Item split — assign all items, sub-tabs created
 *  T3: By Person split — 2 persons, unassigned items distributed
 *  T4: Sub-tabs appear in OrderPanel, parent shows 'split' status
 *  T5: All sub-tabs paid → parent auto-closed (trigger test)
 *  T6: PARENT_TAB_PAID guard — already-split tab shows error toast
 */
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';
```

**beforeEach/afterEach pattern** (lines 41-50 of 33-ingredients.spec.ts):
```typescript
test.beforeEach(async ({ page }) => {
  requireIntegrationEnv();
  await resetTestState();
  await openCaja(570);
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  await logout(page).catch(() => undefined);
});
```

**Service client helper pattern** (lines 31-39 of 33-ingredients.spec.ts):
```typescript
function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}
```

---

### `e2e/35-refund.spec.ts` (test, request-response)

**Analog:** `bar-pos/e2e/33-ingredients.spec.ts` — same E2E spec shell pattern as 34-split-bill.spec.ts above.

---

## Modifications to Existing Files

### `src/shared/lib/domain.ts` — add Phase 6 schemas

**Where to insert:** After the existing `TabStatusSchema` definition (line 52) and after the existing `PaymentSchema` block.

**TabStatusSchema extension** (line 52 of domain.ts currently):
```typescript
// BEFORE:
export const TabStatusSchema = z.enum(['open', 'closed', 'paid', 'voided']);

// AFTER (add 'split'):
export const TabStatusSchema = z.enum(['open', 'closed', 'paid', 'voided', 'split']);
```

**TabSchema additions** (add 3 nullable/optional fields to the existing `TabSchema` object):
```typescript
// Inside TabSchema.extend() or add to the existing object:
parentTabId: UuidSchema.nullable().optional(),
splitMode: z.enum(['item','evenly','by_person','by_amount']).nullable().optional(),
splitLabel: z.string().max(50).nullable().optional(),
```

**PaymentSchema additions** (add 2 fields to the existing PaymentSchema in `src/entities/payment/model/types.ts`):
```typescript
isRefund: z.boolean().default(false),
refundId: UuidSchema.nullable().optional(),
```

**New schemas to append at end of domain.ts** (from research Zod section):
```typescript
export const RefundReasonSchema = z.enum([
  'wrong_order', 'quality_issue', 'customer_complaint', 'billing_error', 'other'
]);
export const RefundItemSchema = z.object({
  id: UuidSchema,
  refundId: UuidSchema,
  orderItemId: UuidSchema,
  qty: z.number().int().min(1),
  amount: z.number().positive(),
  restock: z.boolean(),
  createdAt: TimestampSchema,
});
export const RefundSchema = z.object({
  id: UuidSchema,
  originalPaymentId: UuidSchema,
  reason: RefundReasonSchema,
  amount: z.number().positive(),
  createdBy: UuidSchema,
  createdAt: TimestampSchema,
  items: z.array(RefundItemSchema).default([]),
});
export const RefundCreateSchema = RefundSchema.omit({ id: true, createdAt: true, items: true });
export type Refund = z.infer<typeof RefundSchema>;
export type RefundCreate = z.infer<typeof RefundCreateSchema>;
export type RefundItem = z.infer<typeof RefundItemSchema>;
export type RefundReason = z.infer<typeof RefundReasonSchema>;
```

---

### `src/shared/lib/result.ts` — add 6 new AppErrorCodes

**Where to find the AppErrorCode union:** The union is defined somewhere after line 109. Use Grep to locate the exact line before editing.

**Pattern to extend** (add to the existing `AppErrorCode` union type):
```typescript
| 'PARENT_TAB_PAID'
| 'ITEM_NOT_IN_PARENT'
| 'ITEM_ASSIGNED_TWICE'
| 'UNASSIGNED_ITEMS'
| 'REFUND_EXCEEDS_ORIGINAL'
| 'ITEM_NOT_IN_ORIGINAL_ORDER'
```

---

### `src/shared/lib/rbac.ts` — add `process_refund` action

**STAFF_ACTIONS array** (lines 13-33): append `'process_refund'` to the `as const` array.

**MANAGER_EXTRA set** (lines 49-55): add `'process_refund'` — manager+ only.

**Pattern** (lines 13-33 of rbac.ts — add one entry):
```typescript
export const STAFF_ACTIONS = [
  // ... existing actions ...
  'process_refund',   // Phase 6: refund a payment (manager+)
] as const;
```

```typescript
const MANAGER_EXTRA: ReadonlySet<StaffAction> = new Set([
  // ... existing ...
  'process_refund',
]);
```

---

### `src/entities/tab/model/queries.ts` — add `useSubTabs` + filter

**Where to insert:** After the existing `tabKeys` object (line 49), extend it with `subTabs` key. After `useTabs`/`useTab` hooks, add `useSubTabs`.

**tabKeys extension pattern** (lines 42-49 of queries.ts — add `subTabs`):
```typescript
export const tabKeys = {
  all: ['tabs'] as const,
  lists: () => [...tabKeys.all, 'list'] as const,
  list: (filters?: { shiftId?: string; status?: string; bartenderScope?: string; parentTabIdNull?: boolean }) =>
    [...tabKeys.lists(), filters ?? {}] as const,
  subTabs: (parentTabId: string) => [...tabKeys.all, 'sub-tabs', parentTabId] as const,
  details: () => [...tabKeys.all, 'detail'] as const,
  detail: (id: string) => [...tabKeys.details(), id] as const,
};
```

**useSubTabs hook pattern** (from research Pattern 9):
```typescript
export function useSubTabs(parentTabId: string | null) {
  return useQuery({
    queryKey: tabKeys.subTabs(parentTabId ?? ''),
    enabled: parentTabId != null && parentTabId.length > 0,
    queryFn: async (): Promise<Result<Tab[]>> => {
      if (!parentTabId) return ok([]);
      const res = await supabaseQuery(() =>
        supabase
          .from('tabs')
          .select(tabListSelect)
          .eq('parent_tab_id', parentTabId)
          .order('created_at', { ascending: true })
      );
      if (!res.ok) {
        logger.error('tabs.subtabs.fetch_failed', { code: res.error.code });
        return res;
      }
      const tabs: Tab[] = [];
      for (const row of res.data as TabRow[]) {
        const m = mapTabRow(row);
        if (!m.ok) return m;
        tabs.push(m.data);
      }
      return ok(tabs);
    },
  });
}
```

**useTabList filter patch** — the existing `useTabs` query at line 263 must add `.is('parent_tab_id', null)` to the Supabase query to exclude sub-tabs from the POS list:
```typescript
// Inside useTabs queryFn, add to the supabase chain:
.is('parent_tab_id', null)   // sub-tabs must NOT appear in the main POS list
```

---

### `src/pages/payments/index.tsx` — add Refunds tab

**Analog:** Self (current file is only 15 lines — thin wrapper)

**Wrap existing `PaymentPane` in Tabs pattern** (from UI-SPEC):
```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs';
import { RefundsList } from '@widgets/RefundsList';
import { PaymentPane } from '@widgets/PaymentPane';
import { BackToHomeButton } from '@shared/ui';

export default function PaymentsPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex shrink-0 items-center border-b px-4 py-2">
        <BackToHomeButton />
      </div>
      <Tabs defaultValue="payments" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 mb-0 w-fit">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="flex flex-1 overflow-hidden">
          <PaymentPane />
        </TabsContent>
        <TabsContent value="refunds" className="flex flex-1 overflow-hidden p-4">
          <RefundsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### `src/widgets/PaymentPane/ui/PaymentPane.tsx` — add Refund button on rows

**Analog:** `bar-pos/src/features/void-order/ui/VoidOrderDialog.tsx` (destructive action with modal trigger)

**Refund button pattern** (from UI-SPEC, using VoidOrderDialog pattern for conditional visibility):
```typescript
// In payment row actions column:
{!payment.isRefund && !payment.fullyRefunded && (
  <Button
    variant="destructive"
    size="sm"
    onClick={() => setRefundTarget(payment.id)}
  >
    Refund
  </Button>
)}

// Alongside: RefundSheet trigger
<RefundSheet
  open={refundTarget === payment.id}
  paymentId={refundTarget}
  onOpenChange={(open) => { if (!open) setRefundTarget(null); }}
/>
```

---

## Shared Patterns

### Pre-regen Cast (applies to ALL new entity/feature files that touch new tables)

**Source:** `bar-pos/src/entities/combo/model/queries.ts` (line 21), `bar-pos/src/entities/ingredient/model/queries.ts` (line 17), `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (line 36)

**Apply to:** `entities/refund/model/queries.ts`, feature hooks calling `refunds`, `refund_items`, `tabs.parent_tab_id`

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// Pre-regen cast — remove once supabase.types.ts is regenerated after Phase 6 migrations
const db = supabase as any;
```

---

### Result<T> Error Handling (applies to all mutation hooks)

**Source:** `bar-pos/src/entities/tab/model/queries.ts` (lines 278-335) and `bar-pos/src/shared/lib/result.ts`

**Apply to:** All mutation hooks in `features/split-tab/model/`, `features/process-refund/model/`

```typescript
import { err, ok, supabaseQuery, type Result } from '@shared/lib/result';

// RPC call with error mapping:
const { data, error } = await supabase.rpc('split_tab_by_item', { ... });
if (error) {
  if (error.message.includes('PARENT_TAB_PAID'))
    return err({ code: 'PARENT_TAB_PAID' as AppErrorCode, message: 'This tab has already been paid and cannot be split.' });
  if (error.message.includes('ITEM_ASSIGNED_TWICE'))
    return err({ code: 'ITEM_ASSIGNED_TWICE' as AppErrorCode, message: 'An item was assigned to more than one check.' });
  return err({ code: 'SUPABASE_ERROR', message: error.message, raw: error });
}
return ok(data);
```

---

### Cache Invalidation Pattern (applies to all mutation hooks)

**Source:** `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (line 179), `bar-pos/src/entities/tab/model/queries.ts` (tabKeys factory)

**Apply to:** Split tab mutations (invalidate parent + list), refund mutations (invalidate refundKeys + paymentKeys)

```typescript
const qc = useQueryClient();
// After split succeeds:
void qc.invalidateQueries({ queryKey: tabKeys.detail(parentTabId) });
void qc.invalidateQueries({ queryKey: tabKeys.lists() });
// After refund succeeds:
void qc.invalidateQueries({ queryKey: refundKeys.lists() });
void qc.invalidateQueries({ queryKey: refundKeys.byPayment(paymentId) });
```

---

### Logger Pattern (applies to all new hooks and widgets)

**Source:** `bar-pos/src/entities/ingredient/model/queries.ts` (lines 88-90)

**Apply to:** All new query hooks, mutation hooks, widget error boundaries

```typescript
import { logger } from '@shared/lib/logger-instance';
// On error:
logger.error('useRefunds: query failed', { error });
// On warn:
logger.warn('RefundSheet: submit called with no items selected');
```

---

### Toast Feedback Pattern (applies to all feature components)

**Source:** `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (line 13), `bar-pos/src/features/void-order/ui/VoidOrderDialog.tsx` (lines 77-79)

**Apply to:** SplitTabSheet, RefundSheet

```typescript
import { toast } from 'sonner';

// Success:
toast.success('Tab split into 3 checks.');
// Error:
toast.error('Could not complete split. Check your connection and try again.');
```

---

### MoneyDisplay (applies to all numeric display in new components)

**Source:** Multiple files — `bar-pos/src/shared/ui/MoneyDisplay.tsx` (existing)

**Apply to:** SubTabColumn totals, SplitTabSheet running totals, RefundSheet refund total, RefundsList amount column

```typescript
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
// Standard usage:
<MoneyDisplay amount={total} size="sm" />
// Negative refund amount:
<MoneyDisplay amount={refundTotal} size="lg" negative={true} />
```

---

### QuantityControl (applies to RefundSheet item qty spinners)

**Source:** `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` (lines 170-178)

**Apply to:** RefundSheet `RefundItemRow` qty spinner

```typescript
import { QuantityControl } from '@shared/ui/QuantityControl';
<QuantityControl
  value={item.refundQty}
  min={1}
  max={item.original_qty - item.already_refunded_qty}
  onChange={qty => updateQty(item.id, qty)}
  aria-label={`Refund quantity for ${item.product_name}`}
  disabled={item.original_qty - item.already_refunded_qty === 0}
/>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/features/split-tab/model/useSplitTab.ts` | mutation hook | request-response | No existing RPC mutation hook with multi-mode dispatch + N-payment loop exists. Closest is `useAddComboToTab` (single RPC call). The Evenly mode client loop (N payments) is novel. Use the existing `useProcessPayment` call pattern for the payment loop. |
| Split trigger SQL (event-driven) | migration | event-driven | No existing trigger in the codebase. Pattern is fully specified in RESEARCH.md Pattern 4. |

---

## Metadata

**Analog search scope:** `bar-pos/src/entities/`, `bar-pos/src/features/`, `bar-pos/src/widgets/`, `bar-pos/src/shared/`, `bar-pos/supabase/migrations/`, `bar-pos/e2e/`
**Files scanned:** ~35 files read, ~20 glob/grep searches
**Pattern extraction date:** 2026-04-24
