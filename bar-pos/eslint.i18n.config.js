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
  rules: {
    // Mirrors eslint.config.js's argsIgnorePattern: '^_' (line 90) — this
    // standalone i18n gate's tseslint.configs.recommended base otherwise
    // enables the rule with no ignore pattern, so pre-existing
    // underscore-prefixed intentionally-unused params (e.g. zustand persist's
    // `migrate: (persisted, _persistedVersion) => ...`) fail this narrower
    // gate even though the committed `npm run lint` gate already permits
    // them. 21-11 is the first plan to sweep entities/model/*.ts, where this
    // convention recurs.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
    // Mirrors eslint.config.js's argsIgnorePattern: '^_' — this standalone gate's
    // tseslint.configs.recommended base enables the rule with no ignore pattern,
    // so pre-existing `_reject`-style intentionally-unused Promise executor args
    // (unrelated to string migration) fail this narrower gate even though the
    // committed `npm run lint` gate already permits them.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
          'size', 'name', 'htmlFor', 'id', 'value', 'defaultValue', 'aria-hidden',
          // 'data-slot' is the shadcn/Radix structural slot marker (e.g.
          // data-slot="dialog-content") used across every shared/ui shadcn
          // primitive — a CSS/DOM hook, not UI copy. 'aria-invalid' is always
          // the literal string 'true'/'false', never translatable text.
          'data-slot', 'aria-invalid',
          // 'aria-describedby' is a DOM ID reference (e.g. linking an input to
          // its inline error <span id="...">), not UI copy — same category as
          // 'aria-invalid'.
          'aria-describedby',
          // 'aria-labelledby' is likewise a DOM ID reference (e.g.
          // MoneyDisplay's aria-labelledby="subtotal-label" pointing at a
          // sibling <span id="subtotal-label">), not UI copy — same category
          // as 'aria-describedby'.
          'aria-labelledby',
          // 'step' is the native <input type="number"> HTML attribute
          // controlling increment granularity (e.g. step="any", step="0.01")
          // — a numeric/DOM behavior value, not UI copy.
          'step',
          // 'accept' is the native <input type="file"> HTML attribute listing
          // accepted MIME types/extensions (e.g. accept=".csv") — a technical
          // DOM filter value, not UI copy.
          'accept',
          // 'height' is CardSkeleton's pixel-dimension prop (e.g.
          // height="160px") — a CSS layout value, not UI copy.
          'height',
          // 'confirmClassName' is ConfirmDialog's Tailwind class passthrough for
          // the destructive confirm button (Phase 32/33's touch-target/focus-ring
          // sweep, e.g. VoidOrderDialog's 72px/ring-4 confirm) — a CSS class
          // string, not UI copy, same category as 'className' above.
          'confirmClassName',
          // 'highlight' is CajaDashboard's SummaryCard Tailwind class
          // passthrough (e.g. highlight="border-amber-500/40") — a CSS class
          // string, not UI copy, same category as 'className'/'confirmClassName'.
          'highlight',
          // 'stackId' is Recharts' <Bar> stacking-group identifier (e.g.
          // stackId="a" in ComboMixReport's day-of-week stacked bar chart)
          // — a chart-library technical grouping key, not UI copy.
          'stackId',
        ],
      },
      // 'can(...)'/'canAccess(...)' are the RBAC permission checks (usePermissions().can,
      // @shared/lib/rbac's canAccess(role, action)) — their string argument is a fixed
      // RBACAction identifier, not UI copy.
      // 'logger.error/.warn/.info/.debug(...)' first args are internal
      // telemetry event names (e.g. 'staff.update_locale.failed'), not UI copy.
      // '.rpc(...)' (db.rpc/supabase.rpc, mutation hooks across the order/
      // pool/payment feature cluster) first arg is the fixed Postgres RPC
      // function name — a wire-protocol identifier, never UI copy; the
      // withDottedPrefix wrapper makes this exclude match any receiver
      // (db.rpc, supabase.rpc, (supabase as any).rpc, deplDb.rpc, etc).
      // 'navigate(...)' (react-router's useNavigate() return value) first
      // arg is a route path (e.g. '/pos', '/pool-tables'), never UI copy —
      // recurs across pages/widgets, not just this plan's feature folders.
      // 'from(...)' (Supabase query-builder's db.from('table_name')/supabase.from(...))
      // first arg is a fixed Postgres table name — a wire-protocol identifier like
      // 'rpc', not UI copy; recurs 30+ times across the 21-08 management/inventory/
      // staff-ops feature cluster's pre-regen `db = supabase as any` query builders.
      // 'select(...)'/'eq(...)'/'order(...)' (chained off the same query-builder,
      // e.g. db.from('products').select('id, name').eq('is_active', true).order('name'))
      // carry DB column-name/wildcard literals, not UI copy — same category as 'from',
      // recurring 20+ times in this plan's scope alone.
      // 'executeTool(...)' (src/shared/lib/agent's tool dispatcher) first arg is a
      // fixed AI-agent tool-name identifier (e.g. 'confirm_action', 'bulk_import_products'),
      // a wire-protocol identifier like 'rpc', never UI copy.
      // 'insert(...)'/'update(...)'/'delete(...)' (the remaining Supabase query-builder
      // mutation verbs, e.g. db.from('waitlist_entries').update({ status: 'cancelled' }))
      // carry DB payload objects/enum values, not UI copy — same rationale as 'from'/
      // 'select'/'eq'/'order'; recurs across the waitlist mark-* hooks + toggle-permission
      // in this plan's scope.
      // 'neq'/'gte'/'lte'/'not'/'in'/'is'/'single' (the remaining Supabase
      // query-builder filter/terminal verbs, e.g. db.from('orders').neq('status',
      // 'voided'), .gte('created_at', from.toISOString()), .not('status', 'in',
      // '("seated","cancelled")'), .is('deleted_at', null)) carry DB column
      // names/enum values/date strings, not UI copy — same category as 'eq'/
      // 'order'; this plan (21-11) is the first to sweep entities/model/*.ts,
      // where every report/list query chains these verbs.
      // 'channel'/'on' (Supabase Realtime subscription builders, e.g.
      // supabase.channel('kds:order_items').on('postgres_changes', { event:
      // '*', schema: 'public', table: 'order_items' }, cb)) take fixed
      // channel-name/event-type wire-protocol identifiers as their first
      // arg, not UI copy — same category as 'rpc'.
      // 'logHardwareFail' (PaymentForm.tsx's locally-defined post-payment hardware
      // error logger, wrapping logger.warn + toast.error) takes a fixed telemetry
      // event name as its first arg (e.g. 'cash_drawer.failed') — same category as
      // the already-excluded 'logger\.\w+', just not dotted since it's a local fn.
      // 'toLocaleDateString'/'toLocaleTimeString'/'toLocaleString' (Date.prototype's
      // Intl formatting methods, e.g. payment.processedAt.toLocaleDateString('en-GB',
      // {...}), row.ts's toLocaleString('es-MX')) take a fixed BCP-47 locale
      // identifier as their first arg — a technical Intl parameter, not UI copy.
      // 'usePersistedBool' (@shared/lib/usePersistedBool, e.g.
      // usePersistedBool('pool_filters_collapsed', false)) takes a fixed
      // localStorage key as its first arg — a wire-protocol identifier, not
      // UI copy, same category as 'rpc'.
      callees: {
        exclude: [
          'cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv', 't', 'can', 'canAccess', 'logger\\.\\w+',
          'rpc', 'navigate', 'from', 'select', 'eq', 'order', 'insert', 'update', 'delete',
          'executeTool', 'logHardwareFail', 'toLocaleDateString', 'toLocaleTimeString',
          'toLocaleString', 'usePersistedBool',
          'neq', 'gte', 'lte', 'not', 'in', 'is', 'single', 'channel', 'on',
        ],
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
      // `status` is a Postgres enum column value (e.g. `{ status: 'cancelled' }`
      // in a Supabase `.update()` payload for waitlist_entries/tabs/pool_sessions)
      // — a wire-protocol identifier, never UI copy on its own; user-facing status
      // text goes through StatusBadge's `labelKey` mapping instead.
      // `maxHeight` is a CSS style-object value (e.g. `style={{ maxHeight:
      // 'calc(100vh - 200px)' }}`), same category as `className`, not UI copy.
      // `event`/`schema`/`table` are Supabase Realtime `.on('postgres_changes',
      // { event: '*', schema: 'public', table: 'order_items' }, cb)` filter
      // config keys — wire-protocol identifiers, not UI copy, same category
      // as `status`.
      // `count` is the Supabase `.select('id', { count: 'exact', head: true })`
      // query-option key — a fixed API option name, not UI copy.
      // `onConflict` is the Supabase `.upsert(payload, { onConflict:
      // 'product_id' })` option key — a DB column name, not UI copy.
      'object-properties': {
        exclude: [
          'key', 'id', 'accessorKey', 'displayName', 'className', 'aria-invalid', 'labelKey',
          'status', 'maxHeight', 'event', 'schema', 'table', 'count', 'onConflict',
        ],
      },
      // Em dash ('—') is a standalone symbol used as an empty-value
      // placeholder (e.g. no open shift), not translatable UI copy.
      // The filled/empty PIN dot markers ('●'/'○'), the diff-viewer's
      // removed-line minus sign ('−', U+2212, distinct from ASCII '-'), and
      // en/em dashes are likewise decorative status glyphs, not UI copy.
      // Up/down sort-indicator arrows ('↑'/'↓', DataTable column headers)
      // are the same category of decorative status glyph.
      // Hex color literals (e.g. '#7a3f1f', PoolTableIllustration's felt/
      // cushion/ball fill colors) are SVG presentation values, not UI copy.
      words: {
        exclude: [
          '^[0-9.,$%:@#/x×+*-]+$', '^[A-Z_]{2,}$', '^—$', '^[●○−–]+$', '^[↑↓]+$',
          '^#[0-9a-fA-F]{3,8}$',
        ],
      },
    }],
  },
})
