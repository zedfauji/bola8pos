---
created: 2026-08-04T00:47:18.000Z
title: Tab customer name 100-char cap not enforced anywhere in the open-tab flow
area: validation
severity: minor
files:
  - src/features/open-tab/ui/OpenTabDialog.tsx (client Zod schema — only min(1), no max(100))
  - src/entities/tab/model/queries.ts (useMutationOpenTab — inserts input.customerName verbatim, no domain.ts validation before insert)
  - src/shared/lib/domain.ts:433 (canonical TabSchema.customerName: z.string().min(1).max(100) — documented but not applied on this path)
  - supabase/migrations/20260414000004_tabs_and_orders.sql:8 (customer_name VARCHAR(255) — DB column itself allows up to 255, no CHECK constraint for 100)
  - .planning/phases/39-ai-slob-technical-debt-remediation/39-06-LEDGER.md (evidence — FV3 finding)
---

## Problem

`domain.ts`'s `TabSchema.customerName: z.string().min(1).max(100)` is CLAUDE.md's
declared single source of truth for the tab-name length boundary, but the actual
open-tab submission path does not enforce it anywhere:

- **Client form** (`OpenTabDialog.tsx`'s local `buildFormSchema()`): only
  `z.string().trim().min(1, ...)` — no `.max(100)`, and no `maxLength` HTML
  attribute on the input either.
- **Mutation** (`useMutationOpenTab` in `entities/tab/model/queries.ts`): passes
  `input.customerName` straight into the Supabase insert with no validation
  against `domain.ts`'s `TabSchema` first.
- **DB column** (`tabs.customer_name VARCHAR(255)`): permits up to 255
  characters, and carries no `CHECK` constraint enforcing the documented
  100-char cap.

Discovered during Phase 39 E2E triage (`e2e/26-field-validation.spec.ts` FV3:
"tab name of 101 chars — form error or input capped at 100"). A 101-character
name is accepted end-to-end with no error and no truncation, silently
exceeding the documented contract by up to 155 characters.

Confirmed via source read (not just the failing test): no layer in the actual
submission path — client Zod schema, mutation hook, or DB constraint —
enforces the max(100) that `domain.ts` documents as canonical.

## Solution

TBD — pick one and make it consistent everywhere:
1. Add `.max(100, ...)` to `OpenTabDialog.tsx`'s `buildFormSchema()` (and
   optionally a `maxLength={100}` on the input for the same instant-feedback
   pattern already used elsewhere) so the client enforces what `domain.ts`
   documents, or
2. If 100 chars was never a real product requirement and 255 (matching the
   DB column) is actually fine, relax `domain.ts`'s `TabSchema.customerName`
   max to 255 and update the 100-char reference in
   `e2e/26-field-validation.spec.ts`'s header comment accordingly.

Do not add a DB `CHECK` constraint without also fixing the client-side gap —
a server-only cap would turn today's silent accept into a confusing
last-second Supabase error with no inline field feedback.
