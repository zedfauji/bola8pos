# Quick Start Guide - Bar POS Development

## 🚀 Project Setup Complete

Your Feature-Sliced Design structure is ready. Here's what to do next:

## 📁 Structure Overview

```
src/
├── app/         → Global providers, router, Tauri init
├── pages/       → 5 pages (pos, pool-tables, inventory, staff, reports)
├── widgets/     → 4 widgets (OrderPanel, PoolTableGrid, TabDrawer, PaymentModal)
├── features/    → 9 features (open-tab, add-item-to-tab, etc.)
├── entities/    → 6 entities (tab, pool-table, product, inventory, staff, payment)
└── shared/      → UI primitives, utilities, config
```

## 🎯 Development Workflow

### 1. Start with Entities (Bottom-Up)

**Example: Create Tab Entity**

```bash
# 1. Define types with Zod
src/entities/tab/model/types.ts

# 2. Create Zustand store
src/entities/tab/model/store.ts

# 3. Build UI components
src/entities/tab/ui/TabCard.tsx
```

### 2. Build Features (User Actions)

**Example: Create Open Tab Feature**

```bash
# 1. Create API function
src/features/open-tab/api.ts

# 2. Create TanStack Query hook
src/features/open-tab/useOpenTab.ts

# 3. Build UI form
src/features/open-tab/ui/OpenTabForm.tsx
```

### 3. Compose Widgets

**Example: Create Order Panel Widget**

```bash
# Combine features + entities
src/widgets/OrderPanel/ui/OrderPanel.tsx
```

### 4. Assemble Pages

**Example: Create POS Page**

```bash
# Compose widgets (THIN - no logic)
src/pages/pos/index.tsx
```

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Start Vite dev server
npm run tauri            # Run Tauri app

# Quality Checks
npm run typecheck        # TypeScript validation
npm run lint             # ESLint (includes FSD boundaries)
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format with Prettier

# Testing
npm run test             # Run Vitest
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Generate coverage report
```

## 📦 Next Steps

### Step 1: Install shadcn/ui

```bash
npx shadcn@latest init
```

Choose these options:

- Style: Default
- Base color: Slate
- CSS variables: Yes
- Tailwind config: Yes

### Step 2: Install Core Components

```bash
npx shadcn@latest add button input card dialog form
```

### Step 3: Set Up Supabase

Create `src/shared/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Step 4: Generate Supabase Types

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/lib/supabase.types.ts
```

### Step 5: Create First Entity (Tab)

`src/entities/tab/model/types.ts`:

```typescript
import { z } from 'zod';

export const TabSchema = z.object({
  id: z.string().uuid(),
  customerName: z.string().min(1),
  tableNumber: z.number().int().positive().optional(),
  status: z.enum(['open', 'closed']),
  total: z.number().nonnegative(),
  createdAt: z.date(),
  closedAt: z.date().optional(),
});

export type Tab = z.infer<typeof TabSchema>;
```

## 🚨 Critical Rules

1. **Pages are THIN** - Only compose widgets, no logic
2. **Use path aliases** - `@entities/tab` not `../../entities/tab`
3. **No barrel exports** - `export { Tab }` not `export *`
4. **Entities can't import features** - ESLint will block this
5. **One feature = one action** - Don't create "utils" features

## 🔍 Import Rules (Enforced)

```
✅ features → entities (ALLOWED)
❌ entities → features (BLOCKED)

✅ widgets → features (ALLOWED)
❌ features → widgets (BLOCKED)

✅ pages → widgets (ALLOWED)
❌ widgets → pages (BLOCKED)
```

## 📚 Documentation

- `TOOLING.md` - Complete tooling setup guide
- `FSD-STRUCTURE.md` - Detailed FSD structure explanation
- `FSD-BOUNDARIES.md` - Import rules with examples
- `architecture.md` - FSD architecture rules (in .kiro/steering/)

## 🎨 Constants Available

From `@shared/config/constants`:

```typescript
MAX_POOL_TABLES = 30;
BILLING_ROUND_MINUTES = 15;
DEFAULT_POOL_RATE_PER_HOUR = 10;
MAX_TERMINALS = 2;
APP_NAME = 'Bar & Pool Parlor POS';
```

## 🧪 Testing Pattern

```typescript
// src/entities/tab/model/store.test.ts
import { describe, it, expect } from 'vitest';
import { useTabsStore } from './store';

describe('TabsStore', () => {
  it('should open a new tab', () => {
    const { openTab } = useTabsStore.getState();
    const tab = openTab('John Doe');
    expect(tab.customerName).toBe('John Doe');
    expect(tab.status).toBe('open');
  });
});
```

## 🎯 Development Order

1. ✅ **Tooling** - Complete (ESLint, Prettier, Vitest, Husky)
2. ✅ **FSD Structure** - Complete (all folders created)
3. ⏳ **shadcn/ui** - Next step
4. ⏳ **Supabase Setup** - After shadcn
5. ⏳ **Entity Schemas** - Start with Tab
6. ⏳ **Features** - Build user actions
7. ⏳ **Widgets** - Compose features
8. ⏳ **Pages** - Assemble widgets

---

**Ready to build! Start with `npx shadcn@latest init`**
