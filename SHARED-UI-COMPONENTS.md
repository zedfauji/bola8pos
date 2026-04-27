# Shared UI Components

Complete library of POS-specific display components built on shadcn/ui primitives.

**Last Updated**: 2026-04-14  
**Status**: Complete ✅

---

## Component Inventory

### 1. MoneyDisplay

**File**: `src/shared/ui/MoneyDisplay.tsx`

Formats currency values with proper styling.

**Props**:

- `amount: number` - Amount in dollars (e.g., 12.50)
- `negative?: boolean` - Force negative styling
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Text size variant
- `className?: string` - Additional CSS classes

**Features**:

- Uses `formatMoney()` from domain-helpers
- Negative values render in red with minus sign
- Size variants: sm=text-sm, md=text-base, lg=text-xl, xl=text-3xl font-bold
- Always displays 2 decimal places

**Example**:

```tsx
<MoneyDisplay amount={12.50} size="lg" />
<MoneyDisplay amount={-5.00} negative />
```

---

### 2. TimerDisplay

**File**: `src/shared/ui/TimerDisplay.tsx`

Displays elapsed time in HH:MM:SS format.

**Props**:

- `totalSeconds: number` - Total elapsed seconds
- `size?: 'sm' | 'md' | 'lg'` - Text size variant
- `warning?: boolean` - Show warning styling (yellow)
- `className?: string` - Additional CSS classes

**Features**:

- Uses `formatElapsed()` from domain-helpers
- Monospace font (no layout shift as digits change)
- Warning state for sessions approaching 3 hours
- Formats as HH:MM:SS

**Example**:

```tsx
<TimerDisplay totalSeconds={3665} /> // 01:01:05
<TimerDisplay totalSeconds={10800} warning /> // 03:00:00 (yellow)
```

---

### 3. StatusBadge

**File**: `src/shared/ui/StatusBadge.tsx`

Color-coded status badges for Tab, PoolTable, and Order statuses.

**Props**:

- `status: TabStatus | PoolTableStatus | OrderStatus` - Status value
- `className?: string` - Additional CSS classes

**Features**:

- Maps status to color:
  - open/available/pending = green
  - occupied/reserved = yellow
  - closed/served = gray
  - paid = blue
  - voided/maintenance = red
- Uses shadcn Badge component
- Accessible with proper ARIA labels

**Example**:

```tsx
<StatusBadge status="open" />
<StatusBadge status="occupied" />
<StatusBadge status="paid" />
```

---

### 4. QuantityControl

**File**: `src/shared/ui/QuantityControl.tsx`

Three-button quantity selector with large touch targets.

**Props**:

- `value: number` - Current quantity
- `min?: number` - Minimum value (default: 0)
- `max?: number` - Maximum value (default: 99)
- `onChange: (value: number) => void` - Called when value changes
- `disabled?: boolean` - Disable all buttons

**Features**:

- Three-button layout: [−] [count] [+]
- Large touch targets (min 44px)
- Prevents going below min or above max
- Haptic feedback on mobile (navigator.vibrate if available)
- Accessible with proper ARIA labels

**Example**:

```tsx
<QuantityControl value={quantity} onChange={setQuantity} min={1} max={10} />
```

---

### 5. MoneyInput

**File**: `src/shared/ui/MoneyInput.tsx`

Currency input that stores values as integer cents.

**Props**:

- `value: number` - Value in dollars (e.g., 12.50)
- `onChange: (value: number) => void` - Called when value changes
- `placeholder?: string` - Placeholder text
- `label?: string` - Label text

**Features**:

- Always displays formatted (e.g., "$12.50")
- Stores internally as integer cents to avoid floating point issues
- On blur: formats to 2 decimal places
- Never allows negative values
- Accessible with proper ARIA labels

**Example**:

```tsx
<MoneyInput value={amount} onChange={setAmount} label="Amount" placeholder="$0.00" />
```

---

### 6. EmptyState

**File**: `src/shared/ui/EmptyState.tsx`

Centered empty state with icon, title, description, and optional action.

**Props**:

- `icon: LucideIcon` - Icon component from lucide-react
- `title: string` - Title text
- `description?: string` - Description text
- `action?: { label: string, onClick: () => void }` - Optional action button

**Features**:

- Centered layout with icon, title, description
- Optional action button
- Used when lists/tables are empty
- Accessible with proper ARIA labels

**Example**:

```tsx
<EmptyState
  icon={ShoppingCart}
  title="No items in cart"
  description="Add products to get started."
  action={{ label: 'Browse Products', onClick: handleBrowse }}
/>
```

---

### 7. SectionHeader

**File**: `src/shared/ui/SectionHeader.tsx`

Consistent page/section headers with optional action and badge.

**Props**:

- `title: string` - Header title
- `description?: string` - Description text
- `action?: React.ReactNode` - Action button or element
- `badge?: string | number` - Badge content (count, status, etc.)

**Features**:

- Consistent styling across all pages
- Right slot for action buttons (e.g., "New Tab" button)
- Badge shows counts or status
- Accessible with proper ARIA labels

**Example**:

```tsx
<SectionHeader
  title="Open Tabs"
  description="Currently active customer tabs"
  badge={12}
  action={<Button>New Tab</Button>}
/>
```

---

### 8. LoadingSkeletons

**File**: `src/shared/ui/LoadingSkeletons.tsx`

Multiple skeleton components for loading states.

**Exports**:

- `CardSkeleton` - Skeleton of a card (height configurable)
- `TableRowSkeleton` - Skeleton of a table row (columns configurable)
- `ProductGridSkeleton` - 8-item grid of product card skeletons
- `PoolTableGridSkeleton` - 6-item pool table card skeletons
- `TabListSkeleton` - List of tab card skeletons

**Features**:

- Uses shadcn Skeleton component
- Matches actual component dimensions
- Accessible with proper ARIA labels

**Example**:

```tsx
{
  isLoading ? <ProductGridSkeleton /> : <ProductGrid products={products} />;
}
{
  isLoading ? <TableRowSkeleton columns={5} /> : <TableRow data={data} />;
}
```

---

### 9. PINKeypad

**File**: `src/shared/ui/PINKeypad.tsx`

10-key numeric keypad for PIN entry in bar environment.

**Props**:

- `value: string` - Current PIN value
- `onChange: (value: string) => void` - Called when PIN changes
- `maxLength?: number` - Maximum PIN length (default: 6)
- `onComplete?: (pin: string) => void` - Called when PIN reaches maxLength
- `label?: string` - Label text above keypad
- `error?: string` - Error message to display
- `isLoading?: boolean` - Loading state - disables all keys

**Features**:

- 10-key grid (1-9, then 0) + backspace button
- Large buttons (64px × 64px) for fat-finger bar environment
- Displays value as dots (●●●●) not actual digits
- Auto-fires onComplete when maxLength reached
- Loading state with spinner
- Error state with red border
- Keyboard support (0-9, Backspace)

**Example**:

```tsx
<PINKeypad
  value={pin}
  onChange={setPin}
  maxLength={4}
  onComplete={pin => handleLogin(pin)}
  label="Enter PIN"
  error={error}
  isLoading={isLoading}
/>
```

---

### 10. POSButton

**File**: `src/shared/ui/POSButton.tsx`

Extended Button component optimized for POS touchscreen use.

**Props**:

- All standard Button props
- `touchSize?: 'default' | 'large' | 'xl'` - Touch target size

**Features**:

- Large touch targets for bartender use:
  - default: 44px (standard mobile touch target)
  - large: 56px (comfortable for bartenders)
  - xl: 72px (for primary actions like "Place Order", "Process Payment")
- Press animation (scale-95 on active)
- All standard Button variants supported

**Example**:

```tsx
<POSButton touchSize="xl" variant="default">
  Process Payment
</POSButton>
<POSButton touchSize="large" variant="destructive">
  Void Order
</POSButton>
```

---

### 11. FormField

**File**: `src/shared/ui/FormField.tsx`

Consistent wrapper for form inputs with label, error, and hint.

**Props**:

- `label: string` - Field label
- `error?: string` - Error message to display
- `required?: boolean` - Whether field is required
- `hint?: string` - Hint text to display below input
- `children: React.ReactNode` - Form input element

**Features**:

- Label with optional required asterisk
- Error message in red below input
- Hint text in gray below input
- Accessible with proper ARIA labels
- Clones child input with id and aria attributes

**Example**:

```tsx
<FormField label="Customer Name" required error={errors.name} hint="Enter first and last name">
  <Input value={name} onChange={e => setName(e.target.value)} />
</FormField>
```

---

### 12. ConfirmDialog

**File**: `src/shared/ui/ConfirmDialog.tsx`

Confirmation dialog with destructive variant support.

**Props**:

- `open: boolean` - Whether dialog is open
- `title: string` - Dialog title
- `description: string` - Dialog description
- `confirmLabel?: string` - Confirm button label (default: "Confirm")
- `cancelLabel?: string` - Cancel button label (default: "Cancel")
- `variant?: 'default' | 'destructive'` - Button variant
- `onConfirm: () => void | Promise<void>` - Called when user confirms
- `onCancel: () => void` - Called when user cancels
- `isLoading?: boolean` - Loading state - shows spinner, disables buttons

**Features**:

- Wraps shadcn AlertDialog
- Destructive variant for dangerous actions (red confirm button)
- Loading state with spinner in confirm button
- Keyboard support: Enter = confirm, Escape = cancel
- Accessible with proper ARIA labels

**Example**:

```tsx
<ConfirmDialog
  open={isOpen}
  title="Close Tab?"
  description="This will finalize the tab and require payment."
  confirmLabel="Close Tab"
  variant="destructive"
  onConfirm={handleCloseTab}
  onCancel={() => setIsOpen(false)}
  isLoading={isClosing}
/>
```

---

### 13. SearchInput

**File**: `src/shared/ui/SearchInput.tsx`

Search input with debouncing and clear button.

**Props**:

- `value: string` - Current search value
- `onChange: (value: string) => void` - Called when search value changes (debounced)
- `placeholder?: string` - Placeholder text
- `debounceMs?: number` - Debounce delay in milliseconds (default: 300)

**Features**:

- Debounces onChange calls (default 300ms)
- Clear button (X) when value is not empty
- Search icon for visual clarity
- Accessible with proper ARIA labels

**Example**:

```tsx
<SearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search products..."
  debounceMs={300}
/>
```

---

### 14. DataTable

**File**: `src/shared/ui/DataTable.tsx`

Generic table wrapper using TanStack Table.

**Props**:

- `columns: ColumnDef<T>[]` - Column definitions
- `data: T[]` - Table data
- `isLoading?: boolean` - Loading state - shows skeleton rows
- `emptyState?: React.ReactNode` - Empty state component
- `onRowClick?: (row: T) => void` - Called when row is clicked
- `searchable?: boolean` - Enable search functionality
- `searchPlaceholder?: string` - Search input placeholder

**Features**:

- Loading state with skeleton rows
- Empty state with custom component
- Optional search with local filtering
- Row click handler with hover highlight
- Fully typed with TypeScript generics
- Uses TanStack Table for sorting, filtering, pagination

**Example**:

```tsx
const columns: ColumnDef<Product>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'price', header: 'Price' },
]

<DataTable
  columns={columns}
  data={products}
  isLoading={isLoading}
  searchable
  searchPlaceholder="Search products..."
  onRowClick={(product) => console.log(product)}
/>
```

---

## shadcn/ui Primitives

### Badge

**File**: `src/shared/ui/badge.tsx`

Basic badge component with variants.

**Variants**: default, secondary, destructive, outline

---

### Button

**File**: `src/shared/ui/button.tsx`

Basic button component with variants and sizes.

**Variants**: default, destructive, outline, secondary, ghost, link  
**Sizes**: default, sm, lg, icon

---

### Input

**File**: `src/shared/ui/input.tsx`

Basic input component with consistent styling.

---

### Label

**File**: `src/shared/ui/label.tsx`

Basic label component for form fields.

---

### Skeleton

**File**: `src/shared/ui/skeleton.tsx`

Basic skeleton component for loading states.

---

### AlertDialog

**File**: `src/shared/ui/alert-dialog.tsx`

Alert dialog primitive from Radix UI.

**Exports**: AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel

---

### Table

**File**: `src/shared/ui/table.tsx`

Table primitive components.

**Exports**: Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption

---

## Utility Functions

### cn()

**File**: `src/shared/lib/utils.ts`

Merges Tailwind CSS classes with proper precedence.

**Example**:

```tsx
cn('px-2 py-1', 'px-4'); // "py-1 px-4"
cn('text-red-500', condition && 'text-blue-500'); // conditional classes
```

---

## Dependencies

- `@radix-ui/react-slot` - Slot component for asChild pattern
- `@radix-ui/react-label` - Label primitive
- `@radix-ui/react-alert-dialog` - AlertDialog primitive
- `@tanstack/react-table` - Table state management
- `class-variance-authority` - CVA for variant props
- `clsx` - Conditional class names
- `tailwind-merge` - Merge Tailwind classes
- `lucide-react` - Icon library

---

## Usage Guidelines

### 1. Always Use POS-Specific Components

- ❌ Don't use raw HTML `<input>`, `<button>`, `<select>`
- ✅ Use `<Input>`, `<POSButton>`, shadcn components

### 2. Consistent Styling

- All components use Tailwind CSS v4
- Dark mode by default (bar environment)
- CSS variables for theming (configured in globals.css)

### 3. Accessibility

- All components have proper ARIA labels
- Keyboard navigation supported
- Screen reader friendly

### 4. Touch Targets

- Minimum 44px for mobile
- Use `POSButton` with `touchSize="large"` or `touchSize="xl"` for bartender use
- Large buttons (64px+) for critical actions

### 5. Loading States

- Always show loading skeletons while data is fetching
- Use `isLoading` prop on components that support it
- Never show blank screens

### 6. Empty States

- Always show meaningful empty states
- Use `EmptyState` component with icon, title, description
- Provide action button when appropriate

### 7. Error Handling

- Show error messages in red below inputs
- Use `FormField` for consistent error display
- Use `ConfirmDialog` with `variant="destructive"` for dangerous actions

---

## Next Steps

With the shared UI library complete, the next phase is to build the **Entity Layer**:

1. **Product Entity** - Product cards, product grid, product selection
2. **Tab Entity** - Tab cards, tab list, tab drawer
3. **PoolTable Entity** - Pool table cards, pool table grid, timer display
4. **Staff Entity** - Staff cards, staff list, clock-in form
5. **Inventory Entity** - Inventory cards, inventory list, low-stock alerts
6. **Payment Entity** - Payment cards, payment list, payment summary

Each entity will use these shared UI components as building blocks.

---

## Layout Components

### 15. AppShell

**File**: `src/shared/ui/AppShell.tsx`

Main application layout wrapper with responsive sidebar.

**Props**:

- `children: React.ReactNode` - Main content
- `sidebar?: React.ReactNode` - Optional sidebar content
- `header?: React.ReactNode` - Optional header content
- `className?: string` - Additional CSS classes

**Features**:

- Desktop (≥1024px): fixed left sidebar (240px) + main content
- Tablet/Mobile (<1024px): collapsible sidebar via Sheet
- Sticky header support
- Dark theme applied to entire app
- Accessible with proper ARIA labels

**Example**:

```tsx
<AppShell sidebar={<Navigation />} header={<TopBar user={user} />}>
  <Routes />
</AppShell>
```

---

### 16. PageContainer

**File**: `src/shared/ui/PageContainer.tsx`

Consistent page wrapper with title, description, and actions slot.

**Props**:

- `children: React.ReactNode` - Page content
- `title: string` - Page title
- `description?: string` - Optional page description
- `actions?: React.ReactNode` - Optional actions slot (e.g., buttons)
- `className?: string` - Additional CSS classes

**Features**:

- Max width constraint (1400px)
- Consistent padding (24px)
- Renders SectionHeader at top
- Actions slot for page-level buttons
- Responsive layout

**Example**:

```tsx
<PageContainer
  title="Open Tabs"
  description="Currently active customer tabs"
  actions={<Button>New Tab</Button>}
>
  <TabList tabs={tabs} />
</PageContainer>
```

---

### 17. SplitLayout

**File**: `src/shared/ui/SplitLayout.tsx`

60/40 split layout used for the main POS screen.

**Props**:

- `left: React.ReactNode` - Left panel content
- `right: React.ReactNode` - Right panel content
- `leftWeight?: number` - Left panel weight (percentage, default: 60)
- `className?: string` - Additional CSS classes

**Features**:

- CSS Grid-based split with configurable ratio
- Desktop (≥768px): side-by-side panels
- Mobile (<768px): stacked with tab switcher
- Smooth transitions between layouts
- Accessible with proper ARIA labels

**Example**:

```tsx
<SplitLayout
  left={<ProductGrid products={products} />}
  right={<TabDrawer tab={activeTab} />}
  leftWeight={60}
/>
```

---

### 18. ScrollArea

**File**: `src/shared/ui/ScrollArea.tsx`

Thin wrapper around shadcn ScrollArea with consistent styling.

**Props**:

- `children: React.ReactNode` - Content to scroll
- `className?: string` - Additional CSS classes
- `maxHeight?: string` - Maximum height (e.g., "400px", "50vh")

**Features**:

- Thin scrollbar (2.5px) that appears on hover
- Smooth scrolling behavior
- Consistent styling across all scrollable areas
- Optional max height constraint
- Used in: product grid, tab list, order history

**Example**:

```tsx
<ScrollArea maxHeight="400px">
  <ProductGrid products={products} />
</ScrollArea>
```

---

## Additional shadcn/ui Primitives

### Sheet

**File**: `src/shared/ui/sheet.tsx`

Sheet (drawer) primitive from Radix UI.

**Exports**: Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetClose

**Sides**: top, bottom, left, right

---

### ScrollArea (Primitive)

**File**: `src/shared/ui/scroll-area.tsx`

ScrollArea primitive from Radix UI.

**Exports**: ScrollAreaRoot, ScrollBar

---

## Updated Component Count

**Total: 18 POS-specific components + 9 shadcn primitives = 27 components**

### POS-Specific Components (18)

1. MoneyDisplay
2. TimerDisplay
3. StatusBadge
4. QuantityControl
5. MoneyInput
6. EmptyState
7. SectionHeader
8. LoadingSkeletons
9. PINKeypad
10. POSButton
11. FormField
12. ConfirmDialog
13. SearchInput
14. DataTable
15. AppShell
16. PageContainer
17. SplitLayout
18. ScrollArea

### shadcn/ui Primitives (9)

1. Badge
2. Button
3. Input
4. Label
5. Skeleton
6. AlertDialog
7. Table
8. Sheet
9. ScrollArea (primitive)

---

## Layout Patterns

### Full Application Layout

```tsx
<AppShell
  sidebar={
    <nav className="p-4">
      <NavLink to="/pos">POS</NavLink>
      <NavLink to="/pool-tables">Pool Tables</NavLink>
      <NavLink to="/inventory">Inventory</NavLink>
      <NavLink to="/staff">Staff</NavLink>
      <NavLink to="/reports">Reports</NavLink>
    </nav>
  }
  header={
    <div className="flex items-center justify-between">
      <h1>Bar POS</h1>
      <UserMenu user={currentUser} />
    </div>
  }
>
  <Routes>
    <Route path="/pos" element={<POSPage />} />
    <Route path="/pool-tables" element={<PoolTablesPage />} />
    {/* ... */}
  </Routes>
</AppShell>
```

### Standard Page Layout

```tsx
<PageContainer
  title="Inventory Management"
  description="Track stock levels and adjust inventory"
  actions={<Button onClick={handleAdjustInventory}>Adjust Inventory</Button>}
>
  <ScrollArea maxHeight="calc(100vh - 200px)">
    <DataTable
      columns={inventoryColumns}
      data={inventory}
      searchable
      searchPlaceholder="Search products..."
    />
  </ScrollArea>
</PageContainer>
```

### POS Screen Layout

```tsx
<SplitLayout
  left={
    <ScrollArea maxHeight="calc(100vh - 100px)">
      <ProductGrid products={products} onProductClick={handleAddToTab} />
    </ScrollArea>
  }
  right={
    <div className="flex h-full flex-col">
      <TabHeader tab={activeTab} />
      <ScrollArea maxHeight="calc(100vh - 300px)">
        <OrderItemList items={activeTab.items} />
      </ScrollArea>
      <TabFooter subtotal={subtotal} onCheckout={handleCheckout} />
    </div>
  }
  leftWeight={60}
/>
```

---

## Responsive Breakpoints

All layout components use consistent Tailwind breakpoints:

- **Mobile**: < 768px (sm)
- **Tablet**: 768px - 1024px (md - lg)
- **Desktop**: ≥ 1024px (lg+)

### Responsive Behavior

**AppShell**:

- Desktop: Fixed sidebar (240px)
- Tablet/Mobile: Collapsible Sheet sidebar

**SplitLayout**:

- Desktop: Side-by-side panels (60/40 split)
- Mobile: Stacked with tab switcher

**PageContainer**:

- All sizes: Max width 1400px, centered
- Mobile: Reduced padding (16px vs 24px)

---

## Performance Considerations

### Virtualization

For large lists (>100 items), consider using `@tanstack/react-virtual`:

```tsx
<ScrollArea maxHeight="600px">
  <VirtualizedList items={products} />
</ScrollArea>
```

### Lazy Loading

Use React.lazy for page-level components:

```tsx
const POSPage = React.lazy(() => import('./pages/pos'))

<Suspense fallback={<LoadingSkeleton />}>
  <POSPage />
</Suspense>
```

### Memoization

Memoize expensive layout calculations:

```tsx
const splitRatio = React.useMemo(
  () => ({ left: leftWeight, right: 100 - leftWeight }),
  [leftWeight]
);
```

---

## Accessibility

All layout components follow WCAG 2.1 Level AA guidelines:

- ✅ Keyboard navigation (Tab, Shift+Tab, Enter, Escape)
- ✅ Screen reader support (ARIA labels, roles, descriptions)
- ✅ Focus management (trap focus in modals/sheets)
- ✅ Color contrast (4.5:1 minimum for text)
- ✅ Touch targets (44px minimum for mobile)

---

## Next Steps

With the complete shared UI library (18 components + 9 primitives), the next phase is:

**Phase 2A: Core Entities Implementation**

Build the entity layer using these layout and display components:

1. **Product Entity** - Use DataTable, ScrollArea, SearchInput
2. **Tab Entity** - Use SplitLayout, ScrollArea, MoneyDisplay
3. **PoolTable Entity** - Use DataTable, TimerDisplay, StatusBadge
4. **Staff Entity** - Use PINKeypad, FormField, DataTable
5. **Inventory Entity** - Use DataTable, SearchInput, StatusBadge
6. **Payment Entity** - Use MoneyInput, ConfirmDialog, FormField

Each entity will compose these shared components into domain-specific UI.
