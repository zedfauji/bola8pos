# Development Tooling Standards

This document describes the complete development tooling setup for the Bar POS project.

## ✅ Installed & Configured

### TypeScript Configuration

- **Target**: ES2022 with strict mode enabled
- **Additional Strict Checks**:
  - `noUncheckedIndexedAccess: true` - prevents undefined array access
  - `exactOptionalPropertyTypes: true` - enforces exact optional property types
- **Path Aliases**: All FSD layers mapped with `@` prefix
  - `@app/*` → `./src/app/*`
  - `@pages/*` → `./src/pages/*`
  - `@widgets/*` → `./src/widgets/*`
  - `@features/*` → `./src/features/*`
  - `@entities/*` → `./src/entities/*`
  - `@shared/*` → `./src/shared/*`

### ESLint (v9 Flat Config)

- **Extends**:
  - TypeScript strict type-checked rules
  - React recommended + hooks
  - JSX accessibility (a11y)
  - Import plugin with TypeScript resolver
- **Custom Rules**:
  - `@typescript-eslint/no-explicit-any: error` - NO `any` types allowed
  - `@typescript-eslint/consistent-type-imports: error` - enforce `type` imports
  - `no-console: warn` - only `console.warn` and `console.error` allowed
  - `import/no-cycle: error` - prevent circular dependencies
  - `import/order: error` - enforce FSD import order (shared → entities → features → widgets → pages → app)
  - `no-relative-import-paths: error` - enforce `@` aliases, no `../..` imports
  - **`boundaries/dependencies: error`** - **ENFORCES FSD LAYER RULES** (non-negotiable)
    - `shared` → cannot import from any layer
    - `entities` → can only import from `shared`
    - `features` → can only import from `entities`, `shared`
    - `widgets` → can only import from `features`, `entities`, `shared`
    - `pages` → can only import from `widgets`, `features`, `entities`, `shared`
    - `app` → can import from all layers
  - `no-restricted-syntax: error` - bans barrel exports (`export *`)

### Prettier

- **Style**: Single quotes, no semicolons, 2-space tabs, 100 char width
- **Trailing Commas**: ES5 (objects/arrays only)
- **Arrow Parens**: Avoid when possible
- **Line Endings**: LF (Unix-style)

### Vitest

- **Environment**: jsdom (for React component testing)
- **Setup File**: `src/shared/lib/test-setup.ts`
  - Auto-cleanup after each test
  - Mock `window.matchMedia` for responsive tests
- **Coverage**: v8 provider with HTML/JSON/text reports
- **Excludes**: Stories, test files, generated types

### Git Hooks (Husky)

- **pre-commit**: Runs `lint-staged`
  - Auto-fixes ESLint errors
  - Formats with Prettier
  - Blocks commit if max-warnings exceeded
- **pre-push**: Runs `npm run typecheck`
  - Ensures no TypeScript errors before push

### Lint-Staged

- **TypeScript files** (`.ts`, `.tsx`): ESLint fix + Prettier format
- **Other files** (`.json`, `.md`, `.css`): Prettier format only

## 📦 Package Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run tauri            # Run Tauri commands

# Type Checking
npm run typecheck        # Run TypeScript compiler (no emit)

# Linting
npm run lint             # Check for ESLint errors (max 0 warnings)
npm run lint:fix         # Auto-fix ESLint errors

# Formatting
npm run format           # Format all files with Prettier

# Testing
npm run test             # Run Vitest in watch mode
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Generate coverage report

# Build
npm run build            # TypeScript check + Vite build
npm run preview          # Preview production build
```

## 🚀 Verification

Both commands pass with zero errors on the fresh scaffold:

```bash
npm run typecheck && npm run lint
```

## 📋 Development Workflow

1. **Before committing**: Git hooks automatically run lint-staged
2. **Before pushing**: Git hooks automatically run typecheck
3. **During development**: Use `npm run lint:fix` to auto-fix issues
4. **For testing**: Write tests in `*.test.tsx` files, run with `npm run test`

## 🎯 Key Principles

- **Zero `any` types** - Use `unknown` + type narrowing instead
- **No relative imports** - Always use `@app/`, `@shared/`, etc.
- **Import order matters** - Follow FSD layer hierarchy
- **No circular dependencies** - ESLint will catch these
- **Type-safe everywhere** - Strict TypeScript + Zod validation
- **FSD layer boundaries are ENFORCED** - `eslint-plugin-boundaries` prevents violations
  - Entities CANNOT import from features (will fail lint)
  - Shared CANNOT import from any business layer (will fail lint)
  - All layer violations are caught at lint time, not runtime

## 🔧 IDE Setup

### VS Code (Recommended)

Install these extensions:

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- TypeScript + JavaScript (`ms-vscode.vscode-typescript-next`)

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 📚 Next Steps

1. Install shadcn/ui components: `npx shadcn@latest init`
2. Set up Supabase client in `src/shared/lib/supabase.ts`
3. Generate Supabase types: `supabase gen types typescript > src/shared/lib/supabase.types.ts`
4. Create entity schemas with Zod in `src/entities/*/model/types.ts`
5. Build features following FSD architecture

---

**All files written after this point MUST conform to these standards.**
