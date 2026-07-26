# Phase 21: i18n Multi-Language - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 14
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/i18n/index.ts` | config | request-response (init singleton) | none in repo (greenfield) — follow RESEARCH.md Pattern 1 | no-analog |
| `src/app/i18n/locales/{es-MX,en-US}/*.json` | config | static data | none — new JSON catalogs | no-analog |
| `src/shared/lib/i18n-types.ts` | config | transform (type augmentation) | `src/shared/lib/domain.ts` (module-augmentation style at bottom, lines ~1200+) | role-match |
| `supabase/migrations/2026XXXX_profiles_locale.sql` | migration | CRUD (schema DDL) | `supabase/migrations/20260703000005_force_pin_change.sql` | exact |
| `src/shared/lib/domain.ts` (add `LocaleSchema`, extend `StaffSchema`) | model | transform (Zod schema) | same file, `UserRoleSchema`/`StaffSchema` (lines 42-50, 286-298) | exact |
| `src/entities/staff/model/queries.ts` (`mapStaffRow`, mutation) | service | CRUD | same file, `mapStaffRow` (line 33-47) + `useMutationUpdateStaffRole`-style mutation (used by `EditRoleDialog`) | exact |
| `src/entities/staff/model/store.ts` (locale hydrate on login) | store | event-driven | same file, existing `currentStaff` set-on-login handler | exact |
| `src/shared/lib/locale.ts` (`getCurrentLocale()` accessor, Open Q1) | utility | transform | `src/shared/lib/logger-instance.ts`-style singleton accessor pattern | role-match |
| `src/widgets/SettingsTabsPanel/index.tsx` (add role-agnostic tab group) | widget | request-response | same file — existing `canManageSettings`/`canManageProducts` tab-assembly logic (lines 24-131) | exact |
| `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx` | component | request-response (form + mutation) | `src/widgets/SettingsTabsPanel/tabs/GeneralSettingsTab.tsx` | exact |
| `src/features/edit-staff-locale/ui/EditLocaleDialog.tsx` | component | request-response (dialog + mutation) | `src/features/edit-staff-role/ui/EditRoleDialog.tsx` | exact |
| `src/widgets/StaffDashboard/StaffDashboard.tsx` (add Language column + row action) | widget | CRUD (table render) | same file — existing Role `Badge` column + "Force PIN Change" `ProtectedAction` row action | exact |
| `eslint.config.js` (add `eslint-plugin-i18next` block) | config | static analysis | same file — existing `tailwindcss` plugin block (lines 13, 141-166) | exact |
| `src/shared/lib/receipt-format.ts` (translate labels via `i18n.t()`) | utility | transform | same file — existing `buildThermalReceiptText`/`buildPreChequeText` | exact |
| `src-tauri/src/commands/printer.rs` (`print_receipt` signature → accept `lines: string[]`) | utility (Rust) | transform | same file — existing `build_receipt_lines`/`lines_to_esc_pos` | exact |
| `src/shared/lib/exporters/pdf.tsx` (PDF report builders, `i18n.t()`) | utility | file-I/O | same file — existing report-building functions | exact |

## Pattern Assignments

### `src/app/i18n/index.ts` (config, singleton init)

**No repo analog** — greenfield. Use RESEARCH.md's Pattern 1 verbatim (static `resources` object, `initReactI18next`, `lng: 'es-MX'`, `fallbackLng: 'es-MX'`). Do not add `i18next-http-backend` or `i18next-browser-languagedetector`.

---

### `supabase/migrations/2026XXXX_profiles_locale.sql` (migration, CRUD/DDL)

**Analog:** `supabase/migrations/20260703000005_force_pin_change.sql`

**Idempotent ADD COLUMN pattern** (lines 30-37 of analog):
```sql
BEGIN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT false;
```
Apply the same shape for `locale`:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-MX';
ALTER TABLE profiles ADD CONSTRAINT profiles_locale_check CHECK (locale IN ('es-MX', 'en-US'));
```

**DOWN comment-block pattern** (lines 142-154): keep the DOWN script commented-out (not executed), following this repo's established convention for reversible-but-manual rollback. Do not drop the column in DOWN if any other schema depends on it non-nullably (mirrors the analog's own rationale for *not* dropping `must_change_pin`).

**Admin-writes-another-staff's-locale RPC** (if a server-side RPC is chosen over direct RLS-gated UPDATE) should reuse the exact `SECURITY DEFINER` + manager/admin role-check + `record_audit(...)` shape from `force_pin_change()` (lines 42-89 of analog).

---

### `src/shared/lib/domain.ts` (model — `LocaleSchema` + `StaffSchema` extension)

**Analog:** same file, `UserRoleSchema` (lines 42-50) + `StaffSchema` (lines 286-298)

```typescript
// line 42: existing enum pattern to mirror
export const UserRoleSchema = z.enum(['bartender', 'manager', 'admin', 'kitchen']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// lines 286-298: existing StaffSchema — locale field goes here, required+default (Pitfall 4)
export const StaffSchema = z.object({
  id: UuidSchema,
  role: UserRoleSchema,
  mustChangePin: z.boolean(),
  // ADD: locale: LocaleSchema.default('es-MX'),
});
export const StaffCreateSchema = StaffSchema.omit({ id: true });
export const StaffUpdateSchema = StaffSchema.partial().required({ id: true });
```

**exactOptionalPropertyTypes gotcha (Pitfall 4):** `locale` on `StaffSchema` itself must be **required with `.default('es-MX')`**, not `.optional()` — same non-nullable-with-default treatment already given to `mustChangePin`/`isActive`. Only mutation *input* types that update just the locale field should use the repo's established `.nullable().optional()` convention (search `comboPriceOverride`/`splitMode` in this file for that pattern before authoring the update-shape schema).

---

### `src/entities/staff/model/queries.ts` (service — `mapStaffRow` + mutation)

**Analog:** same file, `mapStaffRow` (lines 33-47)

```typescript
// line 33-47
function mapStaffRow(row: Tables<'profiles'>): Result<Staff> {
  // ...
  mustChangePin: row.must_change_pin,
  // ADD: locale: row.locale,
}
```
Also used at call sites lines 90 and 459 — no change needed there, `mapStaffRow` is the single choke point.

**Mutation pattern to copy:** `useMutationUpdateStaffRole` (referenced by `EditRoleDialog.tsx`, defined in this same file) — copy its shape 1:1 for a new `useMutationUpdateStaffLocale` (same TanStack Query `useMutation` + `Result<T>` return + optimistic-update convention used throughout `entities/*/model/queries.ts`).

---

### `src/entities/staff/model/store.ts` (store — locale hydrate on login)

**Analog:** same file's existing `currentStaff` login-success handler (Zustand store, per RESEARCH.md Pattern 2)

```typescript
// entities/staff/model/store.ts (conceptual, per RESEARCH.md Pattern 2)
import i18n from '@app/i18n';
// ...inside the action that sets currentStaff after successful login/fetch:
void i18n.changeLanguage(staff.locale);
```
Do not read `navigator.language` anywhere — locale is staff-attribute-driven only (Anti-Pattern in RESEARCH.md).

---

### `src/widgets/SettingsTabsPanel/index.tsx` (widget — role-agnostic tab group)

**Analog:** same file (Pitfall 1 — structural change required, not additive)

**Current gated structure** (lines 24-101):
```typescript
const canManageSettings = can('manage_settings');
const canManageProducts = can('manage_products');

const tabs = useMemo<TabItem[]>(() => {
  const out: TabItem[] = [];
  if (canManageSettings) { out.push(/* General, Hardware, Rappi, Email, Backup, Tip Split */); }
  if (canManageProducts) { out.push(/* Products, Pool, Billing, Combos, Promotions, Ingredients */); }
  return out;
}, [canManageProducts, canManageSettings, currentRole]);
```

**Required change (UI-SPEC.md locked decision):** add a third, unconditional `out.push({ key: 'language', label: t('settings.tabs.language'), render: () => <LanguageSettingsTab /> })` **outside** both `if` blocks so it always renders regardless of role — this is what makes the "You do not have permission to view settings." fallback (line 106-109) never block a bartender from at least seeing the Language tab. `firstTab`/`defaultTab` logic (lines 103-111) works unchanged once `tabs` is guaranteed non-empty for every role.

---

### `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx` (component — form + mutation)

**Analog:** `src/widgets/SettingsTabsPanel/tabs/GeneralSettingsTab.tsx` (full file, 145 lines)

**Imports pattern** (lines 1-5):
```typescript
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useMutationUpdateSetting, useSettings } from '@entities/settings';
import type { UserRole } from '@shared/lib/domain';
import { Input, Label, POSButton, ProtectedAction } from '@shared/ui';
```
Swap `useMutationUpdateSetting`/`useSettings` for the new staff-locale mutation/query; swap `Input` for `Select`/`SelectItem` (per `EditRoleDialog.tsx`, `LocaleSchema.options`-driven).

**Dirty-tracking + save state machine** (lines 30-63): copy exactly — `useState` form + `dirty` flag, `useEffect` hydration guarded by `!dirty`, `save()` async handler calling `mutation.mutateAsync`, `toast.error(result.error.message)` on `!result.ok`, `toast.success(...)` + `setDirty(false)` on success. UI-SPEC.md interaction contract for this tab (step 4) additionally requires firing `i18n.changeLanguage(locale)` inside the success branch — insert it right where `toast.success` fires.

**Button state pattern** (lines 131-140):
```typescript
<POSButton
  type="button"
  touchSize="large"
  disabled={!dirty || updateSetting.isPending}
  onClick={() => { void save(); }}
>
  {updateSetting.isPending ? 'Saving...' : 'Save General'}
</POSButton>
```
Copy 1:1, i18n-translate both label states per UI-SPEC.md copy table (`settings.language.save` / `settings.language.saving`).

**Important — UI-SPEC.md deviation from analog:** heading uses `text-lg font-medium` (not `GeneralSettingsTab`'s `font-semibold`, line 72) — this is a deliberate typography collapse for the new element, do not copy `font-semibold` here.

**Do NOT wrap in `ProtectedAction`** (unlike `GeneralSettingsTab`'s `action="manage_settings"` wrapper, lines 66-70) — this tab must be visible/usable by every role per D-03/UI-SPEC.md locked decision.

---

### `src/features/edit-staff-locale/ui/EditLocaleDialog.tsx` (component — admin dialog)

**Analog:** `src/features/edit-staff-role/ui/EditRoleDialog.tsx` (full file, 168 lines)

**Structure to copy near-verbatim, swapping role→locale:**
- Imports (lines 1-24): swap `useMutationUpdateStaffRole` → new `useMutationUpdateStaffLocale`, `UserRoleSchema` → `LocaleSchema`.
- Props shape (lines 26-32): same `open`/`onOpenChange`/`staff`/`currentStaffId`/`preSelectedStaffId` contract, but per UI-SPEC.md this dialog edits **one target staff member's** locale (row-action-triggered), so props likely narrow to a single `staffId`/`staff` rather than the full list — confirm against UI-SPEC.md's "per-row action button" wording during planning.
- `handleSubmit` pattern (lines 58-83): copy the `safeParse` validation guard, `mutation.mutateAsync`, `!result.ok` → `toast.error(...)`, success → `toast.success(...)` + `handleOpenChange(false)`.
- Dialog/Select JSX (lines 87-141): copy the `Dialog`/`DialogContent`/`Select`/`SelectItem` structure exactly, replacing `ROLE_OPTIONS = UserRoleSchema.options` with `LOCALE_OPTIONS = LocaleSchema.options`.
- Footer buttons (lines 143-164): copy exactly — `variant="outline"` Cancel + primary Save, both `disabled` while `mutation.isPending`.

**Important:** per UI-SPEC.md interaction contract §Staff page, this dialog must **not** call `i18n.changeLanguage()` on the acting admin's own session — only `EditLocaleDialog`'s target-staff write happens; the target's own session picks it up on next login/hydrate (Pattern 2 in RESEARCH.md).

---

### `src/widgets/StaffDashboard/StaffDashboard.tsx` (widget — Language column + row action)

**Analog:** same file's existing Role `Badge` column + "Force PIN Change" `ProtectedAction` row action (not read in full this pass — locate via `Badge variant="outline"` + `ProtectedAction action="manage_staff"` grep during planning; both patterns are directly named in UI-SPEC.md lines 138-139).

Copy the exact `Badge variant="outline"` column cell pattern for locale display, and the exact `ProtectedAction action="manage_staff"` wrapper already used for "Force PIN Change" for the "Change language" row-action button that opens `EditLocaleDialog`.

---

### `eslint.config.js` (config — `eslint-plugin-i18next` block)

**Analog:** same file, existing `tailwindcss` plugin block (lines 13, 141-166)

```javascript
// lines 8-16: existing plugin import style
import tailwindcss from 'eslint-plugin-tailwindcss'
import { uiDriftSelectors } from './eslint-rules/no-ui-drift.js'

// lines 144-166: existing file-scoped plugin config block to mirror
files: ['src/pages/**/*.tsx', 'src/widgets/**/*.tsx', 'src/features/**/*.tsx'],
ignores: ['**/*.test.tsx', '**/*.stories.tsx'],
plugins: { tailwindcss },
settings: {
  tailwindcss: {
    callees: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv'],
    whitelist: ['^(animate|fade|slide|zoom)-(in|out)(-from-\\w+)?$'],
  },
},
rules: {
  'tailwindcss/no-custom-classname': 'error',
  'tailwindcss/enforces-shorthand': 'error',
},
```
**New block to add:** same `files`/`ignores` shape but scoped to `src/shared/ui/**`, `src/entities/**`, `src/features/**`, `src/widgets/**`, `src/pages/**` per RESEARCH.md's Code Examples section, reusing the identical `callees: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv']` exclude list already present in this file's tailwindcss block (D-05 requires `mode: 'all'`, not the plugin default — see RESEARCH.md Pitfall 5).

---

### `src/shared/lib/receipt-format.ts` / `src-tauri/src/commands/printer.rs`

**No analog needed for the target shape** — these ARE the files to modify. Read `buildThermalReceiptText`/`buildPreChequeText` in `receipt-format.ts` and `build_receipt_lines`/`lines_to_esc_pos` in `printer.rs` directly during planning (not re-summarized here — see RESEARCH.md Pitfall 2 for the exact refactor: move label selection into TS via `i18n.t()`, change `print_receipt`'s Tauri command to accept `lines: string[]`, leave Rust doing ESC/POS byte encoding only). `grep -rn "ReceiptPrintDto\|build_receipt_lines" src-tauri/` before touching, per RESEARCH.md Open Question 3.

---

## Shared Patterns

### Result<T> + toast error handling
**Source:** `src/widgets/SettingsTabsPanel/tabs/GeneralSettingsTab.tsx` lines 57-63, `src/features/edit-staff-role/ui/EditRoleDialog.tsx` lines 72-76
**Apply to:** every new mutation call site (`LanguageSettingsTab`, `EditLocaleDialog`)
```typescript
const result = await mutation.mutateAsync({ /* ... */ });
if (!result.ok) {
  toast.error(result.error.message);
  return;
}
toast.success('...');
```

### Dirty-tracking save form
**Source:** `GeneralSettingsTab.tsx` lines 30-63
**Apply to:** `LanguageSettingsTab.tsx`

### RBAC gating via `ProtectedAction`/`usePermissions`
**Source:** `GeneralSettingsTab.tsx` line 66 (`ProtectedAction action="manage_settings"`), `SettingsTabsPanel/index.tsx` lines 26-28 (`usePermissions().can(...)`)
**Apply to:** `EditLocaleDialog` trigger on `StaffDashboard` (gate `manage_staff`) — explicitly NOT applied to `LanguageSettingsTab` (must stay ungated per D-03/UI-SPEC.md).

### Idempotent migration + SECURITY DEFINER RPC + record_audit
**Source:** `supabase/migrations/20260703000005_force_pin_change.sql` (full file)
**Apply to:** `profiles.locale` migration; any admin-sets-another-staff's-locale RPC.

### Enum-driven Select options
**Source:** `EditRoleDialog.tsx` line 34 (`const ROLE_OPTIONS = UserRoleSchema.options;`) + JSX lines 122-135
**Apply to:** `LanguageSettingsTab.tsx` and `EditLocaleDialog.tsx` — `const LOCALE_OPTIONS = LocaleSchema.options;`

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/app/i18n/index.ts` | config | request-response (init) | Greenfield — no i18n infra exists anywhere in repo (confirmed by RESEARCH.md grep); follow RESEARCH.md's Pattern 1 code example directly |
| `src/app/i18n/locales/**/*.json` | config | static data | New JSON catalog files — no analog, follow RESEARCH.md's namespacing decision (per-domain-area flat files) |

## Metadata

**Analog search scope:** `src/widgets/SettingsTabsPanel/`, `src/features/edit-staff-role/`, `src/widgets/StaffDashboard/`, `src/entities/staff/model/`, `src/shared/lib/domain.ts`, `supabase/migrations/`, `eslint.config.js`
**Files scanned:** 9 read directly + grep sweeps across `src/`, `supabase/migrations/`, `eslint.config.js`
**Pattern extraction date:** 2026-07-17
