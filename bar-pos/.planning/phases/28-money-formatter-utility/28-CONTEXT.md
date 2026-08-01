# Phase 28: Money Formatter Utility - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate money/percent formatting into a single `shared/lib/format.ts`, backed by `Intl.NumberFormat` and respecting the Phase 21 staff locale (`es-MX` / `en-US`). This replaces the existing hardcoded, locale-blind `formatMoney()` in `src/shared/lib/domain-helpers.ts`, migrates its ~40 call sites, and adds an `no-raw-money-format` ESLint rule to prevent regressions. `parseMoneyInput` and `formatPercent` are new exports with no prior equivalent in the codebase.

</domain>

<decisions>
## Implementation Decisions

### Currency & Locale Formatting
- **D-01:** Currency symbol differs by locale, not locale-invariant: `es-MX` shows `MX$12.50`, `en-US` shows `$12.50` — for the exact same underlying USD amount. This requires a custom locale→symbol map (`{'es-MX': 'MX$', 'en-US': '$'}`); it is NOT raw `Intl.NumberFormat(locale, {style:'currency', currency:'USD'})` output, which would render `es-MX` as `US$12.50`. Digit grouping and decimal punctuation still follow `Intl.NumberFormat(locale)` number-formatting conventions (the symbol map only overrides the prefix, not the numeric portion). — **Reversibility:** costly — every screenshot/e2e assertion and receipt currently expects `$`; changing the es-MX prefix again later means re-touching all of them.
- **D-02:** The underlying currency is USD in both locales — this is a display-symbol difference only, not a multi-currency system. No currency conversion, no per-locale amount storage change.

### parseMoneyInput Scope
- **D-03:** `parseMoneyInput` ships as a new export from `format.ts` for future use only. Do NOT retrofit existing money input fields (`PaymentForm`, `RefundSheet`, `SplitTabSheet`) to use it in this phase — those are payment-critical surfaces the Phase 33 sweep just standardized, and none of them are broken today.
- **D-04:** On malformed input (`'12.5.3'`, `'abc'`, empty string), `parseMoneyInput` returns `null`. No throw, no `Result<T>` wrapper — callers check for `null` and handle their own validation UI.

### Codemod & Migration Scope
- **D-05:** Migration of the ~40 `formatMoney` call sites is a manual find-and-replace pass, not a scripted codemod (jscodeshift/ts-morph). — **Note for planner:** ROADMAP.md's phase description says "codemod to migrate existing call sites" — this decision deviates from that literal wording. Flag/confirm during planning if that matters, but the user's explicit direction here is manual migration.
- **D-06:** `format.ts`'s `formatMoney` takes a new signature: `formatMoney(amount: number, options?: { showSign?: boolean }): string` — not a drop-in of the old `(amount: number): string` signature. `showSign` controls an explicit `+` prefix for positive amounts (e.g. refund/adjustment displays); negative amounts already render with `-`/`−` as today. Locale is read internally from the i18n singleton — no locale-override param on the function itself (no `{ locale? }` option).
- **D-07:** Because the signature changed (added a second optional param), the manual migration pass is a straight import-path swap for existing call sites (`options` is optional, so untouched call sites keep working) — only call sites that need `showSign` require an actual code change beyond the import.

### ESLint Rule Strictness
- **D-08:** `no-raw-money-format` flags BOTH `.toFixed(2)` calls AND string/template literals combining a raw `'$'` with a number expression — the two ways ad-hoc money formatting currently appears in the codebase.
- **D-09:** Rule exemptions — Claude's discretion (see below).

### Claude's Discretion
- Exact exemption list for `no-raw-money-format` (D-09). User selected "You decide" between `{format.ts + tests}` and `{format.ts + tests + receipt-format.ts}`. Recommendation carried into planning: exempt `format.ts` (the implementation itself) and `*.test.ts`/`*.test.tsx` files; do NOT blanket-exempt `receipt-format.ts` since it already calls `formatMoney()` correctly today — if the rule flags something there, treat that as a real signal to fix rather than grounds to exempt the file. Planner/researcher should verify this against the actual receipt-format.ts content before finalizing the ESLint config.
- Precise `.toFixed(2)` detection scope (e.g., whether to flag `.toFixed(2)` calls anywhere in `src/` vs. only within money-shaped variable/prop names) — left to implementation, since money is the overwhelming real-world use of `.toFixed(2)` in this codebase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 21 — i18n / locale foundation (dependency)
- `src/shared/lib/i18n/index.ts` — i18next singleton; `lng`/`fallbackLng` default `es-MX`; this is the source of "current staff locale" that `format.ts` reads internally (per D-06, no locale param on formatMoney)
- `src/shared/lib/domain.ts` — `LocaleSchema` (`'es-MX' | 'en-US'`), `profiles.locale` field
- CLAUDE.md "i18n / Multi-Language" section — namespace scheme, locale-is-per-staff-preference model

### Existing money formatting (being replaced/consolidated)
- `src/shared/lib/domain-helpers.ts:158` — current `formatMoney(amount: number): string`, hardcoded `$` prefix, no locale awareness — this is the function being superseded
- `src/shared/ui/MoneyDisplay.tsx` — wraps `formatMoney` from domain-helpers.ts; needs its import updated during migration
- `src/shared/lib/receipt-format.ts` — 8 call sites using `formatMoney` for receipt/precheque line items; already imports correctly, do not blanket-exempt from lint rule (see Claude's Discretion above)
- CLAUDE.md's "Operational reports suite + CSV" note documents a prior `MoneyDisplay` double-`$`-prefix bug (already fixed) — relevant history when touching this component again

No SPEC.md exists for this phase; ROADMAP.md §Phase 28 (line 884) and this CONTEXT.md are the scope of record. ROADMAP.md's `Requirements: TBD` note references a since-removed `POS-COMPARISON.md §28` — treat this CONTEXT.md as the authoritative scope, not that missing doc.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/lib/domain-helpers.ts` — existing `formatMoney` implementation (JSDoc examples, negative-amount handling) is the behavioral baseline to preserve for default calls
- `src/shared/ui/MoneyDisplay.tsx` — existing component pattern for how negative/sign styling is layered on top of a plain formatted string; formatPercent's UI consumers (if any added later) can follow the same pattern

### Established Patterns
- No `Intl.NumberFormat` usage exists anywhere in `src/` today — this phase introduces the pattern from scratch, nothing to be consistent with except the locale-singleton convention from Phase 21
- Raw percent display today is ad-hoc template-literal concatenation (`` `${percent}%` ``) in `PaymentForm.tsx` (2 sites) and `.toFixed(1)}%` in `WaitlistAnalyticsReport.tsx` — these are the real-world shape `formatPercent` should match/replace, though retrofitting them was not explicitly locked as in-scope during this discussion (follow the same "new utility, no forced retrofit" spirit as D-03 unless planner decides otherwise)

### Integration Points
- `domain-helpers.ts` currently imports are the single choke point — ~40 files import `formatMoney` from there; migration touches only the import line in the common case (D-07)
- ESLint config lives at `eslint.config.js` (per CLAUDE.md's i18n lint-gate precedent — `i18next/no-literal-string` is already a custom-scoped rule there, follow the same registration pattern for `no-raw-money-format`)

</code_context>

<specifics>
## Specific Ideas

- The es-MX vs en-US symbol distinction (`MX$` vs `$`) was the most deliberated point in this discussion — the user went through several rounds before locking D-01. This is the single highest-risk-of-misimplementation decision in this phase; researcher/planner should treat it as the load-bearing requirement, not a minor detail.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No todos matched this phase during cross-reference.

</deferred>

---

*Phase: 28-Money Formatter Utility*
*Context gathered: 2026-08-01*
