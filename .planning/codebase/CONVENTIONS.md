# Coding Conventions

**Analysis Date:** 2026-04-16

## Naming Patterns

**Files:**

- React components and co-located UI: `PascalCase.tsx` (e.g. `bar-pos/src/entities/tab/ui/TabCard.tsx`).
- Hooks: `camelCase` with `use` prefix (e.g. `bar-pos/src/features/open-tab/model/useOpenTab.ts`).
- Zustand stores: `camelCase` + `Store` in name (e.g. `cartStore.ts`, `useCartStore` export).
- Feature folders: **kebab-case** verb phrases under `bar-pos/src/features/` (e.g. `open-tab`, `add-item-to-tab`).
- Tests: same basename as implementation + `.test.ts` / `.test.tsx` (e.g. `TabCard.test.tsx`, `cartStore.test.ts`).
- Storybook: same basename + `.stories.tsx` (e.g. `TabCard.stories.tsx`).
- Entity `types.ts`: re-exports schemas/types from `bar-pos/src/shared/lib/domain.ts` plus mocks for stories/tests.

**Functions:**

- `camelCase` for functions and methods.
- Event handlers: `handle*` or callback props like `onSelect` (see `TabCard`).

**Variables:**

- `camelCase` for locals and props.
- Unused parameters: prefix with `_` to satisfy `@typescript-eslint/no-unused-vars` in `bar-pos/eslint.config.js`.

**Types:**

- `PascalCase` for interfaces, type aliases, and Zod-inferred types (`Tab`, `Product`, etc.).
- No `I` prefix on interfaces.
- Use `import type { ... }` for type-only imports (enforced by ESLint `consistent-type-imports`).

## Code Style

**Formatting:**

- Prettier: `bar-pos/.prettierrc` — semicolons on, single quotes, tab width 2, `printWidth` 100, trailing commas `es5`, `arrowParens: "avoid"`, `endOfLine: "lf"`.
- Also formats `*.{json,md,css}` via lint-staged (see below).

**Linting:**

- ESLint flat config: `bar-pos/eslint.config.js`.
- TypeScript: `typescript-eslint` **strictTypeChecked** with `projectService: true` and `tsconfigRootDir` set to the `bar-pos` package root.
- React: `eslint-plugin-react`, `react-hooks`, `react-refresh` (only-export-components warn with `allowConstantExport`), `jsx-a11y` recommended.
- **FSD boundaries:** `eslint-plugin-boundaries` maps `src/app`, `pages`, `widgets`, `features`, `entities`, `shared` and enforces allowed imports between layers.
- **Imports:** `import/order` with path groups for `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared` (alphabetize ascending). `import/no-cycle` is **error**.
- **Barrel rule:** `no-restricted-syntax` bans `export *` (explicit re-exports only).
- **`any`:** error in app code; relaxed in `**/*.test.ts`, `**/*.test.tsx`, `**/*.stories.tsx`, `**/mocks.ts`.
- **`no-console`:** warn; allows `console.warn` and `console.error` only — prefer `logger` from `bar-pos/src/shared/lib/logger.ts` for production-style logging.
- Storybook: `eslint-plugin-storybook` flat recommended config appended for story files.
- Run from package root: `npm run lint` → `eslint src --max-warnings 0`; fix: `npm run lint:fix`.
- `eslint-config-prettier` is listed in `bar-pos/package.json` but **not** composed into `eslint.config.js`; expect occasional format-vs-lint overlap to be resolved by running Prettier.

**Typecheck:**

- `npm run typecheck` — `tsc --noEmit` using `bar-pos/tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## Import Organization

**Order (enforced):**

1. Built-in Node modules.
2. External packages (`react`, `@tanstack/react-query`, etc.).
3. Internal path aliases in layer order: `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`.
4. Parent/sibling/index relative imports (prefer aliases for cross-layer imports per FSD rules in `.cursor/rules/architecture-fsd.mdc`).

**Path aliases (TS + Vite + Vitest + Storybook):**

- `@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*` → under `bar-pos/src/` (see `bar-pos/tsconfig.json` paths and `bar-pos/vitest.config.ts` / `bar-pos/.storybook/main.ts` resolve.alias).

## Error Handling

**Patterns:**

- Async boundaries and mutations use **`Result<T, AppError>`** from `bar-pos/src/shared/lib/result.ts` with `ok` / `err` helpers and domain-specific error factories (`supabaseError`, `validationError`, etc.).
- Consumers must narrow with `result.ok` before using `result.data` (see tests in `bar-pos/src/shared/lib/result.test.ts` and `bar-pos/src/features/open-tab/model/useOpenTab.test.tsx`).
- TanStack Query hooks may `throw` in `queryFn` for query errors; feature hooks wrap mutations into `Result` where applicable.

**Zod:**

- Canonical schemas and inferred types live in **`bar-pos/src/shared/lib/domain.ts`** (Zod 4.x).
- Entity `bar-pos/src/entities/*/model/types.ts` files **re-export** schemas/types from `domain.ts` and hold **mock fixtures** (`mockTab`, etc.) for Storybook and tests.
- Feature-local schemas (e.g. form resolver) may import `z` in UI files such as `bar-pos/src/features/open-tab/ui/OpenTabDialog.tsx`; keep cross-entity contracts in `domain.ts`.
- Parse external or untrusted payloads with `.safeParse` / `.parse` at boundaries; avoid `as` casts to silence validation (see `.cursor/rules/code-standards.mdc`).

## Logging

**Framework:**

- `logger` from `bar-pos/src/shared/lib/logger.ts` — structured, PII-aware API (`SafeLogPayload`, banned keys).

**Patterns:**

- Use `logger.debug` / `info` / `warn` / `error` with a message string and a context object.
- Do not log PCI/credential fields; rules are documented in the logger module header.

## Comments

**When to comment:**

- File-level blocks describe responsibility (e.g. `domain.ts` “single source of truth”, test files with section titles like `OPEN TAB HOOK TESTS`).
- Prefer clear names over inline noise; explain **why** for non-obvious business rules.

**JSDoc/TSDoc:**

- Used where modules export non-trivial public APIs (e.g. `logger.ts`, `domain.ts` section headers). Not required on every private helper.

## Function Design

**Size:**

- Workspace rule of thumb: avoid files **>300 lines** except large contract files like `domain.ts` / generated types (`.cursor/rules/code-standards.mdc`).

**Parameters / returns:**

- Prefer typed objects for complex inputs (Zod + inferred types).
- Hooks return small objects (`{ openTab, isPending }`) rather than many positional values.

## Module Design

**Exports:**

- Named exports are standard for components and utilities.
- **No** `export *`; re-export symbols explicitly (`eslint.config.js`).

**Barrel files:**

- Entity `types.ts` re-exports from `domain.ts` for a stable import surface for that entity.

## Git hooks and staged checks

**Husky:**

- `bar-pos/package.json` `"prepare": "husky"` installs hooks from `bar-pos/.husky/`.
- `bar-pos/.husky/pre-commit`: `npx tsc --noEmit` then `npx lint-staged`.
- `bar-pos/.husky/pre-push`: `npm run typecheck`.

**lint-staged:**

- `bar-pos/lint-staged.config.js`: `*.{ts,tsx}` → `eslint --fix --max-warnings 0` then `prettier --write`; `*.{json,md,css}` → `prettier --write`.

## Cursor / project rules (authoritative intent)

- **Always-on:** `.cursor/rules/code-standards.mdc` (Result pattern, logger, Zustand vs Query, Zod, PII), `.cursor/rules/architecture-fsd.mdc` (FSD layers, aliases, file naming).
- **UI:** `.cursor/rules/ui-components.mdc` when touching `shared/ui` or composition.
- **Global:** `.cursor/rules/global.mdc` for workspace-wide expectations.

---

*Convention analysis: 2026-04-16*
*Update when patterns change*
