# POS Page

The main Point of Sale interface for the bar/pool parlor application.

## Architecture

This page follows **Feature-Sliced Design (FSD)** principles and is intentionally THIN — it only handles layout composition and widget orchestration, with zero business logic.

## Layout Structure

### Desktop (≥768px)

```
┌─────────────────────────────────────────────────────┐
│  Product Grid (60%)  │  Active Tab + Cart (40%)    │
│                      │                              │
│  [Category Tabs]     │  [Active Tab Selector]      │
│  [Product Cards]     │  [Cart Items]               │
│                      │  [Total + Place Order]      │
└─────────────────────────────────────────────────────┘
```

### Mobile (<768px)

```
┌─────────────────────────────────────────────────────┐
│  [Products Tab] [Cart Tab]  ← Tab Switcher         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Shows either Product Grid OR Cart Panel           │
│  (user toggles between views)                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
POSPage (pages/pos/index.tsx)
├── Mobile Tab Switcher (Products | Cart)
├── ProductGrid (entities/product/ui/)
│   ├── CategoryTabs
│   └── ProductCard[]
├── ActiveTabSelector (widgets/OrderPanel/)
│   ├── Current Tab Info
│   ├── Switch Tab Button
│   └── New Tab Button
├── CartPanel (widgets/OrderPanel/)
│   ├── CartItem[]
│   ├── Total Display
│   ├── Clear Cart Button
│   └── Place Order Button
└── ModifierSheet (features/add-item-to-tab/ui/)
    ├── Modifier Checkboxes
    └── Add to Cart Button
```

## User Flows

### 1. Add Product to Cart

1. User clicks a product card in ProductGrid
2. If product has modifiers → ModifierSheet opens
3. User selects modifiers (optional) and confirms
4. Product added to cart via `cartStore.addItem()`
5. Cart updates automatically (Zustand reactivity)

### 2. Open New Tab

1. User clicks "New Tab" in ActiveTabSelector
2. OpenTabDialog opens
3. User enters customer name + optional table number
4. Form validates with Zod schema
5. Tab created (TODO: Supabase mutation)
6. New tab set as active in cartStore
7. Success toast shown

### 3. Place Order

1. User adds items to cart
2. User selects/creates a tab
3. User clicks "Place Order" in CartPanel
4. Order mutation called (TODO: implement)
5. Cart cleared on success
6. Success toast shown

## State Management

### Local State (Zustand)

- **cartStore**: Cart items, active tab ID, cart operations
- Lives in: `features/add-item-to-tab/model/cartStore.ts`

### Server State (TanStack Query)

- Products (via `useProducts()`)
- Categories (via `useCategories()`)
- Tabs (TODO: implement)
- Orders (TODO: implement)

## Responsive Behavior

| Breakpoint | Layout        | Behavior                                       |
| ---------- | ------------- | ---------------------------------------------- |
| `< 768px`  | Single column | Tab switcher toggles between Products and Cart |
| `≥ 768px`  | 60/40 split   | Both panels visible side-by-side               |

## Key Features

✅ **Responsive Layout**: Mobile-first with desktop optimization  
✅ **Product Selection**: Click to add, with modifier support  
✅ **Cart Management**: Add, remove, update quantities  
✅ **Tab Management**: Create and switch between customer tabs  
✅ **Happy Hour Detection**: Automatic pricing based on time  
✅ **Real-time Updates**: Zustand + TanStack Query reactivity

## TODO

- [ ] Implement `useMutationOpenTab()` for tab creation
- [ ] Implement `useMutationAddOrder()` for order placement
- [ ] Add TabDrawer for switching between open tabs
- [ ] Connect to Supabase Realtime for live tab updates
- [ ] Add offline support with local state persistence
- [ ] Implement receipt printing via ESC/POS
- [ ] Add payment processing via Square Terminal

## Testing

Run Storybook to preview the page:

```bash
npm run storybook
```

View the POS page story at: `Pages/POS`

## Related Files

- `src/entities/product/ui/ProductGrid.tsx` - Product catalog display
- `src/widgets/OrderPanel/CartPanel.tsx` - Cart display and actions
- `src/widgets/OrderPanel/ActiveTabSelector.tsx` - Tab selection UI
- `src/features/add-item-to-tab/model/cartStore.ts` - Cart state management
- `src/features/open-tab/ui/OpenTabDialog.tsx` - New tab creation form
