---
name: bar-pos unit test patterns
description: Established patterns for mocking, rendering, and asserting in Vitest + RTL tests in this project
type: feedback
---

## Key patterns confirmed working

**useStaffStore.setState** — use the full state object directly; do NOT cast `currentShift` via `as`:

```ts
useStaffStore.setState({
  currentStaff: { id, name, email, role, pin, isActive },
  currentShift: { id, staffId, clockIn, clockOut, openingCash, closingCash } satisfies Shift,
  staffList: [],
  isAuthenticated: true,
});
```

**vi.mock for module-level query hooks** — pattern from TabDrawer and StartSessionSheet tests:

```ts
vi.mock('@entities/pool-table/model/queries', () => ({
  useMutationStartSession: vi.fn(),
}));
vi.mocked(poolTableQueries.useMutationStartSession).mockReturnValue({
  mutateAsync: vi.fn().mockResolvedValue(ok(...)),
  isPending: false,
} as unknown as ReturnType<typeof poolTableQueries.useMutationStartSession>);
```

**useSettings mock** — stable reference trick to avoid tip-preset useEffect churn:

```ts
vi.mock('@entities/settings', () => {
  const stableSettings = {
    billing: {
      taxRatePercent: 0,
      defaultTipPercentages: [10, 15, 18, 20],
      paymentMethods: { cash: true, bbvaCard: true, rappi: false },
    },
  };
  return { useSettings: () => ({ data: stableSettings }) };
});
```

Use `taxRatePercent: 0` in settings mock to keep money arithmetic simple.

**MoneyInput getByLabelText** — works as `screen.getByLabelText('Charge amount')` returns the `<input>`. Value is always formatted like `'23.00'`.

**select element options** — avoid `as HTMLSelectElement` cast (triggers `@typescript-eslint/no-unnecessary-type-assertion`). Use:

```ts
screen.getAllByRole('option', { hidden: true }).map(o => o.textContent ?? '');
```

**import order** — non-type imports of the same module path must come before type imports:

```ts
import * as tabQueries from '@entities/tab/model/queries'; // value first
import type { Tab } from '@entities/tab/model/types'; // then type
```

**MemoryRouter for pages** — PaymentsPage uses `BackToHomeButton` which wraps `<Link>`. Wrap in `<MemoryRouter>` when rendering pages that use react-router in tests.

**Why:** All of these were discovered and fixed during the April 2026 test session to avoid TS and lint errors that block the quality gate.

**How to apply:** Follow these patterns whenever writing new Vitest unit tests in this project.
