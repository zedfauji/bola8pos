# Phase 28: Money Formatter Utility - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 6 (2 new, 4 edited)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shared/lib/format.ts` | utility | transform | `src/shared/lib/domain-helpers.ts` (`formatMoney`, lines 140-164) | exact — same function being superseded, same file tier |
| `src/shared/lib/format.test.ts` | test | transform | `src/shared/lib/i18n/index.test.ts` | exact — locale-switching test pattern |
| `eslint-rules/no-raw-money-format.js` | config | transform (lint/AST) | `eslint-rules/no-ui-drift.js` | exact — identical selector-array-module shape |
| `eslint.config.js` | config | transform | itself, lines 140-194 (existing `no-restricted-syntax` + `uiDriftSelectors` wiring) | exact |
| `src/shared/lib/domain-helpers.ts` | utility | transform | n/a (edit in place — delete `formatMoney`, lines 140-164) | n/a |
| `src/shared/ui/MoneyDisplay.tsx` | component | transform | n/a (edit in place — swap import line 9) | n/a |
| `src/shared/lib/receipt-format.ts` | utility | transform | n/a (edit in place — swap import line 2; see Shared Patterns note on locale) | n/a |

Other known migration call sites flagged by research (manual find-and-replace, D-05/D-07): `src/entities/resource/ui/ResourceIllustration.tsx` (also fix pre-existing double-`$` bug, Pitfall 2) and `src/shared/lib/exporters/pdf.tsx` (Pitfall 3, previously undiscovered `.toFixed(2)` money formatter, not currently importing `formatMoney` at all).

## Pattern Assignments

### `src/shared/lib/format.ts` (utility, transform) — NEW

**Analog:** `src/shared/lib/domain-helpers.ts` (behavioral baseline) + `src/shared/lib/i18n/index.ts` (locale integration point)

**Behavioral baseline to preserve for default calls** (`domain-helpers.ts` lines 140-164):
```typescript
/**
 * Formats a money amount as a string.
 * @example formatMoney(12.5) // Returns: "$12.50"
 * @example formatMoney(-3) // Returns: "-$3.00"
 * @example formatMoney(0) // Returns: "$0.00"
 */
export function formatMoney(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2);
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}
```

**Locale integration point** (`src/shared/lib/i18n/index.ts` lines 83-91, already exists — this is the exact JSDoc naming Phase 28 as the intended consumer):
```typescript
/**
 * Resolves the currently-active i18next language to a typed {@link Locale}.
 * For non-component consumers (receipts/PDFs, Phase 28's money formatter)
 * that cannot use the useTranslation() hook's `i18n.language`.
 */
export function getCurrentLocale(): Locale {
  const parsed = LocaleSchema.safeParse(i18n.language);
  return parsed.success ? parsed.data : 'es-MX';
}
```

**New target signature (per D-01/D-06, verified `Intl.NumberFormat` behavior from RESEARCH.md Pattern 2 — do NOT use `style: 'currency'`):**
```typescript
import { getCurrentLocale } from '@shared/lib/i18n';
import type { Locale } from '@shared/lib/domain';

const CURRENCY_SYMBOL: Record<Locale, string> = {
  'es-MX': 'MX$',
  'en-US': '$',
};

export function formatMoney(amount: number, options?: { showSign?: boolean }): string {
  const locale = getCurrentLocale();
  const symbol = CURRENCY_SYMBOL[locale];
  const isNegative = amount < 0;
  const numeric = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  if (isNegative) return `-${symbol}${numeric}`;
  if (options?.showSign) return `+${symbol}${numeric}`;
  return `${symbol}${numeric}`;
}
```

`formatPercent(value, { decimals? })` follows the same `Intl.NumberFormat(locale)` numeric step + `'%'` suffix, no symbol map needed.

`parseMoneyInput(input): number | null` — D-04: regex-validate then `Number()` or `null`, no throw, no `Result<T>` wrapper (this repo's usual `Result<T>` pattern from `src/shared/lib/result.ts` is explicitly NOT used here per D-04 — do not default to it).

**No error-handling/Result pattern applies** — this is a pure function, not an async I/O boundary; skip the codebase's `Result<T>`/`Ok`/`Err` convention entirely for this file (explicit decision, not an oversight).

---

### `src/shared/lib/format.test.ts` (test, transform) — NEW

**Analog:** `src/shared/lib/i18n/index.test.ts` (full file, 21 lines — locale-switching pattern to reuse verbatim)
```typescript
import { describe, expect, it } from 'vitest';
import i18n from './index';

describe('i18n singleton', () => {
  it('resolves ... in en-US after changeLanguage', async () => {
    await i18n.changeLanguage('en-US');
    // assertions here
    await i18n.changeLanguage('es-MX'); // reset for other tests/consumers
  });
});
```
Apply this exact `await i18n.changeLanguage(...)` / reset-after pattern in `format.test.ts` for D-01's locale-symbol assertions (`MX$12.50` vs `$12.50`). Co-locate as `src/shared/lib/format.test.ts`, run via `npx vitest run src/shared/lib/format.test.ts`.

---

### `eslint-rules/no-raw-money-format.js` (config, transform) — NEW

**Analog:** `eslint-rules/no-ui-drift.js` (full file, 47 lines) — copy this module shape exactly: plain array export of `{ selector, message }` objects, no `meta`/`create`, no rule registration.

**Header comment pattern** (lines 1-16 — mirror this framing, citing D-08 instead of Phase 29/scripts/audit-ui-drift.ts):
```javascript
/**
 * no-raw-money-format.js — Standalone ESM module, not a full ESLint rule/plugin.
 * Exports `rawMoneyFormatSelectors`: plain `no-restricted-syntax` selector
 * objects AST-detecting D-08's two ad-hoc money-formatting patterns.
 * Spread into eslint.config.js's `no-restricted-syntax` array — never
 * declared as a standalone rule config.
 */
```

**Selector array shape** (`no-ui-drift.js` lines 18-46, same `selector`/`message` object pattern):
```javascript
export const uiDriftSelectors = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: 'Use POSButton or Button from @shared/ui/button instead...',
  },
  // ...
];
```

**Verified selectors to use (from RESEARCH.md Code Examples — already tested against this repo's installed `esquery@1.7.0`):**
```javascript
export const rawMoneyFormatSelectors = [
  {
    selector: "CallExpression[callee.property.name='toFixed'][arguments.0.value=2]",
    message: "Raw .toFixed(2) is banned for money display — use formatMoney() from '@shared/lib/format' instead. If this is a non-money quantity, add an eslint-disable-next-line comment explaining why.",
  },
  {
    selector: "TemplateElement[value.raw=/\\$$/] ~ TemplateElement",
    message: "Raw '$'-prefixed template literal is banned for money display — use formatMoney() from '@shared/lib/format' instead.",
  },
  {
    selector: "JSXText[value=/\\$\\s*$/] + JSXExpressionContainer CallExpression[callee.property.name='toFixed'][arguments.0.value=2]",
    message: "Raw '$' JSX text adjacent to a formatted number is banned for money display — use <MoneyDisplay> or formatMoney() from '@shared/lib/format' instead.",
  },
];
```

---

### `eslint.config.js` (config, transform) — EDIT

**Analog:** its own existing `uiDriftSelectors` wiring (lines 15, 140-194) — copy this exact import + spread pattern for the new selector module.

**Import** (line 15):
```javascript
import { uiDriftSelectors } from './eslint-rules/no-ui-drift.js'
```
→ add: `import { rawMoneyFormatSelectors } from './eslint-rules/no-raw-money-format.js'`

**Spread into `no-restricted-syntax`** (lines 185-192 — this is the pages/widgets/features-scoped block; note the REPLACE-not-merge gotcha documented at lines 180-184: flat config replaces (not merges) a rule key per matching file block, so the barrel-export selector must be restated in every block that also needs the money selectors):
```javascript
'no-restricted-syntax': [
  'error',
  {
    selector: 'ExportAllDeclaration',
    message: 'Barrel exports (export *) are banned. Export only what you explicitly need.',
  },
  ...uiDriftSelectors,
],
```
→ add `...rawMoneyFormatSelectors` alongside `...uiDriftSelectors`, scoped per D-09/discretion to `src/**` excluding `format.ts` itself and `*.test.{ts,tsx}` (already-existing `ignores: ['**/*.test.tsx', '**/*.stories.tsx']` pattern at line 157 is the template — extend to `**/*.test.ts` and add a `!src/shared/lib/format.ts` scoping, or use a `files`/`ignores` block consistent with how the tailwindcss block at lines 149-157 scopes itself).

---

### `src/shared/lib/domain-helpers.ts` (utility, transform) — EDIT

Delete `formatMoney` (lines 140-164, shown above). Per RESEARCH.md Open Question 1 recommendation: prefer a clean break over a re-export — `tsc --noEmit` surfaces every remaining import as a compile error, consistent with CLAUDE.md's mandated `npm run typecheck` before commit.

---

### `src/shared/ui/MoneyDisplay.tsx` (component, transform) — EDIT

**Full file already read** (67 lines) — single-line import swap at line 9:
```typescript
import { formatMoney } from '@shared/lib/domain-helpers';
```
→
```typescript
import { formatMoney } from '@shared/lib/format';
```
No other changes — this is the choke point; its ~40 downstream JSX usages (`<MoneyDisplay amount={...} />`) are untouched. Note existing negative-sign handling (lines 49-50, 62-64) already layers `−` and `Math.abs()` on top of the plain formatted string — do not duplicate that logic inside `format.ts`'s `formatMoney` beyond its own sign prefix.

---

### `src/shared/lib/receipt-format.ts` (utility, transform) — EDIT

Single-line import swap at line 2:
```typescript
import { formatMoney } from '@shared/lib/domain-helpers';
```
→
```typescript
import { formatMoney } from '@shared/lib/format';
```

**IMPORTANT — flag for planner (Pitfall 1, RESEARCH.md):** This file's `buildThermalReceiptText`/`buildPreChequeText` take an explicit `locale: Locale` parameter and resolve translated text via `i18n.getFixedT(locale, 'receipt')` — but money lines calling the new `formatMoney()` will read `getCurrentLocale()` (live session locale) internally per D-06, not the function's own `locale` param. These are usually the same value but not guaranteed (e.g. reprint after a staff locale change). Planner must decide: (a) accept live-locale read as a documented simplification, or (b) add a second, non-public locale-parameterized export in `format.ts` that `receipt-format.ts` calls directly instead of the public `formatMoney`. Do not resolve this silently as a side effect of the import swap.

---

## Shared Patterns

### Locale resolution (internal, no param)
**Source:** `src/shared/lib/i18n/index.ts` lines 83-91, `getCurrentLocale()`
**Apply to:** `format.ts`'s `formatMoney`/`formatPercent` — call internally every invocation, no `locale` param on the function signature (D-06).

### Symbol-prefix-not-currency-style Intl usage
**Source:** RESEARCH.md Pattern 2 (empirically verified in this repo's runtime)
**Apply to:** `format.ts` only. Never pass `style: 'currency'` to `Intl.NumberFormat` — use plain `{ minimumFractionDigits: 2, maximumFractionDigits: 2 }` and manually prepend `CURRENCY_SYMBOL[locale]`.

### Custom ESLint rule as selector array, not rule module
**Source:** `eslint-rules/no-ui-drift.js` (full file) + its wiring in `eslint.config.js` lines 140-194
**Apply to:** `eslint-rules/no-raw-money-format.js` + its `eslint.config.js` wiring — identical shape, no new plugin/rule-module infrastructure.

### Manual find-and-replace migration, not codemod
**Source:** D-05 — no `jscodeshift`/`ts-morph` tooling exists in this repo for this purpose; all edits above are plain import-line or full-function edits done by hand.

## No Analog Found

None — every file in scope has a direct in-place predecessor (edit) or a closely-matching sibling pattern (new files). `parseMoneyInput` and `formatPercent` have no prior codebase equivalent (per CONTEXT.md's own domain note), but both compose directly from the `Intl.NumberFormat`/regex patterns already verified in RESEARCH.md — no separate analog search needed beyond `format.ts`'s own internal consistency.

## Metadata

**Analog search scope:** `src/shared/lib/`, `src/shared/ui/`, `eslint-rules/`, `eslint.config.js` — files explicitly named in CONTEXT.md canonical_refs + RESEARCH.md Sources (all full-read, not sampled)
**Files scanned:** 6 read in full (domain-helpers.ts excerpt, MoneyDisplay.tsx, i18n/index.ts, i18n/index.test.ts, no-ui-drift.js, eslint.config.js excerpt, receipt-format.ts excerpt)
**Pattern extraction date:** 2026-08-01
