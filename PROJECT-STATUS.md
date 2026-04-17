# Bar POS - Project Status

**Last Updated**: 2026-04-14  
**Phase**: Foundation Complete ✅

---

## ✅ COMPLETED: Foundation Layer (Tasks 1-10)

### 1. Development Tooling ✅

- ESLint v9 (flat config) with TypeScript support
- Prettier with consistent formatting
- Vitest + React Testing Library
- Husky git hooks (pre-commit: lint-staged, pre-push: typecheck)
- TypeScript strict mode with path aliases (@app, @pages, @widgets, @features, @entities, @shared)
- **Status**: All checks passing

### 2. FSD Architecture Enforcement ✅

- `eslint-plugin-boundaries` configured with 6 layer types
- Strict dependency rules: shared ← entities ← features ← widgets ← pages ← app
- Barrel exports banned (`export *`)
- **Status**: All boundaries enforced, 0 violations

### 3. FSD Folder Structure ✅

- Complete layer hierarchy created
- 5 pages: pos, pool-tables, inventory, staff, reports
- 4 widgets: OrderPanel, PoolTableGrid, TabDrawer, PaymentModal
- 9 features: open-tab, add-item-to-tab, close-tab, start-pool-timer, stop-pool-timer, process-payment, adjust-inventory, clock-in-staff, remove-item-from-tab
- 6 entities: tab, pool-table, product, inventory, staff, payment
- **Status**: All directories created with .gitkeep files

### 4. Domain Contracts (Single Source of Truth) ✅

- **File**: `src/shared/lib/domain.ts`
- 7 shared primitives (Money, Uuid, Timestamp, Pin, HexColor, TimeString, Url)
- 6 enums with TypeScript constants
- 15 business entities × 3 schemas each (Full, Create, Update) = 47 total schemas
- Domain namespace export for organized imports
- **Status**: Complete, all types validated with Zod

### 5. Domain Helpers (Pure Business Logic) ✅

- **File**: `src/shared/lib/domain-helpers.ts`
- 9 pure functions: calculatePoolCharge, resolveProductPrice, calculateOrderItemLineTotal, calculateTabSubtotal, calculateTipAmount, formatMoney, formatElapsed, isHappyHourActive, generateIdempotencyKey
- **Tests**: 63 unit tests, all passing
- **Status**: Complete with full edge case coverage

### 6. Supabase Contracts ✅

- **File**: `src/shared/lib/supabase-contracts.ts`
- SupabaseQueryResult<T> wrapper type
- 6 typed query result shapes for joined queries
- 6 type guards for runtime validation
- 6 Supabase error code constants with user-friendly messages
- 4 error handling utility functions
- **Status**: Complete, ready for Supabase integration

### 7. Edge Function Contracts ✅

- **File**: `src/shared/lib/edge-function-contracts.ts`
- Result<T, E> type for type-safe error handling
- 4 edge function contracts: process-payment, close-shift, generate-report, void-order
- Full Zod validation for requests and responses
- Typed caller functions for each edge function
- **Status**: Complete, ready for edge function implementation

### 8. Result Type Infrastructure ✅

- **File**: `src/shared/lib/result.ts`
- Result<T, E> type: `{ ok: true, data: T } | { ok: false, error: E }`
- Helper constructors: ok(), err()
- Result utilities: mapResult(), unwrapResult(), isOk(), isErr()
- AppError type with 14 error codes
- 14 error factory functions
- Supabase integration: supabaseQuery(), supabaseMutation(), parseSupabaseError()
- **Tests**: 50 unit tests, all passing
- **Docs**: RESULT-TYPE.md
- **Status**: Complete, enforced across all async operations

### 9. Structured Logger ✅

- **File**: `src/shared/lib/logger.ts`
- PII-safe logging with TypeScript enforcement (banned keys: pin, cardNumber, cvv, etc.)
- 4 log levels: debug, info, warn, error
- Structured log entries with automatic context injection
- Multiple transports: console (dev), file (Tauri), remote (optional)
- App-level logger instance: `src/shared/lib/logger-instance.ts`
- Tauri command for file logging (rotating logs, 30-day retention)
- **Tests**: 28 unit tests, all passing
- **Docs**: LOGGER.md
- **Status**: Complete, ready for use throughout app

### 10. Shared Display Components ✅

- **Files**: `src/shared/ui/*.tsx`
- 18 POS-specific components built on shadcn/ui primitives:
  - MoneyDisplay: Formats currency with size variants
  - TimerDisplay: Displays elapsed time with warning state
  - StatusBadge: Color-coded status badges
  - QuantityControl: Three-button quantity selector with haptic feedback
  - MoneyInput: Currency input with cent-based storage
  - EmptyState: Centered empty state with icon and action
  - SectionHeader: Consistent page/section headers
  - LoadingSkeletons: Multiple skeleton components for loading states
  - PINKeypad: 10-key numeric keypad for PIN entry with large touch targets
  - POSButton: Extended button with large touch sizes (default/large/xl)
  - FormField: Consistent form field wrapper with label, error, hint
  - ConfirmDialog: Confirmation dialog with destructive variant
  - SearchInput: Debounced search input with clear button
  - DataTable: Generic table with TanStack Table, loading/empty states, search
  - AppShell: Main application layout with responsive sidebar
  - PageContainer: Consistent page wrapper with title and actions
  - SplitLayout: 60/40 split layout for POS screen (responsive)
  - ScrollArea: Consistent scrollable container wrapper
- 9 shadcn/ui primitives: Badge, Button, Input, Label, Skeleton, AlertDialog, Table, Sheet, ScrollArea
- Utility function: cn() for merging Tailwind classes
- **Status**: Complete, all components TypeScript strict

### 11. Storybook Design System Catalog ✅

- **Files**: `.storybook/*`, `src/shared/ui/*.stories.tsx`
- Storybook v10.3.5 configured with React Vite
- **Addons**: a11y, docs, chromatic
- **Decorators**: withQueryClient, withDarkTheme
- **Path Aliases**: All @shared, @entities, @features, etc. working
- **Barrel Export**: `src/shared/ui/index.ts` (ONLY barrel file in project)
- **Introduction Page**: Complete design system documentation
- **Design Token Stories**: ColorPalette, Typography, Spacing
- **Scripts**: `npm run storybook` (dev), `npm run build:storybook` (build)
- **Build Output**: `storybook-static/` (static HTML, offline reference)
- **Status**: Complete, builds with zero errors

---

## 📊 Test Coverage Summary

| Module         | Tests   | Status             |
| -------------- | ------- | ------------------ |
| domain-helpers | 63      | ✅ All passing     |
| result         | 50      | ✅ All passing     |
| logger         | 28      | ✅ All passing     |
| **TOTAL**      | **141** | **✅ All passing** |

---

## 🎯 NEXT PHASE: Entity Layer Implementation

### Phase 2A: Core Entities (Priority 1)

1. **Product Entity** (`src/entities/product/`)
   - [ ] model/types.ts (re-export from domain.ts)
   - [ ] model/store.ts (Zustand store with TanStack Query)
   - [ ] model/hooks.ts (useProducts, useProductById, useProductsByCategory)
   - [ ] ui/ProductCard.tsx (display product with price, happy hour indicator)
   - [ ] ui/ProductGrid.tsx (grid of products with category filter)
   - [ ] Tests + Storybook stories

2. **Tab Entity** (`src/entities/tab/`)
   - [ ] model/types.ts (re-export from domain.ts)
   - [ ] model/store.ts (Zustand store with Realtime subscription)
   - [ ] model/hooks.ts (useTabs, useTabById, useActiveTabsCount)
   - [ ] ui/TabCard.tsx (display tab with customer name, total, status)
   - [ ] ui/TabList.tsx (list of tabs with search/filter)
   - [ ] Tests + Storybook stories

3. **PoolTable Entity** (`src/entities/pool-table/`)
   - [ ] model/types.ts (re-export from domain.ts)
   - [ ] model/store.ts (Zustand store with timer logic)
   - [ ] model/hooks.ts (usePoolTables, usePoolTableById, useActiveSessionsCount)
   - [ ] ui/PoolTableCard.tsx (display table with timer, status)
   - [ ] ui/PoolTableGrid.tsx (grid of all tables)
   - [ ] Tests + Storybook stories

### Phase 2B: Supporting Entities (Priority 2)

4. **Staff Entity** (`src/entities/staff/`)
   - [ ] model/types.ts (re-export from domain.ts)
   - [ ] model/store.ts (Zustand store with current shift tracking)
   - [ ] model/hooks.ts (useStaff, useCurrentStaff, useActiveShift)
   - [ ] ui/StaffCard.tsx (display staff with role, shift status)
   - [ ] ui/StaffList.tsx (list of staff with clock-in status)
   - [ ] Tests + Storybook stories

5. **Inventory Entity** (`src/entities/inventory/`)
   - [ ] model/types.ts (re-export from domain.ts)
   - [ ] model/store.ts (Zustand store with low-stock alerts)
   - [ ] model/hooks.ts (useInventory, useInventoryById, useLowStockItems)
   - [ ] ui/InventoryCard.tsx (display inventory with stock level indicator)
   - [ ] ui/InventoryList.tsx (list with low-stock badges)
   - [ ] Tests + Storybook stories

6. **Payment Entity** (`src/entities/payment/`)
   - [ ] model/types.ts (re-export from domain.ts)
   - [ ] model/store.ts (Zustand store with payment history)
   - [ ] model/hooks.ts (usePayments, usePaymentById, useTodaysRevenue)
   - [ ] ui/PaymentCard.tsx (display payment with method, amount, tip)
   - [ ] ui/PaymentList.tsx (list of payments with date filter)
   - [ ] Tests + Storybook stories

---

## 🎯 NEXT PHASE: Feature Layer Implementation

### Phase 3A: Tab Management Features (Priority 1)

1. **open-tab** (`src/features/open-tab/`)
   - [ ] ui/OpenTabForm.tsx (form with customer name OR table number)
   - [ ] model/useOpenTab.ts (TanStack Query mutation)
   - [ ] Tests + Storybook stories

2. **add-item-to-tab** (`src/features/add-item-to-tab/`)
   - [ ] ui/AddItemButton.tsx (button with product selector)
   - [ ] model/useAddItemToTab.ts (TanStack Query mutation with optimistic update)
   - [ ] Tests + Storybook stories

3. **remove-item-from-tab** (`src/features/remove-item-from-tab/`)
   - [ ] ui/RemoveItemButton.tsx (button with confirmation)
   - [ ] model/useRemoveItemFromTab.ts (TanStack Query mutation)
   - [ ] Tests + Storybook stories

4. **close-tab** (`src/features/close-tab/`)
   - [ ] ui/CloseTabButton.tsx (button with validation)
   - [ ] model/useCloseTab.ts (TanStack Query mutation, checks for active pool sessions)
   - [ ] Tests + Storybook stories

### Phase 3B: Pool Table Features (Priority 2)

5. **start-pool-timer** (`src/features/start-pool-timer/`)
   - [ ] ui/StartTimerButton.tsx (button with tab selector)
   - [ ] model/useStartPoolTimer.ts (TanStack Query mutation)
   - [ ] Tests + Storybook stories

6. **stop-pool-timer** (`src/features/stop-pool-timer/`)
   - [ ] ui/StopTimerButton.tsx (button with charge preview)
   - [ ] model/useStopPoolTimer.ts (TanStack Query mutation, adds charge to tab)
   - [ ] Tests + Storybook stories

### Phase 3C: Payment & Staff Features (Priority 3)

7. **process-payment** (`src/features/process-payment/`)
   - [ ] ui/PaymentForm.tsx (form with amount, tip, method)
   - [ ] model/useProcessPayment.ts (calls edge function, integrates with Square)
   - [ ] Tests + Storybook stories

8. **clock-in-staff** (`src/features/clock-in-staff/`)
   - [ ] ui/ClockInForm.tsx (form with PIN entry)
   - [ ] model/useClockIn.ts (TanStack Query mutation)
   - [ ] Tests + Storybook stories

9. **adjust-inventory** (`src/features/adjust-inventory/`)
   - [ ] ui/AdjustInventoryForm.tsx (form with quantity adjustment)
   - [ ] model/useAdjustInventory.ts (TanStack Query mutation)
   - [ ] Tests + Storybook stories

---

## 🎯 NEXT PHASE: Widget Layer Implementation

### Phase 4: Composite UI Panels (Priority 1)

1. **OrderPanel** (`src/widgets/OrderPanel/`)
   - [ ] ui/OrderPanel.tsx (combines ProductGrid + QuantityControl + AddItemButton)
   - [ ] Tests + Storybook stories

2. **TabDrawer** (`src/widgets/TabDrawer/`)
   - [ ] ui/TabDrawer.tsx (combines TabCard + OrderItemList + CloseTabButton)
   - [ ] Tests + Storybook stories

3. **PoolTableGrid** (`src/widgets/PoolTableGrid/`)
   - [ ] ui/PoolTableGrid.tsx (combines PoolTableCard + StartTimerButton + StopTimerButton)
   - [ ] Tests + Storybook stories

4. **PaymentModal** (`src/widgets/PaymentModal/`)
   - [ ] ui/PaymentModal.tsx (combines PaymentForm + TabSummary)
   - [ ] Tests + Storybook stories

---

## 🎯 NEXT PHASE: Page Layer Implementation

### Phase 5: Route-Mapped Pages (Priority 1)

1. **POS Page** (`src/pages/pos/`)
   - [ ] index.tsx (combines OrderPanel + TabDrawer)
   - [ ] Tests

2. **Pool Tables Page** (`src/pages/pool-tables/`)
   - [ ] index.tsx (combines PoolTableGrid)
   - [ ] Tests

3. **Inventory Page** (`src/pages/inventory/`)
   - [ ] index.tsx (combines InventoryList + AdjustInventoryForm)
   - [ ] Tests

4. **Staff Page** (`src/pages/staff/`)
   - [ ] index.tsx (combines StaffList + ClockInForm)
   - [ ] Tests

5. **Reports Page** (`src/pages/reports/`)
   - [ ] index.tsx (combines PaymentList + RevenueChart)
   - [ ] Tests

---

## 🎯 NEXT PHASE: App Layer Implementation

### Phase 6: Application Shell (Priority 1)

1. **App Providers** (`src/app/`)
   - [ ] providers.tsx (TanStack Query, Zustand, ErrorBoundary)
   - [ ] router.tsx (React Router v6 with route definitions)
   - [ ] globals.css (Tailwind CSS v4 + shadcn/ui theme variables)
   - [ ] tauri-init.ts (Tauri event listeners, window setup)

2. **Main Entry** (`src/main.tsx`)
   - [ ] Render app with providers
   - [ ] Initialize Tauri
   - [ ] Set up logger

---

## 🚀 Deployment Checklist (Future)

### Supabase Setup

- [ ] Create database schema (15 tables)
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create database triggers (inventory auto-decrement)
- [ ] Deploy edge functions (4 functions)
- [ ] Configure Realtime subscriptions

### Tauri Setup

- [ ] Configure tauri.conf.json (Windows target, WebView2)
- [ ] Set up code signing certificate
- [ ] Configure auto-updater
- [ ] Build Windows installer (.msi)

### Square Integration

- [ ] Register Square application
- [ ] Configure OAuth flow
- [ ] Test Terminal API integration
- [ ] Set up webhook handlers

---

## 📝 Notes

### Architecture Decisions

- **FSD**: Strict layer boundaries enforced by ESLint
- **Error Handling**: All async operations return `Result<T, E>`
- **Logging**: Structured, PII-safe logs with automatic context injection
- **State Management**: Zustand for UI state, TanStack Query for server state
- **Validation**: Zod schemas for all entities, single source of truth in `domain.ts`

### Development Workflow

1. Write Zod schema in `domain.ts` (if new entity)
2. Create entity store with TanStack Query hooks
3. Build UI components with TypeScript strict props
4. Write Vitest tests (aim for 80%+ coverage)
5. Create Storybook stories for visual testing
6. Run `npm run lint && npm run typecheck && npm test` before commit
7. Git hooks enforce linting and type checking

### Performance Targets

- First Contentful Paint: < 1s
- Time to Interactive: < 2s
- Lighthouse Score: > 90
- Bundle Size: < 500KB (gzipped)

---

**Status**: Foundation complete. Ready to begin Phase 2A (Core Entities).
