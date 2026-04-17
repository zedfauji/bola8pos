# TanStack Query Hooks - Implementation Checklist

## ✅ Completed

- [x] Created `src/entities/product/model/queries.ts`
  - [x] `useProducts()` - Fetches all active products with modifiers
  - [x] `useCategories()` - Fetches all categories
  - [x] `useModifiers()` - Fetches all modifiers
  - [x] Auto-updates productStore on success
  - [x] 5-minute stale time

- [x] Created `src/entities/tab/model/queries.ts`
  - [x] `useTabs(shiftId)` - Fetches all open tabs for shift
  - [x] `useTab(id)` - Fetches single tab with orders
  - [x] `useMutationOpenTab()` - Opens new tab with optimistic update
  - [x] `useMutationAddOrder()` - Adds order + items in transaction
  - [x] `useMutationCloseTab()` - Closes tab + creates payment
  - [x] Auto-updates tabStore on success
  - [x] Optimistic updates for all mutations

- [x] Created `src/entities/pool-table/model/queries.ts`
  - [x] `usePoolTables()` - Fetches all pool tables
  - [x] `usePoolTable(id)` - Fetches single pool table
  - [x] `useMutationStartSession()` - Starts pool session
  - [x] `useMutationStopSession()` - Stops session with billing calculation
  - [x] `usePoolSessionsByTab(tabId)` - Fetches sessions for tab
  - [x] 30-second stale time (frequent updates)
  - [x] 15-minute rounding for billing

- [x] Created `src/entities/inventory/model/queries.ts`
  - [x] `useInventory()` - Fetches all inventory
  - [x] `useInventoryByProduct(productId)` - Fetches single product inventory
  - [x] `useLowStockInventory()` - Fetches low stock items
  - [x] `useMutationAdjustInventory()` - Adjusts quantity + logs change
  - [x] `useInventoryLog(productId?)` - Fetches inventory history
  - [x] 1-minute stale time
  - [x] Validates non-negative quantities

- [x] Created barrel exports (`index.ts`) for all entities
- [x] Created comprehensive documentation (`TANSTACK-QUERY-HOOKS.md`)
- [x] Created quick reference guide (`QUERY-HOOKS-SUMMARY.md`)
- [x] Created example components (`QUERY-HOOKS-EXAMPLE.tsx`)
- [x] All files pass TypeScript validation (no errors)
- [x] All hooks use Zod validation
- [x] All hooks use generated Supabase types

## 🔲 Next Steps (To Do)

### 1. Set Up TanStack Query Provider

- [ ] Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
- [ ] Create QueryClient in `src/app/providers.tsx`
- [ ] Wrap app with `QueryClientProvider`
- [ ] Add `ReactQueryDevtools` for debugging

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

```tsx
// src/app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30 seconds default
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

### 2. Replace Direct Supabase Calls

- [ ] Find all components calling `supabase.from()` directly
- [ ] Replace with appropriate query hooks
- [ ] Remove direct Supabase imports from components
- [ ] Test each replacement

### 3. Add Loading States

- [ ] Add `<Suspense>` boundaries for page-level components
- [ ] Create loading skeleton components
- [ ] Use `isLoading` from hooks to show spinners
- [ ] Test loading states with slow network

### 4. Add Error Handling

- [ ] Wrap components with `<ErrorBoundary>` from `react-error-boundary`
- [ ] Create error fallback components
- [ ] Use `isError` and `error` from hooks
- [ ] Add retry buttons for failed queries
- [ ] Test error states by disconnecting Supabase

### 5. Add Empty States

- [ ] Create empty state components
- [ ] Check `!data?.length` in components
- [ ] Show helpful messages when no data
- [ ] Add "Create" buttons in empty states

### 6. Test Optimistic Updates

- [ ] Test opening a tab (should appear immediately)
- [ ] Test adding an order (should appear immediately)
- [ ] Test closing a tab (should disappear immediately)
- [ ] Test with slow network to see optimistic updates
- [ ] Verify rollback on error

### 7. Test Cache Invalidation

- [ ] Open tab in one component, verify it appears in another
- [ ] Close tab, verify it disappears from all lists
- [ ] Adjust inventory, verify it updates in all views
- [ ] Test with React Query Devtools

### 8. Add Realtime Subscriptions (Optional)

- [ ] Set up Supabase Realtime subscriptions in stores
- [ ] Use `queryClient.setQueryData()` to update cache on realtime events
- [ ] Test multi-user scenarios
- [ ] Handle conflicts between optimistic updates and realtime

### 9. Add Offline Support (Optional)

- [ ] Configure TanStack Query for offline mode
- [ ] Use `persistQueryClient` for offline persistence
- [ ] Show offline indicator in UI
- [ ] Queue mutations when offline
- [ ] Sync when back online

### 10. Write Tests

- [ ] Test query hooks with `@testing-library/react`
- [ ] Test mutation hooks with mock Supabase client
- [ ] Test optimistic updates
- [ ] Test error handling
- [ ] Test cache invalidation

### 11. Performance Optimization

- [ ] Add pagination for large lists (tabs, inventory logs)
- [ ] Use `keepPreviousData` for smooth pagination
- [ ] Add infinite scroll for long lists
- [ ] Optimize re-renders with `React.memo`
- [ ] Profile with React DevTools

### 12. Documentation

- [ ] Add JSDoc comments to all hooks
- [ ] Document query keys in a central file
- [ ] Create troubleshooting guide
- [ ] Add migration guide from direct Supabase calls

## 📋 Testing Checklist

### Product Queries

- [ ] `useProducts()` fetches all active products
- [ ] `useCategories()` fetches all categories
- [ ] `useModifiers()` fetches all modifiers
- [ ] Products include modifiers array
- [ ] Store is updated on success
- [ ] Stale time is 5 minutes

### Tab Queries & Mutations

- [ ] `useTabs(shiftId)` fetches open tabs for shift
- [ ] `useTab(id)` fetches single tab with orders
- [ ] `useMutationOpenTab()` creates new tab
- [ ] `useMutationAddOrder()` adds order + items
- [ ] `useMutationCloseTab()` closes tab + creates payment
- [ ] Optimistic updates work correctly
- [ ] Store is updated on success
- [ ] Cache is invalidated on mutations

### Pool Table Queries & Mutations

- [ ] `usePoolTables()` fetches all tables
- [ ] `usePoolTable(id)` fetches single table
- [ ] `useMutationStartSession()` starts session
- [ ] `useMutationStopSession()` stops session
- [ ] Billing calculation is correct (15-min rounding)
- [ ] Table status updates correctly
- [ ] Stale time is 30 seconds

### Inventory Queries & Mutations

- [ ] `useInventory()` fetches all inventory
- [ ] `useInventoryByProduct(id)` fetches single product
- [ ] `useLowStockInventory()` fetches low stock items
- [ ] `useMutationAdjustInventory()` adjusts quantity
- [ ] `useInventoryLog()` fetches history
- [ ] Negative quantities are rejected
- [ ] Log entries are created
- [ ] Stale time is 1 minute

## 🐛 Known Issues / Limitations

- [ ] None yet - add issues as they're discovered

## 📚 Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Supabase Docs](https://supabase.com/docs)
- [Zod Docs](https://zod.dev)
- [React Query Devtools](https://tanstack.com/query/latest/docs/react/devtools)

## 🎯 Success Criteria

- [ ] All direct Supabase calls replaced with hooks
- [ ] All components handle loading states
- [ ] All components handle error states
- [ ] All components handle empty states
- [ ] Optimistic updates work smoothly
- [ ] Cache invalidation keeps data fresh
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Performance is acceptable (< 100ms for most queries)
- [ ] User experience is smooth and responsive
