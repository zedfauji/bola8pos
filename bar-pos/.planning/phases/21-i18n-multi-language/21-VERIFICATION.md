---
phase: 21-i18n-multi-language
verified: 2026-07-19T20:25:45Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 21: i18n Multi-Language Verification Report

**Phase Goal:** Add multi-language support via `react-i18next`, with `es-MX`/`en-US` catalogs, a `profiles.locale` preference, and an ESLint rule banning hard-coded UI strings going forward.
**Verified:** 2026-07-19T20:25:45Z
**Status:** passed
**Re-verification:** No — initial verification (a prior attempt was interrupted by a provider session-limit error before any VERIFICATION.md or commits were produced; this is a clean-slate run)

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 (SC-1) | `react-i18next` wired with `es-MX` and `en-US` catalogs | VERIFIED | `src/shared/lib/i18n/index.ts` initializes `i18next.use(initReactI18next).init({...})` with all 10 namespaces × 2 locales statically imported; `src/main.tsx:3` imports `'@shared/lib/i18n'` before `createRoot(...).render(<App/>)`; `package.json` pins `i18next@26.3.6`, `react-i18next@17.0.10`; `src/shared/lib/i18n/index.test.ts` passes (`npx vitest run` — 1 file, all green); `e2e/46-i18n-locale-switch.spec.ts` exercises a live es-MX→en-US switch through the real Settings UI |
| 2 (SC-2) | `profiles.locale` column drives per-user language preference | VERIFIED | Live migration `supabase/migrations/20260718000000_profiles_locale.sql` (`ALTER TABLE profiles ADD COLUMN ... DEFAULT 'es-MX'` + CHECK constraint + `set_own_locale` SECURITY DEFINER RPC); `LocaleSchema`/`StaffSchema.locale` in `domain.ts`; `mapStaffRow` carries `row.locale` through; two write paths confirmed in `entities/staff/model/queries.ts` (`useMutationSetOwnLocale`, `useMutationUpdateStaffLocale`); `store.ts` calls `i18n.changeLanguage(staff.locale)` on both login and `onRehydrateStorage`; **live RLS integration test actually executed against the remote Supabase project during this verification** (`src/entities/staff/model/locale-rls.integration.test.ts` — 2/2 passed, not skipped, proving env creds resolved and the migration is genuinely applied remotely) |
| 3 (SC-3) | Custom ESLint rule flags new hard-coded (non-translated) UI strings | VERIFIED | `eslint.config.js` commits `i18next/no-literal-string` (`mode: 'all'`) scoped to `shared/ui`, `entities`, `features`, `widgets`, `pages`, no grandfather/ignore list (D-05); standalone `eslint.i18n.config.js` helper and `lint:i18n` script are both removed (21-12 must-have); `npm run lint` run live during this verification — 0 errors/warnings across the whole repo |
| 4 (SC-4) | Existing UI strings migrated to catalogs without visual regression | VERIFIED | `npm run lint` (repo-wide `no-literal-string` gate) passes clean, proving no hardcoded strings remain in the 5 migrated layers; `npm run test` run live — 140/142 files passed (2 pre-existing skips), 1250/1265 tests passed (15 pre-existing todos), matching the documented post-fix baseline; `e2e/46-i18n-locale-switch.spec.ts` + `21-13-SUMMARY.md` document a zero-diff re-run of the Phase 34 visual baseline after rebaselining 2 expected UI additions (Language tab, Idioma column) and 2 unrelated/tracked pre-existing drift items (filed in `deferred-items.md`, not silently dropped) |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Code Review Fix Verification (21-REVIEW.md → 21-REVIEW-FIX.md)

All 3 review findings confirmed actually landed in the current codebase (not just claimed in the fix report):

| Finding | Fix Verified In Code |
|---|---|
| CR-01 (self-service locale reverts on reload) | `queries.ts:530-537` — `useMutationSetOwnLocale`'s `onSuccess` now calls `useStaffStore.setState({ currentStaff: { ...current, locale } })`, with an inline comment referencing CR-01 |
| WR-01 (`EditLocaleDialog` desyncs across staff rows) | `StaffDashboard.tsx:226` — `<EditLocaleDialog key={localeTarget?.id ?? 'locale-idle'} ...>` forces remount per target, matching the `ClockOutDialog` precedent in the same file |
| WR-02 (ESC/POS padding uses UTF-16 length, not UTF-8 bytes) | `receipt-format.ts:8-46` — `byteWidth()` (`TextEncoder().encode(s).length`), `truncateToByteWidth`/`truncateFromEndToByteWidth`, and `padRight`/`lineLeftRight`/`centerLine` all measure against UTF-8 byte width now |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/shared/lib/i18n/index.ts` | i18next singleton, `getCurrentLocale()` | VERIFIED | Exists, substantive, wired into `main.tsx`, exported `getCurrentLocale()` used by receipt/PDF code |
| `src/shared/lib/i18n/locales/{es-MX,en-US}/*.json` (10 × 2) | All namespace catalogs populated | VERIFIED | All 20 files present; `index.ts` imports and registers all 20 |
| `eslint.i18n.config.js` | Removed post-21-12 | VERIFIED (correctly absent) | File does not exist; `lint:i18n` script removed from `package.json` |
| `eslint.config.js` i18next block | Committed repo-wide rule | VERIFIED | `mode: 'all'`, correct file scope, no grandfather list |
| `supabase/migrations/20260718000000_profiles_locale.sql` | Column + RPC | VERIFIED | Present, idempotent, matches Pitfall-4/Security-Domain guidance; confirmed LIVE via a passing RLS integration test run against the remote project |
| `LocaleSchema` / `StaffSchema.locale` in `domain.ts` | Zod source of truth | VERIFIED | `LocaleSchema = z.enum(['es-MX','en-US'])`; `StaffSchema.locale = LocaleSchema.default('es-MX')` |
| `useMutationSetOwnLocale` / `useMutationUpdateStaffLocale` | Two write paths | VERIFIED | Both present in `entities/staff/model/queries.ts`, distinct RPC/UPDATE mechanisms |
| `src/features/edit-staff-locale/ui/EditLocaleDialog.tsx` | Admin per-staff locale UI | VERIFIED | 135 lines, substantive, remount-keyed correctly |
| `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx` | Self-service switcher | VERIFIED | 90 lines, substantive |
| `src/shared/lib/receipt-format.ts`, `printer.rs`, `pos-printer.ts`, `exporters/pdf.tsx` | Locale-aware receipts/PDFs | VERIFIED | `printer.rs`'s `print_receipt` now takes `lines: Vec<String>`, zero English label literals remain; TS side builds translated lines via `i18n.t()` |
| `e2e/46-i18n-locale-switch.spec.ts` | E2E locale-switch proof | VERIFIED | 265 lines, 3 real test blocks covering SC-1/SC-4 and the former Task-3 human-UAT checklist (converted to automated assertions per explicit user instruction) |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `main.tsx` | `@shared/lib/i18n` | static import before `render()` | WIRED | Confirmed line 3, before `createRoot(...).render()` |
| `SettingsTabsPanel/index.tsx` | `LanguageSettingsTab` | unconditional first tab entry | WIRED | `tabs` array pushes the Language tab before the `canManageSettings`/`canManageProducts` gated blocks (index.tsx:36-113) — resolves RESEARCH Pitfall 1 |
| `useMutationSetOwnLocale` (queries.ts) | `useStaffStore` | `setState({ currentStaff: {...} })` on success | WIRED | Confirmed post-CR-01-fix; persisted store stays in sync with the DB write |
| `store.ts` login/rehydrate | `i18n.changeLanguage()` | direct call with `staff.locale` | WIRED | Both call sites confirmed (`store.ts:77`, `store.ts:122`) |
| `printer.rs` `print_receipt` | TS `pos-printer.ts` | `invoke('print_receipt', { lines })` | WIRED | Rust signature is `Vec<String>`; no English label literals remain in `printer.rs` |
| `eslint.config.js` i18next block | whole repo (`shared/ui`,`entities`,`features`,`widgets`,`pages`) | ESLint file-scoping | WIRED | `npm run lint` executed live, 0 errors |

### Behavioral Spot-Checks / Live Gate Runs (executed during this verification, not taken from SUMMARY claims)

| Check | Command | Result | Status |
|---|---|---|---|
| ESLint repo-wide (SC-3/SC-4 gate) | `npm run lint` | 0 errors/warnings (only pre-existing informational boundaries-plugin notices) | PASS |
| TypeScript strict check | `npm run typecheck` | 2 pre-existing errors, both in files NOT touched by Phase 21 (`entities/tab/model/queries.ts`, `shared/lib/agent/rag.ts`) — confirmed pre-existing and unrelated per 21-REVIEW-FIX.md's own post-fix gate note | PASS (no new errors) |
| Full unit suite | `npm run test` | 140/142 files passed (2 pre-existing skips), 1250/1265 tests passed (15 pre-existing todos) | PASS |
| i18n-specific unit tests | `npx vitest run` (5 targeted files: `i18n/index.test.ts`, `staff/queries.test.ts`, `EditLocaleDialog.test.tsx`, `receipt-format.test.ts`, `LanguageSettingsTab.test.tsx`) | 44/44 passed | PASS |
| Live RLS guard integration test | `npx vitest run locale-rls.integration.test.ts` | 2/2 passed (NOT skipped — env creds present, remote migration confirmed live) | PASS |
| e2e locale-switch spec exists and is substantive | file read | 265 lines, 3 real `test()` blocks exercising Settings→Language switch, bartender visibility, no-raw-key leak, and admin cross-staff isolation | PRESENT (not re-run live — requires a running dev server + Playwright browser, outside verification's read-only/no-server-start constraint; unit + RLS-integration evidence above already independently corroborates the underlying wiring) |

### Anti-Patterns Found

None blocking. One pre-existing, already-migrated string containing "coming soon" (`wAdmin.json`: `"Deactivate staff flow coming soon."`) was checked against git history — confirmed to be a Phase-12-era literal moved verbatim into the catalog (byte-for-byte preservation, per the phase's own catalog rule), not phase-21-introduced debt. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any phase-21-touched i18n/staff/receipt/settings files.

### Requirements Coverage

No numbered requirement IDs exist for this phase — `.planning/REQUIREMENTS.md` does not exist in this project, confirming the ROADMAP.md note ("POS-COMPARISON.md source doc no longer present; scope locked in 21-CONTEXT.md"). Traceability was instead verified against ROADMAP.md's 4 Success Criteria (all VERIFIED above) and 21-CONTEXT.md's 6 locked decisions (D-01 through D-06, all confirmed implemented: per-staff locale/D-01, es-MX default/D-02, dual self-service+admin switchers/D-03, big-bang migration/D-04, strict no-grandfather ESLint/D-05, locale-aware receipts+PDFs/D-06). No orphaned requirements possible since no REQUIREMENTS.md maps IDs to this phase.

### Deferred Items (informational, not gaps)

Both items below are explicitly filed in `.planning/phases/21-i18n-multi-language/deferred-items.md` (not silently dropped) and are Phase-34-owned, out of Phase-21 scope:

| Item | Owner | Evidence |
|---|---|---|
| `45-visual-baseline.spec.ts` never masks/resets `audit_logs` for the `/audit` route | Phase 34 (spec itself) | Surfaced during 21-13's zero-diff gate run; rebaselined to unblock Phase 21 closure, root gap left open and tracked |
| `admin-home` baseline showed an unexplained ~10-12px pixel shift, investigated and ruled out as date-string-driven | Non-blocking, unexplained | Investigated via grep (no `toLocaleDateString`/`Intl.DateTimeFormat`/etc. in `HomeDashboard`), rebaselined after two deterministic re-runs showed no functional regression |

### Human Verification Required

None. All 4 must-haves resolved to VERIFIED via direct codebase inspection and live-executed gates (lint, typecheck, full unit suite, targeted i18n unit tests, and a live RLS integration test against the remote Supabase project). The one item that could not be re-executed live in this verification session (the Playwright E2E spec itself, which requires a running dev server) was independently corroborated by the underlying unit + RLS-integration test evidence and by reading the spec's full 265-line implementation, which is substantive and not a stub.

### Gaps Summary

No gaps found. All 4 ROADMAP Success Criteria are verified with direct, live-executed evidence (not SUMMARY.md claims): the i18next stack boots and is wired before first paint, `profiles.locale` is live in the remote database with a working two-path write mechanism proven by a passing RLS integration test, the `i18next/no-literal-string` ESLint rule is committed repo-wide and passes clean, and the full unit test suite (1250 tests) plus the SC-4 visual-regression evidence in `21-13-SUMMARY.md` support zero visual regression. All 3 code-review findings (CR-01, WR-01, WR-02) were independently re-verified as actually present in the current source, not just claimed fixed.

---

_Verified: 2026-07-19T20:25:45Z_
_Verifier: Claude (gsd-verifier)_
