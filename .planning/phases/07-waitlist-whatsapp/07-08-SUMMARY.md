---
plan: "07-08"
phase: "07-waitlist-whatsapp"
status: complete
gap_closure: true
completed: "2026-04-25"
commits:
  - bbd53d5
  - b53481e
---

# Plan 07-08 Summary — Gap Closure: Router Wiring + pool_tables Column Fix

## What Was Built

Two blocking gaps from the Phase 07 code review (CR-01 + CR-02) were resolved:

**CR-01 — /waitlist route wired:**
- `router.tsx`: added `WaitlistPage` lazy import, `WaitlistRoute` import, and `/waitlist` Route block (ProtectedRoute + WaitlistRoute guards)
- `providers.tsx`: imported and rendered `WaitlistRealtimeListener` alongside `PoolRealtimeListener` — app-wide mount, not route-scoped

**CR-02 — pool_tables column name fixed in 3 components:**
- `SeatPartySheet.tsx`, `WaitlistQueue.tsx`, `PoolTableOccupancyPanel.tsx`: all updated from `.select('id, name, status')` → `.select('id, label, number, status')` and `.order('name')` → `.order('number')`
- Local `PoolTable` type defs updated to `{ id, label: string, number: number, status }`
- Phantom status comparisons (`=== 'idle'`, `=== 'free'`) removed — only `'available'` is a valid PoolTableStatusSchema value
- `SeatPartySheet` `tableName` arg now builds `'Table ' + String(table.number) + ' – ' + table.label`
- Display spans updated to `Table {table.number} – {table.label}` in all relevant locations

## Verification

| Check | Result |
|-------|--------|
| `path="/waitlist"` in router.tsx | 1 match ✓ |
| `WaitlistPage` in router.tsx | 2 matches ✓ |
| `WaitlistRoute` in router.tsx | 3 matches ✓ |
| `WaitlistRealtimeListener` in providers.tsx | 2 matches ✓ |
| `WaitlistRealtimeListener` in router.tsx | 0 matches ✓ |
| `select.*id, name` in 3 components | 0 matches ✓ |
| `label, number` in 3 components | 3 matches ✓ |
| `status === 'idle'\|'free'` in 3 components | 0 matches ✓ |
| `table.name` references | 0 matches ✓ |
| `npm run typecheck` | exit 0 ✓ |
| `npm run lint` | exit 0 ✓ |
| `npm run test` | 1054/1054 pass ✓ |
| `e2e/24-waitlist.spec.ts` | exists, 5 tests ✓ |

## Self-Check: PASSED

All 13 acceptance criteria met. The /waitlist page is now reachable via the router with proper auth + RBAC guards. The seat-to-table flow displays correct table names from `label` + `number` columns. E2E spec T1–T5 can now run against a live server.
