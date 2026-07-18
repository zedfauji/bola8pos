---
phase: 21-i18n-multi-language
plan: 08
subsystem: ui
tags: [i18next, react-i18next, eslint-plugin-i18next, fsd, management-features, waitlist, staff-ops, ai-agent]

# Dependency graph
requires:
  - phase: 21-i18n-multi-language
    provides: "21-01 i18next singleton, common.json seed, lint:i18n gate; 21-02..21-05 single-writer files already migrated so this fan-out sweep has no file/JSON conflicts; 21-06's shared/ui common namespace + 21-07's widened eslint.i18n.config.js excludes (rpc, navigate, confirmClassName, test-file no-explicit-any override) reused directly"
provides:
  - "Every hardcoded user-facing string in the 26 management/inventory/staff-ops/waitlist/AI-agent feature folders in this plan's scope migrated to t('featMgmt:...') / i18n.t('featMgmt:...') (D-04, SC-4)"
  - "featMgmt.json populated with 530 keys across 27 feature-scoped groups (both locales, key-parity-verified, 0 unused keys against src/**), covering catalog-admin, inventory-adjustment, staff clock-in/out, RBAC/PIN, waitlist, report-export, logo-upload, and AI-agent-chat flows"
  - "eslint.i18n.config.js: 'insert'/'update'/'delete'/'executeTool'/'canAccess' callee excludes, 'status' object-property exclude, 'aria-describedby' jsx-attribute exclude — closing gaps 21-07 didn't need to cover"
affects: [21-09, 21-10, 21-11, 21-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom hooks that call other React hooks (useState/useMutation/useQuery — e.g. useExportReport, useAgent) can call useTranslation('featMgmt') directly at their top level and close over `t` for use inside async callbacks defined in the hook body, since the hook-rules-of-hooks requirement is satisfied at the outer call. Plain non-hook mutation-wrapper functions (e.g. useMarkCancelled's mutationFn/onSuccess closures that TanStack Query invokes outside the render phase) still use the i18n singleton (import i18n from '@shared/lib/i18n'; i18n.t('featMgmt:...')) per the 21-07 precedent."
    - "eslint-plugin-i18next's callees.exclude does NOT reliably suppress violations inside a Supabase query-builder chain once the chain is formatted across multiple lines (Prettier's default multi-line member-chain wrap) — confirmed via isolated repro: `db.from('x').select('y')` on one line is correctly excluded, the identical chain reformatted across 3 lines is NOT, even though 'from'/'select' are both in the exclude list. Config-level excludes still work for single-line chains and non-chained calls (rpc/navigate/canAccess/executeTool); multi-line chains need a scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` block instead. `eslint-disable-next-line` blocks spanning a multi-line explanatory comment silently only cover the comment's own next line, not the code two lines down — keep disable-line comments to a single line."
    - "Catalog rule (from 21-01) extended to a non-English source case: agent-chat's pre-existing UI strings were already Spanish (not English like the rest of the codebase). es-MX still gets the exact pre-migration literal byte-for-byte (per SC-4); en-US gets a genuine English translation instead of a byte-copy — the first real translation pair produced by this phase's sweeps, all prior sweeps had English source so es-MX===en-US."

key-files:
  created: []
  modified:
    - "src/features/{clock-in-staff,clock-out-staff}/** (finishing the prior interrupted session's mid-flight migration)"
    - "src/features/{add-waitlist-entry,mark-waitlist-entry-cancelled,mark-waitlist-no-show,notify-waitlist,seat-waitlist-party}/** (waitlist mutation cluster)"
    - "src/features/{edit-staff-role,force-pin-change,toggle-permission}/** (staff-role/PIN/RBAC cluster)"
    - "src/features/{export-report,upload-logo}/** (report export + branding cluster)"
    - "src/features/agent-chat/** (AI agent chat panel — Spanish source, genuine en-US translation)"
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json
    - eslint.i18n.config.js

key-decisions:
  - "Multi-line Supabase query-builder chains (db.from(...).update({...}).eq(...) formatted across several lines) that the plugin still flagged despite matching callee excludes got scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` blocks instead of relying on the config-level exclude, since the exclude demonstrably does not suppress that shape (isolated repro confirmed) — this recurred across 5 files (mark-waitlist-cancelled, mark-waitlist-no-show, notify-waitlist, seat-waitlist-party's pool_tables query, toggle-permission's insert+delete branches)."
  - "'insert'/'update'/'delete' added to eslint.i18n.config.js's callee excludes (single-line chains) alongside the scoped disable blocks for multi-line chains — both are needed because the plugin's exclude behavior differs by formatting shape."
  - "'status' added to object-properties.exclude — a Postgres enum column value (e.g. `{ status: 'cancelled' }` in a waitlist_entries .update() payload) is a wire-protocol identifier, never UI copy on its own; user-facing status text goes through StatusBadge's existing labelKey mapping."
  - "'canAccess' added to the callee excludes alongside the existing 'can' entry (both are RBAC permission-check functions whose string argument is a fixed RBACAction identifier)."
  - "'executeTool' added to the callee excludes — the AI-agent tool dispatcher's first argument (e.g. 'confirm_action', 'bulk_import_products') is a fixed tool-name identifier, the same category as 'rpc'."
  - "ExportButtons.tsx's 12 ExportType ternary branches (format === 'excel' ? 'caja-excel' : 'caja-pdf', etc.) got a single scoped eslint-disable block around the whole handleExport function body rather than 12 individual disable comments — all of its content is ExportType literal-union technical values, no real UI copy inside that function."
  - "useUploadLogo.ts's internal img.onerror Error message ('image decode failed') is caught and replaced by a translated message before ever reaching the UI — left as a scoped eslint-disable rather than translated, since it's a pure internal control-flow marker never shown to the user."
  - "FileDropZone.tsx's recognition.lang = 'es-MX' (Web Speech API BCP-47 locale) is left hardcoded rather than following the app's runtime i18n locale — voice input is scoped to transcribe Mexican Spanish speech for this Mexican bar POS regardless of UI display language; out of this plan's lint-driven scope to change that behavior."
  - "src/features/adjust-inventory/ (listed in this plan's files_modified) contains only a .gitkeep — it's an empty placeholder superseded by adjust-stock-movement, not an active feature; confirmed via git log this predates the phase and was never populated. Excluded from the Task-3 verification command (ESLint errors on empty glob matches) and from this plan's key-count; not a gap."

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "npm run lint:i18n exits 0 across all 26 active management/inventory/staff-ops/waitlist/AI-agent feature folders in this plan's scope (27th, adjust-inventory, is an empty placeholder)"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "npm run lint:i18n -- <all 26 active folders> (exit 0, confirmed as the Task 3 acceptance command)"
        status: pass
    human_judgment: false
  - id: D2
    description: "es-MX and en-US featMgmt.json have identical key sets (530/530) and 0 unused keys against src/**; every migrated es-MX value equals the pre-migration literal byte-for-byte except agent-chat's 26 genuinely-translated keys (documented, expected)"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "node key-parity + unused-key check (530 keys both locales, 0 orphans each side, 0 unused against src/**/*.{ts,tsx}); 26 differing values all confined to the agentChat.* namespace (deliberate translation, not a catalog-rule violation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run typecheck and npm run lint both exit 0 across the whole repo after the sweep; full unit suite has zero regressions"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npm run typecheck (only the 2 pre-existing unrelated errors, same baseline as 21-06/21-07) + npm run lint (exit 0) + npm run test (140 files/1248 tests pass, 2 skipped, 15 todo — identical to 21-07's baseline)"
        status: pass
    human_judgment: false

duration: ~150min
completed: 2026-07-18
status: complete
---

# Phase 21 Plan 08: Management/Inventory/Staff-Ops/Waitlist/AI-Agent Feature Sweep to featMgmt Summary

**Big-bang string sweep of catalog-admin, inventory, clock-in/out, RBAC/PIN, waitlist, report-export, logo-upload, and AI-agent-chat feature clusters into the `featMgmt` i18next namespace — `npm run lint:i18n` goes from 191 violations (this session's portion) to 0 across all 26 active folders, plus a genuine Spanish→English translation for the AI agent panel**

## Performance

- **Duration:** ~150 min (resumed after a mid-session interruption; catalog-admin+inventory cluster from the prior session's `595881a` commit is included in this summary's scope)
- **Tasks:** 3/3 complete (Task 1 landed in a prior session as `595881a`; Task 2 and Task 3 completed this session)
- **Files modified:** 31 feature files + 2 catalog files + 1 eslint config, across 6 commits total (1 prior-session + 5 this session)

## Accomplishments

- **Resumed cleanly:** Verified the prior session's `595881a` (catalog-admin + inventory, Task 1) was fully committed and untouched; found `ClockInModal.tsx`/`ClockOutDialog.tsx` fully migrated in the working tree but the `clockInStaff`/`clockOutStaff` catalog keys were never added — finished that gap and committed it as its own logical chunk before continuing.
- **Waitlist mutation cluster:** `add-waitlist-entry`, `mark-waitlist-entry-cancelled`, `mark-waitlist-no-show`, `notify-waitlist` (model + `NotifyButton`), `seat-waitlist-party` (model + `SeatPartySheet`, including its inline `pool_tables` query) — all migrated. Discovered and fixed a real ESLint-plugin quirk (see Decisions) affecting 5 files' Supabase `.update()`/`.delete()`/`.insert()` chains.
- **Staff-role/PIN/RBAC cluster:** `edit-staff-role` (`EditRoleDialog`), `force-pin-change` (model + `ForcePinChangeDialog`), `toggle-permission` (insert+delete RPC paths).
- **Report-export + branding cluster:** `export-report` (`useExportReport` + `ExportButtons`, including the native OS save-dialog's Excel/PDF filter labels), `upload-logo` (`useUploadLogo` + `LogoUploader`).
- **AI-agent-chat cluster:** `AgentButton`, `AgentPanel`, `ConfirmActionCard`, `FileDropZone`, `ImportPreviewTable`, `useAgent` — this feature's source strings were already Spanish (unlike the rest of the codebase), so es-MX keeps the exact source text byte-identical while en-US received a genuine English translation (the phase's first real translation pair, not a byte-copy).
- Task 3: ran the combined `lint:i18n` command across all 26 active folders (0 violations), verified 530/530 key parity with 0 unused keys against the full `src/**` tree, re-confirmed `typecheck`/`lint`/full unit suite (140 files/1248 tests, zero regressions).
- `featMgmt.json` grew to 530 keys across 27 feature-scoped groups (both locales): the prior session's `manageCategories`/`manageCombos`/`manageIngredients`/`manageModifierGroups`/`manageModifierInventoryRules`/`manageProducts`/`managePromotions`/`manageRecipe`/`adjustStockMovement`/`physicalCount`/`csvImport`/`producePrepBatch`, plus this session's `clockInStaff`/`clockOutStaff`/`addWaitlistEntry`/`markWaitlistCancelled`/`markWaitlistNoShow`/`notifyWaitlist`/`seatWaitlistParty`/`editStaffRole`/`forcePinChange`/`togglePermission`/`exportReport`/`uploadLogo`/`agentChat`.

## Task Commits

1. **Task 1: Sweep catalog-admin + inventory features → featMgmt** - `595881a` (feat, prior session)
2. **Finish clock-in/clock-out staff sweep (part of Task 2)** - `0b84c14` (feat)
3. **Task 2: Sweep waitlist mutation features → featMgmt** - `3170fbc` (feat)
4. **Task 2: Sweep staff-role/PIN/RBAC features → featMgmt** - `2ea0d06` (feat)
5. **Task 2: Sweep export-report + upload-logo features → featMgmt** - `b074a4b` (feat)
6. **Task 2: Sweep agent-chat feature → featMgmt** - `89d6fe6` (feat)
7. **Task 3: Prove zero violations across the mgmt cluster + reconcile catalog** - verification-only, no code changes (all 26 active folders already clean after Tasks 1+2; nothing to commit)

## Files Created/Modified

- `src/features/{clock-in-staff/ui/ClockInModal.tsx,clock-out-staff/ui/ClockOutDialog.tsx}` — PIN entry, opening/closing cash, shift-duration display
- `src/features/{add-waitlist-entry/{model/useAddWaitlistEntry.ts,ui/AddWaitlistEntryForm.tsx},mark-waitlist-entry-cancelled/model/useMarkCancelled.ts,mark-waitlist-no-show/model/useMarkNoShow.ts,notify-waitlist/{model/useNotifyWaitlist.ts,ui/NotifyButton.tsx},seat-waitlist-party/{model/useSeatWaitlistParty.ts,ui/SeatPartySheet.tsx}}` — waitlist entry lifecycle
- `src/features/{edit-staff-role/ui/EditRoleDialog.tsx,force-pin-change/{model/useForcePinChange.ts,ui/ForcePinChangeDialog.tsx},toggle-permission/useMutationTogglePermission.ts}` — staff role/PIN/RBAC admin actions
- `src/features/{export-report/{model/useExportReport.ts,ui/ExportButtons.tsx},upload-logo/{model/useUploadLogo.ts,ui/LogoUploader.tsx}}` — report export + receipt branding
- `src/features/agent-chat/{ui/{AgentButton,AgentPanel,ConfirmActionCard,FileDropZone,ImportPreviewTable}.tsx,model/useAgent.ts}` — AI assistant chat panel
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json` — 27 key groups, 530 keys, key-parity-verified
- `eslint.i18n.config.js` — `insert`/`update`/`delete`/`executeTool`/`canAccess` callee excludes, `status` object-property exclude, `aria-describedby` jsx-attribute exclude

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights: the eslint-plugin-i18next multi-line-chain quirk (config excludes don't suppress violations once a Supabase chain wraps across lines — scoped disable blocks needed instead), and agent-chat's Spanish-source-to-English-translation being this phase's first genuine (non-byte-copy) translation pair.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prior session's clock-in/clock-out catalog keys were missing despite the component code being fully migrated**
- **Found during:** Resume, before Task 2
- **Issue:** `ClockInModal.tsx`/`ClockOutDialog.tsx` in the working tree called `t('clockInStaff.*')`/`t('clockOutStaff.*')`/`i18n.t('featMgmt:clockOutStaff.*')` but `featMgmt.json` had no `clockInStaff`/`clockOutStaff` top-level keys — `npm run lint:i18n` passed (it only checks for literal strings, not that translation keys resolve) but the app would have rendered raw key paths.
- **Fix:** Added both key groups (10 + 12 keys) to both locale files, byte-identical to the pre-migration literals visible in the component diff.
- **Files modified:** `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json`
- **Verification:** `npm run typecheck`/`npm run lint:i18n` clean; manual trace of every `t()`/`i18n.t()` call site in both files against the new keys.
- **Committed in:** `0b84c14`

**2. [Rule 1 - Bug] eslint-plugin-i18next's callee exclude doesn't suppress violations on multi-line-formatted Supabase query-builder chains**
- **Found during:** Task 2, `mark-waitlist-entry-cancelled` migration
- **Issue:** `db.from('waitlist_entries').update({ status: 'cancelled' }).eq('id', input.entryId)` written across 4 lines (Prettier's default wrap) was still flagged as a literal-string violation on `.from(...)` and the full chain, despite `'from'`/`'eq'`/`'update'` (added this session) all being in `callees.exclude`. Isolated repro confirmed: the identical chain on ONE line passes cleanly; reformatted across lines it fails — a plugin quirk, not a config gap.
- **Fix:** Added scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` blocks around each affected multi-line chain (5 files: `mark-waitlist-entry-cancelled`, `mark-waitlist-no-show`, `notify-waitlist`, `seat-waitlist-party`'s `pool_tables` query, `toggle-permission`'s insert+delete branches), in addition to the config-level `insert`/`update`/`delete` excludes (which still correctly cover any future single-line chains).
- **Files modified:** the 5 files listed above
- **Verification:** `npm run lint:i18n -- <affected folders>` exits 0 for each.
- **Committed in:** `3170fbc`, `2ea0d06`

**3. [Rule 3 - Blocking] `status` object-property (Supabase mutation payload) flagged despite the query-builder callee being excluded**
- **Found during:** Task 2, same file as Deviation 2
- **Issue:** `{ status: 'cancelled' }` inside a `.update()` call argument was independently flagged by the plugin's object-property literal check — this check runs regardless of whether the enclosing call's callee is excluded.
- **Fix:** Added `'status'` to `object-properties.exclude` (a Postgres enum column value, never UI copy on its own).
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** Re-ran `lint:i18n` on all 5 affected waitlist/permission files.
- **Committed in:** `3170fbc`

**4. [Rule 3 - Blocking] `aria-describedby` (DOM ID reference) flagged as literal UI copy**
- **Found during:** Task 2, `add-waitlist-entry`'s phone-error field
- **Issue:** `aria-describedby={phoneError ? 'waitlist-phone-error' : undefined}` links an input to its inline error `<span id="...">` — a DOM ID reference, not UI copy, but not previously excluded (unlike the existing `aria-invalid`/`aria-hidden` excludes).
- **Fix:** Added `'aria-describedby'` to `jsx-attributes.exclude`.
- **Files modified:** `eslint.i18n.config.js`
- **Committed in:** `3170fbc`

**5. [Rule 3 - Blocking] `canAccess(...)` and `executeTool(...)` first-argument identifiers flagged despite being the same category as the already-excluded `can`/`rpc`**
- **Found during:** Task 2, `export-report` (RBAC gate) and `agent-chat` (AI tool dispatcher)
- **Issue:** `canAccess(role, 'view_reports')` (7 occurrences across the codebase) and `executeTool('confirm_action', ...)` (5 occurrences, this file alone has 3) both carry fixed technical identifiers as their string argument, same category as the already-excluded `can`/`rpc` callees but under different function names.
- **Fix:** Added `'canAccess'` and `'executeTool'` to `callees.exclude`.
- **Files modified:** `eslint.i18n.config.js`
- **Committed in:** `b074a4b`, `89d6fe6`

---

**Total deviations:** 5 auto-fixed (1 missing-catalog-key bug from the interrupted prior session, 4 blocking config/scope fixes needed to satisfy the plan's own stated `lint:i18n` acceptance criteria). No scope creep — all necessary to land a clean, zero-violation sweep without regressing the existing test suite.

## Issues Encountered

None beyond the five auto-fixed items documented above. The prior session was killed mid-task by a session-limit API error (not a real failure) while mid-way through `clock-out-staff`'s remaining lint violations — the working-tree state was verified to be a complete, correct migration and was finished by adding the missing catalog keys rather than redoing any code.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 26 active management/inventory/staff-ops/waitlist/AI-agent feature folders in this plan's scope are fully migrated to `featMgmt` (D-04) — `npm run lint:i18n -- <all 26 folders>` exits 0. (`src/features/adjust-inventory/` is an empty `.gitkeep`-only placeholder, not an active feature — excluded from the verification command.)
- `featMgmt.json`'s 530 keys across 27 feature-scoped groups are the canonical location for any subsequent 21-xx sweep touching similar management/inventory/staff/waitlist copy.
- `eslint.i18n.config.js`'s multi-line-Supabase-chain workaround pattern (scoped `eslint-disable`/`eslint-enable` blocks, not relying on callee excludes alone) is now documented precedent for any future sweep hitting the same plugin quirk with formatted query-builder chains.
- `edit-staff-locale` (owned by 21-04) was confirmed untouched — `git status --porcelain src/features/edit-staff-locale` shows no changes from this plan.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-18*

## Self-Check: PASSED

All 6 commits confirmed present in `git log --oneline --all` (`595881a`, `0b84c14`, `3170fbc`, `2ea0d06`, `b074a4b`, `89d6fe6`). Key files confirmed present on disk: `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx`, `src/features/agent-chat/model/useAgent.ts`, `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json`, `eslint.i18n.config.js`. `npm run lint:i18n` across all 26 active folders, `npm run typecheck` (2 pre-existing unrelated errors only), `npm run lint`, and `npm run test` (1248 passed, zero regressions) all re-confirmed clean immediately before writing this summary.
