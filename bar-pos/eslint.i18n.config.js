// Standalone lint gate for the eslint-plugin-i18next `no-literal-string` rule.
// Deliberately separate from eslint.config.js (the committed `npm run lint` gate)
// so that turning the rule on does NOT break CI until every string is migrated —
// 21-12 folds an equivalent block into eslint.config.js and deletes this helper.
//
// Usage: npm run lint:i18n -- <path glob>
import tseslint from 'typescript-eslint'
import i18next from 'eslint-plugin-i18next'

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
        ],
      },
      // 'can(...)' is the RBAC permission check (usePermissions().can) — its
      // string argument is a fixed RBACAction identifier, not UI copy.
      // 'logger.error/.warn/.info/.debug(...)' first args are internal
      // telemetry event names (e.g. 'staff.update_locale.failed'), not UI copy.
      callees: {
        exclude: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv', 't', 'can', 'logger\\.\\w+'],
      },
      // Object literal properties named `key`/`id`/`accessorKey` (React list
      // keys, TanStack Table column identifiers/accessors) are structural
      // data, not UI copy.
      'object-properties': { exclude: ['key', 'id', 'accessorKey'] },
      // Em dash ('—') is a standalone symbol used as an empty-value
      // placeholder (e.g. no open shift), not translatable UI copy.
      words: { exclude: ['^[0-9.,$%:@#/x×+-]+$', '^[A-Z_]{2,}$', '^—$'] },
    }],
  },
})
