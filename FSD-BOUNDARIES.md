# Feature-Sliced Design Boundaries Enforcement

## 🚨 CRITICAL: FSD Layer Rules are ENFORCED by ESLint

The `eslint-plugin-boundaries` plugin **automatically blocks** any code that violates FSD architecture rules. This is non-negotiable and prevents architectural drift.

## ✅ Allowed Import Patterns

```
┌─────────┐
│   app   │ ← Can import from: pages, widgets, features, entities, shared
└─────────┘
     ↓
┌─────────┐
│  pages  │ ← Can import from: widgets, features, entities, shared
└─────────┘
     ↓
┌─────────┐
│ widgets │ ← Can import from: features, entities, shared
└─────────┘
     ↓
┌─────────┐
│features │ ← Can import from: entities, shared
└─────────┘
     ↓
┌─────────┐
│entities │ ← Can import from: shared ONLY
└─────────┘
     ↓
┌─────────┐
│ shared  │ ← CANNOT import from ANY business layer
└─────────┘
```

## ❌ Violations That Will FAIL Lint

### Example 1: Entity importing from Feature

```typescript
// ❌ BLOCKED: src/entities/tab/model/store.ts
import { closeTab } from '@features/close-tab/api'; // ERROR!
```

**Error:**

```
There is no rule allowing dependencies from elements of type "entities" to elements of type "features"
```

**Fix:** Move the logic to a feature, or refactor the entity to accept callbacks.

---

### Example 2: Shared importing from Entity

```typescript
// ❌ BLOCKED: src/shared/lib/utils.ts
import { Tab } from '@entities/tab/model/types'; // ERROR!
```

**Error:**

```
There is no rule allowing dependencies from elements of type "shared" to elements of type "entities"
```

**Fix:** Move the utility to the entity layer, or make it generic.

---

### Example 3: Feature importing from Widget

```typescript
// ❌ BLOCKED: src/features/add-item-to-tab/ui/AddItemForm.tsx
import { OrderPanel } from '@widgets/OrderPanel'; // ERROR!
```

**Error:**

```
There is no rule allowing dependencies from elements of type "features" to elements of type "widgets"
```

**Fix:** Widgets compose features, not the other way around. Move composition to widget or page.

---

## ✅ Correct Patterns

### Pattern 1: Feature uses Entity

```typescript
// ✅ ALLOWED: src/features/close-tab/api.ts
import { Tab } from '@entities/tab/model/types';
import { tabsStore } from '@entities/tab/model/store';

export const closeTab = (tabId: string) => {
  tabsStore.closeTab(tabId);
};
```

---

### Pattern 2: Widget composes Features

```typescript
// ✅ ALLOWED: src/widgets/OrderPanel/ui/OrderPanel.tsx
import { AddItemToTab } from '@features/add-item-to-tab'
import { TabCard } from '@entities/tab/ui/TabCard'

export const OrderPanel = () => {
  return (
    <div>
      <TabCard />
      <AddItemToTab />
    </div>
  )
}
```

---

### Pattern 3: Page composes Widgets

```typescript
// ✅ ALLOWED: src/pages/pos/index.tsx
import { OrderPanel } from '@widgets/OrderPanel'
import { TabDrawer } from '@widgets/TabDrawer'

export const POSPage = () => {
  return (
    <main>
      <OrderPanel />
      <TabDrawer />
    </main>
  )
}
```

---

## 🔧 How to Fix Violations

### Strategy 1: Move Logic Down

If a lower layer needs something from a higher layer, move the logic down.

**Before (WRONG):**

```typescript
// entities/tab/model/store.ts
import { processPayment } from '@features/process-payment/api'; // ❌
```

**After (CORRECT):**

```typescript
// features/close-tab/api.ts
import { tabsStore } from '@entities/tab/model/store';
import { processPayment } from '@features/process-payment/api';

export const closeTabWithPayment = async (tabId: string) => {
  await processPayment(tabId);
  tabsStore.closeTab(tabId);
};
```

---

### Strategy 2: Use Dependency Injection

Pass dependencies from higher layers as props or callbacks.

**Before (WRONG):**

```typescript
// entities/tab/ui/TabCard.tsx
import { closeTab } from '@features/close-tab/api'; // ❌
```

**After (CORRECT):**

```typescript
// entities/tab/ui/TabCard.tsx
type TabCardProps = {
  onClose: () => void  // Injected from feature
}

// features/close-tab/ui/CloseTabButton.tsx
import { TabCard } from '@entities/tab/ui/TabCard'
import { closeTab } from '../api'

export const CloseTabButton = ({ tabId }: { tabId: string }) => {
  return <TabCard onClose={() => closeTab(tabId)} />
}
```

---

### Strategy 3: Extract to Shared

If multiple layers need the same utility, it belongs in `shared`.

**Before (WRONG):**

```typescript
// shared/lib/formatters.ts
import { Tab } from '@entities/tab/model/types'  // ❌

export const formatTabTotal = (tab: Tab) => { ... }
```

**After (CORRECT):**

```typescript
// shared/lib/formatters.ts
export const formatCurrency = (amount: number) => { ... }

// entities/tab/lib/formatters.ts
import { formatCurrency } from '@shared/lib/formatters'
import type { Tab } from '../model/types'

export const formatTabTotal = (tab: Tab) => formatCurrency(tab.total)
```

---

## 🧪 Testing Boundaries

Run this command to verify FSD compliance:

```bash
npm run lint
```

Any violation will **fail the build** and **block git commits** (via pre-commit hook).

---

## 📚 Additional Rules

### No Barrel Exports

```typescript
// ❌ BLOCKED
export * from './components';

// ✅ ALLOWED
export { Button } from './Button';
export { Input } from './Input';
```

### No Relative Imports Across Layers

```typescript
// ❌ BLOCKED
import { Tab } from '../../../entities/tab/model/types';

// ✅ ALLOWED
import { Tab } from '@entities/tab/model/types';
```

---

## 🎯 Summary

- **Boundaries are enforced at lint time** - violations fail CI/CD
- **Lower layers cannot import from higher layers** - this is the core FSD rule
- **Use dependency injection** when lower layers need higher-layer behavior
- **Move logic down** when possible to maintain proper layering
- **Extract to shared** only for truly generic, business-agnostic utilities

**This is non-negotiable. Without boundaries enforcement, FSD will degrade within days.**
