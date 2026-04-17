# Storybook Configuration Checklist

## ✅ Completed Tasks

### 1. Storybook Configuration

- [x] Updated `.storybook/main.ts`
  - [x] Set stories pattern: `src/**/*.stories.@(js|jsx|ts|tsx)`
  - [x] Added @storybook/addon-a11y
  - [x] Added @storybook/addon-docs
  - [x] Configured Vite as builder
  - [x] Set up path aliases for FSD structure

### 2. Preview Configuration

- [x] Updated `.storybook/preview.ts`
  - [x] Import Tailwind CSS from `src/app/globals.css`
  - [x] Set default theme to dark
  - [x] Added QueryClientProvider decorator
  - [x] Added dark theme decorator
  - [x] Configured A11y parameters

### 3. Test Utilities

- [x] Created `src/shared/lib/test-utils.tsx`
  - [x] `renderWithProviders()` function
  - [x] `createTestQueryClient()` function
  - [x] Wraps components in QueryClientProvider
  - [x] Re-exports React Testing Library utilities

### 4. Mock Data

- [x] Created `src/shared/lib/mocks.ts`
  - [x] Re-exports all mock data from entity types
  - [x] Single item generators (generateMockProduct, etc.)
  - [x] Bulk generators (generateMockProducts, etc.)
  - [x] Scenario generators (generateTabScenario, etc.)

### 5. Barrel Exports

- [x] Created `src/shared/lib/index.ts`
  - [x] Exports Supabase client and types
  - [x] Exports test utilities
  - [x] Exports mock data

### 6. Example Stories

- [x] Created `src/shared/ui/Button.stories.tsx`
  - [x] Multiple variants (default, destructive, outline, etc.)
  - [x] Multiple sizes (sm, default, lg)
  - [x] Disabled state
  - [x] Auto-generated docs

### 7. Documentation

- [x] Created `STORYBOOK-SETUP.md` - Comprehensive guide
- [x] Created `STORYBOOK-QUICK-START.md` - Quick reference
- [x] Created `STORYBOOK-CHECKLIST.md` - This file

### 8. Verification

- [x] Ran `npm run storybook`
- [x] Verified Storybook starts on port 6006
- [x] Verified Button story renders
- [x] Verified dark theme is applied
- [x] Verified QueryClient provider works
- [x] All TypeScript files pass validation (0 errors)

## 📊 Summary

### Files Created

```
bar-pos/
├── .storybook/
│   ├── main.ts (updated)
│   ├── preview.ts (updated)
│   └── decorators.tsx (existing)
├── src/
│   └── shared/
│       ├── lib/
│       │   ├── test-utils.tsx (new)
│       │   ├── mocks.ts (new)
│       │   └── index.ts (new)
│       └── ui/
│           └── Button.stories.tsx (new)
└── docs/
    ├── STORYBOOK-SETUP.md (new)
    ├── STORYBOOK-QUICK-START.md (new)
    └── STORYBOOK-CHECKLIST.md (new)
```

### Addons Configured

- ✅ @storybook/addon-a11y - Accessibility testing
- ✅ @storybook/addon-docs - Auto-generated documentation
- ✅ @chromatic-com/storybook - Visual regression testing
- ✅ Built-in addons (Controls, Actions, Viewport, etc.)

### Decorators Applied

- ✅ `withQueryClient` - TanStack Query provider
- ✅ `withDarkTheme` - Dark theme styling

### Mock Data Available

- ✅ Products, Categories, Modifiers
- ✅ Tabs, Orders, Order Items
- ✅ Pool Tables, Pool Sessions
- ✅ Inventory, Inventory Logs

## 🎯 Next Steps

### 1. Create Entity Stories

- [ ] `src/entities/product/ui/ProductCard.stories.tsx`
- [ ] `src/entities/tab/ui/TabCard.stories.tsx`
- [ ] `src/entities/pool-table/ui/PoolTableCard.stories.tsx`
- [ ] `src/entities/inventory/ui/InventoryItem.stories.tsx`

### 2. Create Feature Stories

- [ ] `src/features/open-tab/OpenTabButton.stories.tsx`
- [ ] `src/features/add-item-to-tab/AddItemButton.stories.tsx`
- [ ] `src/features/close-tab/CloseTabButton.stories.tsx`
- [ ] `src/features/start-pool-timer/StartTimerButton.stories.tsx`

### 3. Create Widget Stories

- [ ] `src/widgets/OrderPanel/OrderPanel.stories.tsx`
- [ ] `src/widgets/TabDrawer/TabDrawer.stories.tsx`
- [ ] `src/widgets/PaymentModal/PaymentModal.stories.tsx`
- [ ] `src/widgets/PoolTableGrid/PoolTableGrid.stories.tsx`

### 4. Write Component Tests

- [ ] Use `renderWithProviders()` in all component tests
- [ ] Use mock data generators for test data
- [ ] Test loading, error, and empty states
- [ ] Test user interactions

### 5. Set Up Chromatic (Optional)

- [ ] Create Chromatic account
- [ ] Link repository
- [ ] Configure CI/CD for visual regression testing

### 6. Document Components

- [ ] Add JSDoc comments to all components
- [ ] Use `tags: ['autodocs']` in stories
- [ ] Write component usage examples

## 🧪 Testing Workflow

### 1. Component Development

```bash
# Start Storybook
npm run storybook

# Develop component in isolation
# View in Storybook at http://localhost:6006
```

### 2. Write Stories

```tsx
// Create *.stories.tsx file
// Use mock data generators
// Test all component states
```

### 3. Write Tests

```tsx
// Create *.test.tsx file
// Use renderWithProviders()
// Use mock data generators
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

## 📚 Resources

### Documentation

- `STORYBOOK-SETUP.md` - Full setup guide
- `STORYBOOK-QUICK-START.md` - Quick reference
- `TANSTACK-QUERY-HOOKS.md` - Query hooks documentation

### External Links

- [Storybook Docs](https://storybook.js.org/docs)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [TanStack Query](https://tanstack.com/query/latest)

## ✨ Success Criteria

All items checked:

- [x] Storybook starts without errors
- [x] Stories render correctly
- [x] Dark theme is applied
- [x] QueryClient provider works
- [x] Test utilities work
- [x] Mock data generators work
- [x] A11y addon shows results
- [x] Documentation is complete

## 🎉 Configuration Complete!

Storybook is fully configured and ready to use. Start creating stories for your components!

```bash
npm run storybook
```

Visit http://localhost:6006 to see your stories.
