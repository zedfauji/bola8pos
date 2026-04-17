# Zustand Entity Stores

All entity stores have been generated following FSD architecture and TypeScript strict mode.

## Store Locations

- `src/entities/tab/model/store.ts` - Tab management
- `src/entities/pool-table/model/store.ts` - Pool table and session management
- `src/entities/product/model/store.ts` - Product, category, and modifier management
- `src/entities/staff/model/store.ts` - Staff authentication and shift management
- `src/entities/inventory/model/store.ts` - Inventory tracking and alerts
- `src/entities/payment/model/store.ts` - Payment records

## Persistence Strategy

**Persisted stores** (survive page reload):

- `useTabStore` - Tabs, orders, and order items
- `usePoolTableStore` - Pool tables and sessions
- `useStaffStore` - Current staff and shift authentication

**Non-persisted stores** (fetched fresh on load):

- `useProductStore` - Products are read-only in POS
- `useInventoryStore` - Inventory levels need fresh data
- `usePaymentStore` - Payment records are historical

## Store Features

### Tab Store (`useTabStore`)

**State:**

- `tabs: Tab[]` - All tabs (open and closed)
- `orders: Order[]` - All orders
- `orderItems: OrderItem[]` - All order items
- `activeTabId: string | null` - Currently focused tab

**Actions:**

- `openTab(data)` - Create new tab
- `closeTab(id)` - Close existing tab
- `addOrder(tabId, order, items)` - Add order with items to tab
- `setActiveTab(id)` - Set active tab for UI
- `updateTabStatus(id, status)` - Update tab status
- `setFromRealtime(payload)` - Handle Supabase realtime updates

**Selectors:**

- `selectOpenTabs()` - Get all open tabs
- `selectTabById(id)` - Get specific tab
- `selectOrdersByTabId(tabId)` - Get orders for tab
- `selectOrderItemsByOrderId(orderId)` - Get items for order

### Pool Table Store (`usePoolTableStore`)

**State:**

- `tables: PoolTable[]` - All pool tables
- `sessions: PoolSession[]` - All pool sessions

**Actions:**

- `updateTableStatus(id, status)` - Update table status
- `startSession(tableId, tabId)` - Start new pool session
- `stopSession(sessionId, billedMinutes, totalCharge)` - Stop session and bill
- `setFromRealtime(payload)` - Handle realtime updates

**Selectors:**

- `selectAvailableTables()` - Get available tables
- `selectTableById(id)` - Get specific table
- `selectActiveSessionForTable(tableId)` - Get active session for table
- `selectActiveSessions()` - Get all active sessions
- `selectSessionsByTabId(tabId)` - Get sessions for tab

### Product Store (`useProductStore`)

**State:**

- `products: Product[]` - All products
- `categories: Category[]` - All categories
- `modifiers: Modifier[]` - All modifiers
- `lastFetched: Date | null` - Last fetch timestamp

**Actions:**

- `setProducts(products)` - Set all products
- `setCategories(categories)` - Set all categories
- `setModifiers(modifiers)` - Set all modifiers
- `setFromRealtime(payload)` - Handle realtime updates

**Selectors:**

- `selectActiveProducts()` - Get active products
- `selectProductsByCategoryId(categoryId)` - Get products by category
- `selectProductById(id)` - Get specific product
- `selectCategoryById(id)` - Get specific category
- `selectModifierById(id)` - Get specific modifier
- `selectModifiersByIds(ids)` - Get multiple modifiers
- `selectIsHappyHourActive(categoryId, currentTime)` - Check happy hour status

### Staff Store (`useStaffStore`)

**State:**

- `currentStaff: Staff | null` - Logged-in staff member
- `currentShift: Shift | null` - Active shift
- `isAuthenticated: boolean` - Authentication status
- `allStaff: Staff[]` - All staff members
- `allShifts: Shift[]` - All shifts

**Actions:**

- `login(staff, shift)` - Log in staff and start shift
- `logout()` - Log out and clear shift
- `setShift(shift)` - Update current shift
- `setAllStaff(staff)` - Set all staff
- `setAllShifts(shifts)` - Set all shifts
- `setFromRealtime(payload)` - Handle realtime updates

**Selectors:**

- `selectActiveStaff()` - Get active staff members
- `selectStaffById(id)` - Get specific staff
- `selectActiveShifts()` - Get active shifts
- `selectShiftById(id)` - Get specific shift
- `selectShiftsByStaffId(staffId)` - Get shifts for staff

### Inventory Store (`useInventoryStore`)

**State:**

- `inventory: Inventory[]` - All inventory items
- `inventoryLogs: InventoryLog[]` - All inventory logs
- `lowStockAlerts: string[]` - Product IDs with low stock

**Actions:**

- `updateQuantity(productId, delta)` - Update inventory quantity
- `setInventory(items)` - Set all inventory
- `setInventoryLogs(logs)` - Set all logs
- `refreshAlerts()` - Recalculate low stock alerts
- `setFromRealtime(payload)` - Handle realtime updates

**Selectors:**

- `selectInventoryByProductId(productId)` - Get inventory for product
- `selectLowStockItems()` - Get all low stock items
- `selectIsLowStock(productId)` - Check if product is low stock
- `selectInventoryLogsByProductId(productId)` - Get logs for product
- `selectRecentInventoryLogs(limit)` - Get recent logs

### Payment Store (`usePaymentStore`)

**State:**

- `payments: Payment[]` - All payment records

**Actions:**

- `recordPayment(data)` - Record new payment
- `setPayments(payments)` - Set all payments
- `setFromRealtime(payload)` - Handle realtime updates

**Selectors:**

- `selectPaymentByTabId(tabId)` - Get payment for tab
- `selectPaymentsByMethod(method)` - Get payments by method
- `selectPaymentsByStaffId(staffId)` - Get payments by staff
- `selectPaymentsByDateRange(startDate, endDate)` - Get payments in range
- `selectTotalRevenue(startDate, endDate)` - Calculate revenue
- `selectTotalTips(startDate, endDate)` - Calculate tips

## Usage Examples

### Opening a Tab

```typescript
import { useTabStore } from '@/entities/tab/model/store';

const { openTab } = useTabStore();

openTab({
  customerName: 'John Doe',
  tableNumber: 5,
  staffId: currentStaffId,
  shiftId: currentShiftId,
  status: 'open',
  notes: null,
});
```

### Starting a Pool Session

```typescript
import { usePoolTableStore } from '@/entities/pool-table/model/store';

const { startSession } = usePoolTableStore();

startSession(tableId, tabId);
```

### Checking Low Stock

```typescript
import { useInventoryStore, selectIsLowStock } from '@/entities/inventory/model/store';

const isLowStock = selectIsLowStock(productId);
if (isLowStock) {
  // Show alert badge
}
```

### Authentication

```typescript
import { useStaffStore } from '@/entities/staff/model/store';

const { login, logout, isAuthenticated } = useStaffStore();

// Login
login(staffData, shiftData);

// Check auth
if (isAuthenticated) {
  // Allow access
}

// Logout
logout();
```

## Realtime Integration

All stores include a `setFromRealtime` action for Supabase Realtime subscriptions. Set up subscriptions in the relevant feature or widget components:

```typescript
import { supabase } from '@/shared/lib/supabase';
import { useTabStore } from '@/entities/tab/model/store';

useEffect(() => {
  const channel = supabase
    .channel('tabs-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs' }, payload => {
      useTabStore.getState().setFromRealtime({
        eventType: payload.eventType,
        new: payload.new,
        old: payload.old,
      });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## Next Steps

1. Set up Supabase Realtime subscriptions in app providers
2. Create TanStack Query hooks for async operations
3. Build feature components that use these stores
4. Add optimistic updates for mutations
