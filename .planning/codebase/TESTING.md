# Testing Patterns

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

**Analysis Date:** 2026-04-16

## Test Framework

**Runner:**

- Vitest **4.1.4** (see `bar-pos/package.json`).
- Config: `bar-pos/vitest.config.ts` — Vite resolve aliases mirror `tsconfig.json`; two **test projects**:
  1. **Default (jsdom):** `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/shared/lib/test-setup.ts']`.
  2. **Storybook:** `test.name: 'storybook'`, `@storybook/addon-vitest/vitest-plugin` (`storybookTest` with `configDir: .storybook`), **browser** mode with `@vitest/browser-playwright` (Chromium, headless).

**Assertion / DOM:**

- Vitest built-in `expect`.
- `@testing-library/react` + `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`) — `jest-dom` imported in `bar-pos/src/shared/lib/test-setup.ts`.
- `@testing-library/user-event` for interaction tests (e.g. `bar-pos/src/entities/tab/ui/TabCard.test.tsx`).

**Run Commands:**

```bash
cd bar-pos
npm test                              # vitest (all projects)
npm run test:ui                       # vitest --ui
npm run test:coverage                 # vitest --coverage
```

Single-file examples:

```bash
cd bar-pos
npx vitest run src/shared/lib/result.test.ts
npx vitest run --project storybook
```

## Test File Organization

**Location:**

- Co-located next to the code under `bar-pos/src/**` — no separate top-level `tests/` tree for unit tests.

**Naming:**

- `*.test.ts` / `*.test.tsx` only (no `.spec` suffix in this repo).

**Current test files (inventory):**

- `bar-pos/src/features/add-item-to-tab/model/cartStore.test.ts`
- `bar-pos/src/features/open-tab/model/useOpenTab.test.tsx`
- `bar-pos/src/widgets/TabDrawer/TabDrawer.test.tsx`
- `bar-pos/src/entities/tab/ui/TabCard.test.tsx`
- `bar-pos/src/entities/tab/ui/TabDetail.test.tsx`
- `bar-pos/src/entities/product/ui/CategoryTabs.test.tsx`
- `bar-pos/src/shared/lib/domain-helpers.test.ts`
- `bar-pos/src/shared/lib/logger.test.ts`
- `bar-pos/src/shared/lib/result.test.ts`

**Structure (conceptual):**

```
bar-pos/src/
  features/<feature>/model/*.test.ts(x)
  widgets/<Widget>/*.test.tsx
  entities/<entity>/ui/*.test.tsx
  shared/lib/*.test.ts
```

## Global test setup

**File:** `bar-pos/src/shared/lib/test-setup.ts`

- Registers `@testing-library/jest-dom`.
- `afterEach` → `cleanup()` from Testing Library.
- **`vi.mock('@tauri-apps/api/core')`** — `invoke` resolves by default (Tauri unavailable in jsdom).
- **`vi.mock('@shared/lib/supabase')`** — chained query builder stubs and `auth.getUser`.
- **`window.matchMedia`**, **`ResizeObserver`** polyfills for layout components.

Use this file as the reference when new globals or default mocks are needed.

## Test Structure

**Suite organization (typical):**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('moduleOrHookName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset Zustand: useSomeStore.setState({ ... })
  });

  describe('behaviorGroup', () => {
    it('should ...', () => {
      // arrange / act / assert
    });
  });
});
```

**Patterns:**

- **Zustand:** `beforeEach` resets store via `useCartStore.setState(...)` (`cartStore.test.ts`).
- **Hooks:** `renderHook` from `@testing-library/react` with a local `QueryClientProvider` wrapper; `waitFor` for async assertions (`useOpenTab.test.tsx`).
- **Components:** `render` / `screen` / `userEvent.setup()` (`TabCard.test.tsx`).
- Top-of-file **banner comments** name the suite (`TAB CARD TESTS`, `OPEN TAB HOOK TESTS`).

## Mocking

**Framework:** Vitest `vi` (`vi.mock`, `vi.fn`, `vi.mocked`, `vi.clearAllMocks`).

**Patterns:**

```typescript
vi.mock('@entities/tab/model/queries');
vi.mock('@entities/tab/model/store');
vi.mocked(store.useTabStore).mockReturnValue({ ... });

vi.mock('../model/store', () => ({
  useTabStore: vi.fn((selector) => selector({ ... })),
}));
```

- Mock **entity** query modules and stores when testing features/widgets.
- Mock **`@shared/lib/logger`** in hook tests to avoid noise and assert calls when needed.
- Global Supabase/Tauri mocks live in `test-setup.ts`; override per test with `vi.mocked` if required.

**What to mock:**

- Tauri IPC, Supabase client (defaults in setup), module boundaries (`queries`, `store`), time-sensitive externals as tests grow.

**What not to mock:**

- Pure helpers under test (`domain-helpers.test.ts`, `result.test.ts` use real implementations).

## Fixtures and factories

**Test data:**

- Prefer **fixtures** from entity modules: `mockTab`, `mockTabItem` from `bar-pos/src/entities/tab/model/types.ts`.
- Inline objects in hook tests for full `Tab`-shaped payloads (`useOpenTab.test.tsx`).
- Spread and override fields for variants (`TabCard.test.tsx` plural items case).

**Location:**

- Shared mocks: `bar-pos/src/shared/lib/test-setup.ts`.
- Entity mocks: `bar-pos/src/entities/*/model/types.ts` (alongside re-exports).

## Coverage

**Tool:** `@vitest/coverage-v8` — `npm run test:coverage`.

**Configuration** (`bar-pos/vitest.config.ts` → `test.coverage`):

- Provider: `v8`.
- Reporters: `text`, `json`, `html`.
- **Include:** `src/**/*.ts`, `src/**/*.tsx`.
- **Exclude:** `**/*.stories.tsx`, `**/*.test.*`, `src/shared/lib/supabase.types.ts`, `**/*.d.ts`.

**Requirements:** No enforced coverage threshold in config; use coverage for awareness and regression targeting.

## Test types

**Unit:**

- Store logic (`cartStore.test.ts`), pure libs (`result.test.ts`, `domain-helpers.test.ts`, `logger.test.ts`).

**Component / hook:**

- RTL component tests; `renderHook` for hooks with QueryClient wrapper.

**Storybook + Vitest integration:**

- Stories live as `bar-pos/src/**/*.stories.tsx` (and MDX) per `bar-pos/.storybook/main.ts`.
- **Vitest** `storybook` project runs Storybook-linked tests in a **real browser** (Playwright). Useful for story-based interaction/a11y flows via `@storybook/addon-vitest` (see Storybook docs for writing tests in stories).
- Global Storybook decorators: `bar-pos/.storybook/decorators.tsx` (`withQueryClient`, `withDarkTheme`); preview imports `bar-pos/src/app/globals.css`.

**E2E (Playwright):**

- `playwright` is a devDependency and used as the Vitest browser provider for the Storybook project — **not** a separate `e2e/` Playwright test suite detected under `bar-pos/`.

**Property-based:**

- `fast-check` is in `bar-pos/package.json` devDependencies but **not** referenced in `src/` tests yet.

## Common patterns

**Async / hooks:**

```typescript
const { result } = renderHook(() => useOpenTab(), { wrapper });
const openResult = await result.current.openTab({ ... });
await waitFor(() => {
  expect(openResult.ok).toBe(true);
});
```

**Result errors:**

```typescript
expect(openResult.ok).toBe(false);
if (!openResult.ok) {
  expect(openResult.error.code).toBe('SUPABASE_ERROR');
}
```

**Throwing utilities:**

```typescript
expect(() => unwrapResult(errResult)).toThrow(/NOT_FOUND/);
```

**Snapshots:** Not used in the sampled tests; prefer explicit assertions.

---

*Testing analysis: 2026-04-16*
*Update when test patterns change*
