# Supabase Contracts

## 📋 Overview

`src/shared/lib/supabase-contracts.ts` defines the **EXACT shape** of every Supabase query we make in this application. It extends the auto-generated `supabase.types.ts` with typed query result shapes for joined queries.

## 🎯 Purpose

1. **Type Safety** - Ensures all Supabase queries return properly typed data
2. **Query Documentation** - Documents the exact shape of complex joined queries
3. **Error Handling** - Provides consistent error parsing and handling
4. **Type Guards** - Runtime validation of query results

## 📦 What's Included

### 1. Query Result Wrapper

```typescript
type SupabaseQueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};
```

Wraps all Supabase query responses with data and error fields.

### 2. Typed Query Result Shapes (6 types)

#### `TabWithOrders`

Full tab with all orders and items (used in tab detail view).

```typescript
const { data, error } = await supabase
  .from('tabs')
  .select(
    `
    *,
    orders (
      *,
      order_items (
        *,
        product:products (*)
      )
    ),
    staff:profiles (*)
  `
  )
  .eq('id', tabId)
  .single();

// data is typed as TabWithOrders
```

#### `PoolTableWithSession`

Pool table with current session (used in pool table grid).

```typescript
const { data, error } = await supabase.from('pool_tables').select(`
    *,
    current_session:pool_sessions!current_session_id (*),
    tab:tabs (*)
  `);

// data is typed as PoolTableWithSession[]
```

#### `ProductWithDetails`

Product with category and modifiers (used in POS product grid).

```typescript
const { data, error } = await supabase
  .from('products')
  .select(
    `
    *,
    category:categories (*),
    modifiers (*)
  `
  )
  .eq('is_active', true);

// data is typed as ProductWithDetails[]
```

#### `InventoryWithProduct`

Inventory with product info (used in inventory page).

```typescript
const { data, error } = await supabase.from('inventory').select(`
    *,
    product:products (
      *,
      category:categories (*)
    )
  `);

// data is typed as InventoryWithProduct[]
```

#### `ShiftWithStaff`

Shift with staff info (used in shift management).

```typescript
const { data, error } = await supabase
  .from('shifts')
  .select(
    `
    *,
    staff:profiles (*)
  `
  )
  .is('clock_out', null);

// data is typed as ShiftWithStaff[]
```

#### `OrderWithItems`

Order with items and products (used in order history).

```typescript
const { data, error } = await supabase
  .from('orders')
  .select(
    `
    *,
    order_items (
      *,
      product:products (*)
    )
  `
  )
  .eq('tab_id', tabId);

// data is typed as OrderWithItems[]
```

### 3. Type Guards (6 functions)

Runtime validation of query results:

```typescript
isTabWithOrders(data: unknown): data is TabWithOrders
isPoolTableWithSession(data: unknown): data is PoolTableWithSession
isProductWithDetails(data: unknown): data is ProductWithDetails
isInventoryWithProduct(data: unknown): data is InventoryWithProduct
isShiftWithStaff(data: unknown): data is ShiftWithStaff
isOrderWithItems(data: unknown): data is OrderWithItems
```

**Usage:**

```typescript
const { data } = await supabase.from('tabs').select('*').single();

if (isTabWithOrders(data)) {
  // TypeScript knows data is TabWithOrders
  console.log(data.orders[0].order_items);
}
```

### 4. Supabase Error Codes

```typescript
export const SUPABASE_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505', // Duplicate record
  FOREIGN_KEY_VIOLATION: '23503', // Invalid reference
  NOT_NULL_VIOLATION: '23502', // Missing required field
  ROW_NOT_FOUND: 'PGRST116', // Record not found
  RLS_VIOLATION: '42501', // Permission denied
  CHECK_VIOLATION: '23514', // Invalid data
} as const;
```

### 5. Error Parsing Functions

#### `parseSupabaseError(error: PostgrestError): AppError`

Maps Supabase errors to user-friendly messages.

```typescript
const { data, error } = await supabase.from('tabs').insert(newTab);

if (error) {
  const appError = parseSupabaseError(error);
  console.error(appError.message); // "This record already exists"
}
```

#### `isSupabaseError(error, code): boolean`

Checks if an error matches a specific code.

```typescript
if (isSupabaseError(error, SUPABASE_ERROR_CODES.UNIQUE_VIOLATION)) {
  console.log('Duplicate record');
}
```

#### `hasError<T>(result): boolean`

Type guard for error results.

```typescript
const result = await supabase.from('tabs').select('*');

if (hasError(result)) {
  // TypeScript knows result.error is PostgrestError
  console.error(parseSupabaseError(result.error));
}
```

#### `hasData<T>(result): boolean`

Type guard for successful results.

```typescript
const result = await supabase.from('tabs').select('*');

if (hasData(result)) {
  // TypeScript knows result.data is T (not null)
  console.log(result.data);
}
```

## 🎨 Usage Patterns

### Pattern 1: Simple Query with Error Handling

```typescript
import { parseSupabaseError, hasData } from '@shared/lib/supabase-contracts';

const result = await supabase.from('tabs').select('*').eq('status', 'open');

if (hasData(result)) {
  return result.data;
}

throw parseSupabaseError(result.error);
```

### Pattern 2: Complex Joined Query

```typescript
import type { TabWithOrders } from '@shared/lib/supabase-contracts';
import { isTabWithOrders } from '@shared/lib/supabase-contracts';

const { data, error } = await supabase
  .from('tabs')
  .select(
    `
    *,
    orders (
      *,
      order_items (
        *,
        product:products (*)
      )
    ),
    staff:profiles (*)
  `
  )
  .eq('id', tabId)
  .single();

if (error) {
  throw parseSupabaseError(error);
}

if (!isTabWithOrders(data)) {
  throw new Error('Invalid tab data structure');
}

// TypeScript knows data is TabWithOrders
const firstOrder = data.orders[0];
const firstItem = firstOrder.order_items[0];
console.log(firstItem.product.name);
```

### Pattern 3: Error Code Handling

```typescript
import {
  SUPABASE_ERROR_CODES,
  isSupabaseError,
  parseSupabaseError,
} from '@shared/lib/supabase-contracts';

const { data, error } = await supabase.from('tabs').insert(newTab);

if (error) {
  if (isSupabaseError(error, SUPABASE_ERROR_CODES.UNIQUE_VIOLATION)) {
    // Handle duplicate
    console.log('Tab already exists');
  } else if (isSupabaseError(error, SUPABASE_ERROR_CODES.RLS_VIOLATION)) {
    // Handle permission denied
    console.log('Permission denied');
  } else {
    // Generic error
    const appError = parseSupabaseError(error);
    console.error(appError.message);
  }
}
```

### Pattern 4: Type-Safe Query Results

```typescript
import type { SupabaseQueryResult, ProductWithDetails } from '@shared/lib/supabase-contracts';

async function fetchProducts(): Promise<SupabaseQueryResult<ProductWithDetails[]>> {
  return await supabase
    .from('products')
    .select(
      `
      *,
      category:categories (*),
      modifiers (*)
    `
    )
    .eq('is_active', true);
}

// Usage
const result = await fetchProducts();

if (hasData(result)) {
  result.data.forEach(product => {
    console.log(product.category.name); // Type-safe!
    console.log(product.modifiers.length); // Type-safe!
  });
}
```

## 🔧 Generating Supabase Types

The `Database` type in `supabase-contracts.ts` is a placeholder. To generate actual types from your Supabase schema:

```bash
# Install Supabase CLI
npm install -D supabase

# Generate types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/lib/supabase.types.ts
```

Then import and use in `supabase-contracts.ts`:

```typescript
import type { Database } from './supabase.types';
```

## 📚 Error Code Reference

| Code     | Constant              | Meaning                | User Message                          |
| -------- | --------------------- | ---------------------- | ------------------------------------- |
| 23505    | UNIQUE_VIOLATION      | Duplicate record       | "This record already exists"          |
| 23503    | FOREIGN_KEY_VIOLATION | Invalid reference      | "Invalid reference to related record" |
| 23502    | NOT_NULL_VIOLATION    | Missing required field | "Required field is missing"           |
| PGRST116 | ROW_NOT_FOUND         | Record not found       | "Record not found"                    |
| 42501    | RLS_VIOLATION         | Permission denied      | "Permission denied"                   |
| 23514    | CHECK_VIOLATION       | Invalid data           | "Invalid data"                        |

## 🚨 Best Practices

1. **Always use type guards** - Validate query results at runtime
2. **Parse all errors** - Use `parseSupabaseError()` for consistent error messages
3. **Document queries** - Add JSDoc comments showing the exact query
4. **Use typed results** - Define result shapes for all joined queries
5. **Check error codes** - Handle specific errors differently (e.g., duplicates)

## 🎯 When to Add New Types

Add a new typed result shape when:

1. You have a complex joined query (2+ tables)
2. The query is used in multiple places
3. You need type safety for nested data

**Example:**

```typescript
// Add to supabase-contracts.ts
export type PaymentWithTab = Database['public']['Tables']['payments']['Row'] & {
  tab: Database['public']['Tables']['tabs']['Row'];
};

export function isPaymentWithTab(data: unknown): data is PaymentWithTab {
  // ... type guard implementation
}
```

## 📖 Related Files

- `src/shared/lib/domain.ts` - Domain entity types (Zod schemas)
- `src/shared/lib/supabase.types.ts` - Auto-generated Supabase types
- `src/shared/lib/supabase.ts` - Supabase client singleton

---

**This file is the contract between our application and Supabase. All queries must conform to these types.**
