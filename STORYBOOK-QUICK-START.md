# Storybook Quick Start

## ✅ Status: Configured and Running

Storybook is running on **http://localhost:6006**

## 🚀 Quick Commands

```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook
```

## 📁 Key Files

### Configuration

- `.storybook/main.ts` - Main config (addons, stories pattern, Vite)
- `.storybook/preview.ts` - Global settings (theme, decorators)
- `.storybook/decorators.tsx` - QueryClient + dark theme wrappers

### Utilities

- `src/shared/lib/test-utils.tsx` - `renderWithProviders()` for testing
- `src/shared/lib/mocks.ts` - Mock data generators
- `src/shared/lib/index.ts` - Centralized exports

### Example

- `src/shared/ui/Button.stories.tsx` - Sample Button stories

## 🎨 Features Enabled

✅ **Addons**

- Accessibility testing (@storybook/addon-a11y)
- Auto-generated docs (@storybook/addon-docs)
- Visual regression (Chromatic)
- Controls, Actions, Viewport (built-in)

✅ **Providers**

- TanStack Query (QueryClientProvider)
- Dark theme by default
- Tailwind CSS styling

✅ **Testing**

- React Testing Library integration
- Mock data generators
- Test utilities with providers

## 📝 Create a Story

```tsx
// src/entities/product/ui/ProductCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ProductCard } from './ProductCard';
import { generateMockProduct } from '@/shared/lib/mocks';

const meta = {
  title: 'Entities/Product/ProductCard',
  component: ProductCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    product: generateMockProduct(),
  },
};

export const WithModifiers: Story = {
  args: {
    product: generateMockProduct({
      modifiers: [{ id: '1', name: 'Extra Shot', priceDelta: 2, sortOrder: 1 }],
    }),
  },
};
```

## 🧪 Write a Test

```tsx
// src/entities/product/ui/ProductCard.test.tsx
import { renderWithProviders } from '@/shared/lib/test-utils';
import { generateMockProduct } from '@/shared/lib/mocks';
import { ProductCard } from './ProductCard';

test('renders product name', () => {
  const product = generateMockProduct({ name: 'Beer' });
  const { getByText } = renderWithProviders(<ProductCard product={product} />);
  expect(getByText('Beer')).toBeInTheDocument();
});
```

## 🎯 Mock Data Generators

```tsx
import {
  // Single generators
  generateMockProduct,
  generateMockTab,
  generateMockPoolTable,
  generateMockInventory,

  // Bulk generators
  generateMockProducts,
  generateMockTabs,

  // Scenario generators
  generateTabScenario,
  generatePoolTableWithSession,
  generateLowStockScenario,

  // Pre-made mocks
  mockProducts,
  mockTabs,
  mockPoolTables,
} from '@/shared/lib/mocks';

// Use in stories
const product = generateMockProduct({ name: 'Custom Beer' });
const tabs = generateMockTabs(5);
const { tab, orders, items } = generateTabScenario();
```

## 📊 Story Organization

```
src/
├── shared/ui/          → Shared/UI/ComponentName
├── entities/*/ui/      → Entities/EntityName/ComponentName
├── features/*/         → Features/FeatureName/ComponentName
└── widgets/*/          → Widgets/WidgetName
```

## 🔍 Accessibility Testing

1. Open any story in Storybook
2. Click "Accessibility" tab at bottom
3. Review violations and warnings
4. Fix issues in component code

## 📚 Resources

- Full docs: `STORYBOOK-SETUP.md`
- Storybook: http://localhost:6006
- [Official Docs](https://storybook.js.org/docs)

## ✅ Verification

Run these checks to verify setup:

```bash
# 1. Start Storybook
npm run storybook

# 2. Open http://localhost:6006

# 3. Check Button story renders

# 4. Check dark theme is applied

# 5. Check A11y tab shows results
```

All checks should pass! ✨
