---
phase: 21-i18n-multi-language
reviewed: 2026-07-19T05:42:00Z
depth: standard
files_reviewed: 64
files_reviewed_list:
  - e2e/46-i18n-locale-switch.spec.ts
  - e2e/helpers/supabase.ts
  - src-tauri/src/commands/printer.rs
  - src/entities/staff/model/locale-rls.integration.test.ts
  - src/entities/staff/model/queries.test.ts
  - src/entities/staff/model/queries.ts
  - src/entities/staff/model/store.ts
  - src/entities/staff/model/types.ts
  - src/entities/tab/ui/TabDetail.stories.tsx
  - src/entities/tab/ui/TabDetail.test.tsx
  - src/features/clock-in-staff/ui/ClockInModal.test.tsx
  - src/features/clock-out-staff/ui/ClockOutDialog.test.tsx
  - src/features/edit-staff-locale/index.ts
  - src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx
  - src/features/edit-staff-locale/ui/EditLocaleDialog.tsx
  - src/features/force-pin-change/ui/ForcePinChangeDialog.test.tsx
  - src/features/print-precheque/usePrintPreCheque.ts
  - src/features/process-payment/ui/ReceiptPreview.tsx
  - src/features/start-pool-timer/ui/StartSessionSheet.test.tsx
  - src/features/void-order/ui/VoidOrderDialog.test.tsx
  - src/main.tsx
  - src/shared/lib/audit-actions.ts
  - src/shared/lib/domain.ts
  - src/shared/lib/email-receipt.test.ts
  - src/shared/lib/email-receipt.ts
  - src/shared/lib/exporters/pdf.tsx
  - src/shared/lib/i18n/index.test.ts
  - src/shared/lib/i18n/index.ts
  - src/shared/lib/i18n/locales/en-US/common.json
  - src/shared/lib/i18n/locales/en-US/featMgmt.json
  - src/shared/lib/i18n/locales/en-US/featOrders.json
  - src/shared/lib/i18n/locales/en-US/receipt.json
  - src/shared/lib/i18n/locales/en-US/settings.json
  - src/shared/lib/i18n/locales/en-US/staff.json
  - src/shared/lib/i18n/locales/en-US/wAdmin.json
  - src/shared/lib/i18n/locales/en-US/wPanels.json
  - src/shared/lib/i18n/locales/es-MX/common.json
  - src/shared/lib/i18n/locales/es-MX/featMgmt.json
  - src/shared/lib/i18n/locales/es-MX/featOrders.json
  - src/shared/lib/i18n/locales/es-MX/receipt.json
  - src/shared/lib/i18n/locales/es-MX/settings.json
  - src/shared/lib/i18n/locales/es-MX/staff.json
  - src/shared/lib/i18n/locales/es-MX/wAdmin.json
  - src/shared/lib/i18n/locales/es-MX/wPanels.json
  - src/shared/lib/pos-printer.test.ts
  - src/shared/lib/pos-printer.ts
  - src/shared/lib/receipt-format.test.ts
  - src/shared/lib/receipt-format.ts
  - src/shared/lib/supabase.types.ts
  - src/shared/lib/test-setup.ts
  - src/widgets/AuditLogTable/AuditLogTable.test.tsx
  - src/widgets/CajaDashboard/CajaDashboard.test.tsx
  - src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
  - src/widgets/InventoryPagePanel.tsx
  - src/widgets/PaymentModal/PaymentModal.test.tsx
  - src/widgets/PaymentModal/ui/PaymentForm.test.tsx
  - src/widgets/PaymentPane/ui/PaymentPane.test.tsx
  - src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx
  - src/widgets/SettingsTabsPanel/index.tsx
  - src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx
  - src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx
  - src/widgets/StaffDashboard/StaffDashboard.test.tsx
  - src/widgets/StaffDashboard/StaffDashboard.tsx
  - supabase/migrations/20260718000000_profiles_locale.sql
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-19T05:42:00Z
**Depth:** standard
**Files Reviewed:** 64
**Status:** issues_found

## Summary

Reviewed the hand-written core of Phase 21: the i18next singleton bootstrap, the
`profiles.locale` DB/RPC/RLS migration, the two new UI surfaces
(`LanguageSettingsTab`, `EditLocaleDialog`), and the receipt/printer/PDF
locale-aware refactor (`receipt-format.ts`, `pos-printer.ts`, `email-receipt.ts`,
`exporters/pdf.tsx`, `printer.rs`).

The server-side design is solid: `set_own_locale` is correctly scoped to
`auth.uid()` with no target-id param, the DB `CHECK` constraint mirrors the Zod
`LocaleSchema`, the RLS integration test genuinely exercises the cross-user
denial path with an authenticated (non-service-role) client, and the
`record_audit` positional-args call resolves correctly against the existing
8-arg overload. The receipt/PDF locale plumbing (`getFixedT`, `getCurrentLocale`)
is consistent and covered by tests that assert real catalog strings rather than
mocked keys.

However, two client-side state-management bugs were found that undermine the
two headline UI features this phase ships (self-service language switch, and
admin per-staff locale override). Both are silent-failure-shaped: they don't
throw, don't fail lint/typecheck, and are not caught by the existing unit or
E2E suites because those tests happen to exercise the buggy components in ways
that mask the defect (fresh mount with the target already set, or same-session
non-reload navigation only). See Critical Issues below.

## Critical Issues

### CR-01: Self-service locale change is not persisted to the Zustand store — reverts to the old language on next app reload/restart

**File:** `src/entities/staff/model/queries.ts:504-534` (`useMutationSetOwnLocale`)
**File:** `src/entities/staff/model/store.ts:117-124` (`onRehydrateStorage`)

**Issue:**
`LanguageSettingsTab.save()` (`src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx:36-47`)
calls `useMutationSetOwnLocale()`, which on success only does:

```ts
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: staffKeys.list() });
},
```

This invalidates the `staffKeys.list()` query, whose `useEffect` in
`useStaffList()` calls `setStaffList(...)` — updating the store's `staffList`
array only. It never updates `useStaffStore`'s `currentStaff` object. The only
setter for `currentStaff` is `login()`, called once at PIN-auth time.

`LanguageSettingsTab` itself then does `void i18n.changeLanguage(locale)` —
this changes the *in-memory* i18next language for the current session, but the
persisted `currentStaff` (written to `localStorage` via zustand's `persist`
middleware, `partialize` includes `currentStaff`) still holds the **old**
locale.

On the next app reload or restart — routine for a Tauri desktop kiosk app that
gets closed/relaunched daily — `onRehydrateStorage` runs:

```ts
onRehydrateStorage: () => state => {
  useStaffStore.setState({ hasHydrated: true });
  if (state?.currentStaff) {
    void i18n.changeLanguage(state.currentStaff.locale);
  }
},
```

`state.currentStaff.locale` is the stale pre-change value read straight from
`localStorage`, so this silently reverts the UI back to the staff member's
*previous* language, even though the DB row (`profiles.locale`) and
`set_own_locale`'s audit trail correctly show the new value. The staff member
would have to explicitly re-save their language preference every time the app
restarts.

Not caught by `e2e/46-i18n-locale-switch.spec.ts` because every scenario in
that spec either (a) switches languages within the same session without a
`page.goto()`/reload while the changed locale is still active, or (b) resets
back to `es-MX` (the value `currentStaff.locale` was already set to at login)
before any navigation that could expose the staleness.

**Fix:** Update the in-memory (and therefore persisted) `currentStaff` locale
in the mutation's `onSuccess`, mirroring what `login()`/`updateShift()` already
do for other staff-record fields:

```ts
// queries.ts
export function useMutationSetOwnLocale() {
  const queryClient = useQueryClient();

  return useMutation<Result<null>, Error, { locale: Staff['locale'] }>({
    mutationFn: async ({ locale }) => { /* unchanged */ },
    onSuccess: (_result, { locale }) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list() });
      const current = useStaffStore.getState().currentStaff;
      if (current) {
        useStaffStore.setState({ currentStaff: { ...current, locale } });
      }
    },
  });
}
```

## Warnings

### WR-01: `EditLocaleDialog`'s pre-selected locale desyncs from the target `staff` prop — can display, and silently save, the wrong locale

**File:** `src/features/edit-staff-locale/ui/EditLocaleDialog.tsx:40-51`
**File:** `src/widgets/StaffDashboard/StaffDashboard.tsx:225-231`

**Issue:** `EditLocaleDialog` seeds its combobox from component state that is
initialized once:

```ts
const [selectedLocale, setSelectedLocale] = useState<Locale>(staff?.locale ?? 'es-MX');
```

The only code path that resyncs this state to a newly-selected `staff` prop is
its own `handleOpenChange(next)`:

```ts
function handleOpenChange(next: boolean) {
  if (next && staff) {
    setSelectedLocale(staff.locale);
  }
  onOpenChange(next);
}
```

`handleOpenChange` is passed as `<Dialog onOpenChange={handleOpenChange}>`.
Radix's `Dialog.Root` only invokes `onOpenChange` for **internally-driven**
state transitions (Escape key, overlay click, an internal `DialogTrigger`) —
never merely because the controlling `open` prop changed from the parent. In
`StaffDashboard.tsx`, `EditLocaleDialog` is rendered once, persistently
mounted (unlike `ClockOutDialog` on the same page, which is deliberately given
`key={clockOutTarget ? ... : 'clock-out-idle'}` at line 204-208 specifically to
force a remount per target), and is opened purely by flipping
`localeTarget`/`open` externally:

```tsx
<EditLocaleDialog
  staff={localeTarget}
  open={localeTarget !== null}
  onOpenChange={next => { if (!next) setLocaleTarget(null); }}
/>
```

Since `EditLocaleDialog` has no internal `DialogTrigger` (it's fully
externally controlled) and the `handleOpenChange(true)` branch is thus never
reached by real usage in this app, `selectedLocale` is locked to whatever it
was at first component mount (`'es-MX'`, since `StaffDashboard` mounts it once
with `staff=null`) and never gets corrected — including for the very first
staff member an admin edits, and for every staff member after the first,
where it carries over whatever was last selected in the combobox rather than
that row's actual `locale`.

Consequence: the dialog can visibly show the wrong current locale for a staff
member, and if the admin doesn't happen to notice and change the selection,
clicking Save writes that wrong (stale) value to `profiles.locale` for the
target staff — a silent, unprompted data overwrite with no error surfaced
anywhere.

This is masked in `EditLocaleDialog.test.tsx` because every test there mounts
the component fresh with `staff={targetStaff}` already set at mount time
(`render(<EditLocaleDialog open onOpenChange={vi.fn()} staff={targetStaff} />)`),
which is not how `StaffDashboard` actually uses it (mounted once, `staff` prop
changes across renders without remount). It's also masked in
`e2e/46-i18n-locale-switch.spec.ts`, which only opens the dialog for a single
staff member (`managerRow`) per test run.

**Fix:** Either force a remount per target (matching the existing
`ClockOutDialog` pattern already in the same file):

```tsx
<EditLocaleDialog
  key={localeTarget?.id ?? 'locale-idle'}
  staff={localeTarget}
  open={localeTarget !== null}
  onOpenChange={next => { if (!next) setLocaleTarget(null); }}
/>
```

or add a `useEffect` inside `EditLocaleDialog` that resyncs `selectedLocale`
whenever `staff?.id` changes:

```ts
useEffect(() => {
  if (staff) setSelectedLocale(staff.locale);
}, [staff]);
```

Either fix should be paired with a regression test that renders the dialog
once, then re-renders it with a *different* `staff` prop (locale differing
from the first), and asserts the combobox now shows the second staff's locale
— the scenario the current test suite never exercises.

### WR-02: ESC/POS column math uses UTF-16 code-unit length, not UTF-8 byte width — will misalign as soon as a translated label contains a multi-byte character

**File:** `src/shared/lib/receipt-format.ts:8-24` (`padRight`, `lineLeftRight`, `centerLine`)

**Issue:** `receipt-format.ts` is now an explicitly locale-driven file (two
catalogs, `receiptT(locale)`/translator-facing), but its 32-column layout math
still uses JS `String.prototype.length`:

```ts
function padRight(s: string, width: number): string {
  const t = s.length > width ? s.slice(0, width) : s;
  return t + ' '.repeat(Math.max(0, width - t.length));
}
```

`.length` counts UTF-16 code units, which only equals the printed ESC/POS byte
width for single-byte (ASCII/Latin-1-ish) text. `printer.rs` sends
`line.as_bytes()` — raw UTF-8 bytes — to the printer with no
transcoding/codepage handling. The existing `precheque.happyHour` string
(`"★ HORA FELIZ ACTIVA ★"`, `es-MX`/`en-US` both) already contains `★`
(U+2605), a 3-byte UTF-8 sequence counted as 1 by `.length`; `centerLine`'s
padding is therefore already computed on the wrong width for that line today,
and every future translator who adds an accented character (e.g. a Spanish
label containing `á/é/í/ó/ú/ñ`) to any of these catalogs will silently
reintroduce column misalignment/right-edge truncation on the physical
receipt — with no test catching it, since `receipt-format.test.ts` only
asserts `line.length <= 32`, not byte width.

**Fix:** Compute width from `Buffer.byteLength(s, 'utf8')` (or a
`TextEncoder().encode(s).length` browser-safe equivalent) instead of
`s.length` in `padRight`/`lineLeftRight`/`centerLine`, or add an explicit
comment + lint/test guard restricting receipt/precheque catalog strings to
single-byte-safe characters if byte-accurate padding is out of scope for this
phase.

---

_Reviewed: 2026-07-19T05:42:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
