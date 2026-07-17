# Phase 21: i18n Multi-Language - Research

**Researched:** 2026-07-17
**Domain:** React i18n (react-i18next), Zod/Supabase schema extension, custom ESLint rule authoring, Tauri Rust↔TS boundary, FSD large-scale codemod
**Confidence:** MEDIUM-HIGH — core library setup is HIGH confidence (verified on npm registry, cross-checked with official docs); scope sizing and RBAC-gate gap are HIGH confidence (measured directly against this repo); ESLint-rule-vs-plugin tradeoff and Rust receipt-label approach are MEDIUM (reasoned recommendations, not the only valid path).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `profiles.locale` is per-staff, not per-terminal. Persists across devices/logins.
- **D-02:** es-MX is the default locale for new/unset profiles.
- **D-03:** Self-service switcher lives in Settings; admin can also set a staff member's locale when managing staff (Staff management page).
- **D-04:** Big-bang migration in this phase — every FSD layer (`shared/ui`, `entities`, `features`, `widgets`, `pages`) gets moved to i18next catalogs now. No deferred routes.
- **D-05:** `no-raw-hardcoded-strings`-style rule is strict everywhere from day one — no grandfather/ignore list. Big-bang migration means there should be nothing left to grandfather.
- **D-06:** Printed receipts (Tauri Rust) and generated PDFs (reports) follow the *logged-in staff's* UI locale (`profiles.locale`), not a fixed business language. Consistent with D-01/D-02 — locale is a staff attribute that flows through to everything that staff member produces.

### Claude's Discretion

- Catalog file structure/namespacing (per-feature vs per-page vs single catalog) — planner's call based on FSD layer boundaries.
- Exact ESLint rule implementation (custom rule vs existing plugin like `eslint-plugin-i18next`) — research/planner's call.
- Whether `profiles.locale` also drives `Intl.NumberFormat`/date formatting or stays scoped to UI string translation only — planner should confirm against Phase 28 (Money Formatter Utility, which depends on Phase 21) to avoid overlap.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

No numbered requirement IDs exist for this phase (`POS-COMPARISON.md` source doc is no longer present per ROADMAP.md note). Scope is defined entirely by ROADMAP.md §Phase 21's 4 success criteria and 21-CONTEXT.md's 6 locked decisions, both reproduced below for traceability.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `react-i18next` wired with `es-MX` and `en-US` catalogs | Standard Stack, Architecture Patterns, Code Examples sections |
| SC-2 | `profiles.locale` column drives per-user language preference | Runtime State Inventory, Code Examples (migration + Zod pattern) |
| SC-3 | Custom ESLint rule flags new hard-coded (non-translated) UI strings | Don't Hand-Roll, Architecture Patterns (ESLint rule section) |
| SC-4 | Existing UI strings migrated to catalogs without visual regression | Common Pitfalls, Scope Sizing (below), Validation Architecture |
</phase_requirements>

## Summary

This is a greenfield i18n phase on a codebase with **zero existing i18n infrastructure** — no `react-i18next`, no locale column, no translation catalogs (confirmed by grep). The library choice is uncontroversial: `react-i18next` 17.0.10 + `i18next` 26.3.6 (verified current on npm, both official `i18next` org packages, huge download counts — legitimate despite the automated legitimacy gate flagging "too-new" on their most recent patch release). Because this is a Tauri desktop app with **no CDN and an offline requirement**, catalogs must be statically imported as JSON and passed to `i18next.init({ resources })` — do NOT use `i18next-http-backend` (that fetches over HTTP, which is pointless and fragile for a bundled desktop app).

Three findings materially change how this phase should be planned, beyond what CONTEXT.md's discretion questions asked for:

1. **The Settings page RBAC gate blocks bartenders from self-service locale switching.** D-03 says "self-service switcher lives in Settings," but `SettingsTabsPanel` currently renders **zero tabs** for any role without `manage_settings` (admin-only) or `manage_products` (manager+) — a bartender hitting `/settings` today sees only "You do not have permission to view settings." A language switcher tab must sit **outside** that permission gate, or bartenders can never change their own language. This is a structural change to `SettingsTabsPanel`, not just "add a tab."
2. **The receipt/PDF printing pipeline has TWO parallel, already-inconsistent hardcoded-string sources** — `src/shared/lib/receipt-format.ts` (TS, final receipt in English, pre-cheque in Spanish) and `src-tauri/src/commands/printer.rs` (Rust, English only, hand-duplicated from the TS file per its own top-of-file comment "keep both in sync"). D-06 requires both to become locale-aware. Duplicating a Rust-side translation table is realistic but doubles the maintenance surface the code comment already flags as fragile — recommend moving the label-selection into TS (fully-formatted lines sent to Rust) instead of teaching Rust to translate. See Architecture Patterns.
3. **Scope is large.** Direct grep against this repo: 232 non-test/non-story `.tsx` files, ~108 files contain plain JSX text nodes, 259 `toast.success/error/info/warning(...)` calls with literal strings, 54 `placeholder="..."` literals, 55 `aria-label="..."` literals. This is not a 1-plan phase — plan multiple waves sequenced by FSD layer.

**Primary recommendation:** `react-i18next` + `i18next` with statically-bundled per-locale JSON resources (no HTTP backend), a single flat namespace per FSD layer-group (not per-file), `eslint-plugin-i18next`'s `no-literal-string` rule (not a hand-rolled selector set) tuned with `mode: 'all'` + `jsx-attributes`/`callees`/`words` excludes, a `profiles.locale` column with `es-MX` default seeded via idempotent `ADD COLUMN IF NOT EXISTS`, and moving Rust's `build_receipt_lines` label selection into TypeScript to avoid a second translation table.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI string translation (buttons, labels, toasts) | Browser / Client (React) | — | `react-i18next` runs entirely client-side; no server round-trip needed for static catalogs |
| Locale preference storage | Database / Storage (`profiles.locale`) | API/Backend (Supabase RLS) | Must persist per-staff across devices/logins (D-01) — client-only storage (localStorage) cannot satisfy this |
| Locale-aware date/time display | Browser / Client | — | `toLocaleString()`/`Intl.DateTimeFormat` calls already exist client-side; just need explicit locale arg instead of implicit browser default |
| Receipt printing (thermal, ESC/POS) | Browser / Client (builds text) → Tauri Rust (encodes bytes) | — | Recommend TS builds fully-translated lines; Rust only does ESC/POS byte encoding (see Pitfall 2) — avoids a second translation table in Rust |
| Report PDF export | Browser / Client (`@react-pdf/renderer` runs in JS/Node, not native) | — | PDF docs are React components; `i18n.t()` (not the `useTranslation()` hook) must be used since `pdf()` renders outside the app's React tree/Provider |
| ESLint enforcement of new hardcoded strings | Browser tooling / Client (build-time, not runtime) | — | Static analysis at lint time; zero runtime cost |
| Money/number formatting (`Intl.NumberFormat`) | **Out of scope for Phase 21** — owned by Phase 28 | — | ROADMAP.md Phase 28 explicitly "respect[s] the Phase 21 locale" — Phase 21 must expose the locale value, not implement money formatting itself (see Open Questions #1) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-i18next` | 17.0.10 [VERIFIED: npm registry] | React bindings (`useTranslation`, `Trans`, `I18nextProvider`) | De facto standard React i18n binding; 13M weekly downloads; peer-compatible with React 19 (`peerDependencies.react: >= 16.8.0`) [VERIFIED: npm registry] |
| `i18next` | 26.3.6 [VERIFIED: npm registry] | Core translation engine (interpolation, pluralization, namespaces) | Required peer of react-i18next (`>= 26.2.0`) [VERIFIED: npm registry]; framework-agnostic core, no runtime HTTP dependency needed for bundled resources |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint-plugin-i18next` | 6.1.5 [VERIFIED: npm registry] | `no-literal-string` rule — flags hardcoded JSX text/attributes/call arguments | Satisfies SC-3; purpose-built for exactly this rule, avoids hand-rolling literal-string-exclusion heuristics (numbers, single chars, technical strings, JSX attrs to ignore) |

**Not needed:** `i18next-http-backend`, `i18next-browser-languagedetector` (locale comes from `profiles.locale`, not browser `navigator.language` — see Common Pitfalls), `i18next-icu` (no evidence of ICU-message-format needs in current strings).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-i18next` | `next-intl` | Next.js-specific; irrelevant — this is a Vite/Tauri SPA, not Next.js |
| `react-i18next` | `lingui` | Requires a Babel/SWC macro compile step; adds build complexity for no benefit here since catalogs are hand-authored, not extracted via AST macros |
| `eslint-plugin-i18next` | Hand-rolled `no-restricted-syntax` selectors (repo's own `eslint-rules/no-ui-drift.js` pattern) | Repo precedent exists and integrates cleanly with flat config, but literal-string detection has many edge cases (numeric strings, CSS class names, technical IDs, JSX attrs like `data-testid`) that `eslint-plugin-i18next` already solves via its `words`/`jsx-attributes`/`callees` exclude lists — reinventing this is real, ongoing maintenance cost for no benefit |
| Static JSON `resources` in `i18next.init()` | `i18next-http-backend` fetching `/locales/{{lng}}/{{ns}}.json` | HTTP backend assumes a server or public dir served over HTTP — irrelevant/fragile for an offline-capable Tauri desktop app with no CDN; static bundling means catalogs ship in the same signed binary, no runtime fetch failure mode |

**Installation:**
```bash
npm install react-i18next i18next
npm install -D eslint-plugin-i18next
```

**Version verification:** All three versions above were confirmed live on the npm registry via `npm view <pkg> version` during this research session (2026-07-17). `react-i18next` requires `i18next >= 26.2.0` as a peer — do not pin an older `i18next` version.

## Package Legitimacy Audit

| Package | Registry | Age (repo) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `react-i18next` | npm | Established (`i18next` org, multi-year) | 13,058,476 | github.com/i18next/react-i18next | SUS (automated: "too-new" — flags the *latest patch's* publish date, 2026-07-15, not project age) | Approved — huge download count + official org repo overrides the "too-new" heuristic; still gate the install behind `checkpoint:human-verify` per protocol |
| `i18next` | npm | Established (`i18next` org, multi-year) | 18,534,412 | github.com/i18next/i18next | SUS (same "too-new" false-positive reason) | Approved — same reasoning; gate behind `checkpoint:human-verify` |
| `eslint-plugin-i18next` | npm | Established (single maintainer, multi-year) | 1,110,501 | github.com/edvardchen/eslint-plugin-i18next | SUS (same "too-new" false-positive reason) | Approved with note — single-maintainer project (lower bus-factor than the other two), but 1.1M weekly downloads and an active repo; gate behind `checkpoint:human-verify` |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all three, but only because the legitimacy heuristic's "too-new" signal measures latest-publish-date recency, not package/project age — all three are long-established, high-download, officially-repo'd packages. The planner should still insert one `checkpoint:human-verify` task before `npm install` (per protocol), but this is a low-risk formality here, not a real red flag.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  profiles.locale (Supabase, per-staff, default 'es-MX')              │
│  D-01: persists across devices/logins                                │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ read on login / staff-store hydrate
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  entities/staff store (Zustand) — currentStaff.locale               │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ drives i18n.changeLanguage(locale)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  i18next instance (app/ init, singleton)                             │
│  resources: { 'es-MX': {...catalogs}, 'en-US': {...catalogs} }       │
│  (statically imported JSON — no HTTP backend, offline-safe)          │
└──────────┬───────────────────────────────────────┬───────────────────┘
           │ useTranslation() hook                  │ i18n.t() imperative
           ▼                                        ▼
┌───────────────────────┐              ┌──────────────────────────────┐
│ React component tree   │              │ Non-component contexts:      │
│ shared/ui → entities   │              │ - toast.success/error() calls│
│ → features → widgets   │              │ - @react-pdf/renderer docs   │
│ → pages                │              │   (rendered via pdf(), OUT-  │
│ (JSX text + attrs)      │              │   SIDE the Provider tree)    │
└───────────────────────┘              └──────────┬───────────────────┘
                                                    │ locale + translated
                                                    │ label strings
                                                    ▼
                                        ┌──────────────────────────────┐
                                        │ pos-printer.ts (TS)           │
                                        │ builds fully-translated       │
                                        │ receipt LINES in TS           │
                                        │ (recommend: move label logic  │
                                        │ out of Rust — see Pitfall 2)  │
                                        └──────────┬───────────────────┘
                                                    │ invoke('print_receipt',
                                                    │  { lines: [...] })
                                                    ▼
                                        ┌──────────────────────────────┐
                                        │ src-tauri/printer.rs          │
                                        │ ESC/POS byte encoding ONLY    │
                                        │ (no label strings left here)  │
                                        └──────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── i18n/
│   │   ├── index.ts              # i18next.init() singleton, called once in main.tsx
│   │   └── locales/
│   │       ├── es-MX/
│   │       │   ├── common.json   # shared/ui + entities strings (buttons, statuses, generic labels)
│   │       │   ├── pos.json      # pos/tabs/payments feature strings
│   │       │   ├── inventory.json
│   │       │   ├── staff.json
│   │       │   ├── settings.json
│   │       │   ├── reports.json
│   │       │   └── receipt.json  # printer/PDF label strings (used by non-component i18n.t() calls)
│   │       └── en-US/
│   │           └── (mirrors es-MX file list, 1:1 key parity required)
├── shared/lib/i18n-types.ts       # `declare module 'i18next'` augmentation for typed t()
```

**Namespacing decision:** Namespace **by domain area, not by FSD layer and not by individual file.** Rationale: FSD layers (`shared/ui`, `entities`, `features`, `widgets`, `pages`) do not map to translation *domains* — a "Cancel" button string in `shared/ui/button` and a "Cancel Order" string in `features/void-order` are both plausibly reused across many pages; splitting catalogs strictly by FSD layer would force every feature to load 5 namespaces just to render one screen, and splitting per-file would produce 232+ tiny JSON files with massive key duplication (e.g. "Cancel" repeated in 40 files). A **flat file per domain area** (`common`, `pos`, `inventory`, `staff`, `settings`, `reports`, `receipt`) keeps catalogs small enough to review, lets `i18next`'s namespace lazy-loading (if ever needed later) work per-domain, and matches how a translator/reviewer would actually think about the strings ("all the inventory-page copy" vs "all the `features/` copy"). `common.json` holds cross-cutting strings (button labels, status words, validation messages) referenced via `useTranslation(['common', 'pos'])` multi-namespace loading.

### Pattern 1: i18next singleton init (offline, statically bundled)
**What:** Initialize `i18next` once at app startup with resources statically imported — no network fetch, works fully offline in the packaged Tauri binary.
**When to use:** App bootstrap, before the router mounts.
**Example:**
```typescript
// src/app/i18n/index.ts
// Source: react-i18next official quick-start (https://react.i18next.com/guides/quick-start), adapted for static bundling
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esCommon from './locales/es-MX/common.json';
import enCommon from './locales/en-US/common.json';
// ...repeat per namespace

void i18n.use(initReactI18next).init({
  resources: {
    'es-MX': { common: esCommon /* , pos: esPos, ... */ },
    'en-US': { common: enCommon /* , pos: enPos, ... */ },
  },
  lng: 'es-MX', // overwritten on staff-store hydrate, see Pattern 2
  fallbackLng: 'es-MX', // D-02: es-MX is the default
  ns: ['common' /* , 'pos', 'inventory', ... */],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
```

### Pattern 2: Drive `i18n.changeLanguage()` from `profiles.locale`, not `navigator.language`
**What:** On staff login/hydrate, call `i18n.changeLanguage(currentStaff.locale)` — never read the browser/OS locale as the source of truth.
**When to use:** In the Zustand staff store's login success handler (`entities/staff/model/store.ts`), immediately after `currentStaff` is set.
**Example:**
```typescript
// entities/staff/model/store.ts (conceptual — exact hook depends on existing store shape)
import i18n from '@app/i18n';
// ...inside the action that sets currentStaff after successful login/fetch:
void i18n.changeLanguage(staff.locale); // 'es-MX' | 'en-US', D-01/D-02
```
This satisfies D-01 (per-staff, follows login across devices/terminals) without relying on OS/browser locale, which is shared-terminal state and would leak one staff member's language choice onto the next staff member's shift on the same terminal.

### Pattern 3: Non-component translation (toasts, PDF docs, Rust payload) via `i18n.t()`
**What:** Outside a React component's render (toast calls fired from a mutation hook's `onError`, or a `@react-pdf/renderer` `Document` built via the imperative `pdf()` API which does **not** run inside the app's `I18nextProvider` tree), use the imported `i18n` singleton's `.t()` method directly — `useTranslation()`'s hook form requires React context that these call sites don't have.
**When to use:** `toast.success(i18n.t('common:saved'))`; PDF report builders (`src/shared/lib/exporters/pdf.tsx`); `src/shared/lib/receipt-format.ts`.
**Example:**
```typescript
// Source: react-i18next docs, "Using outside of React" pattern (https://react.i18next.com/latest/using-with-hooks)
import i18n from '@app/i18n';
toast.success(i18n.t('common:orderSaved'));
```

### Anti-Patterns to Avoid
- **`useTranslation()` hook inside `@react-pdf/renderer` document components:** these components are rendered via the imperative `pdf(<Doc />).toBlob()` call, not mounted under the app's `<I18nextProvider>` — the hook will silently fall back to `i18n.language` defaults / throw if no provider is found in some setups. Use `i18n.t()` directly instead (Pattern 3).
- **Reading `navigator.language` / OS locale as the source of truth:** this is shared-terminal state on a Tauri desktop kiosk where multiple staff clock in/out on the same physical machine — D-01 explicitly requires per-staff persistence, which OS locale cannot provide.
- **A second, hand-maintained label table in Rust (`printer.rs`):** the file already has a comment admitting "keep both in sync" between TS and Rust for the receipt layout — adding a third parallel translation table there compounds an already-acknowledged maintenance smell. See Pitfall 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting hardcoded JSX text/attribute/call-argument string literals | A custom `no-restricted-syntax` selector set (repo already has `eslint-rules/no-ui-drift.js` as a working precedent for this pattern) | `eslint-plugin-i18next`'s `no-literal-string` rule | The rule already handles the hard edge cases a hand-rolled AST selector would need to reinvent: excluding numeric-only strings, single-character strings, `className`/`data-testid`-style attributes, `cn()`/`clsx()` callee arguments, and template-literal validation — all configurable via `jsx-attributes`, `callees`, and `words` exclude lists [CITED: github.com/edvardchen/eslint-plugin-i18next/blob/main/docs/rules/no-literal-string.md] |
| Pluralization / interpolation logic | Manual `count === 1 ? 'item' : 'items'` string concatenation scattered across components | `i18next`'s built-in `t('key', { count })` pluralization and `{{variable}}` interpolation | i18next handles locale-specific plural rules (es-MX and en-US both use simple singular/plural, but the API is the same regardless) and interpolation escaping automatically |
| Locale-aware date formatting | Hand-written date formatters per locale | `Intl.DateTimeFormat(locale, opts)` (native), invoked with the resolved `i18n.language` value | Native browser/WebView2 API, zero dependencies, already partially in use (`toLocaleString()` calls exist in 60 call sites) — just needs an explicit locale argument instead of relying on implicit browser default |

**Key insight:** The temptation in this phase is to write one big custom ESLint rule file (the repo has a working precedent in `no-ui-drift.js`) — resist it. String-literal detection is a much broader, edgier surface than the 4 narrow AST patterns `no-ui-drift.js` targets (raw `<button>`, raw `<input>`, hex colors, arbitrary-spacing classes), and `eslint-plugin-i18next` is a purpose-built, actively-published solution for exactly this rule (SC-3).

## Runtime State Inventory

> Rename/refactor triggers do not directly apply (this is additive: new column, new package, new catalogs) — but `profiles.locale` interacts with existing runtime state, documented below per the protocol's "answer explicitly, don't leave blank" rule.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `profiles` table has no `locale` column today (confirmed: migration `20260414000002_profiles_and_shifts.sql` does not define it; no later migration adds it either — grepped all of `supabase/migrations/`) | Data migration: `ALTER TABLE profiles ADD COLUMN locale text NOT NULL DEFAULT 'es-MX'` (idempotent `IF NOT EXISTS`, mirrors the `must_change_pin` precedent in `20260703000005_force_pin_change.sql`) — existing rows backfill to `'es-MX'` automatically via the column default, no separate UPDATE needed |
| Live service config | None found — no n8n/external service holds a copy of staff locale | None |
| OS-registered state | None found — no OS task scheduler / pm2 / launchd entries reference language/locale | None |
| Secrets/env vars | None — no env var currently gates language | None |
| Build artifacts | `src/shared/lib/supabase.types.ts` will be stale immediately after the migration (must add `locale: string` to `profiles` Row/Insert/Update per CLAUDE.md's documented pre-regeneration workaround: `const db = supabase as any` cast at file level, OR manually transcribe the column like the `must_change_pin` precedent did when Docker was unavailable) | Regenerate via `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` once the migration is pushed, or manually transcribe (repo precedent: 5+ prior phases did this due to Docker/WSL pipe unavailability, see STATE.md) |

**Nothing found in category:** confirmed explicitly for "Live service config", "OS-registered state", "Secrets/env vars" — verified by grep across `supabase/migrations/`, `.env.local` pattern usage, and no `n8n`/task-scheduler references exist in this codebase (bar-pos has no such integrations per CLAUDE.md's documented stack).

## Common Pitfalls

### Pitfall 1: Settings page RBAC gate blocks self-service access for bartenders
**What goes wrong:** D-03 says "self-service switcher lives in Settings," but `SettingsTabsPanel` (`src/widgets/SettingsTabsPanel/index.tsx`) currently renders **zero tabs** unless the current role passes `can('manage_settings')` (admin-only, per `src/shared/lib/rbac.ts`'s `ADMIN_EXTRA` set) or `can('manage_products')` (manager+, per `MANAGER_EXTRA`). A bartender navigating to `/settings` today sees only the fallback message "You do not have permission to view settings." If a language-switcher tab is added inside the existing `canManageSettings`/`canManageProducts` conditional blocks (the natural-looking place to add it), bartenders will never be able to change their own language — directly contradicting D-03's "self-service" requirement.
**Why it happens:** `SettingsTabsPanel`'s tab list is built entirely inside two role-gated `if` blocks (lines ~32 and ~66 of `index.tsx`); there is currently no "always visible regardless of role" tab category.
**How to avoid:** Add a third, role-agnostic tab list (or restructure the `firstTab`/fallback logic) so a "Language" tab renders for every authenticated role, independent of `manage_settings`/`manage_products`. This is a structural change to `SettingsTabsPanel`'s tab-assembly logic, not just "drop a new tab into the existing array."
**Warning signs:** If the plan's tasks only say "add a Language tab to SettingsTabsPanel" without touching the `canManageSettings`/`canManageProducts` gating logic, this pitfall was not addressed.

### Pitfall 2: Rust `printer.rs` and TS `receipt-format.ts` are two hand-synced hardcoded-string sources — and they already disagree
**What goes wrong:** `src-tauri/src/commands/printer.rs`'s `build_receipt_lines()` hardcodes English labels ("Date", "Cashier", "Subtotal", "Tip", "Total", "Payment", "Tendered", "Change", "Ref") directly as Rust string literals, and its top-of-file comment says "Layout mirrors `bar-pos/src/shared/lib/receipt-format.ts` — keep both in sync." Meanwhile `receipt-format.ts`'s `buildThermalReceiptText()` (final receipt) uses the *same* English labels, but the neighboring `buildPreChequeText()` in the **same file** already uses hardcoded **Spanish** labels ("Fecha", "Cajero", "Cliente", "Mesa", "CUENTA PREVIA"). This proves the "keep both in sync" comment is already unreliable in practice — the two receipt types in the same file don't even agree on language today.
**Why it happens:** No shared translation source between Rust and TS; each side hand-writes its own label strings, and even within TS, two receipt-building functions were authored independently.
**How to avoid:** Do not add a *third* language-selection table in Rust. Instead, move label selection entirely into TypeScript (which already has `i18next` after this phase): build the fully-translated line array in TS using `i18n.t()`, and change `print_receipt`'s Tauri command signature to accept pre-formatted `lines: string[]` instead of raw `ReceiptPrintDto` fields that Rust re-labels. Rust's `printer.rs` then only does ESC/POS byte encoding (`lines_to_esc_pos`) — no string literals to translate. This requires touching `ReceiptPrintDto` (Rust struct), the `receiptDataToPrinterJson()` mapper (TS), and `printReceipt()`'s `invoke()` call (TS) — flag as its own task, not a drive-by string swap.
**Warning signs:** A plan that adds an `es-MX`/`en-US` match arm inside `payment_method_label()` or a parallel `label_for(locale, key)` function in Rust is recreating the duplication this pitfall warns against.

### Pitfall 3: `toLocaleString()`/`toLocaleDateString()` calls (60 call sites) silently use the browser/WebView2 default locale, not the staff's chosen locale
**What goes wrong:** All 60 grepped call sites (e.g. `pos-printer.ts`'s `data.processedAt.toLocaleString()`, `pdf.tsx`'s `report.cajaSession.openedAt.toLocaleDateString()`) call `Date.prototype.toLocaleString()` with **no locale argument**, meaning they silently use whatever locale the OS/WebView2 reports — which on a shared Windows kiosk terminal is a machine-level setting, not the logged-in staff's `profiles.locale` choice. After this phase ships, an `en-US`-preference staff member on a Windows install configured for `es-MX` will still see Spanish-formatted dates on their translated-English receipt.
**Why it happens:** `toLocaleString()`'s locale argument is optional and easy to omit; every existing call site omits it because there was no locale concept in the codebase before this phase.
**How to avoid:** Pass the resolved `i18n.language` (or `currentStaff.locale`) explicitly: `date.toLocaleString(locale, opts)`. Whether to do this broadly in Phase 21 or narrowly (only receipts/PDFs, per D-06) is exactly Open Question #1 below — flag both options for the planner.
**Warning signs:** Any call site changed to use i18next `t()` for labels but left `toLocaleString()` unchanged will still show a mismatched date locale next to a correctly-translated label.

### Pitfall 4: `exactOptionalPropertyTypes: true` will reject a naive optional `locale?: string` on `StaffSchema`/mutation types
**What goes wrong:** Per CLAUDE.md's documented TypeScript gotcha, this repo's `tsconfig.json` has `exactOptionalPropertyTypes: true`. Adding `locale: LocaleSchema.optional()` to `StaffUpdateSchema`-style partial/update types the naive way (`prop?: string`) breaks the established convention — the codebase's existing pattern (seen in `comboPriceOverride`, `splitMode`, `parentTabId`) is `.nullable().optional()` without `.default()` for update-shape schemas, or `prop: string | undefined` for plain TS mutation input types.
**Why it happens:** This is a repo-wide TS-strictness setting that trips up anyone adding a new optional field without checking existing sibling fields first.
**How to avoid:** For `LocaleSchema` on `StaffSchema` itself, it should almost certainly be **required, non-nullable, with a Zod `.default('es-MX')`** (matching D-02 — every profile has a locale, defaulting to es-MX) — not optional at all. Only the update/mutation input shape needs the optional-handling pattern, and should follow the `.nullable().optional()` convention already established for other optional update fields.

### Pitfall 5: `mode: 'jsx-text-only'` (eslint-plugin-i18next's default) will miss most of this codebase's hardcoded strings
**What goes wrong:** `eslint-plugin-i18next`'s `no-literal-string` rule defaults to `mode: 'jsx-text-only'`, which only flags bare JSX text nodes (`<div>Hello</div>`) — it will **not** catch the 259 `toast.success('Order saved')`-style literal-string function-call arguments, nor the 54 `placeholder="..."` / 55 `aria-label="..."` JSX attribute literals found in this repo, unless `mode` is explicitly set to `'all'` (or `'jsx-only'` plus explicit `jsx-attributes` includes).
**Why it happens:** The rule's default mode is deliberately conservative to minimize false positives out of the box; this repo's D-05 ("strict everywhere, no grandfather list") requires the more aggressive setting.
**How to avoid:** Set `mode: 'all'` explicitly in the ESLint config, then tune `jsx-attributes.exclude` (for non-user-facing attrs like `data-testid`, `className`, `to`, `type`, `key`, `role`, `variant`, `name`) and `callees.exclude` (for `cn`, `clsx`, `cva`, `tv` — same callee list already whitelisted for `eslint-plugin-tailwindcss` in this repo's `eslint.config.js`) to avoid drowning in false positives on the first lint run.

## Code Examples

### ESLint flat-config wiring for `eslint-plugin-i18next`
```javascript
// Source: eslint-plugin-i18next README + no-literal-string.md
// (github.com/edvardchen/eslint-plugin-i18next), adapted to this repo's
// existing flat-config file-scoping pattern (see the tailwindcss block
// already in eslint.config.js for the precedent this follows)
import i18next from 'eslint-plugin-i18next';
// ...
{
  files: ['src/shared/ui/**/*.tsx', 'src/entities/**/*.tsx', 'src/features/**/*.tsx', 'src/widgets/**/*.tsx', 'src/pages/**/*.tsx'],
  ignores: ['**/*.test.tsx', '**/*.stories.tsx'],
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': ['error', {
      mode: 'all', // catches JSX text, JSX attributes, AND call arguments — see Pitfall 5
      'jsx-attributes': { exclude: ['data-testid', 'className', 'to', 'type', 'key', 'role', 'variant', 'size', 'name', 'htmlFor', 'id'] },
      callees: { exclude: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv'] }, // matches tailwindcss config's callees list already in this file
      words: { exclude: ['^[0-9.,$%-]+$', '^[A-Z_]{2,}$'] }, // numeric/currency literals, SCREAMING_SNAKE constants
    }],
  },
},
```

### `profiles.locale` migration (idempotent, following the `must_change_pin` precedent)
```sql
-- Source: repo pattern in supabase/migrations/20260703000005_force_pin_change.sql
-- UP:
BEGIN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-MX';
ALTER TABLE profiles ADD CONSTRAINT profiles_locale_check CHECK (locale IN ('es-MX', 'en-US'));
COMMIT;

-- DOWN:
-- BEGIN;
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_locale_check;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS locale;
-- COMMIT;
```

### `LocaleSchema` + `StaffSchema` extension (domain.ts)
```typescript
// Source: repo pattern — mirrors UserRoleSchema (src/shared/lib/domain.ts:42)
export const LocaleSchema = z.enum(['es-MX', 'en-US']);
export type Locale = z.infer<typeof LocaleSchema>;

export const StaffSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  email: z.email(),
  role: UserRoleSchema,
  pin: PinSchema,
  isActive: z.boolean(),
  mustChangePin: z.boolean(),
  locale: LocaleSchema.default('es-MX'), // D-02: default for new/unset profiles
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `i18next-http-backend` fetching JSON over the network | Statically bundled `resources` object passed to `i18next.init()` | Not a version change — a deployment-context choice; always been valid for bundled apps, just less commonly documented than the backend-fetch pattern | Zero runtime failure mode for missing/slow network — critical for this app's offline-tolerant design goal (per PROJECT.md's "offline-tolerant order-to-payment flow" core value) |
| `i18next-browser-languagedetector` (auto-detect from `navigator.language`) | Explicit `i18n.changeLanguage(profiles.locale)` driven by the authenticated staff record | N/A — deliberate choice for this multi-staff-shared-terminal app, not a library-version change | Prevents locale leaking between staff members sharing one physical terminal (see Pattern 2) |

**Deprecated/outdated:** None identified — `react-i18next`/`i18next` API surface used here (`useTranslation`, `initReactI18next`, `i18n.t()`, `i18n.changeLanguage()`) has been stable across major versions for years; no migration-note risk found.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-i18next`/`i18next`/`eslint-plugin-i18next` package names and their npm-registry-verified versions are the correct, non-hallucinated packages for this purpose | Standard Stack | Low — these are extremely well-known packages (13M+/18M+/1.1M weekly downloads respectively) verified live on the registry with matching official GitHub org repos; risk is near-zero but the automated legitimacy gate's "too-new" flag technically requires a `checkpoint:human-verify` per protocol regardless |
| A2 | Moving Rust's receipt-label selection into TypeScript (Pitfall 2 / Architectural Responsibility Map) is the right tradeoff vs. duplicating a small label table in Rust | Common Pitfalls (Pitfall 2), Architecture Patterns | Medium — if the team prefers keeping Rust "dumb" data-only but does NOT want to change the `print_receipt` Tauri command's parameter shape (e.g. due to test coverage on the Rust side), a Rust-side match-arm table on `(locale, key)` is a smaller, lower-risk diff; either is valid, this research recommends the TS-side approach because it eliminates a second sync point, not because the Rust approach is broken |
| A3 | A "Language" self-service tab should live inside `SettingsTabsPanel` but *outside* the existing `canManageSettings`/`canManageProducts` gates (Pitfall 1) | Common Pitfalls (Pitfall 1) | Medium — D-03 only says "lives in Settings," not "visible to all roles regardless of gate"; if the actual intent was "only admin/manager+ staff get self-service, bartenders get admin-set-for-them only," this recommendation is wrong. This reading was inferred from "self-service" implying every staff member, including bartenders, but the CONTEXT.md text does not explicitly confirm bartenders are in scope for self-service — flagged as Open Question #2 |

## Open Questions

1. **Should `profiles.locale` also drive `Intl.DateTimeFormat`/date display, or stay scoped to UI string translation only?**
   - What we know: ROADMAP.md Phase 28 (Money Formatter Utility) explicitly says its `formatMoney`/`Intl.NumberFormat` work will "respect the Phase 21 locale" — meaning Phase 21 must expose a locale value Phase 28 can consume, but Phase 21 must NOT implement `Intl.NumberFormat`-based money formatting itself (that's Phase 28's `no-raw-money-format` ESLint rule and scope).
   - What's unclear: Dates are different from money — `toLocaleString()` calls for dates (60 call sites) are already present and arguably *are* "UI string translation" territory (a date shown on a translated receipt should render in the matching locale format), unlike money formatting which Phase 28 explicitly owns.
   - Recommendation: Scope Phase 21 to drive **both UI strings AND date/time formatting** (pass `i18n.language` into existing `toLocaleString()`/`Intl.DateTimeFormat` call sites), but explicitly leave `Intl.NumberFormat`/money formatting untouched for Phase 28. Expose the resolved locale via a small reusable accessor (e.g. `entities/staff` or a new `shared/lib/locale.ts` `getCurrentLocale()`) so Phase 28 can import it without re-deriving it from `profiles`.

2. **Is the self-service locale switcher meant to be visible to bartenders, or only to manager+/admin roles who can already reach Settings?**
   - What we know: D-03 says "Self-service switcher lives in Settings; admin can also set a staff member's locale when managing staff." The RBAC reality (Pitfall 1) is that bartenders currently cannot reach any Settings tab at all.
   - What's unclear: Whether "self-service" was intended to include bartenders (in which case Pitfall 1's structural fix is required) or only meant "self-service for the roles that already have Settings access" (in which case no RBAC restructuring is needed, and bartenders rely entirely on admin-set locale via Staff management).
   - Recommendation: Surface this explicitly to the user during `/gsd-discuss-phase` follow-up or plan review before committing to the `SettingsTabsPanel` restructuring in Pitfall 1 — it changes real scope (one new always-visible tab category vs. one gated tab).

3. **Does the Rust `print_receipt` Tauri command's parameter shape change (Pitfall 2's recommendation) require corresponding changes to any Rust-side tests?**
   - What we know: `printer.rs` has `build_receipt_lines()`/`lines_to_esc_pos()` as internal functions; no `#[cfg(test)]` block was found in the file during this research pass.
   - What's unclear: Whether any Rust unit tests exist elsewhere in `src-tauri/` that assert on `ReceiptPrintDto`'s current field shape or `build_receipt_lines()`'s output.
   - Recommendation: Planner should `grep -rn "ReceiptPrintDto\|build_receipt_lines" src-tauri/` before finalizing the Wave that touches this file, to confirm no test breakage beyond what's already visible.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry access | Installing `react-i18next`, `i18next`, `eslint-plugin-i18next` | ✓ | — | — |
| Supabase CLI / remote DB access | `profiles.locale` migration push | ✓ (per STATE.md — `npx supabase db push` used successfully in every recent phase) | supabase ^2.91.1 (devDependency) | Manual `supabase.types.ts` transcription if `supabase gen types` unavailable (repo's own documented, repeatedly-used fallback per CLAUDE.md) |
| Docker (for local `supabase gen types --local`) | Type regeneration after migration | Unconfirmed this session — STATE.md logs repeated "Docker unavailable" entries across many prior phases (Phase 02, 04, 06, 09, 12) | — | Manual transcription into `supabase.types.ts` (established, repeatedly-used repo pattern — not a blocker) |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** Docker/local Supabase type generation — this repo has used the manual-transcription fallback successfully in the majority of its prior phases per STATE.md; treat as expected, not exceptional.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit) + React Testing Library 16.3.2, Playwright 1.59.1 (E2E) |
| Config file | `vitest.config.ts` / `playwright.config.ts` (both pre-existing, no new config needed for this phase) |
| Quick run command | `npx vitest run src/path/to.test.ts` |
| Full suite command | `npm run test` (unit), `npm run test:e2e` (E2E, manual pre-release) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `i18next.init()` resolves with both `es-MX`/`en-US` resources loaded, `t()` returns translated string for a known key in each locale | unit | `npx vitest run src/app/i18n/index.test.ts` | ❌ Wave 0 |
| SC-2 | `mapStaffRow` maps `row.locale` → `Staff.locale`; `StaffSchema.parse()` defaults missing/null locale to `'es-MX'` | unit | `npx vitest run src/entities/staff/model/queries.test.ts` | ✅ (extend existing file) |
| SC-2 | `i18n.changeLanguage()` fires with the correct locale on staff-store login hydrate | unit | `npx vitest run src/entities/staff/model/store.test.ts` | ✅ (extend existing file, if present — confirm during planning) |
| SC-3 | `no-literal-string` ESLint rule fires on a deliberately-introduced hardcoded string in a throwaway fixture file, and does NOT fire on a `t()`-wrapped string | unit (ESLint RuleTester) or manual `npm run lint` smoke check | `npm run lint` (max-warnings 0 — the CI gate itself IS the test for SC-3) | N/A — CI gate is the test |
| SC-4 | Full `npm run lint` passes with zero `i18next/no-literal-string` violations after the big-bang migration (D-04) | integration (whole-repo) | `npm run lint` | N/A — CI gate is the test |
| SC-4 | Visual regression: existing `e2e/visual/45-visual-baseline.spec.ts` (Phase 34) re-run post-migration shows no diffs for `es-MX` (default) locale | E2E (existing suite) | `npm run test:e2e:visual` | ✅ (Phase 34 baseline already exists — re-run as regression gate, do not rebaseline unless a deliberate visual change is confirmed) |
| SC-4 | New: at least one E2E spec exercises the `en-US` locale end-to-end (switch locale → observe translated string on a real page) | E2E | new `e2e/4X-i18n-locale-switch.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` + `npm run typecheck` + `npm run lint` on touched files
- **Per wave merge:** `npm run test` (full unit suite) + `npm run lint` (whole repo — this IS the SC-3/SC-4 enforcement gate)
- **Phase gate:** `npm run test:e2e:visual` (Phase 34's baseline, re-run not re-recorded) + new `e2e/4X-i18n-locale-switch.spec.ts` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/app/i18n/index.test.ts` — covers SC-1 (i18next init resolves, both locales load)
- [ ] `e2e/4X-i18n-locale-switch.spec.ts` — covers SC-4 (en-US end-to-end smoke)
- [ ] Framework install: none — Vitest/Playwright/RTL already fully configured in this repo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase does not touch auth flow |
| V3 Session Management | No | Locale is a display preference, not a session/auth concern |
| V4 Access Control | Yes | Admin-set-locale-for-another-staff-member (D-03) must remain gated behind the same RBAC action used for other admin-writes-to-staff-record operations (`manage_staff`, per CLAUDE.md's RBAC Actions list) — do not introduce a new unguarded write path to `profiles.locale` |
| V5 Input Validation | Yes | `LocaleSchema = z.enum(['es-MX', 'en-US'])` at the Zod layer + a DB `CHECK` constraint (see Code Examples) — reject any value outside the two supported locales at both layers, not just one |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Un-escaped translation-string interpolation enabling stored/reflected XSS via a compromised or mistranslated catalog entry | Tampering | i18next's `interpolation.escapeValue: false` is safe **only** because React already escapes JSX children by default — do NOT introduce `dangerouslySetInnerHTML` or the `<Trans>` component's raw-HTML children feature without re-auditing; CLAUDE.md already documents one existing intentional exception (changelog rendering) that must not be treated as precedent for translation strings |
| Privilege escalation via client-side-only locale-set bypassing the admin-gate for "set another staff member's locale" | Elevation of Privilege | The RPC/mutation that lets an admin set a *different* staff member's `locale` must reuse the same server-side RBAC check pattern as other manager+/admin staff-write operations (e.g. `force_pin_change`'s `SECURITY DEFINER` + explicit role check pattern in `20260703000005_force_pin_change.sql`) — do not rely on client-side UI hiding alone |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version`) — confirmed live versions of `react-i18next` 17.0.10, `i18next` 26.3.6, `eslint-plugin-i18next` 6.1.5, and `react-i18next`'s peer-dependency requirement on `i18next >= 26.2.0`
- Direct codebase inspection (Read/Grep/Bash against this repo) — RBAC gating logic (`src/shared/lib/rbac.ts`), `SettingsTabsPanel` structure, `printer.rs`/`receipt-format.ts` label duplication, `profiles` migration history, `StaffSchema`/`mapStaffRow` shape, scope-sizing greps (file counts, toast/placeholder/aria-label literal counts)

### Secondary (MEDIUM confidence)
- [github.com/edvardchen/eslint-plugin-i18next — no-literal-string.md](https://github.com/edvardchen/eslint-plugin-i18next/blob/main/docs/rules/no-literal-string.md) — rule option names/types/defaults (`mode`, `jsx-attributes`, `callees`, `words`, etc.)
- [react.i18next.com/guides/quick-start](https://react.i18next.com/guides/quick-start) — official quick-start init pattern
- [react.i18next.com/latest/using-with-hooks](https://react.i18next.com/latest/using-with-hooks) — hook usage and "using outside of React" imperative `i18n.t()` pattern

### Tertiary (LOW confidence)
- None — all claims above are either verified via tool (registry/codebase) or cited from official/near-official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package names/versions verified live on npm registry, peer-dependency compatibility confirmed
- Architecture: MEDIUM-HIGH — namespacing/catalog structure is a reasoned recommendation (no single "correct" answer exists industry-wide), but the RBAC gap (Pitfall 1) and Rust/TS duplication (Pitfall 2) are HIGH confidence, directly observed in this codebase
- Pitfalls: HIGH — all 5 pitfalls are grounded in direct grep/read evidence from this specific repo, not generic i18n advice

**Research date:** 2026-07-17
**Valid until:** 2026-08-16 (30 days — stable library choices, but re-verify npm versions if planning is delayed past this window)
