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

**fast-check float tolerance for rounded results** — When asserting that a function's result "never exceeds base", remember that if the function rounds to 2 decimal places, use `roundedBase + 0.005` tolerance, not `base + 0.001`. The function computes `Math.round(raw * 100) / 100`, which can round a result like 1123.465... up to 1123.47, exceeding `base + 0.001`. Correct assertion:

```ts
const roundedBase = Math.round(base * 100) / 100;
return result <= roundedBase + 0.005 && result >= 0;
```

**MoneyInput label for discount** — The `MoneyInput` for discount uses dynamic labels: `'Discount %'` when type is `'percent'` and `'Discount amount'` when type is `'fixed'`. Use `getByLabelText('Discount %')` or `getByLabelText('Discount amount')` accordingly.

**PaymentModal discount tests pattern** — discount section is rendered inside a `<section data-testid="discount-section">`. Hidden when method is `'rappi'`. Use `within(dialog).getByTestId('discount-section')`. After entering a non-zero discount value, `data-testid="discount-applied-label"` and `data-testid="discount-row"` appear. Use `waitFor` before asserting on these since they depend on state updates.

**E2E spec numbering** — spec files 18, 19, and 23 exist. Next new spec should start at 24.

**Pending migrations block E2E** — Before writing new E2E specs, always run `npx supabase migration list` to confirm all local migrations are applied to remote. If unapplied migrations exist, run `npx supabase db push`. Unapplied migrations cause Supabase 404 errors that appear as silent failures in the UI (the error toast fires but contains the DB error message, not the expected success text).

**MoneySchema nonnegative blocks negative netBalance** — `netBalance` in `CajaReportSummarySchema` must use `z.number().multipleOf(0.01)` (not `MoneySchema`) because expenses can make net balance negative. Zod `nonnegative()` on netBalance causes `CajaReportSchema.parse()` to throw silently, resulting in `report === null` in `CajaReportPanel` and a blank reports page.

**CajaEntry dialog submit in E2E** — In real Playwright (not jsdom), clicking `type="submit"` button inside a Radix UI Dialog portal DOES trigger `onSubmit`. The memory note about using `fireEvent.submit` only applies to Vitest/jsdom unit tests, not E2E.

**Debug E2E network/mutation failures** — Add `page.on('console', msg => consoleLogs.push(...))` listener and include log output in assertion error message. Look for `[error] Failed to load resource: 404` paired with logger error calls — this pattern confirms a Supabase table/RPC is missing from remote DB.

**Why:** Discovered during Sprint 2 test writing (April 2026). The fast-check tolerance bug was pre-existing in domain-helpers.test.ts.

**How to apply:** Follow these patterns whenever writing new Vitest unit tests in this project.
