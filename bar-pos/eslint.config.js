// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths'
import boundaries from 'eslint-plugin-boundaries'
import tailwindcss from 'eslint-plugin-tailwindcss'
import { uiDriftSelectors } from './eslint-rules/no-ui-drift.js'
import path from 'node:path'

export default tseslint.config({
  ignores: [
    'node_modules',
    'dist',
    'build',
    'target',
    'src-tauri',
    '*.config.ts',
    '*.config.js',
    'vite-env.d.ts',
    'src/shared/lib/supabase.types.ts',
  ],
}, js.configs.recommended, ...tseslint.configs.strictTypeChecked, {
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}, {
  files: ['**/*.{ts,tsx}'],
  plugins: {
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    'jsx-a11y': jsxA11y,
    import: importPlugin,
    'no-relative-import-paths': noRelativeImportPaths,
    boundaries,
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.json', './tsconfig.node.json'],
      },
    },
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**' },
      { type: 'pages', pattern: 'src/pages/**' },
      { type: 'widgets', pattern: 'src/widgets/**' },
      { type: 'features', pattern: 'src/features/**' },
      { type: 'entities', pattern: 'src/entities/**' },
      { type: 'shared', pattern: 'src/shared/**' },
    ],
  },
  rules: {
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    ...jsxA11y.configs.recommended.rules,
    'react/react-in-jsx-scope': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/no-cycle': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@app/**', group: 'internal', position: 'before' },
          { pattern: '@pages/**', group: 'internal', position: 'before' },
          { pattern: '@widgets/**', group: 'internal', position: 'before' },
          { pattern: '@features/**', group: 'internal', position: 'before' },
          { pattern: '@entities/**', group: 'internal', position: 'before' },
          { pattern: '@shared/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: { order: 'asc' },
      },
    ],
    'no-relative-import-paths/no-relative-import-paths': [
      'off',
    ],
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        rules: [
          {
            from: ['app'],
            allow: ['pages', 'widgets', 'features', 'entities', 'shared'],
          },
          {
            from: ['pages'],
            allow: ['widgets', 'features', 'entities', 'shared'],
          },
          {
            from: ['widgets'],
            allow: ['features', 'entities', 'shared'],
          },
          {
            from: ['features'],
            allow: ['entities', 'shared'],
          },
          {
            from: ['entities'],
            allow: ['shared'],
          },
          {
            from: ['shared'],
            allow: [],
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ExportAllDeclaration',
        message: 'Barrel exports (export *) are banned. Export only what you explicitly need.',
      },
    ],
  },
},
{
  // LINT-01 (D-13/D-14): drift-detection guardrails scoped to the Phase-29
  // audited zone (src/pages|widgets|features), excluding src/shared/ui (D-12,
  // the primitive-definition layer legitimately uses raw elements internally)
  // and src/entities (never audited by Phase 29). Test/stories files are
  // ignored — they carry raw elements in mock components (matches Phase 29's
  // own scan exclusions).
  files: ['src/pages/**/*.tsx', 'src/widgets/**/*.tsx', 'src/features/**/*.tsx'],
  ignores: ['**/*.test.tsx', '**/*.stories.tsx'],
  plugins: { tailwindcss },
  settings: {
    tailwindcss: {
      // Must be an absolute path — eslint-plugin-tailwindcss@3.18.3 resolves
      // the `tailwindcss` package via `require.resolve(..., { paths: [dirname(config)] })`,
      // and Node's require.resolve `paths` option does not reliably resolve a
      // relative dirname ('.') against process.cwd() in all cases.
      config: path.resolve(import.meta.dirname, 'tailwind.config.ts'),
      callees: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv'],
      whitelist: ['^(animate|fade|slide|zoom)-(in|out)(-from-\\w+)?$'],
    },
  },
  rules: {
    'tailwindcss/no-custom-classname': 'error',
    'tailwindcss/enforces-shorthand': 'error',
    // tailwindcss/no-arbitrary-value intentionally NOT enabled — D-15.
    // It flags any bracketed value (h-[...], w-[...], min-h-[...], etc.), not
    // just spacing, which would newly flag ~70 pre-existing, non-drift,
    // legitimate arbitrary-size classes outside this phase's scope.
    // Arbitrary-value SPACING drift specifically is covered by the narrow
    // custom selector in uiDriftSelectors below instead.

    // Restate ExportAllDeclaration verbatim: flat config REPLACES (does not
    // merge) a rule key across config objects matching the same file. This
    // later, more-specific object fully overrides no-restricted-syntax for
    // pages/widgets/features files — omitting the barrel-export selector
    // here would silently kill that ban for those files.
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ExportAllDeclaration',
        message: 'Barrel exports (export *) are banned. Export only what you explicitly need.',
      },
      ...uiDriftSelectors,
    ],
  },
},
{
  files: ['**/*.test.ts', '**/*.test.tsx', '**/*.stories.tsx', '**/mocks.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    'boundaries/dependencies': 'off',
  }
}, storybook.configs["flat/recommended"]);
