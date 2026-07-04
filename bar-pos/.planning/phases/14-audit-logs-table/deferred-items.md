# Deferred Items — Phase 14

## From Plan 14-11

Pre-existing lint errors found via `npm run lint` (full-project run), unrelated to
this plan's files (`src/entities/audit-log/*`, `src/widgets/AuditLogTable/*`).
Out of scope per executor scope-boundary rule — not fixed here.

- `src/app/App.tsx:4` — `import/order`: `@shared/ui/ErrorBoundary` should occur
  before `@shared/ui/OfflineBanner`.
- `src/entities/tab/model/queries.concurrent.test.ts:115-116` —
  `@typescript-eslint/no-unnecessary-type-arguments` (default type param can be
  omitted).
- `src/entities/tab/model/queries.concurrent.test.ts:126` —
  `@typescript-eslint/no-unnecessary-condition` (value is always truthy).
- `src/shared/ui/ErrorBoundary.tsx:3` — `import/order`: `@shared/lib/telemetry`
  should occur before `@shared/ui/POSButton`.
