# TanStack Query Hooks Documentation

This document describes the TanStack Query hooks for fetching and mutating entities from Supabase.

## Overview

All query hooks are located in `src/entities/<entity>/model/queries.ts` and follow these patterns:

- **Queries**: `use<Entity>()` - Fetches data from Supabase
- **Mutations**: `useMutation<Action>()` - Modifies data in Supabase
- **Auto-sync**: All successful queries update their respective Zustand stores
- **Optimistic updates**: All mutations optimistically update the store before server confirmation
- **Cache invalidation**: All mutations invalidate relevant queries on success

## Product Entity

### `useProducts()`

Fetches all active products with their category and modifiers.

```tsx
import { useProducts } from '@/entities/product/model';

function ProductList() {
  const { data: products, isLoading, error } = useProducts();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {products?.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

**Features:**

- Automatically updates `productStore.setProducts()` on success
- `staleTime: 5 minutes` (products don't change often)
- Includes modifiers array for each product

### `useCategories()`

Fetches all categories sorted by `sort_order`.

```tsx
import { useCategories } from '@/entities/product/model';

function CategoryTabs() {
  const { data: categories } = useCategories();

  return (
    <div>
      {categories?.map(cat => (
        <button key={cat.id} style={{ backgroundColor: cat.color }}>
          {cat.name}
        </button>
      ))}
    </div>
  );
}
```

**Features:**

- Automatically updates `productStore.setCategories()` on success
- `staleTime: 5 minutes`
- Includes happy hour time ranges

### `useModifiers()`

Fetches all modifiers sorted by `sort_order`.

```tsx
import { useModifiers } from '@/entities/product/model';

function ModifierList() {
  const { data: modifiers } = useModifiers();

  return (
    <div>
      {modifiers?.map(mod => (
        <label key={mod.id}>
          <input type="checkbox" />
          {mod.name} (+${mod.priceDelta})
        </label>
      ))}
    </div>
  );
}
```

**Features:**

- Automatically updates `productStore.setModifiers()` on success
- `staleTime: 5 minutes`

---

## Tab Entity

### `useTabs(shiftId?: string)`

Fetches all open tabs for the current shift with all orders and order items.

```tsx
import { useTabs } from '@/entities/tab/model';

function TabList({ shiftId }: { shiftId: string }) {
  const { data: tabs, isLoading } = useTabs(shiftId);

  return (
    <div>
      {tabs?.map(tab => (
        <div key={tab.id}>
          {tab.customerName} - Table {tab.tableNumber}
        </div>
      ))}
    </div>
  );
}
```

**Features:**

- Automatically updates `tabStore.setTabs()` on success
- Only fetches tabs with `status = 'open'`
- Includes nested orders and order_items with product details
- Query is disabled if `shiftId` is not provided

### `useTab(id: string)`

Fetches a single tab with all orders and order items.

```tsx
import { useTab } from '@/entities/tab/model';

function TabDetail({ tabId }: { tabId: string }) {
  const { data: tab } = useTab(tabId);

  return (
    <div>
      <h2>{tab?.customerName}</h2>
      <ul>
        {tab?.items?.map(item => (
          <li key={item.id}>
            {item.quantity}x {item.product?.name} - ${item.unitPrice}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Features:**

- Fetches a single tab by ID
- Includes all orders and order items with product details
- Query is disabled if `id` is not provided

### `useMutationOpenTab()`

Opens a new tab. Optimistically updates the store.

```tsx
import { useMutationOpenTab } from '@/entities/tab/model';

function OpenTabButton({ staffId, shiftId }: { staffId: string; shiftId: string }) {
  const openTab = useMutationOpenTab();

  const handleOpenTab = () => {
    openTab.mutate({
      customerName: 'John Doe',
      tableNumber: 5,
      staffId,
      shiftId,
      status: 'open',
      notes: null,
    });
  };

  return (
    <button onClick={handleOpenTab} disabled={openTab.isPending}>
      Open Tab
    </button>
  );
}
```

**Features:**

- Optimistically updates `tabStore.openTab()` before server confirmation
- Invalidates `['tabs']` query on success
- Returns the newly created tab

### `useMutationAddOrder()`

Adds an order with items to a tab. Uses Supabase transaction for atomicity.

```tsx
import { useMutationAddOrder } from '@/entities/tab/model';

function AddOrderButton({ tabId, staffId }: { tabId: string; staffId: string }) {
  const addOrder = useMutationAddOrder();

  const handleAddOrder = () => {
    addOrder.mutate({
      tabId,
      order: {
        staffId,
        status: 'pending',
        notes: null,
      },
      items: [
        {
          productId: 'product-uuid',
          quantity: 2,
          unitPrice: 6.5,
          modifierIds: [],
          modifierPriceDelta: 0,
          notes: null,
        },
      ],
    });
  };

  return (
    <button onClick={handleAddOrder} disabled={addOrder.isPending}>
      Add Order
    </button>
  );
}
```

**Features:**

- Optimistically updates `tabStore.addOrder()` before server confirmation
- Inserts order and order_items in a transaction
- Invalidates `['tabs']` query on success
- Returns the created order and items

### `useMutationCloseTab()`

Closes a tab and creates a payment record.

```tsx
import { useMutationCloseTab } from '@/entities/tab/model';

function CloseTabButton({ tabId, processedBy }: { tabId: string; processedBy: string }) {
  const closeTab = useMutationCloseTab();

  const handleCloseTab = () => {
    closeTab.mutate({
      tabId,
      amount: 45.5,
      tipAmount: 9.0,
      method: 'card',
      processedBy,
      squarePaymentId: 'sq-payment-id',
      squareReceiptUrl: 'https://square.com/receipt',
    });
  };

  return (
    <button onClick={handleCloseTab} disabled={closeTab.isPending}>
      Close Tab
    </button>
  );
}
```

**Features:**

- Optimistically updates `tabStore.closeTab()` before server confirmation
- Updates tab status to `'paid'` and sets `closed_at`
- Inserts payment record
- Invalidates `['tabs']` query on success

---

## Pool Table Entity

### `usePoolTables()`

Fetches all pool tables with current session status.

```tsx
import { usePoolTables } from '@/entities/pool-table/model';

function PoolTableGrid() {
  const { data: tables } = usePoolTables();

  return (
    <div>
      {tables?.map(table => (
        <div key={table.id}>
          Table {table.number} - {table.status}
        </div>
      ))}
    </div>
  );
}
```

**Features:**

- Fetches all pool tables sorted by number
- Includes current session data
- `staleTime: 30 seconds` (pool tables change frequently)

### `usePoolTable(id: string)`

Fetches a single pool table by ID.

```tsx
import { usePoolTable } from '@/entities/pool-table/model';

function PoolTableDetail({ tableId }: { tableId: string }) {
  const { data: table } = usePoolTable(tableId);

  return (
    <div>
      <h2>{table?.label}</h2>
      <p>Rate: ${table?.ratePerHour}/hour</p>
      <p>Status: {table?.status}</p>
    </div>
  );
}
```

**Features:**

- Fetches a single pool table by ID
- Includes current session data
- Query is disabled if `id` is not provided

### `useMutationStartSession()`

Starts a new pool session. Updates pool table status to 'occupied'.

```tsx
import { useMutationStartSession } from '@/entities/pool-table/model';

function StartSessionButton({ tableId, tabId }: { tableId: string; tabId: string | null }) {
  const startSession = useMutationStartSession();

  const handleStart = () => {
    startSession.mutate({ tableId, tabId });
  };

  return (
    <button onClick={handleStart} disabled={startSession.isPending}>
      Start Session
    </button>
  );
}
```

**Features:**

- Inserts new pool_session record
- Updates pool_table status to `'occupied'` and sets `current_session_id`
- Invalidates `['pool-tables']` and `['pool-sessions']` queries on success

### `useMutationStopSession()`

Stops a pool session. Calculates billed minutes and total charge.

```tsx
import { useMutationStopSession } from '@/entities/pool-table/model';

function StopSessionButton({
  sessionId,
  tableId,
  ratePerHour,
}: {
  sessionId: string;
  tableId: string;
  ratePerHour: number;
}) {
  const stopSession = useMutationStopSession();

  const handleStop = () => {
    stopSession.mutate({ sessionId, tableId, ratePerHour });
  };

  return (
    <button onClick={handleStop} disabled={stopSession.isPending}>
      Stop Session
    </button>
  );
}
```

**Features:**

- Fetches session start time
- Calculates elapsed minutes
- Rounds up to nearest 15-minute block
- Calculates total charge: `(billedMinutes / 60) * ratePerHour`
- Updates pool_session with `stopped_at`, `billed_minutes`, `total_charge`
- Updates pool_table status to `'available'` and clears `current_session_id`
- Invalidates `['pool-tables']`, `['pool-sessions']`, and `['tabs']` queries on success

### `usePoolSessionsByTab(tabId: string)`

Fetches all pool sessions for a specific tab.

```tsx
import { usePoolSessionsByTab } from '@/entities/pool-table/model';

function TabPoolSessions({ tabId }: { tabId: string }) {
  const { data: sessions } = usePoolSessionsByTab(tabId);

  return (
    <div>
      {sessions?.map(session => (
        <div key={session.id}>
          Table {session.tableId} - ${session.totalCharge}
        </div>
      ))}
    </div>
  );
}
```

**Features:**

- Fetches all pool sessions for a tab
- Sorted by `started_at` descending
- Query is disabled if `tabId` is not provided

---

## Inventory Entity

### `useInventory()`

Fetches all inventory with product names.

```tsx
import { useInventory } from '@/entities/inventory/model';

function InventoryList() {
  const { data: inventory } = useInventory();

  return (
    <div>
      {inventory?.map(item => (
        <div key={item.id}>
          {item.quantityOnHand} {item.unit}
        </div>
      ))}
    </div>
  );
}
```

**Features:**

- Fetches all inventory items
- Includes product name and SKU
- Sorted by product name
- `staleTime: 1 minute`

### `useInventoryByProduct(productId: string)`

Fetches inventory for a specific product.

```tsx
import { useInventoryByProduct } from '@/entities/inventory/model';

function ProductInventory({ productId }: { productId: string }) {
  const { data: inventory } = useInventoryByProduct(productId);

  return (
    <div>
      Stock: {inventory?.quantityOnHand} {inventory?.unit}
    </div>
  );
}
```

**Features:**

- Fetches inventory for a single product
- Query is disabled if `productId` is not provided

### `useLowStockInventory()`

Fetches items where `quantity_on_hand <= low_stock_threshold`.

```tsx
import { useLowStockInventory } from '@/entities/inventory/model';

function LowStockAlert() {
  const { data: lowStock } = useLowStockInventory();

  if (!lowStock?.length) return null;

  return <div className="alert">{lowStock.length} items low on stock!</div>;
}
```

**Features:**

- Fetches only low stock items
- Sorted by quantity ascending (lowest first)
- `staleTime: 1 minute`

### `useMutationAdjustInventory()`

Adjusts inventory quantity and logs the change.

```tsx
import { useMutationAdjustInventory } from '@/entities/inventory/model';

function AdjustInventoryButton({ productId, staffId }: { productId: string; staffId: string }) {
  const adjustInventory = useMutationAdjustInventory();

  const handleAdjust = () => {
    adjustInventory.mutate({
      productId,
      quantityDelta: -5, // Negative for decrease, positive for increase
      reason: 'Breakage',
      staffId,
    });
  };

  return (
    <button onClick={handleAdjust} disabled={adjustInventory.isPending}>
      Adjust Inventory
    </button>
  );
}
```

**Features:**

- Updates inventory `quantity_on_hand`
- Inserts inventory_log entry
- Validates that quantity doesn't go negative
- Invalidates `['inventory']` and `['inventory-log']` queries on success
- Returns updated inventory and log entry

### `useInventoryLog(productId?: string)`

Fetches inventory log entries, optionally filtered by product.

```tsx
import { useInventoryLog } from '@/entities/inventory/model';

function InventoryHistory({ productId }: { productId?: string }) {
  const { data: logs } = useInventoryLog(productId);

  return (
    <div>
      {logs?.map(log => (
        <div key={log.id}>
          {log.quantityDelta > 0 ? '+' : ''}
          {log.quantityDelta} - {log.reason}
        </div>
      ))}
    </div>
  );
}
```

**Features:**

- Fetches up to 100 most recent log entries
- Includes product and staff details
- Sorted by `created_at` descending
- Optional filter by `productId`

---

## Error Handling

All hooks handle loading, error, and empty states:

```tsx
function MyComponent() {
  const { data, isLoading, error, isError } = useProducts();

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage error={error} />;
  if (!data?.length) return <EmptyState />;

  return <ProductList products={data} />;
}
```

## Optimistic Updates

All mutations implement optimistic updates for fast UX:

```tsx
const openTab = useMutationOpenTab();

// Store is updated immediately (optimistic)
openTab.mutate(data);

// If server fails, TanStack Query automatically rolls back
```

## Cache Invalidation

Mutations automatically invalidate related queries:

```tsx
// After closing a tab, these queries are refetched:
queryClient.invalidateQueries({ queryKey: ['tabs'] });
```

## Best Practices

1. **Always handle loading states** - Use `isLoading` to show spinners
2. **Always handle errors** - Use `isError` and `error` to show error messages
3. **Use optimistic updates** - All mutations already implement this
4. **Don't call Supabase directly** - Always use these hooks
5. **Validate with Zod** - All data is validated before use
6. **Check empty states** - Use `!data?.length` to show empty states
