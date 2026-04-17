# Open Tab Feature

## Overview

The `open-tab` feature handles the business logic and UI for opening a new customer tab in the POS system.

## Structure

```
src/features/open-tab/
├── model/
│   ├── useOpenTab.ts       # Feature hook (business logic)
│   └── useOpenTab.test.ts  # Unit tests
├── ui/
│   ├── OpenTabButton.tsx         # UI component
│   └── OpenTabButton.stories.tsx # Storybook stories
├── index.ts                # Barrel export
└── README.md              # This file
```

## Usage

### In a Page Component

```tsx
import { OpenTabButton } from '@features/open-tab';

export function POSPage() {
  return (
    <div>
      <OpenTabButton />
    </div>
  );
}
```

### Using the Hook Directly

```tsx
import { useOpenTab } from '@features/open-tab';
import { useAuth } from '@entities/staff/model/AuthContext';

export function CustomTabOpener() {
  const { openTab, isPending } = useOpenTab();
  const { profile, currentShift } = useAuth();

  const handleClick = async () => {
    if (!profile || !currentShift) return;

    const result = await openTab({
      customerName: 'John Doe',
      tableNumber: 5,
      staffId: profile.id,
      shiftId: currentShift.id,
      status: 'open',
      notes: null,
      items: [],
    });

    if (result.ok) {
      console.log('Tab opened:', result.data.id);
    } else {
      console.error('Failed to open tab:', result.error.message);
    }
  };

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Opening...' : 'Open Tab'}
    </button>
  );
}
```

## Hook Contract

### `useOpenTab()`

**Returns:**

```typescript
{
  openTab: (input: CreateTab) => Promise<Result<Tab>>,
  isPending: boolean
}
```

**Behavior:**

1. Calls `useCreateTab()` mutation from tab entity
2. On success:
   - Logs the event
   - Selects the new tab in UI state
   - Opens the tab drawer
   - Returns `{ ok: true, data: Tab }`
3. On failure:
   - Logs the error
   - Returns `{ ok: false, error: AppError }`

## UI Component

### `OpenTabButton`

A dialog-based button that prompts for customer name and optional table number before opening a tab.

**Features:**

- Large touch target (56px) for bartender use
- Disabled when no staff is logged in or no active shift
- Shows loading state during tab creation
- Auto-clears form on success
- Validates table number (1-200)

**Props:** None (uses auth context internally)

## Testing

Run tests:

```bash
npm run test src/features/open-tab
```

Run Storybook:

```bash
npm run storybook
```

## Dependencies

- `@entities/tab` - Tab entity queries and store
- `@entities/staff` - Auth context for staff/shift info
- `@shared/ui` - POSButton, Dialog, Input, Label components
- `@shared/lib/logger` - Structured logging
- `@tanstack/react-query` - Async state management

## Architecture Notes

This feature follows Feature-Sliced Design (FSD):

- **model/** contains business logic (hooks)
- **ui/** contains presentational components
- No direct Supabase calls (uses entity layer)
- No business logic in UI components
- Returns Result type for explicit error handling
