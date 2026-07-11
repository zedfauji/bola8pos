# Phase 31: Component, Token & Spacing Consistency Sweep - Research

**Researched:** 2026-07-11
**Domain:** React/TypeScript markup conformance sweep (raw HTML → shared/ui primitives, hardcoded values → existing Tailwind tokens) — zero new components, zero behavior change
**Confidence:** HIGH

## Summary

This phase is fully scoped by `31-CONTEXT.md` (9 locked decisions) and `31-UI-SPEC.md` (file-by-file target mapping). No architectural exploration is needed — every target primitive already exists in `src/shared/ui/`. This research pass exists to (1) pull the exact current-state code for every in-scope file so the planner can write precise `<action>`/`<read_first>` blocks without re-reading the whole codebase, (2) confirm import paths/prop contracts for `POSButton`, `Button`, `Checkbox`, `FormField`, and (3) surface two real risks the CONTEXT/UI-SPEC docs did not catch: a **factual correction** (the "checkbox.tsx has zero consumers" premise in D-04/UI-SPEC is wrong — it's already used in 4 files) and a **load-bearing bug risk** (`FormField`'s `React.cloneElement` unconditionally overwrites any `id` prop passed to its child, which will silently break `e2e/38-audit-logs.spec.ts:231`'s `#audit-filter-date-from` locator if `AuditLogFilterBar`'s date-from input is wrapped in `FormField` as literally described in UI-SPEC).

**Primary recommendation:** Execute exactly per `31-UI-SPEC.md`'s file table, but (1) route the `AuditLogFilterBar` date-input wrap through a `data-testid`-preserving fix or an E2E selector update (see Pitfall 1 below) instead of assuming the existing `id` survives the `FormField` wrap, and (2) when deleting `TableStatusPanel.tsx:382-395`, also remove the now-orphaned `ArrowLeft` import (confirmed used nowhere else in the file) while **keeping** `useNavigate`/`navigate` (confirmed used at 4 other call sites in the same file — UI-SPEC's "if no longer referenced" hedge resolves to "still referenced, do not remove").

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**Payment-adjacent file boundary (COMPONENT-01/02)**
- **D-01:** `src/pages/pos/index.tsx`, `src/widgets/OrderPanel/CartPanel.tsx`, `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` are OUT of scope for Phase 31 — deferred to Phase 33 (payment-critical sweep, COMPONENT-04).
- **D-02:** `src/features/split-tab/ui/SplitTabSheet.tsx` (3 raw buttons) IS in scope for Phase 31, despite being reached from `OrderPanel`.
- **D-03:** `src/features/agent-chat/ui/AgentButton.tsx`, `CommandChips.tsx`, `FileDropZone.tsx` ARE in scope, even though `AgentButton` mounts globally in `router.tsx` and renders on every route including `/pos` and `/payments` — floating chat chrome, zero payment logic.

**Non-text raw `<input>` handling (COMPONENT-02)**
- **D-04:** The 2 raw `type="checkbox"` inputs (`ModifierGroupEditor.tsx:255,336`, `HardwareSettingsTab.tsx:147`) get swapped to `src/shared/ui/checkbox.tsx` (CONTEXT.md described this as "currently unused — exists but not wired in" — **research finding below corrects this**).
- **D-05:** The 4 raw `type="color"/"time"` inputs (`CategoryTreeEditor.tsx:84`, `CategoryForm.tsx:135`, `ComboAvailabilityEditor.tsx:113,125`) and the 2 raw `type="date"` inputs (`AuditLogFilterBar.tsx:139,149`) get wrapped in `FormField` for label consistency, but the native `<input type=color/time/date>` stays — no shared primitive exists for these types.
- **D-06:** `InventoryPagePanel.tsx:353` (`type="number"`, `id="batch-delta"`) is a signed quantity-delta field (can go negative) — same shape as Phase 17's modifier-delta opt-out. Wrap in `FormField`, keep the native number input (not `MoneyInput`).
- **D-07:** `LogoUploader.tsx:77` (`type="file"`) stays untouched — no shared file-input primitive exists.

**Hardcoded color exemption (TOKEN-01)**
- **D-08:** `CategoryTreeEditor.tsx:465` (`'#6366f1'`), `CategoryForm.tsx:33,151` (`'#6B7280'`), and `ModifierSheet.tsx:22` (`'#808080'` fallback) are EXEMPT from TOKEN-01 — `category.color` is arbitrary per-row user data, not app theme color. Document the exemption inline at each site.

**Component-03 (duplicate primitives)**
- **D-09:** No live duplicate-primitive candidates were pre-identified — Phase 30 already removed `BackToHomeButton`/`AppShell`/`AppNav`. If the planner's own scan turns up a new one, treat it as in-scope. (UI-SPEC's own research pass found exactly one: `TableStatusPanel/index.tsx:382-395`.)

### Claude's Discretion

Not explicitly separated in CONTEXT.md — treat all `## Specific Ideas` content as discretion: "No UI-flow or visual-design changes requested — this is a like-for-like markup/token swap. No specific look-and-feel preferences beyond 'use what already exists in `shared/ui`.'"

### Deferred Ideas (OUT OF SCOPE)

- `src/pages/pos/index.tsx`, `src/widgets/OrderPanel/CartPanel.tsx`, `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` raw-button fixes — belongs to Phase 33 (COMPONENT-04).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOKEN-01 | Hardcoded hex/rgb color values replaced with existing Tailwind CSS-variable tokens | All 3 hits are `category.color` user data, EXEMPT per D-08 — deliverable is a documented inline comment at each of the 3 sites, no value change. Exact current lines confirmed below (Code Examples). |
| TOKEN-02 | Arbitrary-value spacing classes replaced with existing Tailwind spacing scale | **Zero violations** — confirmed by `DRIFT-AUDIT.md` and re-confirmed by grep in this research pass. No task needed for this requirement in Phase 31. |
| COMPONENT-01 | Raw `<button>` elements replaced with `POSButton` or correct shared primitive | 16 in-scope files (20 audited − 4 deferred to Phase 33) mapped file-by-file in `31-UI-SPEC.md`; exact current code for every file captured below. |
| COMPONENT-02 | Raw `<input>` elements replaced with correct shared form primitive, except documented signed-delta opt-outs | 8 in-scope files; 2 get real `Checkbox` swaps (D-04), 5 get `FormField` wraps with native input kept (D-05/D-06), 1 stays untouched (D-07). Exact current code + the FormField id-clobber pitfall captured below. |
| COMPONENT-03 | Duplicate one-off components shadowing an existing shared/ui primitive removed | 1 finding: `TableStatusPanel/index.tsx:382-395` — duplicate `POSButton` "Back to Pool Tables" block, superseded by `PageContainer`'s `backTo="/pool-tables"` (added Phase 30). Exact deletion boundaries + import cleanup confirmed below. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Raw `<button>` → shared primitive swap | Browser / Client (React component markup) | — | Pure presentational markup change inside existing FSD `features`/`widgets` components; no data flow, no server state, no new client-side logic |
| Raw `<input>` → `Checkbox`/`FormField` swap | Browser / Client | — | Same — controlled-input markup swap, existing `onChange`/`checked` handlers keep their signatures (only `Checkbox`'s `onCheckedChange` shape differs, still client-local state) |
| Hardcoded hex → token exemption comment | Browser / Client | — | Documentation-only change (JS/TS comment), zero runtime effect |
| Duplicate-button removal (`TableStatusPanel`) | Browser / Client | — | Deletes redundant JSX + now-unused icon import; the surviving navigation affordance (`PageContainer`'s `backTo`) is also Browser/Client tier, already shipped in Phase 30 |

No Frontend-Server, API/Backend, CDN, or Database tier is touched anywhere in this phase — 100% client-tier React markup, confirmed by CONTEXT.md's own framing ("markup/class-level only").

## Standard Stack

No new libraries. Every target primitive is already installed and in use elsewhere in the codebase.

### Core (already installed — confirmed via source read, not package install)

| Primitive | File | Purpose | Confirmed Usage Elsewhere |
|-----------|------|---------|---------------------------|
| `POSButton` | `src/shared/ui/POSButton.tsx` | Touch-optimized `Button` wrapper (44/56/72px `touchSize`), forwards all `ButtonProps` | `ModifierGroupEditor.tsx`, `CategoryTreeEditor.tsx`, `PoolTableGrid/index.tsx`, `TableStatusPanel/index.tsx`, 15+ other files |
| `Button` | `src/shared/ui/button.tsx` | shadcn CVA button, `variant` ∈ {default, outline, secondary, ghost, destructive, link}, `size` ∈ {default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg} | `AuditLogTable.tsx`, `HomeDashboard.tsx`, `SplitTabSheet.tsx` (line 747, `variant="outline" size="sm"`), `NotifyButton.tsx`, `WaitlistEntryCard.tsx` |
| `Checkbox` | `src/shared/ui/checkbox.tsx` | Radix `Checkbox.Root`/`Indicator` wrapper, `checked`/`onCheckedChange` (Radix `CheckedState = boolean \| 'indeterminate'`) | **[CORRECTION — see Assumptions Log A1]** Already used in `ModifierSheet.tsx:97`, `IngredientForm.tsx:272`, `ProductForm.tsx` (via `@shared/ui/checkbox` import), `ComboSlotCard.tsx:19` |
| `FormField` | `src/shared/ui/FormField.tsx` | Label+error+hint wrapper, clones its single child and injects `id`/`aria-invalid`/`aria-describedby` via `React.cloneElement` | `ModifierGroupEditor.tsx` ("Min selections"/"Max selections"), `CategoryTreeEditor.tsx` ("Color", already-compliant), `CategoryForm.tsx`, `AddWaitlistEntryForm.tsx`, `PrepProductionForm.tsx`, `ProductForm.tsx` |

**Installation:** none required — `npm install` step not applicable this phase.

## Package Legitimacy Audit

**N/A — this phase installs zero new packages.** All target primitives (`POSButton`, `Button`, `Checkbox`, `FormField`) are pre-existing files in `src/shared/ui/`, confirmed present and already consumed elsewhere in the codebase (see table above). No `npm install`, no registry check, no slopcheck run needed.

## Architecture Patterns

### System Architecture Diagram

```
Raw <button>/<input> in features/widgets JSX
        │
        ▼
  [markup swap only — same event handlers, same state]
        │
        ├─► Button/POSButton (src/shared/ui/button.tsx, POSButton.tsx)
        │     - preserves aria-label/aria-pressed/aria-expanded/data-testid verbatim
        │     - preserves existing className via cn() merge
        │
        ├─► Checkbox (src/shared/ui/checkbox.tsx)
        │     - checked={x} + onCheckedChange={c => setX(c === true)}
        │     - replaces checked={x} + onChange={e => setX(e.target.checked)}
        │
        └─► FormField (src/shared/ui/FormField.tsx)
              - wraps native <input type=color|time|date|number>
              - clones child, INJECTS its own useId()-generated `id`
                (overwrites any id prop already on the child — see Pitfall 1)
              - renders <label htmlFor={that-same-id}>{label}</label>
```

Every arrow above terminates in the same component file — there is no cross-file/cross-tier data flow introduced by this phase. The diagram is intentionally flat because the phase is a leaf-level markup substitution, not a feature.

### Recommended Task/Plan Grouping

The additional_context for this research explicitly asked for a grouping recommendation. Group by **primitive-type + file-independence**, not by page/route, because the changes are cross-cutting and mostly single-file:

| Group | Files | Why grouped together |
|-------|-------|----------------------|
| **A — Isolated leaf buttons** | `AgentButton.tsx`, `CommandChips.tsx`, `FileDropZone.tsx` (2 buttons), `CsvImportSheet.tsx`, `EmployeeSelector.tsx`, `PINLoginForm.tsx`, `ManageIngredientsTab/index.tsx`, `PoolTableGrid/index.tsx`, `ProductSalesPanel.tsx` (2 buttons), `AuditLogTable.tsx` | Each file has exactly one raw-button concern, no other in-scope change in the same file, no cross-file coupling. Safe to parallelize across multiple small plans/tasks. |
| **B — Card/tile selector buttons + COMPONENT-03 deletion** | `SeatPartySheet.tsx` (2 buttons), `HomeDashboard.tsx`, `TableStatusPanel/index.tsx` (1 row-remove button swap **+** the 382-395 duplicate-button deletion) | Higher-stakes a11y/testid preservation (`data-testid="home-tile-audit"`, `data-testid="lock-icon"`, `data-testid="pool-filters-toggle"` is actually Group A's PoolTableGrid — keep that one there); `TableStatusPanel` bundles two distinct fixes in one file so do them in the same task to avoid two diffs touching the same file in different plans. |
| **C — SplitTabSheet + ComboAvailabilityEditor button** | `SplitTabSheet.tsx` (3 buttons: 597, 693, 735), `ComboAvailabilityEditor.tsx:88` (day-chip button) | UI-SPEC explicitly calls out these two as "the same pattern" (dashed-border add-tile / pill toggle) — review together for consistency; `ComboAvailabilityEditor.tsx` also gets input changes (Group E), so this button fix and the input fix in the same file should land in the same task/commit. |
| **D — Checkbox swaps (COMPONENT-02/D-04)** | `ModifierGroupEditor.tsx` (2 checkboxes), `HardwareSettingsTab.tsx` (6 checkboxes, one `.map()`) | Same primitive, same `checked`/`onCheckedChange` contract, already-proven pattern from `IngredientForm.tsx`/`ModifierSheet.tsx` — cite that pattern directly instead of re-deriving. |
| **E — FormField wraps (COMPONENT-02/D-05/D-06)** | `CategoryTreeEditor.tsx` (comment-only, already compliant), `CategoryForm.tsx` (comment-only, already compliant), `ComboAvailabilityEditor.tsx` (2 time inputs, structural wrap — bundle with Group C's button fix in the same file), `AuditLogFilterBar.tsx` (2 date inputs, structural wrap **+ mandatory E2E selector fix**, see Pitfall 1), `InventoryPagePanel.tsx` (1 number input, structural wrap) | Same primitive (`FormField`), but risk varies per file — isolate `AuditLogFilterBar` as its own task given the load-bearing E2E dependency. |
| **F — TOKEN-01 exemption comments** | `ModifierSheet.tsx:22`, `CategoryTreeEditor.tsx:465`, `CategoryForm.tsx:33,151` | Trivial, comment-only, zero risk — could be its own tiny task or folded into whichever task already touches each file (`CategoryTreeEditor`/`CategoryForm` already appear in Groups C/E above). |

**Suggested wave shape:** Groups A, D, F have zero file overlap with each other or with B/C/E and can run in parallel plans/waves. Group E's `AuditLogFilterBar` sub-task should be sequenced with (or immediately followed by) an E2E test file edit — do not let it land in a "docs-only, no test changes" wave.

### Anti-Patterns to Avoid

- **Assuming `FormField` preserves a passed-in `id`:** It does not — `React.cloneElement(children, { id, ... })` always wins over whatever `id` prop the child element already had. See Pitfall 1.
- **Using `POSButton` for icon-only/chip/card controls:** `POSButton` adds `min-h-[44px] active:scale-95` which visually regresses a 20px icon button or a `rounded-full` FAB. UI-SPEC already encodes this correctly (`Button` for those cases) — do not "upgrade" them to `POSButton` for consistency's sake.
- **Removing the `useNavigate` import from `TableStatusPanel/index.tsx`:** Confirmed still used at lines 113, 122, 178, 407, 422 (all `navigate('/pos')` or `navigate('/pool-tables')` calls outside the deleted block). Only the `ArrowLeft` icon import becomes unused.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox with visible checkmark + focus ring + disabled state | A new styled `<input type="checkbox">` wrapper | `src/shared/ui/checkbox.tsx` (Radix-based) | Already solves focus-visible ring, `aria-invalid`, `data-checked` styling, and is proven in 4 existing consumers — copy their exact `checked`/`onCheckedChange` pattern, don't re-derive from Radix docs |
| Label/error/hint wrapper for a native input | A bespoke `<div><label/><input/><p/></div>` block | `src/shared/ui/FormField.tsx` | Already the established pattern (7 existing consumers) — but see Pitfall 1 before using it on any input with an externally-referenced `id` |

**Key insight:** Every "don't hand-roll" target in this phase is already hand-built once (correctly) in `src/shared/ui/` — the task is purely "stop building a second copy," never "build the first copy."

## Common Pitfalls

### Pitfall 1: `FormField` silently overwrites any `id` prop on its child — breaks a load-bearing E2E selector

**What goes wrong:** `AuditLogFilterBar.tsx:139-158` currently renders two bare `<input type="date" id="audit-filter-date-from" aria-label="Date from" .../>` elements. `e2e/38-audit-logs.spec.ts:231` locates the first one by `page.locator('#audit-filter-date-from')`. UI-SPEC's plan is to wrap each in `<FormField label="Date from"><input id="audit-filter-date-from" type="date" .../></FormField>` and drop the now-redundant `aria-label`.

`FormField.tsx`'s implementation is:
```tsx
const id = React.useId();
...
React.cloneElement(children, { id, 'aria-invalid': ..., 'aria-describedby': ... })
```
`React.cloneElement(element, config)` merges `config` into the element's existing props, with `config` **taking priority** for any key present in both. Since `FormField` always passes `id` in its `cloneElement` call, the DOM will end up with React's auto-generated id (e.g. `:r3a:`), not `audit-filter-date-from` — regardless of what `id` prop the caller passed into the `<input>` JSX.

**Why it happens:** `FormField` was designed for the common case (no consumer currently passes an explicit `id` — confirmed: all 7 existing `FormField` consumers omit `id` on the child and let `FormField` own the label/id pairing entirely). `AuditLogFilterBar` is the first case where an existing explicit `id` has an external dependent (the E2E test), and UI-SPEC's file-by-file table did not account for `FormField`'s clobber behavior.

**How to avoid:** Pick one:
1. **(Recommended)** Update `e2e/38-audit-logs.spec.ts:231` to `page.getByLabel('Date from')` instead of `page.locator('#audit-filter-date-from')`. `FormField` renders a real `<label htmlFor={autoId}>Date from</label>` paired with the auto-generated id, so `getByLabel` resolves correctly without caring what the id actually is. This is arguably a **better** test (asserts by accessible name, not implementation-detail id) and is in scope to touch (this spec is not in COMPONENT-04's payment-critical protected list).
2. Skip the `FormField` wrap for the date-from input specifically and instead manually add a visible `<label htmlFor="audit-filter-date-from">Date from</label>` above the existing input, keeping its explicit `id` — achieves the same visible-label goal without going through `FormField`'s auto-id machinery. Slightly inconsistent with D-05's stated approach but zero E2E risk.
3. Do the `FormField` wrap as UI-SPEC describes, but plan a follow-up commit in the same task that fixes the E2E selector — do NOT ship the wrap without the test fix in the same task, or CI will show a new failure with no obvious cause.

`AuditLogFilterBar.tsx:149-158`'s date-to input has no external `id` reference found (grepped `src/` and `e2e/` — zero hits for `audit-filter-date-to`), so it carries no equivalent risk, but apply the same fix approach for consistency.

`ComboAvailabilityEditor.tsx`'s `startId`/`endId` (from `useId()`) and `InventoryPagePanel.tsx`'s `batch-delta` id have **no external references** (grepped, confirmed) — their existing sibling `<label htmlFor>` gets replaced by `FormField`'s own label, so the id clobber is harmless there. Only `AuditLogFilterBar`'s date-from input is a real risk.

**Warning signs:** Any `grep -rn 'locator\|getByTestId\|querySelector' e2e/ src/**/*.test.*` hit on an `id` string that also appears as a prop on an input about to be wrapped in `FormField`.

### Pitfall 2: CONTEXT.md/UI-SPEC's "checkbox.tsx has zero consumers" premise is factually wrong

**What goes wrong:** Nothing breaks from this — it's a documentation inaccuracy, not a code risk — but a planner or executor who trusts it at face value might be overly cautious about wiring in "an unproven primitive," when in fact the primitive is already proven in production code.

**Why it happens:** CONTEXT.md was written from an audit-time snapshot; `src/shared/ui/checkbox.tsx` is in fact imported and used in 4 files: `src/features/add-item-to-tab/ui/ModifierSheet.tsx:97`, `src/features/manage-ingredients/ui/IngredientForm.tsx:272`, `src/features/manage-products/ui/ProductForm.tsx`, `src/shared/ui/ComboSlotCard/ComboSlotCard.tsx:19`.

**How to avoid:** Treat D-04's swap as low-risk — copy the exact pattern already used in `IngredientForm.tsx:272-278` (`checked={x}` + `onCheckedChange={checked => setX(checked === true)}`), which is the same shape UI-SPEC already prescribes. No new integration risk, no Storybook/manual-only caveat needed beyond what UI-SPEC's own States Checklist already lists.

**Warning signs:** N/A — this is a correction, not a live bug. Flagged for the planner's awareness and to prevent an unnecessarily conservative task breakdown (e.g. an unneeded "spike" task to de-risk `Checkbox`).

### Pitfall 3: `Radix` `CheckedState` is not a plain boolean

**What goes wrong:** Writing `onCheckedChange={setIsRequired}` directly (type mismatch: Radix's `CheckedState = boolean | 'indeterminate'`, but `setIsRequired: (v: boolean) => void`) or writing `onCheckedChange={c => setIsRequired(!!c)}` (subtly wrong — `!!'indeterminate'` is `true`, which may not be the intended semantics for a non-tristate checkbox).

**Why it happens:** Radix's checkbox primitive supports a 3-state indeterminate value even when the consumer never sets `checked="indeterminate"`.

**How to avoid:** Always write `onCheckedChange={(c) => setX(c === true)}` — explicit `=== true` comparison, never truthy-cast. This is the exact pattern already used in `IngredientForm.tsx:275` and `ModifierSheet.tsx` (need to re-check ModifierSheet's exact handler — not required for this phase, that file's checkbox isn't in the D-04 scope) and matches UI-SPEC's own prescription.

**Warning signs:** TypeScript will not error on `!!c` (it's valid), so this bug is a runtime-logic bug, not a compile-time one — code review must catch it explicitly.

## Code Examples

### Existing `Checkbox` pattern to copy verbatim (D-04)

```tsx
// Source: src/features/manage-ingredients/ui/IngredientForm.tsx:272-278 (already in production)
<Checkbox
  id="ing-is-prep"
  checked={isPrep}
  onCheckedChange={checked => {
    setIsPrep(checked === true);
  }}
  disabled={isPending}
/>
```

Apply the same shape to `ModifierGroupEditor.tsx:254-261` (replacing `checked={isRequired}` / `onChange={e => setIsRequired(e.target.checked)}`) and `:335-343` (replacing the per-modifier `onChange={() => toggle(m.id)}` with `onCheckedChange={() => { toggle(m.id); }}` — the handler ignores its argument today and can keep doing so), and to `HardwareSettingsTab.tsx:147-155`'s mapped array (replacing `onChange={e => patchReceipt({ [key]: e.target.checked })}` with `onCheckedChange={(c) => { patchReceipt({ [key]: c === true }); }}`).

### Current raw `<button>` excerpts for every in-scope file (for planner `<read_first>` blocks)

```tsx
// src/features/agent-chat/ui/AgentButton.tsx:12-22 — icon-only FAB
<button
  type="button"
  onClick={toggle}
  aria-label="Abrir asistente IA"
  className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
>
  {hasUnread && <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />}
  <Bot className="size-6" />
</button>

// src/features/agent-chat/ui/CommandChips.tsx:23-30 — pill chip
<button
  key={chip}
  type="button"
  onClick={() => { onSelect(chip); }}
  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  {chip}
</button>

// src/features/agent-chat/ui/FileDropZone.tsx:152-169 — 2 icon-only buttons (mic toggle, send)
<button type="button" onClick={toggleVoice} disabled={disabled} aria-label={isListening ? 'Detener grabación de voz' : 'Iniciar grabación de voz'}
  className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
  {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
</button>
<button type="button" onClick={handleSend} disabled={disabled || !text.trim()} aria-label="Enviar mensaje"
  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
  <Send className="size-4" />
</button>

// src/features/import-ingredients-csv/ui/CsvImportSheet.tsx:216-223 — text link
<button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
  <Download className="size-3.5" />
  Download template
</button>

// src/features/manage-categories/ui/CategoryTreeEditor.tsx:166-176 — icon-only expand/collapse
<button type="button" aria-label={isExpanded ? `Collapse ${category.name}` : `Expand ${category.name}`}
  className={['flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground',
    'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    !hasChildren ? 'invisible pointer-events-none' : ''].join(' ')}
  onClick={() => { /* ... */ }}>
  {/* chevron icon, tabIndex={-1} on the element (confirm exact line if present) */}
</button>

// src/features/manage-combos/ui/ComboAvailabilityEditor.tsx:88-103 — day-of-week toggle chip
<button key={iso} type="button" aria-pressed={selected} onClick={() => { onToggleDay(idx, iso); }}
  className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${
    selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-accent'
  }`}>
  {label}
</button>

// src/features/seat-waitlist-party/ui/SeatPartySheet.tsx:119-133 — available table tile (selectable)
<button key={table.id} type="button" aria-pressed={selectedTableId === table.id}
  className={cn('rounded-lg border p-4 text-left transition-colors',
    selectedTableId === table.id ? 'border-pos-accent bg-pos-accent/10' : 'hover:bg-accent')}
  onClick={() => { setSelectedTableId(table.id); }}>
  <span className="text-base font-semibold">Table {table.number} – {table.label}</span>
</button>
// :144-153 — occupied table tile (disabled)
<button key={table.id} type="button" disabled aria-label={`Table ${String(table.number)} – ${table.label}: occupied`}
  className="rounded-lg border p-4 text-left opacity-50 cursor-not-allowed">
  <span className="text-base font-semibold">Table {table.number} – {table.label}</span>
  <span className="block text-sm text-muted-foreground">Occupied</span>
</button>

// src/features/split-tab/ui/SplitTabSheet.tsx:597-605 — "Add check" dashed tile
<button type="button" className="min-w-[140px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
  onClick={addItemColumn} aria-label="Add sub-check column">
  <Plus className="h-5 w-5" /><span className="text-sm">Add check</span>
</button>
// :693-701 — "Add person" dashed tile (identical shape, different handler/label)
<button type="button" className="min-w-[140px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
  onClick={addPersonColumn} aria-label="Add person">
  <Plus className="h-5 w-5" /><span className="text-sm">Add person</span>
</button>
// :735-744 — icon-only row-remove (conditionally rendered when amountRows.length > 2)
{amountRows.length > 2 && (
  <button type="button" onClick={() => { removeAmountRow(row.id); }} aria-label={`Remove check ${String(i + 1)}`}>
    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
  </button>
)}
// :747-753 — sibling compliant Button in the SAME file (already uses shared/ui/button) — copy this pattern's variant/size for the row-remove fix
<Button variant="outline" size="sm" onClick={addAmountRow} className="w-full">
  <Plus className="h-4 w-4 mr-2" />Add check
</Button>

// src/widgets/AuditLogTable/AuditLogTable.tsx:69-78 — sr-only diff trigger (load-bearing a11y name, e2e/38-audit-logs.spec.ts)
<button type="button" className="sr-only" aria-label={`View diff for ${auditLog.action} on ${formatAuditDate(auditLog.createdAt)}`}
  onClick={() => { openSheet(auditLog); }}>
  View diff
</button>
// NOTE: this file already imports `Button` from '@shared/ui/button' (line 21) — no new import needed, just swap the tag

// src/widgets/EmployeeSelector/EmployeeSelector.tsx:31-46 — staff card tile
<button key={member.id} type="button" onClick={() => { setSelectedStaff(member); }}
  className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:bg-accent transition-colors">
  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">{member.name.charAt(0).toUpperCase()}</div>
  <div><div className="font-semibold">{member.name}</div><div className="text-sm text-muted-foreground capitalize">{member.role}</div></div>
</button>

// src/widgets/HomeDashboard/ui/HomeDashboard.tsx:156-190 — large nav tile (data-testid, Lock/Badge overlays)
<button key={item.path} type="button" onClick={() => { handleItemClick(item); }}
  className="relative flex min-h-[160px] min-w-[160px] flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 shadow transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  aria-label={item.label} data-testid={item.path === '/audit' ? 'home-tile-audit' : undefined}>
  {isGated && <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" data-testid="lock-icon" />}
  <div className="relative"><Icon className="h-12 w-12" />{/* Badge overlay for waitlist count */}</div>
  <span className="text-center text-sm font-medium">{item.label}</span>
  {isGated && item.managerLabel && <Badge variant="secondary" className="text-xs">{item.managerLabel}</Badge>}
</button>
// NOTE: file already imports { Badge, Button } from '@shared/ui' (line 28) — Button import already present, no new import line needed

// src/widgets/ManageIngredientsTab/index.tsx:268-276 — text link
<button type="button" className="text-xs text-primary underline-offset-4 hover:underline"
  onClick={() => { setDialogState({ kind: 'adjust', ingredient: dialogState.ingredient }); }}>
  Record adjustment
</button>

// src/widgets/PINLoginForm/PINLoginForm.tsx:254-260 — text link
<button type="button" onClick={clearSelection} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
  Not you? Go back
</button>

// src/widgets/PoolTableGrid/index.tsx:120-134 — disclosure toggle (data-testid + aria-expanded, load-bearing)
<button type="button" data-testid="pool-filters-toggle" aria-expanded={!filtersCollapsed}
  onClick={() => { setFiltersCollapsed(prev => !prev); }}
  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
  {filtersCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
  Filters
</button>
// NOTE: file already imports { EmptyState, POSButton, PoolTableGridSkeleton, ProtectedAction } from '@shared/ui' (line 20) — add Button to this same import line

// src/widgets/ProductSalesPanel/ProductSalesPanel.tsx:94-119 — sort-toggle pill pair
<button type="button" onClick={() => { setSortBy('revenue'); }}
  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
    sortBy === 'revenue' ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground hover:bg-muted'
  }`}>
  By Revenue
</button>
<button type="button" onClick={() => { setSortBy('units'); }}
  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
    sortBy === 'units' ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground hover:bg-muted'
  }`}>
  By Units
</button>

// src/widgets/TableStatusPanel/index.tsx:244-254 — icon-only row-remove
<button type="button" className="text-muted-foreground hover:text-destructive ml-1 rounded p-1 transition-colors" title="Remove item"
  onClick={() => { setSelectedItemForRemoval(item); setShowPinForRemoval(true); }}>
  <X className="size-4" />
</button>
```

### `TableStatusPanel` COMPONENT-03 duplicate-button deletion — exact boundaries

```tsx
// src/widgets/TableStatusPanel/index.tsx:1 — import line BEFORE fix
import { AlertCircle, ArrowLeft, Clock, DollarSign, X } from 'lucide-react';
// AFTER fix — ArrowLeft removed (confirmed used ONLY at line 392, inside the deleted block):
import { AlertCircle, Clock, DollarSign, X } from 'lucide-react';

// Lines 382-395 — DELETE THIS ENTIRE BLOCK, nothing replaces it:
      {/* Back button */}
      <div>
        <POSButton
          type="button"
          variant="ghost"
          touchSize="default"
          onClick={() => {
            navigate('/pool-tables');
          }}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to Pool Tables
        </POSButton>
      </div>

// DO NOT remove useNavigate/navigate — confirmed still used at lines 113, 122
// (navigate('/pos')) and 178, 407, 422 (navigate('/pool-tables')), all OUTSIDE
// the deleted block.
```

### `FormField` wrap pattern (D-05/D-06) — verified against source

```tsx
// src/shared/ui/FormField.tsx (relevant excerpt) — confirms the id-clobber behavior in Pitfall 1
export function FormField({ label, error, required = false, hint, children, className }: FormFieldProps) {
  const id = React.useId();
  ...
  {React.isValidElement(children) &&
    React.cloneElement(children, {
      id,                              // <-- always wins over any id already on the child
      'aria-invalid': error ? 'true' : 'false',
      ...(cn(error && errorId, hint && hintId).trim() && { 'aria-describedby': ... }),
    })}
  <label htmlFor={id} className="text-sm font-medium text-foreground">{label}...</label>
```

### Existing 3 TOKEN-01 hex-color sites (exact current lines, for the exemption-comment task)

```ts
// src/features/add-item-to-tab/ui/ModifierSheet.tsx:22
color: '#808080',

// src/features/manage-categories/ui/CategoryTreeEditor.tsx:465
: { name: '', color: '#6366f1', routing: 'NONE' }

// src/features/manage-products/ui/CategoryForm.tsx:33
const [color, setColor] = useState(initialCategory?.color ?? '#6B7280');
// src/features/manage-products/ui/CategoryForm.tsx:151
placeholder="#6B7280"
```

### Raw `<input>` current excerpts (D-04/D-05/D-06/D-07, exact lines)

```tsx
// ModifierGroupEditor.tsx:253-263 — checkbox #1
<label className="flex items-center gap-2 text-sm">
  <input type="checkbox" checked={isRequired} onChange={e => { setIsRequired(e.target.checked); }}
    className="size-4 rounded border-border" />
  Required (customer must select)
</label>

// ModifierGroupEditor.tsx:335-343 — checkbox #2 (per-modifier, explicit id pairing)
<input type="checkbox" id={`mod-${m.id}`} checked={selected.has(m.id)} onChange={() => { toggle(m.id); }}
  className="size-4 rounded border-border" />
<label htmlFor={`mod-${m.id}`} className="flex flex-1 items-center gap-2 text-sm">...</label>

// HardwareSettingsTab.tsx:135-159 — 6 mapped checkboxes
{([{ key: 'showCashierName', label: 'Show cashier name' }, /* ...5 more */] as const).map(({ key, label }) => (
  <div key={key} className="flex items-center gap-3">
    <input type="checkbox" id={`receipt-${key}`} checked={receipt[key]}
      onChange={e => { patchReceipt({ [key]: e.target.checked }); }}
      className="h-4 w-4 rounded border-input accent-primary" />
    <Label htmlFor={`receipt-${key}`}>{label}</Label>
  </div>
))}

// CategoryTreeEditor.tsx:82-95 — color, ALREADY inside FormField (structurally compliant, comment-only fix)
<FormField label="Color">
  <div className="flex items-center gap-3">
    <input id="cat-color" type="color" value={color} onChange={e => { setColor(e.target.value); }}
      className="h-9 w-16 cursor-pointer rounded border border-border bg-transparent p-0.5" />
    <span className="text-sm text-muted-foreground">{color}</span>
  </div>
</FormField>

// CategoryForm.tsx:128-155 — color, ALREADY inside FormField (structurally compliant, comment-only fix)
<FormField label="Color" required error={fieldErrors.color ?? ''} hint="Hex or use the picker">
  <div className="flex flex-wrap items-center gap-2">
    <input type="color" aria-label="Color picker" className="h-9 w-14 cursor-pointer rounded border bg-transparent p-0"
      value={color.startsWith('#') ? color.slice(0, 7) : `#${color}`.slice(0, 7)}
      onChange={e => { setColor(e.target.value.toUpperCase()); }} disabled={submitting} />
    <Input className="max-w-[9rem] font-mono text-sm" value={color} onChange={e => { setColor(e.target.value); }}
      placeholder="#6B7280" disabled={submitting} />
  </div>
</FormField>

// ComboAvailabilityEditor.tsx:107-138 — 2 time inputs, NOT yet in FormField (bare label+input pairs)
<label htmlFor={startId} className="text-xs text-muted-foreground">From</label>
<input id={startId} type="time" value={draft.startTime} onChange={e => { onSetStartTime(idx, e.target.value); }}
  className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
<label htmlFor={endId} className="text-xs text-muted-foreground">To</label>
<input id={endId} type="time" value={draft.endTime} onChange={e => { onSetEndTime(idx, e.target.value); }}
  className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
{hasTimeError && <p className="text-sm text-destructive">End time must be after start time</p>}
// startId/endId are from `const startId = useId(); const endId = useId();` — NOT externally referenced (no test hits)

// AuditLogFilterBar.tsx:139-158 — 2 date inputs, NOT yet in FormField, id IS load-bearing (Pitfall 1)
<input type="date" id="audit-filter-date-from" aria-label="Date from" value={toDateInputValue(staged.dateFrom)}
  onChange={e => { setDateFrom(e.target.value); }} className={DATE_INPUT_CLASS} />
<input type="date" id="audit-filter-date-to" aria-label="Date to" value={toDateInputValue(staged.dateTo)}
  onChange={e => { setDateTo(e.target.value); }} className={DATE_INPUT_CLASS} />

// InventoryPagePanel.tsx:349-363 — quantity delta, NOT yet in FormField, id NOT externally referenced
<label htmlFor="batch-delta" className="text-sm font-medium">Quantity delta</label>
<input id="batch-delta" type="number" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
  value={batchDelta} onChange={e => { setBatchDelta(e.target.value); }} />
<p className="text-xs text-muted-foreground">Use negative numbers to remove stock.</p>

// LogoUploader.tsx:75-90 — file input, ALREADY compliant (Label present), D-07 no-op
<Label htmlFor="logo-upload-input">Logo file</Label>
<input ref={inputRef} id="logo-upload-input" data-testid="logo-uploader-input" type="file"
  accept="image/png,image/jpeg" disabled={busy} onChange={e => { /* ... */ }} className="block text-sm" />
```

## State of the Art

Not applicable — no external library/version changes in this phase. All primitives are already at their current in-repo state; no upstream migration involved.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CONTEXT.md/UI-SPEC state `checkbox.tsx` has "currently zero consumers" — **research verified this is FALSE** via `grep` (4 existing consumers found: `ModifierSheet.tsx`, `IngredientForm.tsx`, `ProductForm.tsx`, `ComboSlotCard.tsx`). This is a `[VERIFIED: codebase grep]` correction, not an `[ASSUMED]` claim — listed here for visibility since it contradicts an upstream doc. | Standard Stack, Pitfall 2 | None — this correction only *reduces* risk (proves the primitive is stable in production); a planner who doesn't see this correction might over-scope a "verify Checkbox works" spike task that isn't needed. |
| A2 | `ComboAvailabilityEditor.tsx`'s `startId`/`endId` and `InventoryPagePanel.tsx`'s `batch-delta` id have no external references — `[VERIFIED: grep across src/ and e2e/]`, not assumed. Listed for completeness of the id-clobber risk assessment (Pitfall 1). | Pitfall 1 | If a future hidden reference exists outside grep's reach (e.g. a Playwright test using a dynamic/computed selector string), the `FormField` wrap could silently break it the same way it would break `AuditLogFilterBar`'s. Low likelihood — grep covered both `src/` and `e2e/` exhaustively for the literal strings. |

**If this table is empty:** N/A — 2 entries above, both are research corrections/verifications rather than unverified guesses. No CONTEXT.md-locked decision in this phase rests on unverified `[ASSUMED]` ground — D-01 through D-09 are all either direct code inspection or explicit user decisions.

## Open Questions (RESOLVED)

1. **Does `CategoryTreeEditor.tsx:166`'s expand/collapse button have a `tabIndex={-1}` attribute, as UI-SPEC claims ("`tabIndex={-1}` and `aria-label` must be preserved verbatim")?**
   - What we know: The button's `aria-label`, conditional `className`, and `onClick` were confirmed by direct read (see Code Examples) — `tabIndex` was not visible in the read window shown (lines 166-176 cut off before any `tabIndex` prop would appear, if present later in the element's prop list).
   - What's unclear: Whether `tabIndex={-1}` is actually present in the source today, or whether UI-SPEC's researcher saw it in a slightly different context.
   - Recommendation: Planner/executor should re-read `CategoryTreeEditor.tsx` lines 166-180 in full immediately before writing this task's diff, and preserve whatever attributes are actually present — do not add or remove `tabIndex` speculatively.
   - **RESOLVED:** 31-03-PLAN.md Task 3 instructs the executor to re-read lines 166-180 in full before editing and preserve whatever attributes are actually present — matches the recommendation exactly.

2. **Should the `AuditLogFilterBar` E2E fix (Pitfall 1) be its own task, or folded into the FormField-wrap task?**
   - What we know: The wrap and the test fix must land together (shipping one without the other breaks CI).
   - What's unclear: Whether the project's task-granularity convention prefers "one task = one file" (would need `AuditLogFilterBar.tsx` + `e2e/38-audit-logs.spec.ts` in the same task) or a stricter separation.
   - Recommendation: Same task/commit for both files — this is a correctness dependency, not a style preference.
   - **RESOLVED:** 31-06-PLAN.md Task 1 folds both files into one atomic task — confirmed by plan-checker's VERIFICATION PASSED.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit) + React Testing Library + Playwright 1.59 (E2E) |
| Config file | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) |
| Quick run command | `npm run test` (unit, run-once) |
| Full suite command | `npm run test` (unit) + `npm run test:e2e` (E2E, requires dev server + `.env.local` creds) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMPONENT-01 | Every swapped button still renders with same accessible name/role, same click behavior | unit (existing) | `npx vitest run src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx src/widgets/AuditLogTable/AuditLogTable.test.tsx` | ✅ (2 of 16 button files have unit coverage; the other 14 have none — manual/Storybook spot-check per UI-SPEC's States Checklist) |
| COMPONENT-01 (`PoolTableGrid`, `AuditLogTable`'s sr-only button, `HomeDashboard`'s tiles) | `data-testid`/`aria-label`/`aria-expanded` preserved | E2E (existing) | `npx playwright test e2e/38-audit-logs.spec.ts e2e/15-home-navigation.spec.ts` | ✅ |
| COMPONENT-02 (`AuditLogFilterBar` date-from) | Filter input still locatable and fillable after `FormField` wrap | E2E (existing, **needs selector update per Pitfall 1**) | `npx playwright test e2e/38-audit-logs.spec.ts -g "date range filter"` | ✅ — but will FAIL until the `#audit-filter-date-from` locator is updated (Pitfall 1) |
| COMPONENT-02 (`ModifierGroupEditor` checkboxes) | Round-trips `checked`/`onCheckedChange` correctly | manual/Storybook (no unit file exists) | N/A — no automated test file found for `ModifierGroupEditor` | ❌ Wave 0 gap (pre-existing, not introduced by this phase) |
| COMPONENT-02 (`InventoryPagePanel` batch-delta) | Still accepts and submits negative values after `FormField` wrap | manual (no unit file exists) | N/A | ❌ Wave 0 gap (pre-existing) |
| COMPONENT-03 (`TableStatusPanel` duplicate button removal) | `/pool-table-status` still has exactly one way back to `/pool-tables` | E2E (existing) | `npx playwright test e2e/16-table-status.spec.ts` | ✅ — **NOTE: this spec had pre-existing live-Supabase-RPC-latency flakiness documented in Phase 30's SUMMARY (120s timeout on "Start Session"), unrelated to this phase's change; do not treat pre-existing flake as a new regression** |
| TOKEN-01 | Exemption comment present at all 3 sites, no value change | manual code review (no automated lint exists yet — that's Phase 35's `LINT-01`) | N/A | ❌ intentional — Phase 35 adds the drift-lint, not this phase |
| TOKEN-02 | Zero violations, no task needed | N/A | N/A | N/A |

### Sampling Rate

- **Per task commit:** `npm run typecheck && npm run lint && npx vitest run <touched test files, if any>`
- **Per wave merge:** `npm run test` (full unit suite) + targeted `npx playwright test e2e/38-audit-logs.spec.ts e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts` (the 3 specs with load-bearing selectors/testids touched by this phase)
- **Phase gate:** Full unit suite green + the 3 targeted E2E specs green before `/gsd-verify-work`. Full `npm run test:e2e` (all 22 specs) is optional per CLAUDE.md's "run manually before releases" policy, but given this phase touches shared page chrome (`HomeDashboard`, `PoolTableGrid`), running the full suite once at phase-gate is recommended over skipping it.

### Wave 0 Gaps

- `ModifierGroupEditor.test.tsx` — no file exists; D-04's checkbox swap and D-06-style delta-field precedent (Phase 17) both rely on manual verification only. Not required to backfill this phase (out of scope per CONTEXT.md's "no new tests" framing — this is a pure markup phase), but flag as a pre-existing gap.
- `AuditLogFilterBar.test.tsx` / `InventoryPagePanel.test.tsx` / `HardwareSettingsTab.test.tsx` / `TableStatusPanel.test.tsx` / `PoolTableGrid.test.tsx` — none exist. Same as above.
- **Not a gap to fill in this phase** — UI-SPEC's own States Checklist already scopes verification to "Storybook or dev server spot-check" for exactly these files, consistent with the "zero new tests" framing of a pure conformance sweep.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per protocol), but this phase has essentially zero security surface:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — no auth logic touched |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | Unchanged — `ProtectedAction`/RBAC gating on `HardwareSettingsTab`, `TableStatusPanel`, etc. is untouched by a markup-only swap |
| V5 Input Validation | No change | The `Checkbox`/`FormField` swaps do not alter validation logic — `checked === true` comparison is a UI-state concern, not a security boundary; underlying Zod schemas (`domain.ts`) are untouched |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

None newly introduced. This phase performs no new data intake, no new network calls, no new dynamic HTML (`dangerouslySetInnerHTML` is not used anywhere in the touched files, confirmed by the code excerpts above — every touched element is either an icon, a plain-text label, or a controlled input bound to existing React state).

## Sources

### Primary (HIGH confidence — direct codebase read, this session)

- `src/shared/ui/POSButton.tsx`, `button.tsx`, `checkbox.tsx`, `FormField.tsx` — full source read, confirms prop contracts and the `FormField` id-clobber behavior (Pitfall 1)
- All 16 in-scope button files + 8 input files + 3 hex-color files — direct read at the exact lines cited in `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md`
- `e2e/38-audit-logs.spec.ts:231` — confirms the load-bearing `#audit-filter-date-from` locator
- `src/features/manage-ingredients/ui/IngredientForm.tsx:272-278`, `src/features/add-item-to-tab/ui/ModifierSheet.tsx:97` — confirms `Checkbox` is already in production use (corrects CONTEXT.md's A1 claim)
- Grep of `src/` and `e2e/` for `audit-filter-date`, `batch-delta`, `startId`, `endId` — confirms which `id`s have external dependents and which don't

### Secondary (MEDIUM confidence)

None used — no WebSearch/Context7 lookups were needed since every fact required is directly verifiable in this repository.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — every primitive read directly from source, zero external dependency
- Architecture: HIGH — flat, single-tier, fully traceable to CONTEXT.md/UI-SPEC's own decisions
- Pitfalls: HIGH — Pitfall 1 (FormField id-clobber) verified by reading `FormField.tsx`'s actual `cloneElement` call and cross-referencing the E2E spec's literal locator string; Pitfall 2 (checkbox consumer count) verified by grep

**Research date:** 2026-07-11
**Valid until:** Effectively indefinite for this phase's scope (pure internal-repo facts, no external library version drift risk) — but re-verify file line numbers if any other phase/plan touches these same files before Phase 31 executes.
