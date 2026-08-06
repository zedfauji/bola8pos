---
created: 2026-08-04T00:00:00.000Z
title: MoneyInput fields inside FormField have no working label association
area: accessibility
severity: minor
files:
  - src/shared/ui/MoneyInput.tsx
  - src/shared/ui/FormField.tsx
  - src/features/manage-products/ui/ProductForm.tsx:253-255
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/21-product-management.spec.ts` PM3
("create product ... at $9.99").

`FormField` (`src/shared/ui/FormField.tsx`) associates its rendered `<label>` with its
child input by cloning the child with a generated `id` (`React.cloneElement(children, {
id, ... })`). This works for plain `<Input>`/`<select>` children, which accept and
forward an `id` prop straight to the underlying DOM element.

`MoneyInput` (`src/shared/ui/MoneyInput.tsx`) does not accept an `id` prop at all — its
prop type (`MoneyInputProps`) has no `id` field, so FormField's cloned-in `id` is
silently dropped. `MoneyInput` instead generates its own internal `inputId` via
`useId()` and only renders a connected `<Label>` if its own `label` prop is passed
explicitly. Every current caller that wraps `MoneyInput` in an external `FormField`
(e.g. `ProductForm.tsx:253-255`'s "Base price" field) does NOT pass `MoneyInput`'s own
`label` prop, relying on the ineffective FormField wiring instead — so the underlying
`<input>` ends up with a generic `aria-label="Money amount"` (the `!label` fallback
branch) instead of being programmatically associated with FormField's actual "Base
price"/"Happy hour price"/etc. text at all.

Effect: `getByLabel(/base price/i)` (or any screen reader / label-click interaction)
cannot find these fields by their visible label text — only a generic "Money amount" is
exposed. Confirmed by E2E: the outer FormField's `<label>` is real, but clicking it does
not focus the input, and Playwright's `getByLabel()` never resolves for these fields
during PM3.

## Solution

TBD. Options to evaluate:
- Add an `id` prop to `MoneyInputProps` and forward it to the underlying `<Input
  id={id ?? inputId} ...>`, so `FormField`'s cloned-in `id` takes effect the same way it
  does for a plain `<Input>`.
- Or: stop using `FormField` around `MoneyInput` entirely and instead pass `MoneyInput`'s
  own `label` prop everywhere it's currently wrapped (`ProductForm.tsx` and any other
  callers), so the working internal `<Label htmlFor={inputId}>` path is used consistently
  instead of two parallel, only-one-of-which-works labeling mechanisms.
