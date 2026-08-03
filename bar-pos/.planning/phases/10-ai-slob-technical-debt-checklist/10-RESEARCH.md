# Phase 10: AI Slob Technical Debt Checklist - Research

**Researched:** 2026-08-03
**Domain:** Static-analysis tooling pipeline (dead code / duplication / circular-dependency detection) + existing lint/typecheck/test/E2E gates, synthesized into a severity-grouped audit document
**Confidence:** MEDIUM (tool CLI mechanics HIGH; severity thresholds and some false-positive claims MEDIUM/LOW — flagged below)

## Summary

This phase installs three new devDependencies (**knip**, **jscpd**, **madge**) alongside the four already-wired `npm run` scripts (`lint`, `typecheck`, `test`, `test:e2e`), runs all seven as one audit pass over the whole `bar-pos/` tree, and synthesizes their structured (JSON) output into a single severity-grouped `CHECKLIST.md`. No remediation happens in this phase.

The critical fact the planner needs: **`bar-pos/` is the actual project root for every one of these tools** — it has its own `package.json`, `tsconfig.json`, `vite.config.ts`. The git root one level up (`/mnt/ai/bola8pos-kiro`) has no `package.json` and is irrelevant to knip/jscpd/madge invocation. All three tools should simply be run with cwd = `bar-pos/` (i.e. from inside the existing npm scripts), exactly like `lint`/`typecheck`/`test` already are. There is no monorepo/workspace complexity to solve.

All three tools were verified to exist on the npm registry with long track records (knip: registry since 2022-10, 12.2M weekly downloads; jscpd: registry since 2013-06, 2.2M weekly downloads; madge: registry since 2012-05, 3.2M weekly downloads) and no postinstall scripts. jscpd v5 (the current major, a Rust rewrite) ships its binary via per-platform `optionalDependencies` (`jscpd-linux-x64-gnu` etc.) rather than a postinstall compile step — a normal, safe pattern (same approach as esbuild/swc).

**Primary recommendation:** Add all three tools as devDependencies pinned to their current versions (knip `^6.31.0`, jscpd `^5.0.14`, madge `^8.0.0`), write one `--reporter/--reporters json` config per tool that explicitly excludes `graphify-out/`, `src/graphify-out/`, `node_modules`, `dist`, `src-tauri`, `coverage`, and generated files (`src/shared/lib/supabase.types.ts`, `src/shared/ui/**` shadcn components), run all seven checks via one orchestration script that writes each tool's JSON to an untracked scratch directory, then have Claude read only the JSON summaries (never full source files) to write `CHECKLIST.md`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lint/typecheck/unit/E2E execution | Build tooling (npm scripts) | — | Already wired; this phase only re-runs, doesn't change them |
| Unused files/exports/deps detection | Build tooling (knip, dev-only) | — | Static analysis over `src/`, no runtime code touched |
| Duplicate-code detection | Build tooling (jscpd, dev-only) | — | Static analysis, no runtime code touched |
| Circular-dependency detection | Build tooling (madge, dev-only) | — | Static analysis, no runtime code touched |
| Checklist synthesis | Claude (research/planning tier) | — | Reads JSON reports, not source files, per D-03 |

This phase has no browser/API/database tier work — it is entirely dev-tooling + documentation output.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| knip | 6.31.0 [VERIFIED: npm registry] | Unused files/exports/dependencies/dead code | Most-downloaded (12.2M/wk), actively maintained, TS/Vite/Vitest/Storybook/Playwright plugins built in — matches this stack exactly |
| jscpd | 5.0.14 [VERIFIED: npm registry] | Copy/paste (duplicate code) detection across formats | Standard duplication detector for JS/TS ecosystems; v5 Rust engine is fast enough for whole-repo CI runs |
| madge | 8.0.0 [VERIFIED: npm registry] | Circular-dependency / dependency-graph analysis | De facto standard for JS/TS circular-dep detection; supports `tsConfig` path-alias resolution directly |

Package names for all three came from the user's own locked decision (CONTEXT.md D-04), not from this research session's web search — so the `[ASSUMED]` package-provenance rule for *discovered* names does not apply here. Their registry facts (version, age, downloads, postinstall) were independently confirmed this session via `npm view`, so those specific facts are `[VERIFIED: npm registry]`.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | — | — | All JSON parsing can be done with Node's built-in `JSON.parse`; no schema-validation library needed for reading these reports (Zod is for domain data, not throwaway audit tooling output) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| knip | ts-prune, depcheck, unimported | User already confirmed (D-04) none of these are installed and explicitly chose knip — it's the only one of the four that covers files+exports+deps+binaries in one tool |
| jscpd | eslint plugin sonarjs `no-duplicate-string` | jscpd does cross-file structural clone detection; ESLint rules are single-file/token-level only — different problem, not a substitute |
| madge | dependency-cruiser | Both work; madge was explicitly chosen (D-04) and has a smaller config surface for a single-package (non-monorepo) TS project |

**Installation:**
```bash
cd bar-pos
npm install -D knip@^6.31.0 jscpd@^5.0.14 madge@^8.0.0
```

**Version verification:** confirmed live via `npm view <pkg> version` on 2026-08-03 (see table above). Training-data familiarity with jscpd assumed the older v4 TypeScript engine — the registry shows v5.0.14, the Rust rewrite, is current. **Do not reuse v4-era CLI-flag knowledge without checking `npx jscpd --help` first** — the two engines' documented flag sets differ (see Pitfall 3 below).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict (seam) | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| knip | npm | 3.8 yrs (first published 2022-10-09) | 12.2M/wk | github.com/webpro-nl/knip | SUS (`too-new`) | **Overridden → OK.** False positive — see below. |
| jscpd | npm | 12.2 yrs (first published 2013-06-03) | 2.2M/wk | github.com/kucherenko/jscpd | SUS (`too-new`) | **Overridden → OK.** False positive — see below. |
| madge | npm | 14.2 yrs (first published 2012-05-20) | 3.2M/wk | github.com/pahen/madge | OK | Approved |

**Why knip/jscpd were flagged SUS despite being years old:** the automated legitimacy seam's `too-new` signal is computed from the *most recent version's* publish timestamp (knip 6.31.0 published 2026-07-31; jscpd 5.0.14 published 2026-07-27 — both within the last ~1-2 weeks of this research date), not the package's first-ever publish date. Both packages release frequently; a recent patch release is normal, healthy maintenance activity, not a slopsquat signal. `npm view <pkg> time.created` was checked directly this session and confirms both packages predate this project by years (knip: 2022, jscpd: 2013). Combined with multi-million weekly downloads and long-lived GitHub repos, this is a confirmed false positive, not a real risk.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** knip, jscpd — flagged by the automated seam only; manually verified as legitimate via `npm view <pkg> time.created` (see above). **Recommendation:** the planner may skip inserting a `checkpoint:human-verify` task for these two specifically, since the override evidence (registry age, download count, repo) is already documented here and re-verifiable with one command. If the plan-checker or a stricter reviewer wants the checkpoint anyway, it should be a fast confirm-and-proceed (re-run `npm view knip time.created` / `npm view jscpd time.created`), not a blocking research task.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │  npm run audit:tech-debt (new script)    │
                    └───────────────┬───────────────────────────┘
                                    │
        ┌───────────────┬──────────┼──────────┬───────────────┬─────────────┬─────────────┐
        ▼               ▼          ▼          ▼               ▼             ▼             ▼
   npm run lint   npm run     npm run    npm run       npx knip       npx jscpd     npx madge
   (existing)     typecheck   test       test:e2e      --reporter     --reporters   --circular
                  (existing)  (existing) (existing)    json           json          --json
        │               │          │          │               │             │             │
        ▼               ▼          ▼          ▼               ▼             ▼             ▼
   eslint JSON     tsc text   vitest     playwright     knip-report   jscpd-report  madge-cycles
   (--format json) output    --reporter  JSON reporter  .json         .json         .json
                             json                        (unused       (duplicate    (circular
                                                          files/        code          dep
                                                          exports/      blocks)       chains)
                                                          deps)
        │               │          │          │               │             │             │
        └───────────────┴──────────┴──────────┴───────────────┴─────────────┴─────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  Claude reads 7 JSON files only          │
                    │  (never re-reads source files)           │
                    │  groups findings by severity → sub-groups│
                    │  by source/category (D-06)                │
                    └───────────────┬───────────────────────────┘
                                    │
                                    ▼
                    .planning/phases/10-.../CHECKLIST.md
```

### Recommended Project Structure
```
bar-pos/
├── knip.json                 # NEW — knip config (ignores, entry, plugins)
├── .jscpd.json                # NEW — jscpd config (ignore, reporters, thresholds)
├── .madgerc                  # NEW — madge config (tsConfig path, excludeRegExp)
├── .planning/phases/10-ai-slob-technical-debt-checklist/
│   ├── 10-RESEARCH.md
│   ├── 10-PLAN.md            # planner output
│   └── 10-CHECKLIST.md       # this phase's deliverable
```
Report JSON output itself (knip-report.json, jscpd-report.json, madge-circular.json, eslint-report.json, tsc-errors.json, vitest-results.json, playwright-results.json) should be written to an **untracked scratch dir** (e.g. `/tmp` or a gitignored `.audit-tmp/`), not committed — they are throwaway intermediate artifacts, only `CHECKLIST.md` is the deliverable.

### Pattern 1: JSON-first tool invocation (no eyeballing terminal text)
**What:** Every one of the 7 checks must be invoked with its structured/JSON output flag, never parsed from human-readable stdout.
**When to use:** Every task in this phase's plan.
**Example:**
```bash
# lint — ESLint has a built-in json formatter
npx eslint src --format json --max-warnings 0 > /tmp/eslint-report.json || true

# typecheck — tsc has no native JSON reporter; capture text and let the
# planner write a 5-line regex parser (path:line:col - error TSxxxx: msg),
# or use `tsc --noEmit --pretty false` for stable single-line-per-error output
npx tsc --noEmit --pretty false > /tmp/tsc-errors.txt 2>&1 || true

# unit tests — vitest has a JSON reporter
npx vitest run --project unit --reporter=json > /tmp/vitest-results.json || true

# e2e — playwright has a JSON reporter
npx playwright test --reporter=json > /tmp/playwright-results.json || true

# knip — Source: https://knip.dev/features/reporters
npx knip --reporter json > /tmp/knip-report.json || true

# jscpd — Source: jscpd README (reporters: json)
npx jscpd . --reporters json --output /tmp/jscpd-out || true
# -> /tmp/jscpd-out/jscpd-report.json

# madge — Source: madge README (--json, --circular)
npx madge --circular --json --ts-config tsconfig.json src \
  > /tmp/madge-circular.json || true
```
Every command uses `|| true` because all of these tools intentionally use a non-zero exit code to signal "findings present" (knip: exit 1 if issues; madge --circular: exit 1 if cycles found; eslint/vitest/playwright: standard non-zero on failures/errors). The audit script must **not** treat non-zero exit as a script failure — that exit code IS the signal that there's something to add to the checklist.

### Pattern 2: knip's built-in plugin auto-detection
**What:** Knip ships plugins that auto-activate when they see a project's own config files (Vite, Vitest, Storybook, Playwright, ESLint, Tailwind, etc.) and add the right entry points/ignores without manual config.
**When to use:** Rely on this instead of hand-listing every entry point — this repo has `vite.config.ts`, `vitest.config.ts`, `.storybook/main.ts`, `playwright.config.ts`, all of which knip's plugins recognize out of the box. [CITED: knip.dev/reference/faq — "Plugins... save you a lot of configuration out of the box... only for the tools actually installed"]
**Example knip.json:**
```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["src/main.tsx", "src-tauri/**"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "src/graphify-out/**",
    "src/shared/lib/supabase.types.ts"
  ],
  "ignoreDependencies": []
}
```

### Pattern 3: jscpd scoped to source, skip generated/vendor
**Example .jscpd.json:**
```json
{
  "threshold": 0,
  "minLines": 5,
  "minTokens": 50,
  "reporters": ["json"],
  "output": "/tmp/jscpd-out",
  "gitignore": true,
  "ignore": [
    "**/node_modules/**",
    "**/dist/**",
    "**/src-tauri/**",
    "**/graphify-out/**",
    "**/src/graphify-out/**",
    "**/src/shared/lib/supabase.types.ts",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.stories.tsx"
  ]
}
```
[CITED: jscpd README — ignore uses glob patterns; `gitignore: true` additionally respects `.gitignore`]

### Pattern 4: madge with tsconfig path-alias resolution
**Example command:**
```bash
npx madge --circular --json --ts-config tsconfig.json \
  --extensions ts,tsx \
  --exclude '(graphify-out|supabase\.types\.ts|\.stories\.tsx|\.test\.tsx?)$' \
  src/main.tsx
```
madge's `--ts-config` flag resolves the `@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*` aliases from this repo's `tsconfig.json` `paths` block directly [CITED: madge README — "provide tsConfig option ... for TypeScript path resolution"]. No separate webpack/vite-alias config file is needed since this project doesn't use webpack and madge reads Vite-equivalent aliases via the same `tsconfig.json` paths this repo already defines.

### Anti-Patterns to Avoid
- **Treating tool exit code as pass/fail for the audit script itself:** all 7 tools are *expected* to exit non-zero when they find something — that's the whole point of running them. Guard every invocation with `|| true` (or `set +e` around the block) so the orchestration script completes and always produces all 7 JSON files.
- **Reading source files to "double check" a finding:** D-03 explicitly forbids this. If a tool's finding needs `file:line` context for the checklist, that context should come from the tool's own JSON payload (all four tools + eslint + vitest + playwright include file/line in their JSON), not from opening the file.
- **Applying v4 jscpd CLI-flag knowledge to v5:** jscpd v5 is a Rust rewrite; public documentation for v5's exact flag set is thin (official docs pages return mostly overview text, not a complete flag table — see Pitfall 3). Confirm flags with `npx jscpd --help` before writing the pipeline script rather than trusting older blog posts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Finding unused exports/files/deps | A custom grep/AST script over `src/` | knip | Knip already resolves TS path aliases, Vite/Vitest/Storybook/Playwright entry points, and dependency graphs — a hand-rolled version would re-implement a mature static analyzer for one-off use |
| Finding duplicate code blocks | A custom diff/similarity script | jscpd | Token-based clone detection (Rabin-Karp-style) across 224+ formats is exactly what jscpd exists for |
| Finding circular imports | Manually tracing imports | madge | Graph-cycle detection over a real dependency graph, including TS path-alias resolution, is non-trivial to get right by hand |
| Parsing tsc's plain-text error output | A bespoke regex-per-IDE-format parser | `tsc --noEmit --pretty false` (stable `file(line,col): error TSxxxx: message` per line) | No native JSON reporter exists for tsc, but `--pretty false` gives one predictable line format — a 5-line regex is enough; don't build more than that |

**Key insight:** every one of these problems (dead code, duplication, cycles) has a mature, widely-used tool because getting them right by hand (correct alias resolution, correct AST-level comparison, correct graph-cycle detection) is exactly the kind of "deceptively complex" problem this project's own CLAUDE.md guidance about not hand-rolling things applies to.

## Common Pitfalls

### Pitfall 1: knip flags shadcn/ui and Storybook work-in-progress files as "unused"
**What goes wrong:** `src/shared/ui/**` shadcn-generated components and Storybook `.stories.tsx` files often get reported as unused exports because they're consumed only through Storybook or aren't yet wired into a page.
**Why it happens:** Knip's default mode analyzes the whole project including dev-only surfaces; it correctly sees these files aren't imported by production entry points, but that's often intentional (component library, work-in-progress).
**How to avoid:** Two choices, both legitimate — (a) run knip in `--production` mode for a stricter "is this reachable from the shipped app" view, or (b) keep default mode but treat `shared/ui/**` and `**/*.stories.tsx` findings as a distinct sub-category in the checklist (informational, not necessarily "debt") rather than deleting the ignore-pattern escape hatch, which the tool's own docs warn against overusing. [CITED: knip.dev/guides/handling-issues, knip.dev/reference/faq]
**Warning signs:** A large fraction of "unused exports" findings cluster entirely in `shared/ui/` or `*.stories.tsx` — that's the false-positive signature, not a real debt spike.

### Pitfall 2: madge reporting FSD barrel/index re-exports as "circular"
**What goes wrong:** In a layered architecture where an `entities/tab/index.ts` barrel re-exports from multiple internal modules, and one of those internal modules imports a type from a sibling module via the barrel, madge can report a cycle that is actually just barrel-file indirection, not a real logic cycle.
**Why it happens:** Madge builds its graph from static import statements; a barrel that re-exports A and is imported by B, while A also imports something from the barrel, produces a graph cycle even if the *runtime* dependency isn't circular in a harmful sense.
**How to avoid:** Classify madge findings by whether the cycle crosses FSD layers (real architectural violation — Blocking/High) vs. stays within a single entity/feature's own barrel re-exports (Low/informational, common and often harmless). This distinction is not automatic — the checklist-writing step should read each cycle's file list from the JSON and bucket by whether all files share the same top-level `src/<layer>/<slice>/` prefix.
**Warning signs:** A "circular dependency" whose every file lives under the exact same `entities/<name>/` or `features/<name>/` directory is very likely a barrel-indirection artifact, not real debt. [MEDIUM confidence — general community pattern, not tied to a specific FSD+madge citation; recommend the planner spot-check a small sample rather than trust this heuristic blindly.]

### Pitfall 3: jscpd v5's documented CLI surface is thin/inconsistent with v4
**What goes wrong:** Most jscpd blog posts, Stack Overflow answers, and even MegaLinter's descriptor pages document the older v4 (TypeScript engine) flag set. jscpd 5.0.14 (installed by `npm install jscpd`) is the Rust rewrite; some flag names/behaviors differ, and the official README explicitly splits docs into `docs/typescript.md` (v4) vs `docs/rust.md` (v5) without always making clear which applies.
**Why it happens:** A major rewrite (TS → Rust) shipped under the same package name/major-version-bump path; older content dominates search results.
**How to avoid:** Before writing the pipeline script, run `npx jscpd --help` once and treat that output as ground truth over any blog post. The flags this research confirmed from `docs/rust.md` (`--min-tokens`, `--min-lines`, `--reporters`, `--output`, `--ignore`, `--gitignore`, `--skip-local`, `--min-duplicated-lines`, `--silent`) are current for v5, but the exact JSON schema of `jscpd-report.json` was not confirmed from official docs this session — confirm the field names empirically on first run (open the file once, not per-finding).
**Warning signs:** A flag documented in an older tutorial (e.g. `--format`) producing an "unknown option" error — fall back to `--help` output.

### Pitfall 4: `npm run lint`/`test`/`test:e2e` findings need re-triage, not blind re-inclusion
**What goes wrong:** Since D-01 mandates a full re-run (not a delta since Phase 11), the audit could surface findings already tracked in `.planning/todos/pending/*.md`. Per D-05, the audit must run independently first and cross-check afterward — treating a pending-todo item as "new" debt would double-count it.
**How to avoid:** After the independent audit produces raw findings, do one pass comparing against the 6 canonical-refs items (5 pending todos + Phase 38) and annotate matches inline in CHECKLIST.md (e.g. "See existing todo: 2026-07-27-payment-total-omits-tax...") rather than omitting or duplicating.
**Warning signs:** A CHECKLIST.md item that reads suspiciously close to an existing todo's title — cross-reference before finalizing.

### Pitfall 5: stray untracked working-tree files pollute reports if not explicitly ignored
**What goes wrong:** `graphify-out/`, `src/graphify-out/`, `.graphifyignore`, and `Modelfile` are currently untracked (visible in `git status`) and sitting inside `bar-pos/`. `src/graphify-out/cache/ast/**` contains a JSON cache file that is *inside `src/`* — knip's `project` glob (`src/**/*.{ts,tsx}`) naturally excludes it (wrong extension), but jscpd's default recursive scan and madge's directory walk could still touch it unless explicitly ignored, and it would show up as unexplained noise in any generic file-count metric.
**How to avoid:** Add `graphify-out/**` and `src/graphify-out/**` to every tool's ignore list explicitly (shown in the config examples above), even though today's file extensions happen not to match. This is defensive against graphify emitting `.ts`/`.tsx`/`.json`-adjacent files in a future run.
**Warning signs:** none currently — verified via `find src/graphify-out -type f | sed 's/.*\.//' | sort | uniq -c` this session: exactly 1 file, extension `.json`. [VERIFIED: local filesystem check]

## Code Examples

### Full orchestration script skeleton
```bash
#!/usr/bin/env bash
# scripts/run-tech-debt-audit.sh — Phase 10, run once, write JSON, never re-run per-finding
set -uo pipefail   # NOT -e: every tool below exits non-zero on findings, that's expected
OUT=/tmp/phase10-audit
mkdir -p "$OUT"

npx eslint src --format json --max-warnings 0 > "$OUT/eslint-report.json"
npx tsc --noEmit --pretty false > "$OUT/tsc-errors.txt" 2>&1
npx vitest run --project unit --reporter=json > "$OUT/vitest-results.json"
npx playwright test --reporter=json > "$OUT/playwright-results.json"
npx knip --reporter json > "$OUT/knip-report.json"
npx jscpd . --reporters json --output "$OUT/jscpd-out"
npx madge --circular --json --ts-config tsconfig.json --extensions ts,tsx \
  --exclude '(graphify-out|supabase\.types\.ts|\.stories\.tsx|\.test\.tsx?)$' \
  src/main.tsx > "$OUT/madge-circular.json"

echo "All 7 reports written to $OUT — read only these JSON files to write CHECKLIST.md"
```
This is a throwaway script (not committed as a permanent npm script unless the plan decides remediation phases will re-run it later — Claude's Discretion, no strong opinion either way since this phase is audit-only).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| jscpd v4 (TypeScript engine) | jscpd v5 (Rust engine, per-platform optional binary) | v5 line, actively current as of 2026-07 | 24-37x faster per jscpd's own release notes claim [CITED: jscpd README]; CLI flag set partially changed — verify with `--help`, don't trust v4-era tutorials verbatim |
| ts-prune (community favorite ~2021-2023) | knip | knip has effectively superseded ts-prune/depcheck/unimported as the consolidated tool covering files+exports+deps+binaries in one pass — user's own D-04 research already confirmed this by choosing knip over the older alternatives | Single tool instead of three |

**Deprecated/outdated:** ts-prune is in maintenance mode in the broader ecosystem; not used here regardless since D-04 already locked in knip.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Severity-tier definitions (Blocking/High/Medium/Low → which tool categories map to which tier) proposed below | Common Pitfalls / this section's tier table | Planner may need to adjust thresholds after seeing actual finding volume; low risk since D-06 leaves exact thresholds to researcher/planner discretion |
| A2 | madge circular-dependency-within-single-FSD-slice heuristic (barrel-indirection false positive) | Pitfall 2 | If wrong, some genuine cross-module cycles inside one slice could be under-prioritized as "Low" — mitigate by having the planner spot-check a sample of same-slice cycles rather than blanket-downgrading all of them |
| A3 | jscpd-report.json exact field schema (not confirmed from official docs; only reporter *names* and CLI flags were confirmed) | Pattern 3 / Pitfall 3 | Low risk — plan should include one inspection step (`cat` the file once) before writing a parser against assumed field names |
| A4 | Oversized-file and stale-TODO/FIXME thresholds (proposed below: >400 lines, >90 days old comment) are not tool-derived; they are reasonable defaults, not measured against this specific codebase's actual file-size distribution | Severity Tiers below | If the codebase's median file size is very different from typical FSD projects, threshold may need adjusting — flag for user confirmation during planning if the plan-checker wants tighter calibration |

## Open Questions

1. **Exact severity-tier boundaries**
   - What we know: D-06 requires severity grouping (Blocking/High/Medium/Low) with source/category sub-groups; Claude's Discretion note explicitly defers exact thresholds to researcher/planner.
   - What's unclear: How many findings each tool will actually surface on this codebase (unknown until the audit runs).
   - Recommendation (proposed tiers, to confirm/adjust once real finding counts are in hand):
     - **Blocking:** `npm run lint` errors (not warnings — script already enforces `max-warnings 0`), `npm run typecheck` errors, `npm run test` failures, `npm run test:e2e` failures, madge circular dependencies that cross FSD layer boundaries (app→pages→widgets→features→entities→shared violations), knip `unresolved`/`unlisted` findings (broken/missing imports — these can break the build).
     - **High:** knip `dependencies`/`files`/`exports` findings outside `shared/ui/**` and `*.stories.tsx` (real unused code, not knip's own known false-positive surfaces), jscpd duplicate blocks ≥50 lines that span different FSD slices (not intentional parallel features), unjustified `as any` (grep for `as any` not immediately preceded by a same-line justification comment, per this project's own CLAUDE.md "No `any` without a justification comment on the same line" rule).
     - **Medium:** knip unused-export findings confined to `shared/ui/**`/`*.stories.tsx` (Pitfall 1 — likely false-positive but still worth listing for human triage), jscpd duplicates within the same FSD slice (possibly intentional parallel structure, still worth a look), madge cycles confined to one slice's own barrel (Pitfall 2).
     - **Low:** stale TODO/FIXME comments (grep for `TODO|FIXME`, cross-reference git blame date if easy, else just list all with file:line), oversized files (>400 lines as a starting heuristic for a `shared/ui`/`entities`/`features` file — adjust after seeing the real distribution).

2. **Whether to run knip in default mode or `--production` mode**
   - What we know: production mode strictly excludes tests/devDependencies/Storybook and reduces false positives (Pitfall 1); default mode catches more but includes WIP-code noise.
   - What's unclear: Which mode better serves "full re-audit including regressions in old code" per D-01's intent.
   - Recommendation: run **both** — default mode as the primary source of findings, production mode as a cross-check to identify which default-mode findings would disappear in production mode (those go in the Medium tier per the table above, since they're likely Storybook/test-only code, not necessarily undeletable production debt).

3. **ROADMAP.md stale duplicate section (D-04 phase-boundary note)**
   - What we know: CONTEXT.md documents a stale "Phase 10" detailed section at ROADMAP.md line ~323 that incorrectly shows this phase as already executed.
   - What's unclear: Whether fixing it belongs in this phase's plan or a separate doc-hygiene todo (left to Claude's Discretion per CONTEXT.md).
   - Recommendation: **fix it as part of this phase's plan**, as a small final task (delete/replace the stale section, matching what STATE.md/ROADMAP.md's top-level checklist and PROJECT.md already correctly show). Rationale: it's a one-line/one-section diff directly touching the same document this phase's own execution will need to update anyway (marking Phase 10 complete), so doing it in the same commit avoids a second document-touching pass later and avoids leaving a known-wrong doc in the tree an extra milestone cycle. Not filing a separate todo also matches this phase's own spirit (don't leave low-effort corrections to "later").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | all tooling | ✓ | v24.18.0 | — |
| npm/npx | all tooling | ✓ | 11.16.0 | — |
| git | audit cross-referencing, cwd detection | ✓ | 2.53.0 | — |
| google-chrome-stable | `npm run test:e2e` (Playwright `channel: 'chrome'`) | ✓ | installed at `/usr/bin/google-chrome-stable` | — |
| Display session (`$DISPLAY`) | Playwright non-headless requirement (per CLAUDE.md) | ✓ | `:0` set | — |
| knip/jscpd/madge | new audit tooling | ✗ (not yet installed) | — | Installation is this phase's own Task 1 — not a blocker, it's in-scope work |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — knip/jscpd/madge absence is expected (installing them is this phase's own first task, not an external blocker).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (unit), Playwright v1.59 (E2E) — both pre-existing, unchanged by this phase |
| Config file | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` |
| Quick run command | `npm run test` (Vitest unit, ~seconds) |
| Full suite command | `npm run test` + `npm run test:e2e` (E2E requires display + Chrome, both confirmed available) |

### Phase Requirements → Test Map
This phase has no `REQUIREMENTS.md` entries (`phase_req_ids` is null — confirmed `.planning/REQUIREMENTS.md` does not exist in this project). There is no traditional feature behavior to unit-test; the phase's own "correctness" is that `CHECKLIST.md` accurately reflects the 7 tools' actual output. Treat verification as a **smoke/reconciliation check**, not unit tests:

| Check | Behavior | Test Type | Automated Command | File Exists? |
|-------|----------|-----------|---------------------|--------------|
| CHECKLIST.md finding counts match tool output | Every finding count cited in CHECKLIST.md's severity tables sums to the same total the raw JSON reports contain | smoke (manual reconciliation, one-time) | `jq '.results | length' /tmp/phase10-audit/eslint-report.json` (and equivalent per-tool JSON query), diff against CHECKLIST.md's stated counts | N/A — this is a one-off audit-completion check, not a persisted test file |
| Config files don't break existing green baseline | Adding `knip.json`/`.jscpd.json`/`.madgerc` and 3 devDependencies doesn't change `npm run lint`/`typecheck`/`test` exit codes | smoke | `npm run lint && npm run typecheck && npm run test` (re-run after adding the new devDependencies/config files, before writing the checklist) | N/A |

### Sampling Rate
- **Per task commit:** none required beyond the existing `npm run typecheck` (adding devDependencies + config files should not break typecheck).
- **Per wave merge:** re-run the full 7-tool script once after all config files are in place, before writing CHECKLIST.md.
- **Phase gate:** `CHECKLIST.md` exists, is severity-grouped per D-06, and its counts reconcile against the raw JSON reports (see table above) before `/gsd-verify-work`.

### Wave 0 Gaps
None — existing test infrastructure (Vitest + Playwright) fully covers this phase's minimal test-adjacent needs (baseline-preservation smoke checks only). No new test files are needed since this phase produces no new application code.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | This phase touches no auth code |
| V3 Session Management | No | This phase touches no session code |
| V4 Access Control | No | This phase touches no RBAC/permission code |
| V5 Input Validation | No | This phase produces documentation, not user-facing input handling |
| V6 Cryptography | No | Not applicable |

This phase's only security-relevant surface is **supply-chain risk from the 3 new devDependencies**, which is not an ASVS web-app category but is worth documenting.

### Known Threat Patterns for this phase's actual surface (devDependency supply chain)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malicious/compromised devDependency with a postinstall script | Tampering | Confirmed this session: `npm view knip scripts.postinstall`, `npm view jscpd scripts.postinstall`, `npm view madge scripts.postinstall` all return empty — none of the three run a postinstall script. jscpd distributes its native binary via `optionalDependencies` (standard `esbuild`/`swc`-style per-platform packages), not a build-time compile/download step. |
| Typosquat/slopsquat package name | Spoofing | All three package names were user-specified in CONTEXT.md D-04 (a locked decision, not this session's discovery), and independently confirmed on the npm registry with multi-year history and multi-million weekly downloads — see Package Legitimacy Audit above. |
| Audit tooling accidentally exfiltrating source via a "helpful" telemetry/reporting feature | Information Disclosure | None of knip/jscpd/madge are documented to phone home by default; if the plan adds any tool that does (none currently proposed), it must be explicitly disabled via config before running against this codebase's proprietary source. |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view knip/jscpd/madge version|time.created|time.modified|scripts.postinstall|optionalDependencies`) — checked live 2026-08-03
- Local filesystem (`tsconfig.json`, `vite.config.ts`, `package.json`, `eslint.config.js`, `git status`, `find src/graphify-out`) — checked live 2026-08-03
- `gsd-tools query package-legitimacy check --ecosystem npm knip jscpd madge` — seam output, cross-checked manually against `npm view time.created`

### Secondary (MEDIUM confidence)
- [Knip Configuration Reference](https://knip.dev/reference/configuration) — entry/project/ignore/workspaces semantics
- [Knip CLI Reference](https://knip.dev/reference/cli) — `--reporter json`, `--directory`, exit codes 0/1/2
- [Knip Reporters & Preprocessors](https://knip.dev/features/reporters) — reporter list including `json`
- [Knip FAQ](https://knip.dev/reference/faq) — production mode, monorepo/workspace handling, plugin auto-detection
- [Knip false-positive issue #719](https://github.com/webpro-nl/knip/issues/719) — monorepo false-positive precedent
- [jscpd GitHub README](https://github.com/kucherenko/jscpd) — reporters list, v4 vs v5 docs split, config priority
- [jscpd docs/rust.md](https://github.com/kucherenko/jscpd/blob/master/docs/rust.md) — v5 CLI flags
- [madge GitHub README](https://github.com/pahen/madge) — `--circular`, `--json`, `--ts-config`, alias resolution
- [Madge circular-dependency exit-code discussion](https://github.com/pahen/madge/issues/288) / GitHub Actions circular-dependency-check marketplace action — exit-code-1-on-cycle-found behavior

### Tertiary (LOW confidence)
- General WebSearch results on jscpd `--skip-local`/threshold false-positive tuning for boilerplate-similar folders (no single authoritative source, aggregated from multiple blog/README mentions)
- Community understanding of madge barrel-file/FSD circular false positives (Pitfall 2) — not tied to a specific authoritative citation, flagged for spot-check during planning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all 3 packages verified live on npm registry with version/age/downloads/postinstall data
- Architecture: HIGH — cwd/config placement resolved by direct filesystem inspection (no monorepo ambiguity found), CLI invocation patterns confirmed from official docs/READMEs
- Pitfalls: MEDIUM — knip/jscpd false-positive patterns backed by official docs and GitHub issues; madge/FSD-specific barrel false-positive is a reasonable inference, not directly cited (flagged as Assumption A2)
- Severity tiers: LOW/MEDIUM — proposed by this research per CONTEXT.md's explicit discretion grant, not derived from actual finding counts (unknowable until the audit runs)

**Research date:** 2026-08-03
**Valid until:** 30 days (stable ecosystem; jscpd v5's thin documentation is the main fast-moving risk — re-check `npx jscpd --help` if this research is reused after that window)
