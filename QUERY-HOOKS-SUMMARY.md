# TanStack Query Hooks - Quick Reference

## Files Created

✅ `src/entities/product/model/queries.ts`
✅ `src/entities/tab/model/queries.ts`
✅ `src/entities/pool-table/model/queries.ts`
✅ `src/entities/inventory/model/queries.ts`
✅ `src/entities/*/model/index.ts` (barrel exports)
✅ `TANSTACK-QUERY-HOOKS.md` (comprehensive documentation)

## Quick Import Guide

```tsx
// Product queries
import { useProducts, useCategories, useModifiers } from '@/entities/product/model';

// Tab queries & mutations
import {
  useTabs,
  useTab,
  useMutationOpenTab,
  useMutationAddOrder,
  useMutationCloseTab,
} from '@/entities/tab/model';

// Pool table queries & mutations
import {
  usePoolTables,
  usePoolTable,
  useMutationStartSession,
  useMutationStopSession,
  usePoolSessionsByTab,
} from '@/entities/pool-table/model';

// Inventory queries & mutations
import {
  useInventory,
  useInventoryByProduct,
  useLowStockInventory,
  useMutationAdjustInventory,
  useInventoryLog,
} from '@/entities/inventory/model';
```

## Key Features

### ✅ Auto-sync with Zustand Stores

All successful queries automatically update their respective stores:

- `useProducts()` → `productStore.setProducts()`
- `useCategories()` → `productStore.setCategories()`
- `useTabs()` → `tabStore.setTabs()`

### ✅ Optimistic Updates

All mutations update the store immediately before server confirmation:

- `useMutationOpenTab()` → `tabStore.openTab()`
- `useMutationAddOrder()` → `tabStore.addOrder()`
- `useMutationCloseTab()` → `tabStore.closeTab()`

### ✅ Cache Invalidation

All mutations invalidate relevant queries on success to keep data fresh.

### ✅ Zod Validation

All data from Supabase is validated with Zod schemas before use.

### ✅ TypeScript Types

All hooks use generated Supabase types from `supabase.types.ts`.

### ✅ Error Handling

All hooks return `isLoading`, `isError`, and `error` for proper error handling.

## Stale Times

- **Products**: 5 minutes (products don't change often)
- **Categories**: 5 minutes
- **Modifiers**: 5 minutes
- **Pool Tables**: 30 seconds (change frequently)
- **Inventory**: 1 minute

## Business Logic Implemented

### Tab Mutations

- **Open Tab**: Creates new tab, sets status to 'open'
- **Add Order**: Inserts order + order_items in transaction
- **Close Tab**: Updates tab to 'paid', inserts payment record

### Pool Table Mutations

- **Start Session**: Creates session, sets table to 'occupied'
- **Stop Session**: Calculates billed minutes (15-min rounding), total charge, sets table to 'available'

### Inventory Mutations

- **Adjust Inventory**: Updates quantity, inserts log entry, validates non-negative

## Next Steps

1. **Set up TanStack Query Provider** in `src/app/providers.tsx`
2. **Replace direct Supabase calls** with these hooks in components
3. **Add Suspense boundaries** for loading states
4. **Add ErrorBoundary** for error handling
5. **Test optimistic updates** in the UI

## Example Provider Setup

```tsx
// src/app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Testing

All hooks can be tested with `@tanstack/react-query` testing utilities:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProducts } from '@/entities/product/model';

test('useProducts fetches products', async () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useProducts(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBeDefined();
});
```

See `TANSTACK-QUERY-HOOKS.md` for full documentation with examples.
