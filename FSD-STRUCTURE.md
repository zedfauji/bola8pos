# Feature-Sliced Design Structure

This document describes the complete FSD folder structure for the Bar & Pool Parlor POS application.

## 📁 Directory Structure

```
src/
├── app/                          # Application initialization layer
│   └── .gitkeep
│
├── pages/                        # Route-mapped pages (THIN - no business logic)
│   ├── pos/                      # Main POS register page
│   ├── pool-tables/              # Pool table management page
│   ├── inventory/                # Stock management page
│   ├── staff/                    # Staff & shifts management page
│   └── reports/                  # Daily reports page
│
├── widgets/                      # Composite UI blocks
│   ├── OrderPanel/               # Order creation and management panel
│   ├── PoolTableGrid/            # Grid view of all pool tables
│   ├── TabDrawer/                # Drawer showing open tabs
│   └── PaymentModal/             # Payment processing modal
│
├── features/                     # User actions (one action per folder)
│   ├── open-tab/                 # Open a new customer tab
│   ├── add-item-to-tab/          # Add product to existing tab
│   ├── remove-item-from-tab/     # Remove item from tab
│   ├── close-tab/                # Close and finalize a tab
│   ├── start-pool-timer/         # Start pool table timer
│   ├── stop-pool-timer/          # Stop pool table timer and calculate charges
│   ├── process-payment/          # Process payment via Square/cash
│   ├── adjust-inventory/         # Adjust stock levels
│   └── clock-in-staff/           # Staff clock in/out
│
├── entities/                     # Business domain objects
│   ├── tab/
│   │   ├── model/                # Tab types, store, business logic
│   │   └── ui/                   # TabCard, TabList components
│   ├── pool-table/
│   │   ├── model/                # PoolTable types, store, timer logic
│   │   └── ui/                   # PoolTableCard, PoolTableStatus components
│   ├── product/
│   │   ├── model/                # Product types, store, pricing logic
│   │   └── ui/                   # ProductCard, ProductList components
│   ├── inventory/
│   │   ├── model/                # Inventory types, store, stock tracking
│   │   └── ui/                   # InventoryItem, StockLevel components
│   ├── staff/
│   │   ├── model/                # Staff types, store, shift tracking
│   │   └── ui/                   # StaffCard, ShiftStatus components
│   └── payment/
│       ├── model/                # Payment types, store, transaction logic
│       └── ui/                   # PaymentSummary, ReceiptPreview components
│
└── shared/                       # Shared utilities (NO business logic)
    ├── ui/                       # shadcn/ui components (Button, Input, etc.)
    ├── lib/                      # Utilities, helpers, API clients
    │   ├── supabase.ts           # Supabase client singleton
    │   ├── supabase.types.ts     # Generated Supabase types
    │   ├── pos-printer.ts        # ESC/POS receipt printer wrapper
    │   ├── square.ts             # Square Terminal SDK wrapper
    │   └── test-setup.ts         # Vitest test configuration
    └── config/
        ├── constants.ts          # Application constants
        └── routes.ts             # Route path constants (to be created)
```

## 📋 Layer Responsibilities

### `app/` - Application Layer

- Global providers (React Query, Error Boundary, Theme)
- Router configuration
- Tauri initialization
- Global CSS imports
- **NO business logic**

### `pages/` - Pages Layer

- Route-mapped components
- Compose widgets into full pages
- **THIN ONLY** - no useState, no API calls, no business logic
- Example: `<POSPage>` renders `<OrderPanel>` + `<TabDrawer>`

### `widgets/` - Widgets Layer

- Composite UI blocks
- Combine features + entities into cohesive panels
- Can have local UI state (open/closed, selected tab, etc.)
- Example: `<OrderPanel>` combines `<AddItemToTab>` feature + `<ProductList>` entity

### `features/` - Features Layer

- One user action per folder
- Contains UI + API logic for that action
- Can use TanStack Query mutations
- Example: `open-tab/` has `<OpenTabForm>` + `useOpenTab()` hook + API call

### `entities/` - Entities Layer

- Business domain objects
- `model/` contains types, Zustand stores, business logic
- `ui/` contains presentational components
- **CANNOT import from features or widgets**
- Example: `tab/model/types.ts` defines Tab schema with Zod

### `shared/` - Shared Layer

- Zero business logic
- Generic utilities, UI primitives, config
- **CANNOT import from any business layer**
- Example: `formatCurrency()` is generic, `formatTabTotal()` belongs in entities

## 🎯 Import Rules (Enforced by ESLint)

```
app      → pages, widgets, features, entities, shared
pages    → widgets, features, entities, shared
widgets  → features, entities, shared
features → entities, shared
entities → shared ONLY
shared   → NOTHING
```

## 📦 Constants Configuration

Located in `src/shared/config/constants.ts`:

```typescript
// Pool Table Configuration
export const MAX_POOL_TABLES = 30;
export const BILLING_ROUND_MINUTES = 15;
export const DEFAULT_POOL_RATE_PER_HOUR = 10;

// Terminal Configuration
export const MAX_TERMINALS = 2;

// Application
export const APP_NAME = 'Bar & Pool Parlor POS';
```

## 🚀 Next Steps

1. **Install shadcn/ui**: `npx shadcn@latest init`
2. **Set up Supabase client**: Create `src/shared/lib/supabase.ts`
3. **Generate Supabase types**: Run `supabase gen types typescript`
4. **Create entity schemas**: Start with `src/entities/tab/model/types.ts` using Zod
5. **Build features**: Implement user actions in `src/features/`
6. **Compose widgets**: Combine features + entities in `src/widgets/`
7. **Create pages**: Compose widgets in `src/pages/`

## 📚 File Naming Conventions

- **Components**: PascalCase (`TabCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`usePoolTimer.ts`)
- **Stores**: camelCase with `Store` suffix (`tabsStore.ts`)
- **Types**: camelCase with `.types.ts` extension (`tab.types.ts`)
- **Tests**: same name + `.test.ts` (`TabCard.test.tsx`)
- **Stories**: same name + `.stories.tsx` (`TabCard.stories.tsx`)

## ⚠️ Critical Rules

1. **Pages are THIN** - No business logic, just composition
2. **One feature = one user action** - Don't create "utils" features
3. **Entities cannot import features** - This is enforced by ESLint
4. **No barrel exports** - `export *` is banned
5. **Use path aliases** - Always `@entities/tab`, never `../../entities/tab`

---

**This structure is enforced by `eslint-plugin-boundaries`. Any violation will fail lint and block commits.**
