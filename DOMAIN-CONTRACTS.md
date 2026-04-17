# Domain Contracts - Single Source of Truth

## 📋 Overview

`src/shared/lib/domain.ts` is the **MASTER DOMAIN CONTRACTS** file and the **SINGLE SOURCE OF TRUTH** for all business entity types in the Bar POS application.

## 🚨 Critical Rules

1. **NEVER define entity types anywhere else** - All types come from `domain.ts`
2. **Import from domain.ts** - Every entity store, feature hook, and UI component imports from here
3. **Use Zod schemas for validation** - All data from Supabase must be validated
4. **Three schemas per entity** - Full, Create (for INSERT), Update (for UPDATE)

## 📦 What's Included

### Shared Primitives

```typescript
MoneySchema; // Always 2 decimal places, never negative
UuidSchema; // UUID v4 format validation
TimestampSchema; // Coerces ISO strings to Date objects
PinSchema; // 4-6 digit PIN codes
HexColorSchema; // #RRGGBB format
TimeStringSchema; // HH:MM format (24-hour)
UrlSchema; // Valid HTTP/HTTPS URLs
```

### Enums (with TypeScript constants)

```typescript
UserRole; // bartender | manager | admin
TabStatus; // open | closed | paid | voided
OrderStatus; // pending | served | voided
PoolTableStatus; // available | occupied | reserved | maintenance
PaymentMethod; // cash | card | tab_transfer
InventoryAdjustReason; // sale | manual_adjustment | waste | delivery | correction
```

### Business Entities (14 total)

Each entity has three schemas:

- **[Entity]Schema** - Full schema with all fields
- **[Entity]CreateSchema** - Omits `id`, `createdAt`, `updatedAt` (for INSERT)
- **[Entity]UpdateSchema** - All fields partial except `id` (for UPDATE)

**Entities:**

1. Category
2. Modifier
3. Product
4. Staff
5. Shift
6. OrderItem
7. Order
8. Tab
9. PoolTable
10. PoolSession
11. PoolSessionSummary (read-only, for tab display)
12. Payment
13. Inventory
14. InventoryLog
15. CartItem (client-only, not in DB)

## 🎯 Usage Patterns

### Pattern 1: Import Types

```typescript
// ✅ CORRECT - Import from domain
import type { Tab, TabCreate, TabUpdate } from '@shared/lib/domain';

// ❌ WRONG - Never define types locally
type Tab = {
  id: string;
  customerName: string;
  // ...
};
```

### Pattern 2: Validate Supabase Data

```typescript
import { TabSchema } from '@shared/lib/domain';

const { data, error } = await supabase.from('tabs').select('*').single();

if (error) throw error;

// Validate and parse
const tab = TabSchema.parse(data);
// Now tab is fully typed and validated
```

### Pattern 3: Create Operations

```typescript
import { TabCreateSchema, type TabCreate } from '@shared/lib/domain';

const newTab: TabCreate = {
  customerName: 'John Doe',
  tableNumber: 5,
  staffId: currentStaff.id,
  shiftId: currentShift.id,
  status: 'open',
  notes: null,
};

// Validate before sending to Supabase
const validated = TabCreateSchema.parse(newTab);

const { data, error } = await supabase.from('tabs').insert(validated).select().single();
```

### Pattern 4: Update Operations

```typescript
import { TabUpdateSchema, type TabUpdate } from '@shared/lib/domain';

const update: TabUpdate = {
  id: tab.id,
  status: 'closed',
  closedAt: new Date(),
};

// Validate before sending
const validated = TabUpdateSchema.parse(update);

const { data, error } = await supabase.from('tabs').update(validated).eq('id', tab.id);
```

### Pattern 5: Use Domain Namespace

```typescript
import { domain } from '@shared/lib/domain';

// Access schemas
const tab = domain.schemas.Tab.parse(data);

// Access enum constants
if (staff.role === domain.types.UserRole.ADMIN) {
  // ...
}
```

## 📊 Entity Relationships

```
Staff
  ↓ has many
Shift
  ↓ has many
Tab
  ↓ has many
Order
  ↓ has many
OrderItem
  ↓ references
Product
  ↓ belongs to
Category
  ↓ has many
Modifier

PoolTable
  ↓ has one active
PoolSession
  ↓ belongs to
Tab

Tab
  ↓ has one
Payment
```

## 🔍 Computed Fields

Some schemas include optional computed fields that are calculated at runtime:

### OrderItem

- `lineTotal` - `(unitPrice + modifierPriceDelta) * quantity`

### Order

- `orderTotal` - Sum of all `item.lineTotal`

### Tab

- `subtotal` - Sum of all `order.orderTotal` + all `poolCharge.totalCharge`

### PoolSession

- `billedMinutes` - Elapsed time rounded up to 15-min blocks
- `totalCharge` - `(billedMinutes / 60) * table.ratePerHour`

## 🧪 Testing with Schemas

```typescript
import { describe, it, expect } from 'vitest';
import { TabSchema, TabCreateSchema } from '@shared/lib/domain';

describe('Tab Schema', () => {
  it('should validate a valid tab', () => {
    const validTab = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      customerName: 'John Doe',
      tableNumber: 5,
      staffId: '123e4567-e89b-12d3-a456-426614174001',
      shiftId: '123e4567-e89b-12d3-a456-426614174002',
      openedAt: new Date(),
      closedAt: null,
      status: 'open',
      notes: null,
      orders: [],
      poolCharges: [],
    };

    expect(() => TabSchema.parse(validTab)).not.toThrow();
  });

  it('should reject invalid customer name', () => {
    const invalidTab = {
      customerName: '', // Empty string not allowed
      // ...
    };

    expect(() => TabCreateSchema.parse(invalidTab)).toThrow();
  });
});
```

## 🎨 Enum Usage

```typescript
import { TabStatus, UserRole } from '@shared/lib/domain';

// Use TypeScript constants for type safety
const status: typeof TabStatus.OPEN = TabStatus.OPEN;

// In conditionals
if (tab.status === TabStatus.OPEN) {
  // ...
}

// In switch statements
switch (staff.role) {
  case UserRole.BARTENDER:
    // ...
    break;
  case UserRole.MANAGER:
    // ...
    break;
  case UserRole.ADMIN:
    // ...
    break;
}
```

## 💰 Money Handling

```typescript
import { MoneySchema } from '@shared/lib/domain';

// Always use MoneySchema for currency
const price = MoneySchema.parse(19.99); // ✅ Valid
const invalid = MoneySchema.parse(19.999); // ❌ Throws - not 2 decimals
const negative = MoneySchema.parse(-5.0); // ❌ Throws - negative not allowed

// Calculations
const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
const total = MoneySchema.parse(subtotal); // Validate result
```

## 🕐 Time Handling

```typescript
import { TimestampSchema, TimeStringSchema } from '@shared/lib/domain';

// Timestamps (from Supabase)
const timestamp = TimestampSchema.parse('2024-01-15T10:30:00Z');
// Result: Date object

// Time strings (for happy hour)
const happyHourStart = TimeStringSchema.parse('16:00'); // ✅ Valid
const invalid = TimeStringSchema.parse('25:00'); // ❌ Throws
```

## 🛡️ Validation Best Practices

1. **Always validate Supabase data** - Never trust external data
2. **Validate before INSERT/UPDATE** - Catch errors before DB operations
3. **Use `.safeParse()` for user input** - Returns `{ success, data, error }`
4. **Use `.parse()` for internal data** - Throws on validation failure

```typescript
// User input - use safeParse
const result = TabCreateSchema.safeParse(formData);
if (!result.success) {
  console.error(result.error.issues);
  return;
}
const validData = result.data;

// Internal data - use parse (throws)
const tab = TabSchema.parse(supabaseData);
```

## 📚 Complete Entity List

| Entity       | Purpose            | Key Fields                           |
| ------------ | ------------------ | ------------------------------------ |
| Category     | Product categories | name, color, happyHour times         |
| Modifier     | Product add-ons    | name, priceDelta                     |
| Product      | Drinks/snacks      | name, basePrice, happyHourPrice      |
| Staff        | Employees          | name, role, pin                      |
| Shift        | Work sessions      | clockIn, clockOut, cash amounts      |
| OrderItem    | Single line item   | product, quantity, unitPrice         |
| Order        | Group of items     | tabId, items[], orderTotal           |
| Tab          | Customer session   | customerName, orders[], subtotal     |
| PoolTable    | Physical table     | number, ratePerHour, status          |
| PoolSession  | Timed session      | tableId, startedAt, billedMinutes    |
| Payment      | Transaction        | amount, tipAmount, method            |
| Inventory    | Stock levels       | quantityOnHand, lowStockThreshold    |
| InventoryLog | Stock changes      | quantityDelta, reason                |
| CartItem     | UI cart state      | product, quantity, selectedModifiers |

## 🚀 Next Steps

1. Use these schemas in entity stores (`src/entities/*/model/store.ts`)
2. Validate all Supabase queries with schemas
3. Use Create/Update schemas in feature hooks
4. Reference types in UI components

---

**Remember: `domain.ts` is the single source of truth. Never define entity types elsewhere.**
