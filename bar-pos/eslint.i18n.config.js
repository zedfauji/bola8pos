// Standalone lint gate for the eslint-plugin-i18next `no-literal-string` rule.
// Deliberately separate from eslint.config.js (the committed `npm run lint` gate)
// so that turning the rule on does NOT break CI until every string is migrated —
// 21-12 folds an equivalent block into eslint.config.js and deletes this helper.
//
// Usage: npm run lint:i18n -- <path glob>
import tseslint from 'typescript-eslint'
import i18next from 'eslint-plugin-i18next'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Matches every ts/tsx file so files outside the i18next-scoped block below
  // (e.g. src/shared/lib/**) are "seen" by ESLint (no ignored-file warning)
  // without being subject to the no-literal-string rule. Extends the
  // typescript-eslint recommended base for parser + JSX support.
  files: ['**/*.{ts,tsx}'],
  extends: [tseslint.configs.recommended],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  // Registered (not enabled) so eslint-disable comments scoped to the wider
  // committed eslint.config.js's rule set (react-refresh/only-export-components,
  // react-hooks/*, jsx-a11y/*, react/prop-types, e.g. pdf.tsx, DataTable.tsx,
  // PersonCard.tsx, input-group.tsx, input.tsx, table.tsx) resolve as
  // known-but-inactive rules instead of erroring with "Definition for rule
  // ... was not found" under this narrower standalone gate.
  plugins: {
    'react-refresh': reactRefresh,
    'react-hooks': reactHooks,
    'jsx-a11y': jsxA11y,
    react,
  },
  linterOptions: {
    // Same rationale — a disable comment for a rule this gate doesn't enable
    // (@typescript-eslint/no-unsafe-argument, react-refresh/only-export-components)
    // is legitimately "unused" here without being a real problem in the file.
    reportUnusedDisableDirectives: 'off',
  },
}, {
  // Mirrors eslint.config.js's test-file override — tseslint.configs.recommended
  // (registered above) enables @typescript-eslint/no-explicit-any repo-wide,
  // but this standalone i18n gate has no equivalent override, so pre-existing
  // `any` usage in test/mock/story files (unrelated to string migration) was
  // failing this narrower gate even though the committed `npm run lint` gate
  // already permits it there.
  files: ['**/*.test.ts', '**/*.test.tsx', '**/*.stories.tsx', '**/mocks.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
}, {
  files: [
    'src/shared/ui/**/*.tsx',
    'src/entities/**/*.{ts,tsx}',
    'src/features/**/*.{ts,tsx}',
    'src/widgets/**/*.{ts,tsx}',
    'src/pages/**/*.tsx',
  ],
  ignores: ['**/*.test.tsx', '**/*.test.ts', '**/*.stories.tsx', '**/mocks.ts'],
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': ['error', {
      mode: 'all', // catches JSX text, JSX attributes, AND call arguments (Pitfall 5)
      'jsx-attributes': {
        exclude: [
          'data-testid', 'className', 'to', 'type', 'key', 'role', 'variant',
          'size', 'name', 'htmlFor', 'id', 'value', 'aria-hidden',
          // 'data-slot' is the shadcn/Radix structural slot marker (e.g.
          // data-slot="dialog-content") used across every shared/ui shadcn
          // primitive — a CSS/DOM hook, not UI copy. 'aria-invalid' is always
          // the literal string 'true'/'false', never translatable text.
          'data-slot', 'aria-invalid',
          // 'confirmClassName' is ConfirmDialog's Tailwind class passthrough for
          // the destructive confirm button (Phase 32/33's touch-target/focus-ring
          // sweep, e.g. VoidOrderDialog's 72px/ring-4 confirm) — a CSS class
          // string, not UI copy, same category as 'className' above.
          'confirmClassName',
        ],
      },
      // 'can(...)' is the RBAC permission check (usePermissions().can) — its
      // string argument is a fixed RBACAction identifier, not UI copy.
      // 'logger.error/.warn/.info/.debug(...)' first args are internal
      // telemetry event names (e.g. 'staff.update_locale.failed'), not UI copy.
      // '.rpc(...)' (db.rpc/supabase.rpc, mutation hooks across the order/
      // pool/payment feature cluster) first arg is the fixed Postgres RPC
      // function name — a wire-protocol identifier, never UI copy; the
      // withDottedPrefix wrapper makes this exclude match any receiver
      // (db.rpc, supabase.rpc, (supabase as any).rpc, deplDb.rpc, etc).
      callees: {
        exclude: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv', 't', 'can', 'logger\\.\\w+', 'rpc'],
      },
      // Object literal properties named `key`/`id`/`accessorKey` (React list
      // keys, TanStack Table column identifiers/accessors) are structural
      // data, not UI copy. `displayName` is the React DevTools component
      // name assignment (e.g. `Card.displayName = 'Card'`) — always a code
      // identifier matching the component's own name, never UI copy.
      // `className`/`aria-invalid` cover the same object-literal-property
      // shape as their JSX-attribute counterparts above (e.g. StatusBadge's
      // `statusConfig` map uses `className: 'bg-green-500...'` entries, and
      // FormField's cloned-child props object uses `'aria-invalid': ...`).
      // `labelKey` (StatusBadge's status->i18next-key config map) holds a
      // dot-path key string looked up via t(), not the UI copy itself.
      'object-properties': {
        exclude: ['key', 'id', 'accessorKey', 'displayName', 'className', 'aria-invalid', 'labelKey'],
      },
      // Em dash ('—') is a standalone symbol used as an empty-value
      // placeholder (e.g. no open shift), not translatable UI copy.
      // The filled/empty PIN dot markers ('●'/'○'), the diff-viewer's
      // removed-line minus sign ('−', U+2212, distinct from ASCII '-'), and
      // en/em dashes are likewise decorative status glyphs, not UI copy.
      words: {
        exclude: ['^[0-9.,$%:@#/x×+*-]+$', '^[A-Z_]{2,}$', '^—$', '^[●○−–]+$'],
      },
    }],
  },
})
