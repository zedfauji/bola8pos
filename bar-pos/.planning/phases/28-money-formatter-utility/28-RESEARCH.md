# Phase 28: Money Formatter Utility - Research

**Researched:** 2026-08-01
**Domain:** JavaScript `Intl.NumberFormat` locale-aware currency/percent formatting, ESLint flat-config custom AST rules (no-restricted-syntax + esquery selectors)
**Confidence:** HIGH

## Summary

This phase consolidates money formatting into `src/shared/lib/format.ts`. The load-bearing technical question (D-01: `es-MX` shows `MX$12.50`, `en-US` shows `$12.50` for the same USD amount) is answered decisively by empirical testing in this environment: **do not use `Intl.NumberFormat`'s `style: 'currency'` at all.** Both `currencyDisplay: 'symbol'` (default) and `currencyDisplay: 'code'` produce locale-driven, ISO-currency-derived output (`es-MX` renders `"USD 1,234.50"` for the code style and would render `"US$"`-style symbols depending on CLDR data — never the desired `"MX$"`, which is not a real ISO/CLDR currency symbol for USD in any locale). The safe, verified technique is to **format the plain number only** (`Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`, no `style: 'currency'`) and manually prepend a symbol from a hand-written `{ 'es-MX': 'MX$', 'en-US': '$' }` map plus a manually-computed sign. This sidesteps all of Intl's currency-symbol-placement and negative-sign-position variability, which is the actual risk `formatToParts()` reassembly or `currencyDisplay: 'code'` + string-replace would still carry. Digit grouping/decimal punctuation were verified identical between `es-MX` and `en-US` (both use `,` grouping / `.` decimal) — so today the "locale-aware" grouping is a no-op in visible output, but the code must still route through `Intl.NumberFormat(locale)` rather than hardcode, so it stays correct if that ever changes.

The ESLint rule (`no-raw-money-format`) should follow this repo's own established convention for lightweight custom AST rules — `eslint-rules/no-ui-drift.js`'s pattern of plain `esquery` selector strings spread into `no-restricted-syntax`, not a full custom rule module with `context.report()`. Both target patterns from D-08 were prototyped and verified against this repo's actual installed `esquery@1.7.0` + `@typescript-eslint/parser` in this research session (see Code Examples) — including the trickier JSX case (`{'$'}{expr.toFixed(2)}` as adjacent `JSXText`/`JSXExpressionContainer` siblings, not a template literal) which several current call sites use.

The manual migration (D-05) is much smaller in practice than "~40 call sites" suggests: only **3 files** directly import `formatMoney` from `domain-helpers.ts` — `MoneyDisplay.tsx` (the actual choke point; its ~40 downstream JSX call sites need zero changes), `receipt-format.ts` (8 internal call sites, 1 import line), and `ResourceIllustration.tsx` (2 call sites, 1 import line — see Pitfall 2, a real pre-existing double-`$` bug found during this research). The "~40" figure in CONTEXT.md was almost certainly counting `MoneyDisplay` JSX usages, which the migration does not need to touch individually.

**Primary recommendation:** Build `formatMoney`/`formatPercent` on plain (non-currency-style) `Intl.NumberFormat(locale)` output with a manual symbol/sign prefix, read locale via the existing `getCurrentLocale()` export from `@shared/lib/i18n`; implement `no-raw-money-format` as `esquery` selectors appended to the existing `no-restricted-syntax` array (not a new rule module); migrate the 3 real importers, and disable-comment the ~4 known non-money `.toFixed(2)` false positives (inventory quantities) rather than trying to build a semantic name-matching selector.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Currency symbol differs by locale, not locale-invariant: `es-MX` shows `MX$12.50`, `en-US` shows `$12.50` — for the exact same underlying USD amount. This requires a custom locale→symbol map (`{'es-MX': 'MX$', 'en-US': '$'}`); it is NOT raw `Intl.NumberFormat(locale, {style:'currency', currency:'USD'})` output. Digit grouping and decimal punctuation still follow `Intl.NumberFormat(locale)` number-formatting conventions (the symbol map only overrides the prefix, not the numeric portion). — **Reversibility:** costly — every screenshot/e2e assertion and receipt currently expects `$`; changing the es-MX prefix again later means re-touching all of them.
- **D-02:** The underlying currency is USD in both locales — this is a display-symbol difference only, not a multi-currency system. No currency conversion, no per-locale amount storage change.
- **D-03:** `parseMoneyInput` ships as a new export from `format.ts` for future use only. Do NOT retrofit existing money input fields (`PaymentForm`, `RefundSheet`, `SplitTabSheet`) to use it in this phase — those are payment-critical surfaces the Phase 33 sweep just standardized, and none of them are broken today.
- **D-04:** On malformed input (`'12.5.3'`, `'abc'`, empty string), `parseMoneyInput` returns `null`. No throw, no `Result<T>` wrapper — callers check for `null` and handle their own validation UI.
- **D-05:** Migration of the ~40 `formatMoney` call sites is a manual find-and-replace pass, not a scripted codemod (jscodeshift/ts-morph). — **Note for planner:** ROADMAP.md's phase description says "codemod to migrate existing call sites" — this decision deviates from that literal wording. Flag/confirm during planning if that matters, but the user's explicit direction here is manual migration.
- **D-06:** `format.ts`'s `formatMoney` takes a new signature: `formatMoney(amount: number, options?: { showSign?: boolean }): string` — not a drop-in of the old `(amount: number): string` signature. `showSign` controls an explicit `+` prefix for positive amounts. Locale is read internally from the i18n singleton — no locale-override param on the function itself.
- **D-07:** Because the signature changed (added a second optional param), the manual migration pass is a straight import-path swap for existing call sites (`options` is optional, so untouched call sites keep working) — only call sites that need `showSign` require an actual code change beyond the import.
- **D-08:** `no-raw-money-format` flags BOTH `.toFixed(2)` calls AND string/template literals combining a raw `'$'` with a number expression — the two ways ad-hoc money formatting currently appears in the codebase.
- **D-09:** Rule exemptions — Claude's discretion (see below).

### Claude's Discretion

- Exact exemption list for `no-raw-money-format` (D-09). User selected "You decide" between `{format.ts + tests}` and `{format.ts + tests + receipt-format.ts}`. Recommendation carried into planning: exempt `format.ts` (the implementation itself) and `*.test.ts`/`*.test.tsx` files; do NOT blanket-exempt `receipt-format.ts` since it already calls `formatMoney()` correctly today — if the rule flags something there, treat that as a real signal to fix rather than grounds to exempt the file. Planner/researcher should verify this against the actual receipt-format.ts content before finalizing the ESLint config.
- Precise `.toFixed(2)` detection scope (e.g., whether to flag `.toFixed(2)` calls anywhere in `src/` vs. only within money-shaped variable/prop names) — left to implementation, since money is the overwhelming real-world use of `.toFixed(2)` in this codebase.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. No todos matched this phase during cross-reference.
</user_constraints>

## Phase Requirements

<phase_requirements>
No `.planning/REQUIREMENTS.md` exists for this milestone (confirmed absent — consistent with every prior 21-xx/22-xx/23-xx phase in this project's history, per STATE.md session log). ROADMAP.md's `Requirements: TBD` note references a since-removed `POS-COMPARISON.md §28`. Per 28-CONTEXT.md's own instruction, this CONTEXT.md is the authoritative scope of record — treat the 9 locked decisions (D-01..D-09) above as the requirement set for this phase; there are no separate REQ-IDs to map.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Money/percent string formatting | Shared (`src/shared/lib/format.ts`) | — | Pure display-formatting utility, zero business logic, consumed by every layer above `shared`; must live at the bottom of the FSD import graph so `entities`/`features`/`widgets` can all import it |
| Current-locale resolution | Shared (`src/shared/lib/i18n/index.ts`) | — | Already exists (`getCurrentLocale()`), phase 21 dependency; `format.ts` is a consumer, not an owner, of locale state |
| Money-string parsing (`parseMoneyInput`) | Shared (`src/shared/lib/format.ts`) | — | Same file as formatting per D-03/D-06 phrasing ("ships as a new export from format.ts"); no UI wiring in this phase |
| Lint-time regression prevention | Build tooling (`eslint.config.js` + `eslint-rules/`) | — | Static analysis, not runtime; mirrors the existing `i18next/no-literal-string` and `no-ui-drift.js` precedent already in this repo |
| Receipt/PDF money display | Shared (`receipt-format.ts`, `exporters/pdf.tsx`) | — | Both already call into a money formatter (`formatMoney` / local `n.toFixed(2)`); receipt-format.ts is an existing correct consumer, `pdf.tsx` is an additional off-CONTEXT-radar `.toFixed(2)` site the ESLint rule will newly flag (see Pitfall 3) |

## Standard Stack

### Core

No new packages. This phase is built entirely on the JS/TS standard library and already-installed devDependencies.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `Intl.NumberFormat` (ECMA-402, built-in) | Node 24 / V8 runtime bundled with Tauri's WebView2/webkit2gtk | Locale-aware digit grouping/decimal formatting | Web platform standard; zero-dependency; exactly what D-01 calls for on the numeric portion |
| `i18next` | `26.3.6` [VERIFIED: package.json] | Locale state (`getCurrentLocale()` already reads `i18n.language`) | Already the sole locale mechanism in this codebase (Phase 21); D-06 explicitly forbids introducing a second one |
| `eslint` | `^9.39.4` [VERIFIED: package.json] | Flat-config lint engine hosting the new rule | Already configured; flat config (`eslint.config.js`) is the only config format in this repo |
| `esquery` (transitive, via ESLint's own `no-restricted-syntax` selector matcher) | `1.7.0` [VERIFIED: installed in `node_modules`, confirmed by running `require('esquery/package.json').version` in this repo] | AST selector matching for the custom rule | Already the exact mechanism `eslint-rules/no-ui-drift.js` uses for 4 other custom checks — verified selectors for this phase's two D-08 patterns match/don't-match correctly against this exact installed version (see Code Examples) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.1.4` [VERIFIED: package.json] | Unit tests for `format.ts` | Standard for this repo; co-locate `format.test.ts` |
| `fast-check` | `^4.6.0` [VERIFIED: package.json] | Property-based boundary tests | `domain-helpers.test.ts` already uses it for money-adjacent math (7 references found); reuse for `formatMoney`/`parseMoneyInput` round-trip properties if the planner wants that rigor — optional, not required by any locked decision |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `Intl.NumberFormat` + manual symbol prefix | `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code' })` + string-replace `"USD"` → symbol map | Verified in this session to still emit locale-dependent spacing/positioning around the code token (`"USD 1,234.50"` for es-MX, space-separated) that a blind string-replace has to fight instead of avoid; more fragile, no benefit over the plain-number approach |
| Plain `Intl.NumberFormat` + manual symbol prefix | `formatToParts()` reassembly with `style: 'currency'`, filtering out the `currency` part and injecting the custom symbol | Works, but is strictly more code than skipping `style: 'currency'` entirely (there is no `currency`-type part to filter if you never request currency style) — no upside here since no per-locale symbol *placement* variance needs to be preserved (D-01 wants the symbol always as a leading prefix, matching current `formatMoney` behavior) |
| `esquery` selectors via `no-restricted-syntax` | A hand-written full ESLint rule module (`meta`/`create`/`context.report`) | More powerful (could inspect variable names, types via `@typescript-eslint/utils`' type-aware linting) but this repo has zero precedent for a real custom rule module — `no-ui-drift.js` explicitly documents itself as "not a full ESLint rule/plugin." Introducing the first one for this phase is a bigger footprint than the problem needs; selectors already provably work for both D-08 patterns |

**Installation:** None — no `npm install` required for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All required capabilities (`Intl.NumberFormat`, `esquery` via ESLint, `i18next`) are either JS/TS stdlib or already-installed dependencies verified above.

## Architecture Patterns

### System Architecture Diagram

```
Staff sets locale (Settings > Language, or admin /staff edit)
        │
        ▼
i18next singleton (src/shared/lib/i18n/index.ts)
  i18n.language = 'es-MX' | 'en-US'
        │
        │ getCurrentLocale()  ◄── format.ts's ONLY locale input
        ▼
┌─────────────────────────────────────────────────────────┐
│ src/shared/lib/format.ts                                 │
│                                                           │
│  formatMoney(amount, {showSign?}) ──┐                    │
│                                      │                    │
│    1. locale = getCurrentLocale()   │                    │
│    2. symbol = SYMBOL_MAP[locale]   │  (MX$ | $)         │
│    3. numeric = Intl.NumberFormat(  │                    │
│         locale,                     │                    │
│         {minimumFractionDigits:2,   │                    │
│          maximumFractionDigits:2}   │                    │
│       ).format(Math.abs(amount))    │                    │
│    4. sign = amount<0 ? '-'         │                    │
│              : showSign ? '+' : ''  │                    │
│    5. return sign+symbol+numeric ───┘                    │
│                                                           │
│  formatPercent(value, {decimals?})                       │
│    same Intl.NumberFormat(locale) numeric step, + '%'    │
│                                                           │
│  parseMoneyInput(input): number | null                   │
│    regex-validate → Number() or null (D-04)               │
└─────────────────────────────────────────────────────────┘
        │                          │                  │
        ▼                          ▼                  ▼
MoneyDisplay.tsx           receipt-format.ts     ~35 other direct
(1 import swap,            (1 import swap,        formatMoney/
~40 JSX usages             8 internal calls)      formatPercent-shaped
untouched)                                        call sites (manual
                                                   find-and-replace, D-05)

Parallel, build-time-only path:
eslint.config.js
  └─ no-restricted-syntax + esquery selectors (eslint-rules/no-raw-money-format.js,
     modeled on eslint-rules/no-ui-drift.js)
       ├─ flags `.toFixed(2)` CallExpressions
       └─ flags raw '$' + number-expression TemplateLiteral / JSXText patterns
     scoped to src/**, exempting format.ts + *.test.{ts,tsx}
```

### Recommended Project Structure

```
src/shared/lib/
├── format.ts          # NEW — formatMoney, formatPercent, parseMoneyInput
├── format.test.ts      # NEW — co-located unit tests (locale-switching via i18n.changeLanguage)
├── domain-helpers.ts   # EDIT — remove formatMoney (or re-export from format.ts for one release, planner's call)
├── receipt-format.ts   # EDIT — swap import to format.ts
└── i18n/
    └── index.ts         # UNCHANGED — getCurrentLocale() is the integration point, already exported

src/shared/ui/
└── MoneyDisplay.tsx    # EDIT — swap import to format.ts (1 line; ~40 downstream JSX usages untouched)

eslint-rules/
└── no-raw-money-format.js   # NEW — esquery selector array, same shape as no-ui-drift.js

eslint.config.js        # EDIT — import + spread new selectors into no-restricted-syntax, scoped block
```

### Pattern 1: Locale read inside the formatter, not passed by the caller

**What:** `formatMoney`/`formatPercent` call `getCurrentLocale()` internally on every invocation; they take no `locale` parameter (D-06 is explicit about this).
**When to use:** Always, for this phase — this matches how `receipt-format.ts` already resolves locale internally via `i18n.getFixedT(locale, 'receipt')`, except receipt-format.ts is handed an explicit `locale: Locale` parameter (because receipts are generated for a specific past transaction's locale context, not "whatever the UI is showing right now"). `format.ts`'s `formatMoney`/`formatPercent` are UI-facing and should reflect the live staff session, so `getCurrentLocale()` is correct there — but note the asymmetry: `receipt-format.ts` calling into `formatMoney()` internally means receipt formatting will start reflecting the *live* i18n language, not the locale the receipt was explicitly parameterized with. Flag this for the planner (see Pitfall 1).
**Example:**
```typescript
// Source: src/shared/lib/i18n/index.ts (existing, verified in this repo)
export function getCurrentLocale(): Locale {
  const parsed = LocaleSchema.safeParse(i18n.language);
  return parsed.success ? parsed.data : 'es-MX';
}
```

### Pattern 2: Format the number, prefix the symbol — never use `style: 'currency'`

**What:** Get locale-correct digit grouping from `Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` (no `style` option at all — defaults to plain decimal), then manually concatenate `sign + symbol + numericString`.
**When to use:** For every money-formatting call in this phase. This is the D-01-mandated approach.
**Example:**
```typescript
// Verified empirically in this session via `node -e` against the actual runtime
// (Node v24.18.0, same Intl/ICU data family as the WebView2/webkit2gtk runtimes
// this Tauri app ships on):
new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.50)
// => "1,234.50"
new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.50)
// => "1,234.50"  (identical grouping — confirms D-01's "digit grouping still follows
//                  Intl.NumberFormat(locale)" clause is currently a no-op in output,
//                  but must still route through Intl for correctness/future-proofing)

// What NOT to do — verified to NOT produce "MX$":
new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(1234.50)
// => "USD 1,234.50"   (NOT "US$1,234.50", NOT "MX$1,234.50" — CLDR es-MX currency
//                        formatting for USD renders as ISO-code + space, not a symbol)
new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', currencyDisplay: 'code' }).format(1234.50)
// => "USD 1,234.50"   (identical to default — currencyDisplay:'code' changes nothing
//                        here because es-MX's CLDR data already renders USD as a code)
```

### Pattern 3: Custom lint rules as `esquery` selectors, not rule modules

**What:** `eslint-rules/no-ui-drift.js` demonstrates the established pattern: export a plain array of `{ selector, message }` objects (valid `esquery`/`no-restricted-syntax` selector strings), spread into the `no-restricted-syntax` rule's option array in a scoped block of `eslint.config.js`. No `meta`/`create`/rule registration, no new ESLint plugin.
**When to use:** For `no-raw-money-format` in this phase — keeps the same maintenance shape as the existing UI-drift rule, reviewable by anyone who already understands that file.
**Example:**
```javascript
// Source: eslint-rules/no-ui-drift.js (existing file in this repo, read in full during research)
export const uiDriftSelectors = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: 'Use POSButton or Button from @shared/ui/button instead of a raw <button> element. See DESIGN-TOKENS.md.',
  },
  // ...3 more entries, same shape
];

// eslint.config.js consumes it:
'no-restricted-syntax': ['error', { selector: 'ExportAllDeclaration', message: '...' }, ...uiDriftSelectors],
```

### Anti-Patterns to Avoid

- **Reassembling `formatToParts()` output for a custom symbol:** Tempting-looking approach that's strictly more code and more fragile than skipping `style: 'currency'` outright (see Pattern 2, Alternatives Considered). It re-introduces exactly the locale-driven symbol/spacing variance D-01 is trying to eliminate.
- **A `locale` parameter on `formatMoney`:** D-06 explicitly forbids this. Every call site reads the live session locale via `getCurrentLocale()`. The one legitimate exception in this codebase (`receipt-format.ts`, which needs an explicit past-transaction locale) is a pre-existing pattern outside this phase's `formatMoney`/`formatPercent` signatures — see Pitfall 1 for how that tension should be resolved.
- **A full custom ESLint rule module for `no-raw-money-format`:** No precedent in this repo; `no-restricted-syntax` + `esquery` selectors (Pattern 3) already prove sufficient for both D-08 detection targets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale-aware digit grouping | A manual comma-insertion function | `Intl.NumberFormat(locale, {minimumFractionDigits:2, maximumFractionDigits:2})` | Web platform standard, zero-dependency, already the exact API D-01 references |
| Lenient money-string parsing for a live input field | A new parser inside `format.ts` wired into `PaymentForm`/`RefundSheet`/`SplitTabSheet` | Nothing — D-03 explicitly says don't retrofit those fields this phase. `MoneyInput.tsx`'s existing local `parseToCents()` (lenient, strips non-digits, clamps negatives to 0) stays as-is; it has a *different* contract than `parseMoneyInput` (never returns null, always resolves to a number) and is out of scope to unify | Two different contracts for two different UI needs (live-typing tolerance vs. strict validate-then-null); forcing them into one function now would be scope creep beyond D-03/D-04 |
| ESLint custom rule infrastructure | A new `eslint-plugin-*` package or full rule module with `meta`/`create` | `no-restricted-syntax` + `esquery` selectors, appended to the existing array (Pattern 3) | Repo has zero existing custom rule modules; the selector approach is proven to work for both D-08 patterns in this exact repo (verified below) and matches `no-ui-drift.js` precedent |

**Key insight:** Every piece of this phase — Intl formatting, the lint mechanism, the locale singleton — already has a stdlib or in-repo precedent. There is no library to add and no new architectural mechanism to invent; the entire phase is composition of existing primitives.

## Common Pitfalls

### Pitfall 1: `receipt-format.ts` will silently start reading live locale instead of its `locale` parameter

**What goes wrong:** `receipt-format.ts`'s `buildThermalReceiptText`/`buildPreChequeText` currently take an explicit `locale: Locale` parameter and use `i18n.getFixedT(locale, 'receipt')` for translated strings — but they call the shared `formatMoney(amount)` for money lines. If the new `formatMoney` reads `getCurrentLocale()` internally (per D-06), the receipt's money portions will format using whatever the *live UI session* locale is at print time, not the `locale` parameter the receipt function was explicitly given. In practice these are usually the same value (the receipt is normally printed by the currently logged-in staff member), but they are not guaranteed to be — e.g., a receipt reprint after a staff locale change, or (per this repo's existing async-safe patterns) a race between `i18n.changeLanguage()` and an in-flight receipt build.
**Why it happens:** D-06 locked `formatMoney`'s locale source as internal-only with no override param, but `receipt-format.ts` predates this phase and was built around an explicit `locale` parameter for exactly this kind of correctness.
**How to avoid:** Flag this tension explicitly to the planner. Two resolutions, either acceptable: (a) accept the live-locale read as fine for this app's actual usage pattern (single staff member per active session, printing their own receipts) and document it as a known simplification; (b) `format.ts` could additionally export a locale-parameterized internal helper that `formatMoney` wraps for the default (no-param) case, and `receipt-format.ts` calls the parameterized version directly. Given D-06 is explicit that `formatMoney` itself takes no locale param, option (b) would need a second, non-public export — decide during planning, not implicit in code.
**Warning signs:** Any test that changes `i18n.language` mid-test and separately calls `receipt-format.ts` functions with a fixed `locale` argument — if those two diverge, the receipt's money lines and text labels will show different locales' formatting on the same receipt.

### Pitfall 2: `ResourceIllustration.tsx` has a real, pre-existing double-`$` bug that the migration will surface

**What goes wrong:** `src/entities/resource/ui/ResourceIllustration.tsx:315` does `` <span>${formatMoney(timer.currentCharge)}</span> `` — a raw `$` JSXText literal immediately followed by `formatMoney()`, whose own return value is already `$`-prefixed. This produces `$$12.50` today. This is the exact same class of bug CLAUDE.md documents as already fixed in `MoneyDisplay.tsx` ("Operational reports suite + CSV" section) — but that fix only touched `MoneyDisplay.tsx`, not this file, which independently imports `formatMoney` directly.
**Why it happens:** Direct `formatMoney` import outside the `MoneyDisplay` component, combined with a stale assumption that `formatMoney` returns a bare number string.
**How to avoid:** When migrating this file's import (D-07: straight import-path swap), also strip the redundant leading `$` from the JSX (`<span>{formatMoney(timer.currentCharge)}</span>`), since the new `no-raw-money-format` rule's JSX-adjacency selector (verified in Code Examples) will flag this exact line anyway once the rule is added — better to fix it during the same migration pass than leave a freshly-linted failure.
**Warning signs:** Any `no-raw-money-format` failure inside `ResourceIllustration.tsx` after the rule lands, if the bug isn't fixed proactively during migration.

### Pitfall 3: The lint rule will also flag `src/shared/lib/exporters/pdf.tsx`, which is outside CONTEXT.md's radar

**What goes wrong:** `pdf.tsx:44` has `return \`$${n.toFixed(2)}\`;` — a template-literal money formatter, structurally identical to the pattern D-08 targets, in a file CONTEXT.md's canonical_refs section never mentions (only `domain-helpers.ts`, `MoneyDisplay.tsx`, and `receipt-format.ts` are called out).
**Why it happens:** CONTEXT.md's canonical refs were scoped to `formatMoney`'s known importers; this is a separate, parallel ad-hoc formatter for PDF exports that never went through `formatMoney` at all.
**How to avoid:** Grep for the D-08 patterns across all of `src/` (not just the 3 canonical files) before finalizing the exemption list — this file is a legitimate migration target, not a false positive, and should be swapped to `format.ts`'s `formatMoney` like everything else, or explicitly documented as an intentional exception if PDF export has a formatting constraint `format.ts` doesn't meet (verify during planning; no such constraint was found in this research — the function signature `(n: number) => string` is compatible).
**Warning signs:** Lint failures in `exporters/pdf.tsx` after the rule lands that weren't anticipated in the plan's file list.

### Pitfall 4: Broad `.toFixed(2)` detection will flag ~4 non-money quantity displays

**What goes wrong:** `.toFixed(2)` is also used for inventory/UoM quantities, not money: `PrepOnHandCard.tsx:40` (`qtyOnHand.toFixed(2)`), `PrepBatchPreview.tsx` (3 sites: `need`, `row.delta`, `qtyProduced`), `KitchenPrepDashboard.tsx:57` (`qtyProduced.toFixed(2)`). A selector broad enough to catch all real money `.toFixed(2)` sites (verified: 30+ across widgets/features) will also catch these.
**Why it happens:** D-09 already acknowledges this exact tradeoff and delegates the decision to implementation ("money is the overwhelming real-world use of `.toFixed(2)` in this codebase").
**How to avoid:** Accept the broad selector (simplest, most maintainable — matches the "left to implementation" discretion) and add a scoped `// eslint-disable-next-line no-restricted-syntax -- quantity, not money` comment at each of the ~4-5 known non-money sites, discovered via the same grep run in this research (see Sources). Do not attempt a name-based regex selector (e.g. matching `amount|price|total` in the callee identifier) — it was considered and rejected: `entry.amount.toFixed(2)` (property access, not plain identifier) and camelCase variance make a reliable name-matching esquery selector meaningfully harder to write correctly than 4-5 disable comments, and it would introduce false negatives (money vars not matching the regex) that are worse than the current false positives.
**Warning signs:** New non-money `.toFixed(2)` call sites added after this phase lands will need their own disable comment — this is a permanent, low-frequency maintenance cost, not a one-time migration cost.

### Pitfall 5: `MoneySchema` in `domain.ts` is `nonnegative()` — don't assume `parseMoneyInput` should reject negatives

**What goes wrong:** `src/shared/lib/domain.ts:15` defines `MoneySchema = z.number().nonnegative().multipleOf(0.01)`, which might suggest `parseMoneyInput` should also reject negative strings. But D-06's `showSign`/negative-amount handling elsewhere in this phase treats negative money values as a first-class, valid case (refunds, adjustments, expense entries in `CajaDashboard.tsx` all display negative amounts). `parseMoneyInput` is a generic string→number parser (D-03: "for future use"), not bound to `MoneySchema`'s domain-specific non-negative constraint.
**Why it happens:** Surface-level pattern-matching between two similarly-named money-validation concepts that actually serve different purposes (a Zod schema for a stored/charged amount vs. a generic input-string parser).
**How to avoid:** `parseMoneyInput` should accept an optional leading `-` and return the signed number; do not couple it to `MoneySchema`. If a specific future caller needs a non-negative constraint, that's the caller's responsibility (e.g., `MoneySchema.safeParse(parseMoneyInput(input))`), consistent with D-03's "no retrofit, ships for future use" framing.
**Warning signs:** A `parseMoneyInput('-5.00')` test asserting `null` would be over-constraining the utility beyond what any locked decision requires.

## Code Examples

All three selectors below were parsed and matched against representative snippets using this repo's actually-installed `@typescript-eslint/parser` and `esquery@1.7.0` in this research session (not assumed from documentation) — each selector matched its target pattern and did not match the other two control cases:

### `.toFixed(2)` detection (broad, per D-09 discretion)
```javascript
// [VERIFIED: ran via esquery.match(ast, esquery.parse(selector)) against this
// repo's installed esquery@1.7.0 + @typescript-eslint/parser, in this session]
{
  selector: "CallExpression[callee.property.name='toFixed'][arguments.0.value=2]",
  message: "Raw .toFixed(2) is banned for money display — use formatMoney() from '@shared/lib/format' instead. If this is a non-money quantity, add an eslint-disable-next-line comment explaining why.",
}
```

### Template-literal `$${...}` detection (e.g. `` `+$${amount.toFixed(2)}` ``)
```javascript
// [VERIFIED: matched the `$${...}` template-literal case, did NOT match the
// JSX-adjacency case or the plain-toFixed-only case, in this session]
{
  selector: "TemplateElement[value.raw=/\\$$/] ~ TemplateElement",
  message: "Raw '$'-prefixed template literal is banned for money display — use formatMoney() from '@shared/lib/format' instead.",
}
```

### JSX raw-`$`-adjacent-to-expression detection (e.g. `<span>${amount.toFixed(2)}</span>`)
```javascript
// [VERIFIED: matched the JSX case (JSXText ending in '$' immediately followed
// by a sibling JSXExpressionContainer whose expression calls .toFixed(2)),
// did NOT match the other two control cases, in this session]
{
  selector: "JSXText[value=/\\$\\s*$/] + JSXExpressionContainer CallExpression[callee.property.name='toFixed'][arguments.0.value=2]",
  message: "Raw '$' JSX text adjacent to a formatted number is banned for money display — use <MoneyDisplay> or formatMoney() from '@shared/lib/format' instead.",
}
```

### `formatMoney` implementation shape (D-01, D-06)
```typescript
// Design derived from this session's verified Intl.NumberFormat behavior
// (see Pattern 2) + the existing getCurrentLocale() integration point.
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

### Existing test pattern for locale-switching (reuse for `format.test.ts`)
```typescript
// Source: src/shared/lib/i18n/index.test.ts (existing file, read in full during research)
import i18n from './index';

it('resolves ... in en-US after changeLanguage', async () => {
  await i18n.changeLanguage('en-US');
  // assertions here
  await i18n.changeLanguage('es-MX'); // reset for other tests/consumers
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `domain-helpers.ts:158` `formatMoney(amount)` — `.toFixed(2)` + hardcoded `$` prefix, locale-blind | `format.ts` `formatMoney(amount, {showSign?})` — `Intl.NumberFormat(locale)` numeric portion + locale-mapped symbol prefix | This phase | Every existing call site's *default* output is unchanged for `en-US` (still `$12.50`); `es-MX` output changes from (today, since there's no locale-blind behavior currently) `$12.50` to `MX$12.50` — this IS the point of the phase, but is a visible UI change wherever `es-MX` is the active locale |
| Ad-hoc `.toFixed(1)}%` / `` `${percent}%` `` in `PaymentForm.tsx`/`WaitlistAnalyticsReport.tsx` | `formatPercent(value, {decimals?})` (new, no forced retrofit per D-03's "no retrofit" spirit extended to percent) | This phase (new export only) | No forced behavior change; existing percent call sites keep working until/unless separately migrated |

**Deprecated/outdated:** None — `domain-helpers.ts`'s `formatMoney` is being superseded, not deprecated-with-warning; whether it's deleted outright or left as a thin re-export is a planner decision (see Recommended Project Structure note).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `parseMoneyInput`'s exact regex/validation shape (`/^-?\d+(\.\d{1,2})?$/`, allowing a leading `-`, requiring 1-2 fraction digits) is a reasonable design for a "future use" utility — no existing consumer or test locks this shape today | Pitfall 5 / Code Examples | Low — D-04 only locks the *malformed-input* behavior (`null` return); the exact accepted-format grammar is new-code design, easily adjusted before any real caller exists |
| A2 | Resolving Pitfall 1 (receipt-format.ts locale-param vs. live-locale tension) in favor of "accept the live-locale read as fine" vs. adding a parameterized internal helper is left open — this research does not pick one | Pitfall 1 | Medium — if the planner picks the wrong default without deciding explicitly, receipts could silently format money in the wrong locale in an edge case (staff locale change mid-shift, multi-terminal reprint) |
| A3 | `pdf.tsx`'s `.toFixed(2)` site (Pitfall 3) has no formatting constraint that makes it incompatible with `format.ts`'s `formatMoney` (e.g. font/encoding limits in the PDF renderer) — verified only that the function signature is compatible, not that the PDF rendering pipeline accepts the `MX$` symbol glyph without issue | Pitfall 3 | Low-Medium — PDF exports (jsPDF or similar) can have font-glyph limitations; `$` is safe in any standard font, `MX$` (multi-character ASCII) should also be safe but wasn't explicitly tested against the PDF font in use |

## Open Questions

1. **Should `domain-helpers.ts`'s `formatMoney` be deleted outright, or kept as a deprecated re-export from `format.ts`?**
   - What we know: D-05/D-07 describe the migration as "a straight import-path swap" implying the old export goes away and callers repoint their imports.
   - What's unclear: Whether any external/test code still imports `formatMoney` from `domain-helpers.ts` after the 3-file migration that the planner wants to leave working via a re-export, vs. a clean break with a compile error forcing every site to be found by TypeScript.
   - Recommendation: Prefer a clean break (delete from `domain-helpers.ts`) — `tsc --noEmit` will surface every remaining import as a compile error, which is a stronger and simpler completeness check than trusting a manual grep pass, and this repo's CLAUDE.md already mandates `npm run typecheck` before every commit.

2. **Does `receipt-format.ts` need to switch its internal `formatMoney` calls to a still-locale-parameterized path (Pitfall 1), or accept the live-locale change?**
   - What we know: The tension is real and verified (receipt-format.ts's own text labels are explicitly locale-parameterized; money would become live-locale-only if it just imports the new `formatMoney`).
   - What's unclear: Whether this app's actual usage pattern (one staff session prints its own receipts) makes the distinction irrelevant in practice.
   - Recommendation: Planner should make an explicit decision here (not let it be an implicit side effect of "swap the import"), documented as either a deliberate simplification or resolved with a parameterized internal export.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies. `Intl.NumberFormat` is a JS-engine built-in already present in every runtime this app targets (Node for tests/build, WebView2 on Windows, webkit2gtk on Ubuntu); `esquery`/`eslint` are already-installed devDependencies verified above.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.4` [VERIFIED: package.json] |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run src/shared/lib/format.test.ts` |
| Full suite command | `npm run test` (`vitest run --project unit --reporter=dot`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | `formatMoney` renders `MX$12.50` for es-MX, `$12.50` for en-US, same amount | unit | `npx vitest run src/shared/lib/format.test.ts -t "locale symbol"` | ❌ Wave 0 |
| D-01 | Digit grouping uses `Intl.NumberFormat(locale)` (not hardcoded), verified for a 4+ digit amount (e.g. 1234.5) | unit | same file | ❌ Wave 0 |
| D-04 | `parseMoneyInput` returns `null` for `'12.5.3'`, `'abc'`, `''` | unit | same file | ❌ Wave 0 |
| D-06 | `formatMoney(amount, {showSign: true})` prefixes `+` for positive amounts; negative amounts unaffected by `showSign` (still `-`) | unit | same file | ❌ Wave 0 |
| D-08 | `no-raw-money-format` selectors flag `.toFixed(2)`, `` `$${...}` `` template literals, and JSX raw-`$`-adjacent patterns | lint (not vitest) | `npm run lint -- eslint-rules/` or a small fixture test if the planner wants one | ❌ Wave 0 (no existing fixture-based lint-rule test harness in this repo — `no-ui-drift.js` has no test file either; precedent is to trust manual verification, consistent with this research's own verification approach) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/shared/lib/format.test.ts` (and `npm run lint` once the ESLint rule task lands)
- **Per wave merge:** `npm run test` + `npm run lint` + `npm run typecheck`
- **Phase gate:** Full suite green (`npm run typecheck && npm run lint && npm run test`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/shared/lib/format.test.ts` — new file, covers D-01, D-04, D-06 (no existing test file to extend)
- [ ] No shared fixture/conftest needed — reuse the existing `i18n.changeLanguage()` pattern from `src/shared/lib/i18n/index.test.ts` directly in the new test file
- [ ] Framework install: none — Vitest already configured and running in this repo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not touched by this phase |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | No | Not touched by this phase |
| V5 Input Validation | Yes (narrow) | `parseMoneyInput`'s regex-based validate-then-`Number()` pattern (D-04) — reject-on-ambiguity, never silently coerce malformed input to `0` or `NaN` that a caller might not check |
| V6 Cryptography | No | Not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/adversarial string reaching `parseMoneyInput` and silently becoming a usable numeric value (e.g. `NaN` coerced to `0` and treated as a valid free-item charge) | Tampering | D-04's `null`-return contract already mitigates this at the function level — the risk is entirely in a *future* caller forgetting to check for `null`. No specific mitigation needed in this phase beyond documenting the contract clearly in JSDoc, since D-03 forbids wiring any real caller in this phase |
| CSV/formula injection via money-formatted strings in exports | Tampering | Not applicable — `formatMoney`/`formatPercent` output flows into UI display and receipts, not into `rowsToCsv()` cell values directly (raw numeric amounts feed CSV rows, already covered by the existing `sanitizeCsvCell()` per CLAUDE.md's Phase 24 note); no new export surface is created by this phase |

## Sources

### Primary (HIGH confidence)
- This repo's `package.json` — `npm view`-equivalent confirmation of installed versions (`i18next@26.3.6`, `react-i18next@17.0.10`, `eslint@9.39.4`, `eslint-plugin-i18next@6.1.5`, `typescript-eslint@8.58.2`, `vitest@4.1.4`, `fast-check@4.6.0`) — read directly, not inferred
- `node -e` runtime execution against `Intl.NumberFormat` in this environment (Node v24.18.0) — empirically verified D-01's core technical question (symbol/grouping/negative-sign behavior for `es-MX`/`en-US`/USD), not sourced from documentation or training data
- Direct execution of `esquery.match()` against this repo's installed `esquery@1.7.0` + `@typescript-eslint/parser`, using representative code snippets modeled on real call sites found via `grep` — verified all 3 candidate lint selectors match/reject correctly
- Full reads of: `src/shared/lib/domain-helpers.ts`, `src/shared/ui/MoneyDisplay.tsx`, `src/shared/lib/receipt-format.ts`, `src/shared/lib/i18n/index.ts`, `src/shared/ui/MoneyInput.tsx`, `src/shared/lib/domain.ts` (relevant sections), `eslint.config.js`, `eslint-rules/no-ui-drift.js`, `src/shared/lib/i18n/index.test.ts`

### Secondary (MEDIUM confidence)
- None used — all claims in this research were either verified via direct tool execution against this repo/environment or cited from files read in full.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every version claim read directly from `package.json`
- Architecture: HIGH — `Intl.NumberFormat` behavior and `esquery` selector behavior both empirically verified against this repo's actual environment, not assumed from training data
- Pitfalls: HIGH — all 5 pitfalls found via direct code reading/grep of this specific codebase, not generic domain knowledge

**Research date:** 2026-08-01
**Valid until:** 90 days (stdlib `Intl` behavior and this repo's own file contents are stable; re-verify if `esquery` or `eslint` major-version bumps occur before planning executes)
