# Phase 28: Money Formatter Utility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 28-Money Formatter Utility
**Areas discussed:** Currency & locale formatting, parseMoneyInput scope, Codemod & migration scope, ESLint rule strictness

---

## Currency & Locale Formatting

| Option | Description | Selected |
|--------|-------------|----------|
| Always USD '$', locale-invariant | Intl.NumberFormat with currency:'USD', symbol stays '$' regardless of locale | |
| Locale changes symbol too | es-MX → distinct marker, en-US → '$' | ✓ |
| You decide | Default to locale-invariant | |

**User's choice:** Locale changes symbol too.
**Notes:** Follow-up clarification needed — user's next answer ("Force '$' symbol always") appeared to contradict this pick, so a clarifying question was asked directly.

| Option | Description | Selected |
|--------|-------------|----------|
| Accept 'US$' for es-MX locale | Standard ICU/Intl.NumberFormat currency:'USD' output | |
| Force '$' symbol always | narrowSymbol override, pixel-identical to today in both locales | ✓ (superseded by clarification below) |
| You decide | Default to narrowSymbol/'$' override | |

**Notes:** This answer was superseded — the clarifying question below established the user actually wants the symbol to differ per locale, not be forced identical.

**Clarification:** "Locale affects grouping only, symbol stays '$'" vs "Symbol should actually differ per locale (e.g. MX$ vs $)" → user selected **the symbol should differ**.

| Option | Description | Selected |
|--------|-------------|----------|
| es-MX: 'US$12.50' / en-US: '$12.50' | Raw Intl.NumberFormat ICU output, zero custom code | |
| es-MX: 'MX$12.50' / en-US: '$12.50' | Custom symbol override/map, not pure Intl defaults | ✓ |
| You decide | Default to raw ICU output | |

**User's choice:** es-MX: 'MX$12.50' / en-US: '$12.50' — final locked decision (D-01, D-02 in CONTEXT.md).
**Notes:** This was the most-deliberated point in the whole discussion — three rounds of questions to converge. Flagged in CONTEXT.md `<specifics>` as the highest-risk decision to misimplement.

---

## parseMoneyInput Scope

| Option | Description | Selected |
|--------|-------------|----------|
| New utility only, no call-site wiring | Export from format.ts, don't retrofit PaymentForm/RefundSheet/SplitTabSheet | ✓ |
| Wire into existing money input fields | Retrofit payment-critical inputs | |
| You decide | Default to utility-only | |

**User's choice:** New utility only, no call-site wiring.

| Option | Description | Selected |
|--------|-------------|----------|
| Return null on invalid input | Caller checks for null | ✓ |
| Throw on invalid input | try/catch required | |
| You decide | Default to null | |

**User's choice:** Return null on invalid input.

---

## Codemod & Migration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted codemod (jscodeshift/ts-morph) | Automated rewrite across ~40 files | |
| Manual find-and-replace pass | Hand-edit ~40 files, no throwaway script | ✓ |
| You decide | Default to scripted codemod (matches roadmap wording) | |

**User's choice:** Manual find-and-replace pass.
**Notes:** This deviates from ROADMAP.md's literal "a codemod to migrate existing call sites" wording — flagged for the planner to confirm/reconcile.

| Option | Description | Selected |
|--------|-------------|----------|
| Same signature: formatMoney(amount: number): string | Drop-in replacement, pure import-path swap | |
| New signature (e.g. adds options param) | More flexible, larger diff for call sites needing it | ✓ |
| You decide | Default to same signature | |

**User's choice:** New signature (options param).

| Option | Description | Selected |
|--------|-------------|----------|
| { showSign?: boolean } | Only controls '+' prefix for positive amounts | ✓ |
| { showSign?, locale? } | Also allows per-call locale override | |
| You decide | Default to including locale override | |

**User's choice:** { showSign?: boolean } only — no locale override param.

---

## ESLint Rule Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Both: .toFixed(2) and '$'+template literals | Broadest net | ✓ |
| Just .toFixed(2) | Narrower, avoids false positives on raw '$' detection | |
| You decide | Default to .toFixed(2) everywhere + literal '$' patterns | |

**User's choice:** Both: .toFixed(2) and '$'+template literals.

| Option | Description | Selected |
|--------|-------------|----------|
| format.ts + all *.test.ts/tsx | Narrowest exemption list | |
| format.ts + tests + receipt-format.ts | Also exempts receipt-format.ts | |
| You decide | Default to format.ts + tests only (receipt-format.ts not blanket-exempted) | ✓ |

**User's choice:** You decide.
**Notes:** Carried into CONTEXT.md as Claude's Discretion — default to NOT exempting receipt-format.ts since it already calls formatMoney correctly; a lint hit there is a real signal to fix, not exempt.

---

## Claude's Discretion

- Exact ESLint exemption list beyond format.ts + tests (whether receipt-format.ts needs any exemption) — recommendation: no blanket exemption, verify against actual file content during planning.
- Precise `.toFixed(2)` detection scope (blanket in `src/` vs. scoped to money-shaped identifiers).
- formatPercent retrofit scope for existing ad-hoc percent displays (PaymentForm.tsx, WaitlistAnalyticsReport.tsx) — not explicitly locked; follow the same "new utility, no forced retrofit" spirit as parseMoneyInput unless planner decides otherwise.

## Deferred Ideas

None — discussion stayed within phase scope.
