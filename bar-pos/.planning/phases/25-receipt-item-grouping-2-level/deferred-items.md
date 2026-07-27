# Deferred Items — Phase 25

Out-of-scope pre-existing issues discovered during plan execution. Not fixed
(scope boundary: only auto-fix issues directly caused by the current task's
changes).

## 25-01

- `src/entities/tab/model/queries.ts(791,11)`: `error TS2322: Type 'number | null' is not assignable to type 'number | undefined'.` — pre-existing, file untouched by this plan.
- `src/shared/lib/agent/rag.ts(60,7)`: `error TS2322: Type 'number[]' is not assignable to type 'string'.` — pre-existing, file untouched by this plan.
