---
phase: 06-split-bill-refund
plan: "06"
subsystem: shared-ui
tags: [split-bill, shared-ui, storybook, components]
dependency_graph:
  requires: [06-03]
  provides: [SubTabColumn, PersonCard]
  affects: [features/split-tab/ui/SplitTabSheet]
tech_stack:
  added: []
  patterns: [labelSlot-composition, data-attribute-propagation-guard]
key_files:
  created:
    - bar-pos/src/shared/ui/SubTabColumn/SubTabColumn.tsx
    - bar-pos/src/shared/ui/SubTabColumn/SubTabColumn.stories.tsx
    - bar-pos/src/shared/ui/SubTabColumn/index.ts
    - bar-pos/src/shared/ui/PersonCard/PersonCard.tsx
    - bar-pos/src/shared/ui/PersonCard/PersonCard.stories.tsx
    - bar-pos/src/shared/ui/PersonCard/index.ts
  modified:
    - bar-pos/src/shared/ui/index.ts
decisions:
  - "Used labelSlot?: React.ReactNode prop on SubTabColumn so PersonCard composes without duplicating layout"
  - "Used data-item-list attribute + closest() check instead of stopPropagation on li (avoids jsx-a11y/no-noninteractive-element-interactions)"
  - "Replaced autoFocus prop with useRef+useEffect in PersonCard (jsx-a11y/no-autofocus violation)"
  - "Converted item rows to ul/li semantic HTML but removed event handlers from li; stopPropagation handled by parent column onClick via data attribute"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
---

# Phase 06 Plan 06: SubTabColumn + PersonCard Components Summary

SubTabColumn and PersonCard shared/ui components built with Storybook stories for split-bill Item and By Person modes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build SubTabColumn component + Storybook story | f3029b7 | SubTabColumn.tsx, SubTabColumn.stories.tsx, index.ts, shared/ui/index.ts |
| 2 | Build PersonCard component + Storybook story | 87e28e4 | PersonCard.tsx, PersonCard.stories.tsx, index.ts |

## Verification

```bash
cd bar-pos && npm run typecheck   # exit 0 ✓
cd bar-pos && npm run lint        # exit 0, 0 warnings ✓
ls src/shared/ui/SubTabColumn/    # SubTabColumn.tsx, SubTabColumn.stories.tsx, index.ts ✓
ls src/shared/ui/PersonCard/      # PersonCard.tsx, PersonCard.stories.tsx, index.ts ✓
```

## Success Criteria Met

- [x] SubTabColumn renders with label, item list, running total, selected ring state
- [x] SubTabColumn shows drop zone hint when empty, hides it when items present
- [x] PersonCard extends SubTabColumn with editable name Input (via labelSlot composition)
- [x] Both components have Storybook stories with required variants
- [x] Stories import from `@storybook/react-vite` (not `@storybook/react`)
- [x] SubTabColumn stories: Empty, Selected, WithItems, SingleItem
- [x] PersonCard stories: DefaultName, CustomName, Selected, WithItems
- [x] npm run typecheck + lint pass (0 errors, 0 warnings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accessibility violations required structural changes**
- **Found during:** Task 1 lint run
- **Issue 1:** `jsx-a11y/click-events-have-key-events` + `jsx-a11y/interactive-supports-focus` on the column `div` with `role="option"`
- **Fix:** Added `tabIndex={0}` and `onKeyDown` handler (Enter/Space → onSelect)
- **Issue 2:** `jsx-a11y/no-noninteractive-element-interactions` — `li` elements with `onClick={stopPropagation}` are not allowed
- **Fix:** Removed onClick from `li` elements; instead intercept at the outer column `onClick` using `element.closest('[data-item-list]')` to bail out when click originates inside the item list
- **Issue 3:** `jsx-a11y/no-autofocus` in PersonCard — HTML `autoFocus` prop disallowed
- **Fix:** Changed to `useRef<HTMLInputElement>` + `useEffect` that calls `inputRef.current?.focus()` when `autoFocusName=true`
- **Files modified:** SubTabColumn.tsx, PersonCard.tsx

**2. [Rule 1 - Bug] Pre-existing unused eslint-disable directives in integration test stubs**
- **Found during:** Task 2 lint run
- **Issue:** Two integration test stub files from earlier phase plans had `/* eslint-disable @typescript-eslint/no-explicit-any */` that became stale after code was refactored
- **Fix:** Removed the directives from `process-refund-rpc.integration.test.ts` and `split-tab-rpc.integration.test.ts`
- **Files modified:** src/features/process-refund/process-refund-rpc.integration.test.ts, src/features/split-tab/split-tab-rpc.integration.test.ts
- **Note:** These are Phase 06 untracked stubs from prior plans — lint count reduced from 2 warnings → 0

## Known Stubs

None. Both components are fully implemented. `item.product?.name ?? item.productId` is the correct runtime fallback per the OrderItem domain type (product is optional in the schema).

## Threat Flags

None. PersonCard name Input has `maxLength={30}` per T-06-15 mitigation. Name is local UI state only.

## Self-Check: PASSED

- [x] SubTabColumn.tsx exists: `bar-pos/src/shared/ui/SubTabColumn/SubTabColumn.tsx`
- [x] SubTabColumn.stories.tsx exists with 4 variants (Empty, Selected, WithItems, SingleItem)
- [x] PersonCard.tsx exists: `bar-pos/src/shared/ui/PersonCard/PersonCard.tsx`
- [x] PersonCard.stories.tsx exists with 4 variants (DefaultName, CustomName, Selected, WithItems)
- [x] Both exported from shared/ui barrel
- [x] Commit f3029b7 exists (Task 1)
- [x] Commit 87e28e4 exists (Task 2)
- [x] typecheck: 0 errors
- [x] lint: 0 errors, 0 warnings
