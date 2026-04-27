# POS Page Architecture

## Component Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         POS PAGE (THIN)                         │
│                    pages/pos/index.tsx                          │
│                                                                 │
│  State: mobileView, selectedProduct, modifierSheetOpen         │
│  Logic: handleProductSelect, handleModifierConfirm             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Composes
                              ▼
        ┌─────────────────────────────────────────────┐
        │                                             │
        ▼                                             ▼
┌──────────────────┐                    ┌──────────────────────────┐
│  PRODUCT GRID    │                    │   ORDER PANEL WIDGETS    │
│  (60% desktop)   │                    │   (40% desktop)          │
│                  │                    │                          │
│  entities/       │                    │  widgets/OrderPanel/     │
│  product/ui/     │                    │                          │
│                  │                    │  ┌────────────────────┐ │
│  ┌────────────┐  │                    │  │ ActiveTabSelector  │ │
│  │ Category   │  │                    │  │                    │ │
│  │ Tabs       │  │                    │  │ - Current Tab Info │ │
│  └────────────┘  │                    │  │ - Switch Tab Btn   │ │
│                  │                    │  │ - New Tab Btn      │ │
│  ┌────────────┐  │                    │  └────────────────────┘ │
│  │ Product    │  │                    │                          │
│  │ Cards      │  │                    │  ┌────────────────────┐ │
│  │ (Grid)     │  │                    │  │   CartPanel        │ │
│  └────────────┘  │                    │  │                    │ │
│                  │                    │  │ - CartItem[]       │ │
│  onClick:        │                    │  │ - Total Display    │ │
│  onProductSelect │                    │  │ - Clear Cart       │ │
└──────────────────┘                    │  │ - Place Order      │ │
                                        │  └────────────────────┘ │
                                        └──────────────────────────┘
                              │
                              │ Opens
                              ▼
                    ┌──────────────────────┐
                    │   ModifierSheet      │
                    │                      │
                    │  features/           │
                    │  add-item-to-tab/ui/ │
                    │                      │
                    │  - Modifier List     │
                    │  - Checkboxes        │
                    │  - Price Deltas      │
                    │  - Confirm Button    │
                    └──────────────────────┘
                              │
                              │ Calls
                              ▼
                    ┌──────────────────────┐
                    │     cartStore        │
                    │                      │
                    │  features/           │
                    │  add-item-to-tab/    │
                    │  model/              │
                    │                      │
                    │  State:              │
                    │  - items[]           │
                    │  - activeTabId       │
                    │                      │
                    │  Actions:            │
                    │  - addItem()         │
                    │  - removeItem()      │
                    │  - updateQuantity()  │
                    │  - clearCart()       │
                    │  - setActiveTab()    │
                    │                      │
                    │  Computed:           │
                    │  - totalAmount()     │
                    │  - itemCount()       │
                    └──────────────────────┘
```

## Data Flow

### Adding a Product to Cart

```
User clicks Product Card
        │
        ▼
POSPage.handleProductSelect(product)
        │
        ├─── Has modifiers? ──YES──► Open ModifierSheet
        │                                    │
        │                                    ▼
        │                          User selects modifiers
        │                                    │
        │                                    ▼
        │                          handleModifierConfirm(modifiers)
        │                                    │
        └─── Has modifiers? ──NO────────────┤
                                             │
                                             ▼
                              cartStore.addItem(product, modifiers)
                                             │
                                             ▼
                              Cart updates (Zustand reactivity)
                                             │
                                             ▼
                              CartPanel re-renders with new item
```

### Opening a New Tab

```
User clicks "New Tab" button
        │
        ▼
ActiveTabSelector opens OpenTabDialog
        │
        ▼
User fills form (customerName, tableNumber)
        │
        ▼
Form validates with Zod schema
        │
        ├─── Valid? ──NO──► Show validation errors
        │
        └─── Valid? ──YES──► Submit form
                                │
                                ▼
                    useMutationOpenTab() (TODO)
                                │
                                ▼
                    Supabase: INSERT INTO tabs
                                │
                                ▼
                    cartStore.setActiveTab(newTabId)
                                │
                                ▼
                    Toast: "Tab opened for {name}"
                                │
                                ▼
                    Dialog closes, form resets
```

### Placing an Order

```
User clicks "Place Order" button
        │
        ▼
CartPanel.handlePlaceOrder()
        │
        ├─── Cart empty? ──YES──► Button disabled
        │
        ├─── No active tab? ──YES──► Button disabled
        │
        └─── Ready? ──YES──► useMutationAddOrder() (TODO)
                                │
                                ▼
                    Supabase: INSERT INTO orders
                                │
                                ▼
                    Supabase: INSERT INTO order_items
                                │
                                ▼
                    Trigger: Decrement inventory
                                │
                                ▼
                    cartStore.clearCart()
                                │
                                ▼
                    Toast: "Order placed successfully!"
```

## State Management Strategy

### Local State (Zustand)

**cartStore** - Ephemeral cart state

- Lives in browser memory only
- Resets on page refresh (intentional)
- Fast, synchronous updates
- No persistence needed

### Server State (TanStack Query)

**Products, Categories, Tabs** - Persistent data

- Cached by TanStack Query
- Auto-refetch on window focus
- Optimistic updates for mutations
- Synced with Supabase

## Responsive Breakpoints

| Screen Size          | Layout        | Behavior                                             |
| -------------------- | ------------- | ---------------------------------------------------- |
| `< 768px` (Mobile)   | Single column | Tab switcher toggles between Products and Cart views |
| `≥ 768px` (Tablet)   | 60/40 split   | Both panels visible, side-by-side                    |
| `≥ 1024px` (Desktop) | 60/40 split   | Optimized spacing and grid columns                   |

## Import Dependencies

```
pages/pos/
  ↓ imports
  ├─ entities/product/ui/ProductGrid
  ├─ widgets/OrderPanel/CartPanel
  ├─ widgets/OrderPanel/ActiveTabSelector
  ├─ features/add-item-to-tab/ui/ModifierSheet
  └─ features/add-item-to-tab/model/cartStore

widgets/OrderPanel/CartPanel
  ↓ imports
  ├─ entities/tab/ui/CartItem
  └─ features/add-item-to-tab/model/cartStore

widgets/OrderPanel/ActiveTabSelector
  ↓ imports
  ├─ features/open-tab/ui/OpenTabDialog
  └─ features/add-item-to-tab/model/cartStore

features/add-item-to-tab/ui/ModifierSheet
  ↓ imports
  └─ entities/product/model/types

entities/tab/ui/CartItem
  ↓ imports
  └─ entities/tab/model/types
```

## FSD Layer Compliance

✅ **Pages** → Can import from: widgets, features, entities, shared  
✅ **Widgets** → Can import from: features, entities, shared  
✅ **Features** → Can import from: entities, shared  
✅ **Entities** → Can import from: shared  
✅ **Shared** → Cannot import from any business layer

All imports follow the FSD hierarchy rules.

## Performance Considerations

1. **Zustand Store**: O(1) state updates, minimal re-renders
2. **TanStack Query**: Automatic caching, deduplication
3. **React Memoization**: ProductGrid uses useMemo for filtering
4. **Lazy Loading**: Page-level components use React.lazy (TODO)
5. **Virtual Scrolling**: Consider for large product catalogs (TODO)

## Security Considerations

1. **Input Validation**: All forms use Zod schemas
2. **XSS Prevention**: React escapes all user input by default
3. **RLS Policies**: Supabase enforces row-level security (TODO)
4. **Staff Authentication**: PIN-based login required (TODO)
5. **Payment Data**: Never logged or stored in browser console

---

**Last Updated**: 2026-04-14  
**Status**: ✅ Architecture implemented and validated
