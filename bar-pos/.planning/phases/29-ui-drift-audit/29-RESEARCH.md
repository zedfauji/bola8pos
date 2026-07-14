# Phase 29: UI Drift Audit - Research

**Researched:** 2026-07-10
**Domain:** Static-analysis dev tooling (Node/TS scripting) over a React 19 + Tailwind + shadcn codebase
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Script approach**
- **D-01:** `scripts/audit-ui-drift.ts` uses plain Node.js `fs` walk + regex per pattern (no AST/ts-morph). Matches research's already-verified counts (28 raw-button files, 8 raw-input files) and keeps the tool dependency-free.

**Output format & location**
- **D-02:** Output is a single Markdown checklist grouped by file (per AUDIT-02's "checklist/backlog" wording) — not JSON, not a dual-format artifact. No current downstream consumer needs machine-parseable output.
- **D-03:** Committed artifact lives at `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` — co-located with phase docs, git-tracked, directly readable by Phase 30-33 planners/researchers. Script does not just print to stdout.

**Violation definition & exclusions**
- **D-04:** "Arbitrary-value Tailwind class" scope = spacing only (`p-[13px]`, `m-[7px]`, `gap-[5px]`, etc.) — matches roadmap wording exactly. Arbitrary sizing/typography values (`w-[Npx]`, `text-[Npx]`) are out of scope for this audit, not flagged.
- **D-05:** `shared/ui/` is excluded from all three scans (raw button/input, hex color, arbitrary spacing). Roadmap scope is `pages/`, `widgets/`, `features/` only — `shared/ui` is the primitive source, not drift.

**Route-count cross-check**
- **D-06:** Script parses `<Route path=...>` entries in `src/app/router.tsx`, counts them, and prints an explicit diff against `CLAUDE.md`'s routes table (13 rows, per CONTEXT.md's note — this research found the actual row count is 14, see Pitfall 3) as part of the audit output — not a manually-written prose note. This gives SHELL-03 (Phase 30) hard evidence rather than an assertion.
  - Note: raw `grep -c "<Route"` during scouting returned 19 matches (vs. roadmap/research's stated 17) — likely includes redirects or nested routes counted separately. The script must resolve this precisely (e.g. filter to routes with a real `element`/`Component`, not redirects) rather than trusting the raw grep count. **This research confirms the resolution: see Pitfall 2 below.**

> **Research correction to D-01's cited numbers:** D-01 references "28 raw-button files" as an already-verified count. This research re-verified directly against the repo and found the correctly-filtered (excluding `.test.*` files and non-`.ts(x)` files) count is **20 files**, not 28. The unfiltered substring-grep count is 29 (not 28). See Summary and Pitfall 1 for the full breakdown. This does not change D-01's *approach* (regex, no AST) — it corrects the baseline number the script's output should be checked against.

### Claude's Discretion
None explicitly called out — CONTEXT.md's decisions (D-01 through D-06) cover all implementation choices for this phase. Discretion remaining: line-number granularity in the checklist output (see Open Question 2), and whether to defensively exclude `.stories.tsx` (see Open Question 1).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (per CONTEXT.md `<deferred>`).
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Strict TypeScript applies to `scripts/`, not just `src/`:** `tsconfig.json`'s `"include": ["src", "scripts"]` means `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all apply to `audit-ui-drift.ts`. Never write `prop?: string` for function inputs — use `prop: string | undefined`. Regex match results and array indexing return `T | undefined` — guard before use. (See Pitfall 4.)
- **`npm run lint` does NOT cover `scripts/`:** `"lint": "eslint src --max-warnings 0"` only targets `src/`, so `eslint-plugin-boundaries` and other `src`-only ESLint rules do not apply to this script. `npm run typecheck` (`tsc --noEmit`) is the relevant gate, and it does cover `scripts/`.
- **No hardcoded secrets, no service-role key in renderer** — not applicable here (script has no Supabase/network calls at all).
- **Commit convention:** Conventional Commits `<type>(<ticket-id>): <description>`, no `--no-verify`. Applies to whatever commit ships this script and `DRIFT-AUDIT.md`.
- **`console.log` vs logger:** CLAUDE.md forbids `console.log` in favor of `src/shared/lib/logger.ts` — but that rule is enforced via ESLint on `src/`, which (per above) does not cover `scripts/`. Established precedent: existing `scripts/*.ts` files (`indexCodebase.ts`) use `console.error`/`console.log` directly with no logger import. The audit script should follow this same established `scripts/` convention (plain `console.log` for its report/summary output), not import `shared/lib/logger.ts` (that would be a `scripts/` → `src/shared/*` reach with no precedent and no enforcement mechanism requiring it).
- **Read-only constraint (from phase description, reinforced by CLAUDE.md's "no application code touched" framing):** The script must not write anywhere under `src/`. Its only write target is `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md`.

## Summary

This phase is a single throwaway script, not application code. All research questions the phase description raised (AST vs. regex, how to scope arbitrary-spacing detection, how to reconcile the route count) were already resolved by the user in CONTEXT.md (D-01 through D-06) — so this research's job was to **verify those decisions produce correct results against the real repo**, not to re-litigate the approach.

Every count below was reproduced directly with `grep` against `src/pages/`, `src/widgets/`, `src/features/` on 2026-07-10 (excluded `src/shared/ui/` per D-05). Two things matter more than the raw numbers:

1. **Naive substring matching over-counts.** `grep -rl "<button"` returns 29 files, but 9 of those are `.test.tsx` mock factories (`vi.mock(() => <button>Export</button>)`) or a `README.md` — not real JSX in shipped components. Filtered to real source (`.ts`/`.tsx`, excluding `*.test.*`), the true count is **20 files** with raw `<button`, **8 files** with raw `<input` (input had zero false positives). This is the single most important correction this research makes to the CONTEXT.md's D-01 note ("28 raw-button files") — the actually-verified, filtered number is 20, not 28.
2. **The arbitrary-spacing category is genuinely empty**, not a script bug. CONTEXT.md's scouting note speculated the simple regex was "too narrow." Testing the broadest reasonable pattern (`(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\[...\]`, including responsive/state variant prefixes like `sm:`, `hover:`) still returns **zero files**. The codebase has plenty of arbitrary-value classes (`min-h-[56px]`, `w-[380px]`, `max-h-[calc(90vh-64px)]`) but they are all sizing/typography, which D-04 explicitly excludes. The script should report this as a real, honest 0 — not something to "fix" by loosening the pattern.

**Primary recommendation:** Write `scripts/audit-ui-drift.ts` as a plain Node `fs`-walk + regex script (per D-01, already locked), filtering to `*.ts`/`*.tsx` and excluding `*.test.*`/`*.stories.*` files and the `shared/ui/` directory, and be aware the script runs under the project's strict `tsconfig.json` (`scripts/` is in `"include"`, so `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/`strict` all apply — this is not exempted dev-tooling territory).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI drift detection (scan + report) | Dev Tooling / Build-time script | — | Runs via `tsx`, outside the app runtime; never imported by `src/`, never bundled by Vite |
| Route-count cross-check | Dev Tooling / Build-time script | — | Parses `src/app/router.tsx` as text, doesn't execute the router |
| Audit output artifact | Filesystem (git-tracked doc) | — | `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md`, not a DB/API concern |

No Browser, Frontend-Server, API, or Database tier involvement — this phase never touches the running application.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs`/`path` (builtin) | Node 20.20.2 (repo-verified) | Recursive directory walk + file read | `fs.readdirSync(dir, { recursive: true, withFileTypes: true })` is Node 20.1+ builtin — no need for `glob` even though it's already a devDependency [VERIFIED: node --version + repo package.json] |
| `tsx` | `^4.21.0` (already installed) [VERIFIED: package.json] | Run the `.ts` script directly | Existing project convention — every other `scripts/*.ts` file (`indexCodebase.ts`, `seed-*.ts`) runs via `npx tsx scripts/<file>.ts` |

### Supporting
None needed. `glob@^13.0.6` is already a devDependency (used by `indexCodebase.ts`) and could be used instead of raw `fs.readdirSync(recursive)`, but per D-01's "dependency-free" framing and the ladder (stdlib covers it), plain `fs` is the leaner choice — no functional difference for this file count.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `fs` walk + regex (D-01, locked) | `ts-morph` / TypeScript Compiler API (AST) | AST would catch JSX with 100% syntactic accuracy (no test-file/comment false positives) but is significant setup for a one-shot, throwaway audit script feeding a Markdown checklist a human will scan anyway. D-01 already ruled this out; regex + explicit test-file exclusion closes the main gap AST would have caught. |
| `fs.readdirSync(dir, { recursive: true })` | `glob` package (already installed) | Either works; `glob` gives nicer ignore-pattern syntax but is an unneeded abstraction for 3 fixed root directories. |

**Installation:** None — zero new dependencies.

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All tooling (`tsx`, Node builtins) is already present in `package.json` and verified above.

## Architecture Patterns

### Recommended Project Structure
```
scripts/
└── audit-ui-drift.ts     # new — standalone, never imported by src/
.planning/phases/29-ui-drift-audit/
└── DRIFT-AUDIT.md          # new — committed output artifact (D-03)
```

### Pattern 1: Filtered file-list scan (avoids the false-positive trap this research found)
**What:** Walk `src/pages`, `src/widgets`, `src/features` recursively, collect `.ts`/`.tsx` files, exclude `shared/ui` (already outside these 3 roots so no-op in practice, but excluding by path-segment `shared/ui/` is the D-05-literal way to express it if scan roots ever widen), exclude `*.test.ts(x)` and `*.stories.tsx`.
**When to use:** Every scan in this script — all three violation types share this same filtered file list.
**Example:**
```typescript
// Verified against this repo, 2026-07-10 — grep reproduction of the intended logic
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOTS = ['src/pages', 'src/widgets', 'src/features'];

function collectFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    if (/\.stories\.tsx?$/.test(entry.name)) continue;
    const full = path.join(entry.parentPath ?? root, entry.name); // parentPath: Node 20.12+; fall back to entry.path on older 20.x
    if (full.includes(`${path.sep}shared${path.sep}ui${path.sep}`)) continue;
    out.push(full);
  }
  return out;
}
```
**Note on `entry.parentPath`:** Node's `Dirent.parentPath` was added in Node 20.12/21.4 (renamed from the earlier `Dirent.path`, which was deprecated). Since the repo runs 20.20.2, `parentPath` is available, but `entry.path` should be tried as a fallback for robustness `[ASSUMED: Node release-note detail not independently re-verified via WebFetch this session, MEDIUM confidence — verify at execution time with a console.log of a sample Dirent if unexpected undefined appears]`.

### Pattern 2: Per-category regex with verified patterns
Each pattern below was run against the live repo and its exact file count is recorded — use these as the acceptance baseline for the script's own output.

| Category | Pattern | Verified file count (filtered) |
|----------|---------|-------------------------------|
| Raw `<button` | `/<button[\s>]/` or substring `<button` per-line, then filter | 20 |
| Raw `<input` | `/<input[\s>]/` or substring `<input` per-line, then filter | 8 |
| Hex/rgb hardcoded color | `/#[0-9a-fA-F]{3,8}\b/` and `/rgba?\(/` | 3 (all hex; zero `rgb(`/`rgba(` matches in the codebase) |
| Arbitrary-value spacing (D-04 scope: `p-`,`px-`,`py-`,`pt-`,`pb-`,`pl-`,`pr-`,`m-`,`mx-`,`my-`,`mt-`,`mb-`,`ml-`,`mr-`,`gap-`,`gap-x-`,`gap-y-`,`space-x-`,`space-y-`, incl. variant prefixes) | `/\b(?:[a-z:]+:)?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\[[^\]]+\]/` | **0** — genuinely zero, not a pattern gap (verified with 3 progressively broader patterns) |

### Anti-Patterns to Avoid
- **Unfiltered substring grep (`grep -rl "<button"` with no exclusions):** Inflates the button count from 20 to 29 by counting `.test.tsx` mock stubs and a `README.md` code sample as real violations. Phases 30-33 would then "fix" files that don't need fixing (or worse, edit test mocks). Always exclude `*.test.*` and non-`.ts(x)` files.
- **Loosening the spacing regex to "find something":** The 0-file spacing result is correct per D-04's scope. Don't widen the pattern to catch `w-[Npx]`/`text-[Npx]` (explicitly out of scope) just because the count feels suspiciously low.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Recursive directory walk | Custom manual recursion with a stack/queue | `fs.readdirSync(dir, { recursive: true, withFileTypes: true })` | Node 20.1+ builtin does this in one call; manual recursion is more code for the same result (ladder rung 3/4) |
| Full JSX/AST-correct button detection | `ts-morph`/TS Compiler API parsing | Regex + explicit test/story file exclusion | AST is the "more correct" answer but is disproportionate setup for a throwaway, one-shot Markdown-checklist audit script (D-01's explicit rationale); regex + filename filtering closes ~100% of the false-positive gap this research found |

**Key insight:** The only real "hand-roll" risk here was already avoided by D-01 locking out AST tooling. The remaining risk is under-filtering (test/story files, non-`.ts(x)` files) rather than over-engineering — this research's main contribution is quantifying that filtering gap.

## Common Pitfalls

### Pitfall 1: Counting `.test.tsx` mock stubs as real violations
**What goes wrong:** `vi.mock(() => ({ ExportButtons: () => <button>Export</button> }))` and inline test JSX (`PaymentPane.test.tsx` has 2 raw `<button>` in test-only markup) get counted as app-code drift.
**Why it happens:** Naive `grep -rl "<button"` doesn't distinguish test files from source.
**How to avoid:** Exclude `*.test.ts`/`*.test.tsx` (and defensively `*.stories.tsx`, even though zero currently match) before running any of the three scans.
**Warning signs:** File count that includes files under `__tests__` naming or `.test.` suffix, or a `README.md` in the match list (found in this repo: `src/features/open-tab/README.md` matched raw `<button`).

### Pitfall 2: `grep -c "<Route"` over-counts by matching `<Routes>` too
**What goes wrong:** `grep -c "<Route" src/app/router.tsx` returns 19, not 17 or 18, because the substring `<Route` also matches the `<Routes>` container's opening tag on line 46. This is exactly the discrepancy CONTEXT.md's D-06 flagged ("raw grep returned 19... likely includes redirects").
**Why it happens:** `<Routes>` contains `<Route` as a substring.
**How to avoid:** Match `<Route ` (with a trailing space or newline) or, more robustly, match `<Route\s+path=` / `<Route$` to anchor on the actual element, then separately subtract the one `path="/"` `<Navigate>` redirect (no real page component) to get the true page-route count.
**Verified numbers (this repo, 2026-07-10):** 18 real `<Route .../>` elements (`grep -c "<Route"` minus the 1 `<Routes>` match) → 17 actual page routes after excluding the `path="/"` → `<Navigate to="/home" />` redirect. This confirms the roadmap's "17 routes" claim.

### Pitfall 3: CLAUDE.md's routes table row count
**What goes wrong:** CONTEXT.md's D-06 note states the CLAUDE.md table has "13 rows" — verified count is actually **14 rows** (`grep -cE "^\| \`/" CLAUDE.md` → 14). Missing routes (present in `router.tsx` but absent from the CLAUDE.md table): `/kds`, `/kitchen-prep`, `/audit`. 14 + 3 = 17, which reconciles cleanly.
**Why it happens:** Manual eyeballing during discussion vs. an actual `grep -c` count.
**How to avoid:** The script should compute this count itself (`grep`/regex over `CLAUDE.md`'s table rows, not a hardcoded "13") and print both numbers plus the diff — per D-06's own requirement that this be evidence, not an assertion.
**Warning signs:** If the script hardcodes "13" instead of computing it, it will produce a wrong diff line in DRIFT-AUDIT.md.

### Pitfall 4: `scripts/` is not exempt from strict TypeScript
**What goes wrong:** Assuming a "throwaway" script can use loose typing, `any`, or unchecked array indexing.
**Why it happens:** `tsconfig.json`'s `"include"` is `["src", "scripts"]` — `scripts/` is typechecked by the same `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` config as `src/`. `npm run typecheck` (`tsc --noEmit`) and `npm run build` (`tsc && vite build`) both cover it `[VERIFIED: tsconfig.json line 36]`.
**How to avoid:** Regex `.match()`/`.exec()` results and array index access (e.g., `matches[0]`) will type as `T | undefined` — guard every access. `npm run lint` does NOT cover `scripts/` (`"lint": "eslint src --max-warnings 0"` only targets `src`), so ESLint boundary/style rules don't apply here — but `npm run typecheck` does.
**Warning signs:** `tsc --noEmit` failing after the script is written; this would surface at commit time via any pre-commit typecheck hook if one exists (verify `.husky/` if present).

### Pitfall 5: Windows path separators in output
**What goes wrong:** `path.join()` on Windows produces backslash paths (`src\pages\pos\index.tsx`); if DRIFT-AUDIT.md hardcodes these, the doc looks inconsistent with every other git-tracked doc in this repo (which use forward slashes) and could break simple string-matching by Phase 30-33 tooling.
**Why it happens:** Dev environment is Windows (`Platform: win32` per environment info); `path.join` is OS-native by default.
**How to avoid:** Normalize output paths with `.replace(/\\/g, '/')` before writing to the Markdown, or use `path.posix` utilities for the display string (keep native `path` for actual `fs` calls).
**Warning signs:** DRIFT-AUDIT.md file paths rendered with backslashes.

## Code Examples

### Route-count cross-check (verified against this repo)
```typescript
// Source: verified manually 2026-07-10 via grep against src/app/router.tsx + CLAUDE.md
import * as fs from 'node:fs';

const routerSrc = fs.readFileSync('src/app/router.tsx', 'utf-8');
// Anchor on the element form, not the bare substring, to avoid matching <Routes>
const routeMatches = routerSrc.match(/<Route\s/g) ?? [];
const navigateRedirects = (routerSrc.match(/<Navigate\s/g) ?? []).length;
const realPageRoutes = routeMatches.length - navigateRedirects; // 18 - 1 = 17, verified

const claudeMd = fs.readFileSync('CLAUDE.md', 'utf-8');
const claudeRouteRows = (claudeMd.match(/^\| `\//gm) ?? []).length; // 14, verified — do not hardcode
```
Verified output for this repo: `realPageRoutes = 17`, `claudeRouteRows = 14`, diff = 3 missing (`/kds`, `/kitchen-prep`, `/audit`).

## State of the Art

Not applicable — no library/framework version drift is relevant to a one-shot internal script. No deprecated APIs are involved (`fs.readdirSync(recursive)` is current Node 20 stdlib, not legacy).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `Dirent.parentPath` is available and populated correctly on Node 20.20.2 for recursive `readdirSync` results | Architecture Patterns, Pattern 1 | LOW — if `undefined`, script would need `entry.path` fallback or manual path-join from the walk; a 2-line fix, easily caught by the strict-TS pitfall (Pitfall 4) forcing a null check anyway |

**All other claims in this research were directly verified by running commands against the live repository during this research session** (grep counts, tsconfig contents, package.json contents, router.tsx contents, CLAUDE.md contents) — no other user confirmation needed.

## Open Questions

1. **Should `.stories.tsx` files be excluded even though zero currently match?**
   - What we know: Zero `.stories.tsx` files currently contain raw `<button`/`<input>` in the scanned roots.
   - What's unclear: Whether future stories might legitimately use raw elements as comparison/demo wrappers, which would be a false positive the same way `.test.tsx` mocks are.
   - Recommendation: Exclude defensively anyway (cheap, zero cost given the current 0-match state, prevents future false positives without needing to revisit the script).

2. **Does the audit need line numbers or just file names?**
   - What we know: D-02 specifies "checklist grouped by file"; AUDIT-02 says "mapped to specific files."
   - What's unclear: Whether Phase 30-33 planners need exact line numbers to scope tasks precisely, or file-level granularity is sufficient (files are often small enough that "the file" is precise enough).
   - Recommendation: Include line numbers where cheap (regex `.exec()` with a line-counting pass already needed to report position) — it costs little extra and gives Phase 30-33 more precise backlog entries, but if it complicates the script meaningfully, file-level-only satisfies both D-02 and AUDIT-02's literal wording.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Script runtime | Yes | 20.20.2 [VERIFIED: `node --version`] | — |
| `tsx` | Running `.ts` script directly | Yes | ^4.21.0 [VERIFIED: package.json] | — |
| `glob` | Optional alt to `fs.readdirSync(recursive)` | Yes (already installed) | ^13.0.6 [VERIFIED: package.json] | Not needed — stdlib covers it (see Standard Stack) |

No missing dependencies. No external services involved.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — `scripts/` has no Vitest coverage today (established pattern: `indexCodebase.ts`, `seed-*.ts` are also untested; `"test": "vitest run --project unit"` only covers `src/`) |
| Config file | none — no test file expected for this script |
| Quick run command | `npx tsx scripts/audit-ui-drift.ts` (run the script itself; its own printed counts ARE the verification) |
| Full suite command | `npm run typecheck` (covers `scripts/` per `tsconfig.json` `include`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | Script correctly identifies raw button/input/hex-rgb/arbitrary-spacing violations, file-attributed | manual-only (compare script output counts against this research's verified baseline: 20 button files, 8 input files, 3 hex files, 0 spacing files) | `npx tsx scripts/audit-ui-drift.ts` then diff against baseline in this doc | N/A — no test file, output is human-diffable against the Verified File Counts table above |
| AUDIT-02 | Output is a usable checklist/backlog, file-mapped | manual-only (read `DRIFT-AUDIT.md`, confirm Markdown checklist format, one entry per file per category) | — | ❌ Wave 0: `DRIFT-AUDIT.md` doesn't exist yet — it's this phase's deliverable |

**Justification for manual-only:** This is a read-only, one-shot audit script producing a static Markdown artifact for human/downstream-planner consumption, not a runtime code path with regression risk. Automated snapshot-testing the script's own regex output against this research's verified counts (20/8/3/0) is the practical acceptance check — a plan task should explicitly diff the script's printed summary against those four numbers before considering the script correct, since a silent regex bug (e.g., forgetting to filter `.test.tsx`) would otherwise ship wrong data to Phases 30-33 undetected.

### Sampling Rate
- **Per task commit:** Run the script, manually confirm printed counts match this research's verified baseline (20 button / 8 input / 3 hex / 0 spacing / 17 routes / 14 CLAUDE.md rows).
- **Per wave merge:** `npm run typecheck` (confirms `scripts/audit-ui-drift.ts` compiles under strict TS).
- **Phase gate:** `DRIFT-AUDIT.md` exists, committed, and its counts match the verified baseline (or a documented, explained delta if the repo changed between research and execution).

### Wave 0 Gaps
- None — no test framework or fixtures are needed. This phase's "test" is the script's own output compared against the verified baseline table in this document.

## Security Domain

Not materially applicable. This is a local, read-only, developer-run script with no network I/O, no user input, no auth surface, and no data persistence beyond a git-tracked Markdown file. No ASVS category applies meaningfully.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V5 Input Validation | No | Script reads only files within the repo it's run from; no external/untrusted input |

No threat-pattern table needed — no STRIDE-relevant surface (no network calls, no secrets, no privilege boundary).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| AUDIT-01 | A drift audit exists identifying every raw `<button>`/`<input>`, hardcoded hex color, and arbitrary-value Tailwind class across `pages/`, `widgets/`, `features/` (17 routes) | Verified regex patterns + exact file-filtering approach (exclude `.test.*`/`.stories.*`/`shared/ui`) that produce the correct counts: 20 button files, 8 input files, 3 hex files, 0 spacing files — see Architecture Patterns, Pattern 2 |
| AUDIT-02 | Audit output is a checklist/backlog mapped to specific files, usable to scope subsequent fix phases | D-02/D-03 (Markdown checklist at `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md`) confirmed as the right format/location; Open Question 2 flags the line-number-vs-file-level granularity decision for the planner |

## Sources

### Primary (HIGH confidence)
- Direct repo inspection via `grep`/`node --version`/file reads: `src/pages/`, `src/widgets/`, `src/features/`, `src/app/router.tsx`, `CLAUDE.md`, `tsconfig.json`, `package.json`, `tailwind.config.ts` — all counts and pitfalls in this document are reproducible with the exact commands shown.
- `.planning/phases/29-ui-drift-audit/29-CONTEXT.md` — locked decisions D-01 through D-06 (this research verifies, does not override, these).
- `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md` — phase scope and milestone framing.

### Secondary (MEDIUM confidence)
- Node.js `Dirent.parentPath` availability (Node 20.12+/21.4+) — based on training knowledge of Node release notes, not independently re-verified via WebFetch this session; flagged as Assumption A1.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, both `tsx` and `glob` version-confirmed directly from `package.json`.
- Architecture: HIGH — all violation counts and the route-count reconciliation were reproduced directly against the live repository, not estimated.
- Pitfalls: HIGH — every pitfall in this document was triggered and observed directly (test-file false positives, `<Routes>` substring collision, CLAUDE.md row miscount, tsconfig `scripts/` inclusion) rather than inferred from general knowledge.

**Research date:** 2026-07-10
**Valid until:** Effectively durable until the codebase's raw-button/input/hex/route counts change materially (i.e., until Phases 30-33 start fixing files) — this is a point-in-time audit baseline, not a stable API/library recommendation with a normal staleness window. Re-verify counts immediately before the audit script ships if significant time passes between this research and execution.
