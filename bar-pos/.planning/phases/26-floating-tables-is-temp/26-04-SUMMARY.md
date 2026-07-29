---
phase: 26-floating-tables-is-temp
plan: 04
subsystem: ui
tags: [react-query, react-i18next, playwright, waitlist, resources]

# Dependency graph
requires:
  - phase: 26-floating-tables-is-temp
    provides: "resources.is_temp, 'floating' table_type, resourceKeys.all === ['resources'], auto-deactivate trigger (Plan 03)"
provides:
  - "useSeatAtNewTable() — composed create-and-seat mutation in src/features/seat-waitlist-party"
  - "SeatPartySheet empty-state explicit action wired to the composed mutation (D-05)"
  - "ResourceCard floating badge using a variant distinct from all 3 other types (destructive)"
  - "e2e/24-waitlist.spec.ts SC-3 positive + D-05 negative coverage"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composed mutation hooks: a new useMutation wraps two existing mutateAsync calls (useMutationAddResource + the pre-existing seat mutation) rather than duplicating either's Result/toast/cache-invalidation logic"
    - "e2e dialog disambiguation: page.getByRole('dialog').filter({ hasText: '<title>' }) — this app's persistent AI-assistant side panel is also a `dialog` role that can be open concurrently with a feature sheet"
    - "e2e listitem disambiguation: page.locator('div[role=\"listitem\"]') (not getByRole('listitem')) — Sonner's toast library also renders <li> elements exposing an implicit listitem role"

key-files:
  created: []
  modified:
    - src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts
    - src/features/seat-waitlist-party/model/useSeatWaitlistParty.test.ts
    - src/features/seat-waitlist-party/index.ts
    - src/features/seat-waitlist-party/ui/SeatPartySheet.tsx
    - src/entities/resource/ui/ResourceCard.tsx
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json
    - e2e/24-waitlist.spec.ts

key-decisions:
  - "useSeatAtNewTable composes useMutationAddResource + the existing seatParty mutateAsync directly inside its own useMutation's mutationFn — no outer onSuccess toast for the seat-success/failure branch (already handled by the composed seatParty call); only the create-failure branch toasts directly, since useMutationAddResource itself has no toast."
  - "Floating badge variant set to 'destructive' (not a new 4th CSS variant) — the only Badge variant not already claimed by pool/carom/consumption, satisfying 'distinct from all 3 others' without adding new UI plumbing."
  - "T6's e2e cleanup hard-deletes (not soft-deletes) the floating resource it creates — soft-delete correctly models production retirement (D-04), but a test that never starts a pool session on its floating table has no FK to protect, and soft-delete would permanently burn that number (RESEARCH.md Pitfall 5) on every re-run against the shared Supabase Cloud project, causing every subsequent run of this exact test to fail on the number-uniqueness constraint. Discovered via actual execution, not anticipated in the plan."

requirements-completed: [SC-1, SC-3]

coverage:
  - id: D1
    description: "useSeatAtNewTable composes resource creation (floating type, temp flag) with the existing seat mutation; number = max(existing)+1, rate = last entry's rate with a 12 fallback (verbatim PoolTablesSettingsTab.handleAddTable rule); a create failure short-circuits before any seat call and surfaces as an error Result"
    requirement: SC-3
    verification:
      - kind: unit
        ref: "src/features/seat-waitlist-party/model/useSeatWaitlistParty.test.ts (6/6 pass) — numbering (max+1, empty->1), floating type/temp flag on create, seat-on-success, no-seat-on-create-failure, seat-failure-not-swallowed"
        status: pass
    human_judgment: false
  - id: D2
    description: "SeatPartySheet's empty state renders an explicit 'seat at a new temporary table' action alongside the existing no-tables message (not replacing it); the action is the sheet's only invocation site of the composed hook; ResourceCard's floating badge uses a variant distinct from pool/carom/consumption, keyed off tableType only"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npm run typecheck && npm run lint && npm run test (1331/1346 pass, unchanged 15 todo/2 skip baseline); locale-parity node script for featMgmt.json/entities.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "e2e coverage for SC-3 (empty-state action seats the party at a genuinely new floating table, badge visible) and the D-05 negative guard (action absent while a table is available)"
    requirement: SC-3
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/24-waitlist.spec.ts -g 'Waitlist floating-table seating' — both T6 and T7 passed in an isolated run (2 passed, 53.3s)"
        status: pass
    human_judgment: true
    rationale: "A subsequent test-hygiene fix (T6's cleanup switched from soft-delete to hard-delete, see key-decisions) was applied after that passing run to make the test repeatable across re-runs against the shared cloud DB. Severe host-level filesystem/I/O contention (unrelated concurrent sessions on the shared external-drive mount, plus a pre-existing hung `git worktree add` process from before this plan started) prevented a final confirmation run after that fix within this session — the fix itself only changes teardown cleanup, not the assertions that were proven passing, but a human or a follow-up CI run should confirm the file green end-to-end once the environment is stable."

duration: ~2h40min (majority spent on environment recovery, not implementation — see Issues Encountered)
completed: 2026-07-29
status: complete
---

# Phase 26 Plan 04: Waitlist Floating-Table Seating Summary

**A composed `useSeatAtNewTable()` mutation lets a manager+ seat a waitlist party at a brand-new floating table directly from the empty-state of the existing seat sheet — numbering/rate rules copied verbatim from the admin add-table flow, a `destructive`-variant badge marks floating tables as visually distinct, and `e2e/24-waitlist.spec.ts` gained a positive SC-3 case plus a D-05 negative guard.**

## Performance

- **Duration:** ~2h40min wall-clock (implementation itself was fast; the majority of elapsed time was spent recovering from severe host-level filesystem/process contention unrelated to this plan's code — see Issues Encountered)
- **Completed:** 2026-07-29
- **Tasks:** 3 (1 `tdd="true"`, 2 `auto`)
- **Files modified:** 8 (7 in `src/`, 1 in `e2e/`)

## Accomplishments

- **Task 1** added `useSeatAtNewTable()` to `useSeatWaitlistParty.ts` (RED commit `459e880`, GREEN commit `5e506eb`) and a new feature barrel `src/features/seat-waitlist-party/index.ts` exporting both mutation hooks. The hook composes `useMutationAddResource` (from Plan 03) with the pre-existing `seatParty` mutateAsync: on create success it seats the entry at the new resource's id; on create failure it toasts and returns the error Result without ever calling the seat path; on a post-create seat failure it returns that failure unmodified (not swallowed). Numbering (`Math.max(0, ...numbers) + 1`) and rate (`last entry's ratePerHour ?? 12`) are copied verbatim from `PoolTablesSettingsTab.handleAddTable`, matching the plan's `label: \`Table ${nextNumber}\`` convention exactly (confirmed via `eslint` that this exact template-literal shape is not flagged by the literal-string rule, same as the admin flow). 6/6 new unit tests pass; no new error code was needed.
- **Task 2** (`d6cc420`) extended `SeatPartySheet`'s inline resource query to select `rate_per_hour`/`table_type` (mapped to camelCase locally), added the explicit "seat at a new temporary table" button inside the existing empty-state branch (alongside, not replacing, the no-tables message), wired it to `useSeatAtNewTable`, and disabled it with the same spinner treatment as the footer's seat button while pending. `ResourceCard`'s `TABLE_TYPE_VARIANT` floating entry changed from `outline` (previously identical to `consumption`, a Plan 03 deviation) to `destructive` — the one Badge variant not already claimed by pool/carom/consumption, keyed off `tableType` alone (no second `isTemp` conditional). One new i18n key (`seatWaitlistParty.seatAtNewTable`) landed in both locale files with genuine Spanish/English text; the locale-parity gate and `git diff` (no route/nav/title touched) both pass.
- **Task 3** (`c4394ce`) extended `e2e/24-waitlist.spec.ts` with a new `describe` block: T6 drives the real app end-to-end (occupy every visible resource via the admin client, reload for a fresh fetch, add a party, open its seat sheet, confirm the empty-state action, click it, confirm the sheet closes and a new `table_type='floating'` resource exists, confirm the "Floating" badge renders on `/pool-tables`) and T7 guards D-05 (the action is absent while a table is available). Both tests were verified **passing** in an isolated `-g` run (`2 passed, 53.3s`) before a follow-up cleanup fix (see Deviations) was applied; that fix was not re-verified end-to-end in this session due to environment instability (see Issues Encountered), though it only changes teardown, not the asserted behavior.

## Task Commits

1. **Task 1 RED: failing test for the composed mutation** — `459e880` (test)
2. **Task 1 GREEN: `useSeatAtNewTable` implementation + feature barrel** — `5e506eb` (feat)
3. **Task 2: empty-state action + floating badge + i18n** — `d6cc420` (feat)
4. **Task 3: e2e coverage for SC-3/D-05** — `c4394ce` (test)

**Plan metadata:** commit for this SUMMARY.md + STATE.md/ROADMAP.md (see final commit).

## Files Created/Modified

- `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` — new `useSeatAtNewTable()` hook
- `src/features/seat-waitlist-party/model/useSeatWaitlistParty.test.ts` — new, 6 cases
- `src/features/seat-waitlist-party/index.ts` — new feature barrel (both mutation hooks)
- `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` — extended inline query, empty-state action, new handler
- `src/entities/resource/ui/ResourceCard.tsx` — floating badge variant `outline` → `destructive`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json` — new `seatWaitlistParty.seatAtNewTable` key
- `e2e/24-waitlist.spec.ts` — new `describe` block, 2 new cases (T6, T7)

## Decisions Made

- **No outer `useMutation` toast for the seat-success/failure branch** — the composed hook lets the pre-existing `seatParty` mutateAsync's own `onSuccess` handle that toast/logging/cache-invalidation entirely, per the plan's explicit "compose rather than duplicate" instruction. Only the create-failure branch (which `useMutationAddResource` itself never toasts) gets an inline `toast.error` call.
- **Floating badge variant: `destructive`** — the plan's own research/pattern docs suggested reusing `outline` (already used by `consumption`); Task 2's acceptance criteria required a variant distinct from at least two of the other three, which `outline` trivially satisfied, but the action text explicitly asked to avoid reusing an already-claimed variant "if a distinct one is available" — `destructive` was the only unclaimed option among this codebase's 4 Badge variants.
- **T6's e2e cleanup hard-deletes the floating resource it creates, not soft-deletes** — see coverage D3's rationale and Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] e2e test's own cleanup would permanently exhaust table numbers across repeated runs**
- **Found during:** Task 3, running the new tests against the live Supabase Cloud project
- **Issue:** The plan's own action text anticipated this exact mechanism (RESEARCH.md Pitfall 5: soft-deleted resource numbers are never reissued) but the first-drafted cleanup soft-deleted the test's own floating resource to mirror production retirement (D-04). Since the test never starts a pool session on that resource, nothing ever triggers the real auto-deactivate trigger — so a soft-deleted test resource sits invisible forever, permanently consuming its number. On the very next run, `useSeatAtNewTable`'s numbering rule (`max(visible)+1`) recomputed the *same* number, and the create INSERT failed on the `resources.number` unique constraint (`23505`/`DUPLICATE_ENTRY`) — a real, reproducible failure caught by re-running the test twice in this session, not a hypothetical.
- **Fix:** T6's `finally` block now hard-deletes (`admin.from('resources').delete()`) the floating resource it created, after confirming (and documenting) that no `pool_sessions` row ever referenced it, so there is no FK to protect. Production retirement still goes through the soft-delete trigger exclusively (D-04) — this is a test-teardown-only change.
- **Files modified:** `e2e/24-waitlist.spec.ts`
- **Verification:** Confirmed via direct DB query that the created floating row had zero `pool_sessions` references before switching to hard-delete; the isolated `-g "Waitlist floating-table seating"` run passed (2/2) with the soft-delete version, then the fix was applied and reasoned through but not re-run to a final green confirmation (see Issues Encountered).
- **Committed in:** `c4394ce` (Task 3 commit)

**2. [Rule 3 - Blocking] Three unrelated accessibility-tree collisions blocked the new e2e selectors**
- **Found during:** Task 3, iterating on the new tests against the real running app
- **Issue:** (a) `page.getByRole('dialog')` matched both the intended sheet and this app's persistent AI-assistant side panel (also a `dialog` role, observed open mid-test); (b) `page.getByRole('listitem')` matched both the waitlist entry `<div role="listitem">` and Sonner's toast `<li>` elements (Sonner also exposes an implicit listitem role); (c) `getByRole('button', { name: 'Close' })` matched both the sheet's own footer "Close" button and `SheetContent`'s built-in sr-only "Close" icon button (`src/shared/ui/sheet.tsx`) — a collision that exists on every Sheet in this app, not something new to this plan.
- **Fix:** (a) scoped dialog locators with `.filter({ hasText: '<title copy>' })`; (b) switched to a CSS-tag-scoped `page.locator('div[role="listitem"]')` (Sonner renders `<li>`, the waitlist entry renders `<div>`); (c) added `.first()` to the Close-button locator (both buttons dismiss the sheet identically).
- **Files modified:** `e2e/24-waitlist.spec.ts`
- **Verification:** Isolated `-g` run passed 2/2 after these fixes.
- **Committed in:** `c4394ce` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — a genuine, reproduced bug in the test's own teardown; 1 Rule 3 — blocking selector ambiguity, all in test code, no application-code changes). No scope creep: no production code beyond the plan's explicit file list was touched.

## Issues Encountered

- **Pre-existing e2e flakiness in `e2e/24-waitlist.spec.ts`'s original T1/T2/T4** (unrelated to this plan): a full-file run showed these three pre-existing tests failing on `strict mode violation: getByText('García E2E') resolved to 4 elements` / similar — caused by years of accumulated duplicate waitlist entries in the shared Supabase Cloud project from prior CI/dev runs of these same tests, none of which ever delete the rows they create. Not touched — out of this plan's scope (Task 3's own new cases use unique per-run party names and delete their own rows specifically to avoid repeating this pattern).
- **Confirmed a wider, previously-mischaracterized e2e gap:** `e2e/helpers/supabase.ts` and ~15 other e2e spec files (`04-pool-timer`, `07-reports`, `16-table-status`, `17-payment-pane`, `18-void-order`, `22-sprint3-billing`, `24-pool-advanced`, `24-sprint5-pool-accuracy`, `visual/45-visual-baseline`, and others) still query `.from('pool_tables')` — the table Plan 01 renamed to `resources`. Plan 02's summary attributed `e2e/04-pool-timer.spec.ts`'s prior failure purely to a dev-server `ERR_CONNECTION_REFUSED` issue; this session's investigation found the deeper cause would independently break these specs regardless of dev-server health, since `pool_tables` no longer resolves at the DB level. This is pre-existing debt from Plan 01/02 (not caused by this plan) affecting ~15 files well outside this plan's scope — recorded here rather than silently left for the phase gate to rediscover. Not fixed in this plan.
- **Severe host-level environment instability** (this session, not this codebase): a `git worktree add` process from an unrelated, earlier agent session was found hung in uninterruptible disk-sleep (D-state, 4+ hours elapsed, confirmed via `/proc/<pid>/fd` to hold no lock on this repo) on the same shared external-drive mount; separately, `git status`'s own untracked-directory scan (likely `graphify-out/`, an untracked knowledge-graph export directory) repeatedly hung in the same D-state under concurrent load from other sessions on this shared host, twice leaving a stale `.git/index.lock` that was safely removed after confirming (via `/proc/<pid>/fd`) no process held an open handle on it — the same remediation already documented as safe precedent in `26-02-SUMMARY.md`. `git add`/`git diff --stat`/`git commit` (which do not need the untracked-scan) worked normally throughout once the stale lock was cleared each time. System load average climbed from ~1 to over 50 during this window from other, unrelated concurrent processes on the host — not something this plan's execution caused or could resolve. As a direct consequence, the plan's own `<verification>` items 6 (`npx playwright test e2e/04-pool-timer.spec.ts`) and 7 (`npx vitest run .../deactivate-floating-resource.integration.test.ts`) were not (re-)run to completion in this session; item 7 was attempted but did not return a result before this summary was written. Both are recommended follow-ups once the environment stabilizes — neither exercises code this plan touched (SC-4 regression and SC-2 regression respectively, both already proven by Plan 02/03's own test runs).

## User Setup Required

None — no external service configuration required. `SUPABASE_SERVICE_ROLE_KEY`/`VITE_SUPABASE_URL`/E2E staff credentials were already present in `.env.local`.

## Next Phase Readiness

- This is the last plan in Phase 26. All 6 locked decisions (D-01..D-06) and both Claude's-discretion items (floating badge styling, `.max(30)` cap removal) from `26-CONTEXT.md` are now implemented across Plans 01-04.
- **Recommended before closing the phase gate:** (1) re-run `npx playwright test e2e/24-waitlist.spec.ts -g "Waitlist floating-table seating"` once the host environment is stable, to reconfirm both cases green after the hard-delete cleanup fix (logic reasoned sound, not re-executed); (2) re-run `npx playwright test e2e/04-pool-timer.spec.ts` and the SC-2 integration test per the plan's own verification items 6-7; (3) separately track the ~15-file `pool_tables`→`resources` e2e literal-rename gap discovered in this session (Issues Encountered) — likely blocking (2) independent of any dev-server issue.
- No blockers to the application code itself: `npm run typecheck`, `npm run lint`, and `npm run test` are all green (1331/1346, unchanged 15-todo/2-skip baseline) as of Task 2's commit, and Task 3 only touched `e2e/` (outside those three gates' scope).

## Self-Check: PASSED

- FOUND: src/features/seat-waitlist-party/index.ts
- FOUND: src/features/seat-waitlist-party/model/useSeatWaitlistParty.test.ts
- FOUND: commit 459e880 in git log
- FOUND: commit 5e506eb in git log
- FOUND: commit d6cc420 in git log
- FOUND: commit c4394ce in git log

---
*Phase: 26-floating-tables-is-temp*
*Completed: 2026-07-29*
