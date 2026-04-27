# Storybook Configuration

This document describes the Storybook setup for the Bar POS project.

## ✅ Configuration Complete

Storybook is configured and running on **http://localhost:6006**

## 📁 Files Configured

### Storybook Configuration

- **`.storybook/main.ts`** - Main Storybook configuration
  - Stories pattern: `src/**/*.stories.@(js|jsx|ts|tsx)`
  - Addons: a11y, docs, chromatic, onboarding
  - Framework: React + Vite
  - Path aliases configured for FSD structure

- **`.storybook/preview.ts`** - Global preview configuration
  - Imports Tailwind CSS from `src/app/globals.css`
  - Default theme: dark
  - Decorators: QueryClient provider, dark theme wrapper
  - A11y configuration enabled

- **`.storybook/decorators.tsx`** - Global decorators
  - `withQueryClient` - Wraps stories in QueryClientProvider
  - `withDarkTheme` - Applies dark theme styling

### Test Utilities

- **`src/shared/lib/test-utils.tsx`** - Testing helpers
  - `renderWithProviders()` - Renders components with all providers
  - `createTestQueryClient()` - Creates test QueryClient
  - Re-exports React Testing Library utilities

### Mock Data

- **`src/shared/lib/mocks.ts`** - Centralized mock data
  - Re-exports all mock data from entity types
  - Generator functions for all entities
  - Bulk generators for multiple items
  - Scenario generators for complex setups

### Example Stories

- **`src/shared/ui/Button.stories.tsx`** - Sample Button stories

## 🎨 Storybook Features

### Addons Installed

- **@storybook/addon-a11y** - Accessibility testing
- **@storybook/addon-docs** - Auto-generated documentation
- **@chromatic-com/storybook** - Visual regression testing
- **@storybook/addon-onboarding** - Onboarding guide

### Built-in Features (Storybook 10)

- **Controls** - Interactive component props
- **Actions** - Event handler logging
- **Viewport** - Responsive design testing
- **Backgrounds** - Background color switching
- **Measure** - Layout measurement tools
- **Outline** - Element outline visualization

## 🚀 Usage

### Running Storybook

```bash
npm run storybook
```

Storybook will start on http://localhost:6006

### Building Storybook

```bash
npm run build-storybook
```

Builds static Storybook to `storybook-static/`

## 📝 Writing Stories

### Basic Story Example

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

const meta = {
  title: 'Features/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Hello World',
  },
};
```

### Story with Mock Data

```tsx
import { generateMockTab } from '@/shared/lib/mocks';

export const WithMockData: Story = {
  args: {
    tab: generateMockTab({
      customerName: 'John Doe',
      tableNumber: 5,
    }),
  },
};
```

### Story with Query Client

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const WithQueries: Story = {
  decorators: [
    Story => {
      const queryClient = new QueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};
```

## 🧪 Testing with Mock Data

### Using Mock Data in Tests

```tsx
import { renderWithProviders } from '@/shared/lib/test-utils';
import { generateMockTab } from '@/shared/lib/mocks';
import { TabCard } from './TabCard';

test('renders tab card', () => {
  const tab = generateMockTab();
  const { getByText } = renderWithProviders(<TabCard tab={tab} />);
  expect(getByText(tab.customerName)).toBeInTheDocument();
});
```

### Using Test Utilities

```tsx
import { renderWithProviders, createTestQueryClient } from '@/shared/lib/test-utils';

test('renders with custom query client', () => {
  const queryClient = createTestQueryClient();
  const { getByText } = renderWithProviders(<MyComponent />, { queryClient });
  expect(getByText('Hello')).toBeInTheDocument();
});
```

## 📚 Mock Data Generators

### Single Item Generators

```tsx
import {
  generateMockProduct,
  generateMockTab,
  generateMockPoolTable,
  generateMockInventory,
} from '@/shared/lib/mocks';

// Generate with defaults
const product = generateMockProduct();

// Generate with overrides
const tab = generateMockTab({
  customerName: 'Jane Doe',
  tableNumber: 10,
  status: 'open',
});
```

### Bulk Generators

```tsx
import { generateMockProducts, generateMockTabs, generateMockPoolTables } from '@/shared/lib/mocks';

// Generate 10 products
const products = generateMockProducts(10);

// Generate 5 tabs with overrides
const tabs = generateMockTabs(5, { status: 'open' });
```

### Scenario Generators

```tsx
import {
  generateTabScenario,
  generatePoolTableWithSession,
  generateLowStockScenario,
} from '@/shared/lib/mocks';

// Complete tab with orders and items
const { tab, orders, items } = generateTabScenario();

// Pool table with active session
const { table, session } = generatePoolTableWithSession();

// Low stock inventory items
const lowStock = generateLowStockScenario();
```

## 🎯 Story Organization

Stories are organized following the FSD structure:

```
src/
├── shared/
│   └── ui/
│       └── Button.stories.tsx
├── entities/
│   ├── product/
│   │   └── ui/
│   │       └── ProductCard.stories.tsx
│   └── tab/
│       └── ui/
│           └── TabCard.stories.tsx
├── features/
│   └── open-tab/
│       └── OpenTabButton.stories.tsx
└── widgets/
    └── OrderPanel/
        └── OrderPanel.stories.tsx
```

### Story Naming Convention

- **Title**: Follow FSD layer structure
  - Shared: `Shared/UI/ComponentName`
  - Entities: `Entities/EntityName/ComponentName`
  - Features: `Features/FeatureName/ComponentName`
  - Widgets: `Widgets/WidgetName`

- **Story Names**: Use descriptive names
  - `Default` - Default state
  - `WithData` - With mock data
  - `Loading` - Loading state
  - `Error` - Error state
  - `Empty` - Empty state

## 🔧 Customization

### Adding Custom Decorators

Edit `.storybook/decorators.tsx`:

```tsx
export const withCustomProvider: Decorator = Story => {
  return (
    <CustomProvider>
      <Story />
    </CustomProvider>
  );
};
```

Then add to `.storybook/preview.ts`:

```tsx
import { withCustomProvider } from './decorators';

const preview: Preview = {
  decorators: [withQueryClient, withDarkTheme, withCustomProvider],
  // ...
};
```

### Customizing Theme

Edit `.storybook/preview.ts`:

```tsx
parameters: {
  backgrounds: {
    default: 'dark',
    values: [
      { name: 'dark', value: '#0a0a0a' },
      { name: 'light', value: '#ffffff' },
      { name: 'custom', value: '#1a1a1a' },
    ],
  },
}
```

## 📊 Accessibility Testing

All stories are automatically tested for accessibility issues using @storybook/addon-a11y.

### Viewing A11y Results

1. Open a story in Storybook
2. Click the "Accessibility" tab at the bottom
3. Review violations, passes, and incomplete checks

### Configuring A11y Rules

Edit `.storybook/preview.ts`:

```tsx
a11y: {
  config: {
    rules: [
      {
        id: 'color-contrast',
        enabled: true,
      },
      {
        id: 'label',
        enabled: true,
      },
    ],
  },
}
```

## 🐛 Troubleshooting

### Storybook Won't Start

```bash
# Clear cache and restart
rm -rf node_modules/.cache
npm run storybook
```

### Stories Not Showing Up

- Check file naming: `*.stories.tsx` or `*.stories.ts`
- Check stories pattern in `.storybook/main.ts`
- Restart Storybook

### Import Errors

- Check path aliases in `.storybook/main.ts`
- Ensure imports use `@/` prefix
- Restart Storybook after config changes

### Dark Theme Not Working

- Check `globals.css` import in `.storybook/preview.ts`
- Verify `withDarkTheme` decorator is applied
- Check Tailwind CSS configuration

## 📖 Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook React Vite](https://storybook.js.org/docs/react/get-started/install)
- [Accessibility Addon](https://storybook.js.org/addons/@storybook/addon-a11y)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)

## ✅ Verification Checklist

- [x] Storybook starts on port 6006
- [x] Dark theme is applied by default
- [x] QueryClient provider wraps stories
- [x] Path aliases work correctly
- [x] A11y addon is enabled
- [x] Test utilities are available
- [x] Mock data generators work
- [x] Sample Button story renders correctly

## 🎉 Next Steps

1. **Create stories for entity components**
   - ProductCard, TabCard, PoolTableCard, etc.

2. **Create stories for feature components**
   - OpenTabButton, AddOrderButton, etc.

3. **Create stories for widget components**
   - OrderPanel, TabDrawer, PaymentModal, etc.

4. **Write interaction tests**
   - Use `@storybook/addon-vitest` for component testing

5. **Set up Chromatic**
   - Visual regression testing for UI changes

6. **Document component APIs**
   - Use JSDoc comments for auto-generated docs
