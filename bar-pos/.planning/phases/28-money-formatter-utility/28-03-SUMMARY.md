---
phase: 28-money-formatter-utility
plan: 03
subsystem: ui
tags: [i18n, formatting, eslint, agent-tools]

# Dependency graph
requires:
  - phase: 28-money-formatter-utility (plan 01)
    provides: src/shared/lib/format.ts (formatMoney, formatMoneyIn, formatPercent, parseMoneyInput)
provides:
  - buildStartTicketText.ts's pool start-ticket rate line rendered through formatMoney
  - posTools.ts's two estimated_charge preview fields rendered through formatMoney
  - The eslint-disable-next-line no-restricted-syntax exemption convention (name rule + inline reason) that plan 08's lint gate will read
affects: [28-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reasoned eslint-disable-next-line no-restricted-syntax -- <reason> comment as the exemption convention for the one legitimate unformatted-money site (MoneyInput's editable raw value)"

key-files:
  created: []
  modified:
    - src/shared/lib/buildStartTicketText.ts
    - src/shared/lib/buildStartTicketText.test.ts
    - src/shared/lib/__snapshots__/buildStartTicketText.test.ts.snap
    - src/shared/lib/agent/tools/posTools.ts
    - src/shared/ui/MoneyInput.tsx

key-decisions:
  - "buildStartTicketText.ts has no locale parameter in scope, so it calls formatMoney(ratePerHour) (live session locale) rather than threading a new locale parameter through the builder and its callers, per the plan's explicit scope boundary"
  - "posTools.ts's two estimated-charge sites use formatMoney (not formatMoneyIn) because the agent chat session's preview is inherently tied to the live UI locale"
  - "MoneyInput's formatCents value serialization stays a bare two-decimal string (D-03) with a single reasoned eslint-disable-next-line no-restricted-syntax comment naming why — this is the one site future plan 08's lint rule must not flag"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "buildStartTicketText's rate line renders through formatMoney, carrying the locale's currency symbol; test pins the exact new substring (MX$15.00/h) rather than loosening the assertion"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/shared/lib/buildStartTicketText.test.ts#snapshot: known input produces expected formatted string"
        status: pass
    human_judgment: false
  - id: D2
    description: "posTools.ts's stopPoolSession and stopAndMoveTable estimated_charge fields both render through formatMoney instead of hand-built currency template strings; field name/position and arithmetic unchanged"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "npx vitest run src/shared/lib/agent --passWithNoTests (17 passing, no regression)"
        status: pass
      - kind: other
        ref: "grep -Ec 'estimated_charge' src/shared/lib/agent/tools/posTools.ts == 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "MoneyInput's raw editable value stays unformatted and is now explicitly exempted with a reasoned eslint-disable-next-line no-restricted-syntax comment, establishing the exemption convention plan 08 depends on"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "grep -Eq 'eslint-disable-next-line no-restricted-syntax' src/shared/ui/MoneyInput.tsx"
        status: pass
      - kind: other
        ref: "grep -Ec 'parseMoneyInput' src/shared/ui/MoneyInput.tsx == 0 (D-03: local parser left untouched)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 03: Migrate remaining shared-layer money strings + document the MoneyInput exemption Summary

**Migrated the pool start-ticket rate line and the agent tool's two estimated-charge preview fields onto `formatMoney`, and added the reasoned `eslint-disable-next-line no-restricted-syntax` exemption on `MoneyInput`'s editable raw value that plan 08's lint gate will read.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-02T13:35:00Z (approx.)
- **Completed:** 2026-08-02T14:00:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 5 (buildStartTicketText.ts + .test.ts + snapshot, posTools.ts, MoneyInput.tsx)

## Accomplishments
- `buildStartTicketText.ts`'s rate line no longer hand-concatenates a literal `$` with `String(ratePerHour)` — it calls `formatMoney(ratePerHour)`, since the builder has no `locale` in scope (unlike its sibling `receipt-format.ts`, which threads an explicit `locale` parameter)
- `buildStartTicketText.test.ts` now pins the exact new rate-line substring (`MX$15.00/h`, replacing the old `$15/h`) and adds an `afterEach` locale reset consistent with `format.test.ts`; the pre-existing snapshot was regenerated to match
- `posTools.ts`'s `stopPoolSession` and `stopAndMoveTable` both collapsed their `.toFixed(2)` + hand-built `` `$${estimatedCharge}` `` pair into a single `formatMoney(...)` call; `estimated_charge` field name, object position, and the underlying arithmetic expression are all unchanged
- `MoneyInput.tsx`'s `formatCents` value serialization is now marked with a single `eslint-disable-next-line no-restricted-syntax` comment stating it's an editable input's raw value (re-typed/re-parsed by `parseToCents`), not a money display — establishing the exemption convention plan 08's lint rule will read; no other line in the file changed, and `parseMoneyInput` is not referenced (D-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate the pool start-ticket rate line** - `4be5c4b` (feat)
2. **Task 2: Migrate agent-tool estimated-charge fields** - `17cae1a` (feat)
3. **Task 3: Document MoneyInput's value serialization as a permanent exemption** - `81eeb91` (docs)

**Plan metadata:** commit pending (see final commit step)

## Files Created/Modified
- `src/shared/lib/buildStartTicketText.ts` - Rate line now calls `formatMoney(ratePerHour)`
- `src/shared/lib/buildStartTicketText.test.ts` - Pinned new expected substring + `afterEach` locale reset
- `src/shared/lib/__snapshots__/buildStartTicketText.test.ts.snap` - Regenerated to match the new locale-aware rendered ticket
- `src/shared/lib/agent/tools/posTools.ts` - Both `estimated_charge` sites now built via `formatMoney(...)`
- `src/shared/ui/MoneyInput.tsx` - Added the reasoned `eslint-disable-next-line no-restricted-syntax` exemption comment above `formatCents`' value serialization

## Decisions Made
- `buildStartTicketText.ts` uses `formatMoney` (live session locale), not `formatMoneyIn` — the plan explicitly forbids adding a new `locale` parameter to the builder's signature in this plan since it has none in scope today
- `posTools.ts` uses `formatMoney`, not `formatMoneyIn` — the agent chat session's preview is always the live UI locale by definition
- The `MoneyInput` exemption names the generic `no-restricted-syntax` rule ID (not a money-specific rule name) since plan 08 will add its selector to that same rule family — the disable comment is written now so it's already in place and reasoned before the rule exists

## Deviations from Plan

None - plan executed exactly as written.

One environment-only setup step (not a deviation from plan content): this worktree had no `node_modules` or `.env.local` present (fresh worktree checkout, both gitignored). Symlinked both from the main repo checkout (`/mnt/ai/bola8pos-kiro/bar-pos/node_modules`, `/mnt/ai/bola8pos-kiro/bar-pos/.env.local`) so `npx vitest`/`npm run typecheck`/`npm run lint` could run — same approach 28-01's summary documented. No project files were changed by this step.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SC-2 for the shared layer is now complete across plans 02 and 03: no file under `src/shared/` builds a money string by hand except `format.ts` itself and the reasoned `MoneyInput` exemption
- SC-4 is satisfied: the one site where migration would cause a real regression (`MoneyInput`'s editable raw value) is identified, protected, and documented rather than swept along
- Plan 08's ESLint rule can rely on the `eslint-disable-next-line no-restricted-syntax -- <reason>` convention established here when it adds its money-string-detection selector
- No blockers

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: src/shared/lib/buildStartTicketText.ts
- FOUND: src/shared/lib/buildStartTicketText.test.ts
- FOUND: src/shared/lib/agent/tools/posTools.ts
- FOUND: src/shared/ui/MoneyInput.tsx
- FOUND commit: 4be5c4b
- FOUND commit: 17cae1a
- FOUND commit: 81eeb91
