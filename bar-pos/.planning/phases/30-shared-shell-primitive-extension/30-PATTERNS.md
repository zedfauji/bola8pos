# Phase 30: Shared Shell & Primitive Extension - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 22 (2 extended, 14+1 callers migrated, 3 deleted, 1 barrel, 1 docs file)
**Analogs found:** 22 / 22 (this phase edits/deletes existing files — no genuinely new files; "analog" = the current live version of each file being modified)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shared/ui/PageContainer.tsx` | component (layout shell) | request-response (prop-in, render-out) | itself (extend in place) | exact |
| `src/shared/ui/SectionHeader.tsx` | component (layout shell) | request-response | itself (extend in place) | exact |
| `src/shared/ui/BackToHomeButton.tsx` | component (nav) | request-response | DELETE — markup absorbed into `SectionHeader` | exact |
| `src/shared/ui/AppShell.tsx` | component (dead code) | n/a | DELETE | exact |
| `src/widgets/AppNav/` (whole folder) | widget (dead code) | n/a | DELETE | exact |
| `src/shared/ui/index.ts` | config (barrel) | n/a | itself (edit exports) | exact |
| `src/pages/audit/index.tsx` | page (route container) | request-response | Pattern A (no-`PageContainer` group) | exact |
| `src/pages/inventory/index.tsx` | page | request-response | Pattern A | exact |
| `src/pages/reports/index.tsx` | page | request-response | Pattern A | exact |
| `src/pages/settings/index.tsx` | page | request-response | Pattern A | exact |
| `src/pages/staff/index.tsx` | page | request-response | Pattern A | exact |
| `src/pages/pos/index.tsx` | page (full-bleed split-view) | request-response | Pattern C (full-bleed override) | exact |
| `src/pages/payments/index.tsx` | page (full-bleed tabs) | request-response | Pattern C | exact |
| `src/pages/kds/index.tsx` | page (already on `PageContainer`) | request-response | Pattern B (existing-adopter group) | exact |
| `src/pages/kds-bar/index.tsx` | page | request-response | Pattern B | exact |
| `src/pages/kitchen-prep/index.tsx` | page | request-response | Pattern B | exact |
| `src/pages/pool-tables/index.tsx` | page | request-response | Pattern B | exact |
| `src/pages/rappi/index.tsx` | page | request-response | Pattern B | exact |
| `src/pages/rbac/index.tsx` | page | request-response | Pattern B | exact |
| `src/pages/waitlist/index.tsx` | page | request-response | Pattern B | exact |
| `src/pages/pool-table-status/index.tsx` | page (custom `backTo` target) | request-response | Pattern D (correct-target special case) | exact |
| `CLAUDE.md` (§Routes table) | config (docs) | n/a | itself (add 3 rows) | exact |

## Pattern Assignments

### `src/shared/ui/PageContainer.tsx` (component, extend in place)

**Current full source** (`src/shared/ui/PageContainer.tsx:1-67`):
```tsx
export interface PageContainerProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, title, description, actions, className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] space-y-6 p-6', className)}>
      <SectionHeader
        title={title}
        {...(description && { description })}
        {...(actions && { action: actions })}
      />
      {children}
    </div>
  );
}
```

**Change to make:** Add `backTo?: string` and `backLabel?: string` to `PageContainerProps`, forward both to `SectionHeader` with the same conditional-spread pattern already used for `description`/`actions`:
```tsx
<SectionHeader
  title={title}
  {...(description && { description })}
  {...(actions && { action: actions })}
  {...(backTo && { backTo })}
  {...(backLabel && { backLabel })}
/>
```
Do not write `backTo={backTo}` directly — `exactOptionalPropertyTypes` is on project-wide; an explicit `undefined` assignment differs from prop omission and this codebase's existing pattern (line 58-59) already avoids it.

---

### `src/shared/ui/SectionHeader.tsx` (component, extend in place)

**Current full source** (`src/shared/ui/SectionHeader.tsx:1-61`):
```tsx
export type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  badge?: string | number;
  className?: string;
};

export function SectionHeader({ title, description, action, badge, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b pb-4', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {badge !== undefined && (
            <Badge variant="secondary" aria-label={`Count: ${String(badge)}`}>{badge}</Badge>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
```

**Change to make** — add `backTo`/`backLabel` to the type, add a new `<Button>`/`<Link>` block as the FIRST child inside the existing `<div className="space-y-1">` (before the `<h2>` row), imports needed: `import { ChevronLeft } from 'lucide-react'; import { Link } from 'react-router-dom'; import { Button } from './button';` (this is exactly `BackToHomeButton.tsx`'s import set, moved here). Exact markup per `30-UI-SPEC.md` (lines 71-87):
```tsx
<div className="space-y-1">
  {backTo && (
    <Button variant="ghost" size="sm" asChild className="-ml-2.5 h-6 px-2 text-xs">
      <Link to={backTo}>
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        {backLabel ?? 'Home'}
      </Link>
    </Button>
  )}
  <div className="flex items-center gap-2">
    <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    {badge !== undefined && <Badge variant="secondary" aria-label={`Count: ${String(badge)}`}>{badge}</Badge>}
  </div>
  {description && <p className="text-sm text-muted-foreground">{description}</p>}
</div>
```
This is the ONE markup change in the phase requiring judgment (size/margin tuning already resolved by UI-SPEC — do not re-derive).

---

### `src/shared/ui/BackToHomeButton.tsx` (DELETE)

**Full source being deleted** (`src/shared/ui/BackToHomeButton.tsx:1-17`):
```tsx
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './button';

export function BackToHomeButton() {
  return (
    <div className="px-4 pt-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/home">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Home
        </Link>
      </Button>
    </div>
  );
}
```
Its markup is exactly what moves into `SectionHeader` above (icon size shrinks `h-4 w-4`→`h-3.5 w-3.5`, wrapper div is dropped, negative margin added — per UI-SPEC).

---

### Pattern A: Pages with NO `PageContainer` today (first-time adoption)

**Analog:** `src/pages/audit/index.tsx:1-17` (full file, exact current state)
```tsx
import { AuditLogTable } from '@widgets/AuditLogTable';
import { BackToHomeButton } from '@shared/ui';
import { SectionHeader } from '@shared/ui/SectionHeader';

export default function AuditPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <SectionHeader title="Audit Log" />
          <AuditLogTable />
        </div>
      </main>
    </div>
  );
}
```
**Migration shape:** Remove `BackToHomeButton` import + JSX line; replace the inner `<div className="mx-auto max-w-6xl space-y-8"><SectionHeader .../>...</div>` with `<PageContainer title="Audit Log" backTo="/home"><AuditLogTable /></PageContainer>`. Keep the outer `<div className="flex h-screen flex-col"><main className="flex-1 overflow-auto">...</main></div>` scroll shell — `PageContainer` does NOT replace it (per RESEARCH.md Anti-Patterns). Applies identically to `inventory`, `reports`, `settings`, `staff` (each has the same `flex h-screen flex-col` + `BackToHomeButton` + ad-hoc `<main><div className="max-w-Nxl">` shape — verified in RESEARCH.md source list).

**Error handling / validation:** None applicable — pure presentational migration, no data fetching changed.

---

### Pattern B: Pages ALREADY on `PageContainer` (just swap `BackToHomeButton` for `backTo` prop)

**Analog:** `src/pages/kds/index.tsx:1-15` (full file, exact current state)
```tsx
import { KdsBoard } from '@widgets/KdsBoard';
import { BackToHomeButton, LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Kitchen Display" actions={<LiveTimeDisplay />}>
          <KdsBoard routing="KITCHEN" />
        </PageContainer>
      </main>
    </div>
  );
}
```
**Migration shape:** Remove `BackToHomeButton` from the `@shared/ui` import list and its JSX line; add `backTo="/home"` prop directly onto the existing `<PageContainer>` call (alongside `actions` etc. — same conditional-prop pattern). Result:
```tsx
import { LiveTimeDisplay, PageContainer } from '@shared/ui';
...
<main className="flex-1 overflow-auto">
  <PageContainer title="Kitchen Display" backTo="/home" actions={<LiveTimeDisplay />}>
    <KdsBoard routing="KITCHEN" />
  </PageContainer>
</main>
```
Applies identically to `kds-bar`, `kitchen-prep`, `pool-tables`, `rappi`, `rbac`, `waitlist` (all already import `BackToHomeButton` + `PageContainer` side-by-side from `@shared/ui` per RESEARCH.md's file list).

---

### Pattern C: Full-bleed split-view pages (`pos`, `payments`) — `className` override

**Analog:** `src/pages/pos/index.tsx:48-51` (current outer JSX)
```tsx
return (
  <div className="flex h-screen flex-col bg-background">
    <BackToHomeButton />
    <div className="flex min-w-0 flex-1 items-center justify-center p-4 md:p-6">
      ...
```
Import line to update (`src/pages/pos/index.tsx:18`): `import { BackToHomeButton, POSButton, ProtectedAction } from '@shared/ui';` → drop `BackToHomeButton`.

**Migration shape:** Wrap in `PageContainer` with a neutralizing `className` (per RESEARCH.md Pattern 2, `cn()`/`twMerge`-backed) so the existing full-height flex body is preserved:
```tsx
<PageContainer
  title="POS"
  backTo="/home"
  className="mx-0 h-screen max-w-none space-y-0 p-0"
>
  {/* existing full-height flex-1 split-view content, unchanged */}
</PageContainer>
```
Exact override classes are a per-task judgment call (RESEARCH.md Open Question, resolved as non-blocking) — verify visually against `03-tab-order.spec.ts`/`41-split-payment.spec.ts` (pos) and `05-payments.spec.ts`/`17-payment-pane.spec.ts` (payments) after the change; do not let `space-y-6`/`p-6` defaults collapse the `flex-1 overflow-y-auto`/`overflow-hidden` regions.

---

### Pattern D: `pool-table-status` — corrected `backTo` target (do NOT default to `/home`)

**Analog:** `src/pages/pool-table-status/index.tsx:1-40` (full file, exact current state)
```tsx
import { ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { TableStatusPanel } from '@widgets/TableStatusPanel';
import { PageContainer } from '@shared/ui/PageContainer';
import { Button } from '@shared/ui/button';

export default function TableStatusPage() {
  ...
  return (
    <div className="flex h-screen flex-col">
      <div className="px-4 pt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/pool-tables">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Pool Tables
          </Link>
        </Button>
      </div>
      <main className="flex-1 overflow-auto">
        <PageContainer title="Table Status">
          <TableStatusPanel tableId={tableId} />
        </PageContainer>
      </main>
    </div>
  );
}
```
**Migration shape:** Remove the hand-rolled `<div className="px-4 pt-4"><Button>...</Button></div>` block and its now-unused `ChevronLeft`/`Link`/`Button` imports; add `backTo="/pool-tables" backLabel="Pool Tables"` to the `<PageContainer>` call:
```tsx
<PageContainer title="Table Status" backTo="/pool-tables" backLabel="Pool Tables">
  <TableStatusPanel tableId={tableId} />
</PageContainer>
```
**Do not** copy the generic `backTo="/home"` default from Pattern A/B here — this is the one D-01-flagged exception (verified live: this page already correctly targets `/pool-tables`, must not regress). `e2e/16-table-status.spec.ts:813-822` (T15) asserts `getByRole('link', { name: /pool tables/i })` — must keep passing.

Note: this migration does NOT touch `src/widgets/TableStatusPanel/index.tsx`'s own separate hand-rolled `ArrowLeft` back button (line ~392) — that is COMPONENT-03, deferred to Phase 31.

---

### `src/shared/ui/index.ts` (barrel — remove 3 exports)

**Current relevant lines:**
```ts
// line 64 (Navigation section)
export { BackToHomeButton } from './BackToHomeButton';

// lines 69-70 (Layout section)
export { AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';
```
**Change:** Delete these 3 export lines. `PageContainer`/`SectionHeader` exports (lines 30-31, 71-72) stay untouched. `AppNav` has no barrel export today (confirmed — `src/widgets/AppNav/` is self-contained, no entry in this file), so nothing to remove there beyond deleting the folder itself.

---

### `AppShell.tsx` / `AppNav/` — DELETE, zero consumers confirmed

Confirmed via RESEARCH.md full-repo grep: `AppShell` appears only in its own file + its own barrel export line (removed above); `AppNav` appears only inside its own single-file widget folder (no barrel, no other consumers). Delete `src/shared/ui/AppShell.tsx` and the entire `src/widgets/AppNav/` folder outright — no replacement, no re-export shim (D-03: "removed, not resurrected").

---

### `CLAUDE.md` §Routes (add 3 rows)

**Current table** (`CLAUDE.md:109-124`, 14 rows) is missing `/kds`, `/kitchen-prep`, `/audit`. Router source confirms (`src/app/router.tsx:132-185`):
```
path="/kds"          → KdsRoute → KdsPage
path="/kitchen-prep"  → (no dedicated guard component seen at line 152 stub — verify wrapper at read time)
path="/audit"         → AuditRoute → AuditPage
```
**Change:** Insert 3 rows into the existing `| Path | Page | Notes |` table, matching the existing column format/alignment exactly. Per UI-SPEC copywriting contract: source `Notes` text from each route's own guard/comment in `router.tsx` if present, otherwise leave blank — do not invent descriptive copy. Suggested rows (verify guard names against live `router.tsx` before committing):
```
| `/kds`          | KdsPage        | Kitchen KDS board (gated by `KdsRoute`) |
| `/kitchen-prep` | KitchenPrepPage | Batch chef prep production |
| `/audit`        | AuditPage      | Audit log (gated by `AuditRoute`) |
```
No other CLAUDE.md section is touched (D-04 scope lock).

## Shared Patterns

### Back-navigation button (all 15 non-exempt pages)
**Source:** `src/shared/ui/BackToHomeButton.tsx` (deleted) → absorbed into `src/shared/ui/SectionHeader.tsx`
**Apply to:** Every page file listed above — the `ChevronLeft` + `Button asChild` + `Link` composition, `ghost` variant, ONLY reachable via `PageContainer`'s new `backTo`/`backLabel` props now (no direct page-level import of the old component).

### `exactOptionalPropertyTypes`-safe conditional prop spread
**Source:** `src/shared/ui/PageContainer.tsx:57-60` (existing `description`/`actions` pattern)
**Apply to:** `PageContainer`'s new `backTo`/`backLabel` forwarding to `SectionHeader`, and every page call site that conditionally sets `backTo`/`backLabel` (all of them do, since `pool-table-status` differs from the other 14).

### `className` override via `cn()`/`twMerge`
**Source:** `src/shared/lib/utils.ts` — `export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }`
**Apply to:** `pos` and `payments` only (Pattern C) — safe to pass conflicting Tailwind utilities as `className` on `PageContainer`; later classes win, not naive concatenation.

## No Analog Found

None — every file in scope is an edit/delete of an existing, already-read file. This phase introduces zero net-new components (confirmed by CONTEXT.md/RESEARCH.md: "entirely relocation + prop-threading, not new UI design").

## Metadata

**Analog search scope:** `src/shared/ui/`, `src/widgets/AppNav/`, `src/pages/{audit,inventory,reports,settings,staff,pos,payments,kds,kds-bar,kitchen-prep,pool-tables,rappi,rbac,waitlist,pool-table-status}/`, `src/app/router.tsx`, `CLAUDE.md`
**Files scanned:** 22 (all read directly, no inference)
**Pattern extraction date:** 2026-07-10
