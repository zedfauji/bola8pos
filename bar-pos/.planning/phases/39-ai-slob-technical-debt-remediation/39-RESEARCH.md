# Phase 39: AI Slob Technical Debt Remediation - Research

**Researched:** 2026-08-03
**Domain:** Dead-code removal (knip) + E2E test triage/fix (Playwright) in a mature FSD React/TypeScript/Tauri codebase
**Confidence:** HIGH

## Summary

This phase has no new-technology surface — it is entirely a remediation of findings already produced by Phase 10's audit pipeline (`scripts/run-tech-debt-audit.sh`, `knip.json`, `.jscpd.json`). The research effort here was spent verifying **what the raw finding counts actually mean mechanically**, because the counts in CONTEXT.md/10-CHECKLIST.md are *raw digest sums*, not deduplicated work items, and planning waves off the raw numbers will oversize the phase.

Three findings materially change how this phase should be sized:

1. **knip's default-mode and production-mode reports overlap ~95%.** They are two separate `knip` invocations (`npx knip` and `npx knip --production`) scanning largely the same source, so most of the "1917 High-tier" findings are the *same* dead-code location reported twice. Recomputed directly against the raw `.audit-tmp/knip-report.json` / `.audit-tmp/knip-production.json` (excluding the 37 Medium-tier `shared/ui`/stories items per D-08, and excluding deps/devDeps per D-09), the **actual distinct High-tier work is 982 findings across 198 distinct source files** (61 whole-file deletions + 137 files needing partial export/type edits) — not ~1857. See "Standard Stack → knip Output Mechanics" below for the exact commands used.
2. **`domain.ts` + `edge-function-contracts.ts` alone account for 181 of the 982 findings (~18%).** Both are CLAUDE.md-designated "single source of truth" registry files. knip has a well-documented elevated false-positive rate on this exact file shape (a barrel/registry exporting a wide public API where only a subset is currently consumed). These two files warrant one dedicated review plan, not blind batch deletion.
3. **The Blocking-tier E2E "83 unannotated" figure is failed tests only** (94 failed − 11 confirmed-infra = 83; the 53 skipped tests are a separate, disjoint triage bucket — total triage-required E2E work is 83 + 53 = 136 items, plus 11 already routed to Phase 38 with no code change needed here). A grep across `e2e/*.spec.ts` found 136 `test.skip(true, '...')` call sites, many with reasons like `'UI not implemented — EXPECTED FAIL'` for features (e.g. void-order, transfer-tab) that CLAUDE.md's "Implemented Features" list now confirms shipped — meaning a meaningful fraction of the 53 skips are likely stale placeholders that should be re-enabled and will now pass, not real infra/regression work.

**Primary recommendation:** Do not plan waves off the raw "1954"/"2135" figures. Plan off the verified distinct-item counts in this document. Sequence knip's own recommended order (unused files → unresolved → unused exports → unused types → dependencies) and keep the registry files (`domain.ts`, `edge-function-contracts.ts`) in their own review plan. Keep E2E triage in a separate wave from knip removal — they touch disjoint files and have no ordering dependency on each other, so they are safe to run as parallel plan tracks within the phase, not sequential ones.

## Architectural Responsibility Map

This phase is a remediation phase, not a feature phase — "capabilities" here are audit categories, not app-domain capabilities. Ownership maps to *where the dead code / failing test physically lives*, not a single tier:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| knip dead-code deletion (files/exports/types) | Spans all tiers (`app→pages→widgets→features→entities→shared`) | — | Findings are distributed across the full FSD tree; each deletion must respect the existing `app→pages→widgets→features→entities→shared` import direction (deleting an export from `shared/` requires confirming no upstream tier still imports it) |
| E2E triage-and-fix | Test harness (`e2e/`) | Whichever tier owns the underlying bug (widgets/features/entities) once triaged as "real regression" | A failing spec is a symptom; D-03 requires filing real product bugs as todos rather than fixing them inline here, so most fixes stay inside `e2e/*.spec.ts` (test/seed logic) not `src/` |
| knip unlisted-dependency fix (`@testing-library/user-event`) | Build tooling (`package.json`) | — | Single-line devDependency addition; no application tier touched |
| Audit re-verification | Dev tooling (`scripts/run-tech-debt-audit.sh`) | — | Re-run after each wave to confirm counts actually dropped, not a new capability |

## Standard Stack

### Core (already installed — no new runtime dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `knip` | `^6.31.0` [VERIFIED: package.json:127] | Dead-code/dead-export/dead-type/dead-dependency detection | Already the project's audit tool (Phase 10); do not introduce a second dead-code tool |
| `@playwright/test` | `^1.59.1` [VERIFIED: package.json:90] | E2E test runner used for triage/re-run | Already the project's E2E framework; `npx playwright test e2e/NN-name.spec.ts` re-runs a single spec |
| `vitest` | `^4.1.4` [VERIFIED: package.json:140] | Unit test runner, re-run after each dead-code deletion wave (`npm run test`) | Fastest signal that a deletion broke something still-imported |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/user-event` | `^14.6.1` (currently resolved transitively; `14.6.3` latest on npm) [VERIFIED: npm registry] | Direct devDependency to fix the 34 "unlisted" knip Blocking findings | Add to `package.json` `devDependencies` — see Package Legitimacy Audit below for the important correction on *which* package currently supplies it |

### Alternatives Considered

None — this phase makes no library choice; it is 100% remediation of existing tooling output.

**Installation:**
```bash
npm install --save-dev @testing-library/user-event@^14.6.1
```

**Version verification — corrected provenance chain (important):**

10-CHECKLIST.md's inline note states the 34 unlisted `@testing-library/user-event` imports are "transitively available via `@testing-library/react`, but not declared directly." **This is incorrect** — verified this session via `npm ls @testing-library/user-event --all`:
```
bar-pos@0.1.0 /mnt/ai/bola8pos-kiro/bar-pos
└─┬ storybook@10.3.5
  └── @testing-library/user-event@14.6.1
```
[VERIFIED: npm ls output, this session] The package is transitively resolvable *only* through `storybook` (a devDependency), not through `@testing-library/react`. Because all 34 offending imports are in `*.test.tsx` files run under **Vitest** (not Storybook's toolchain), relying on this transitive path is fragile — an npm/lockfile change that drops or re-versions `storybook`'s own `@testing-library/user-event` pin would silently break every one of those 34 test files with no `package.json` signal. This makes the direct-devDependency fix (not just "config-only," an actual behavior-preserving hardening) higher-value than the checklist implied.

`npm view @testing-library/user-event version` → `14.6.3` [VERIFIED: npm registry, this session]. Pin to `^14.6.1` (matches what's already resolved and already exercised by the 1391 passing unit tests) rather than jumping to `14.6.3` inside this remediation phase, to keep the diff a pure "declare what's already used" change with zero behavior risk.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `@testing-library/user-event` | npm | Long-established (testing-library org); latest patch published same day this research ran | 45,520,101/wk [VERIFIED: gsd-tools package-legitimacy check, this session] | `github.com/testing-library/user-event` | `SUS` (heuristic: "too-new") | **Approved despite SUS flag** — the "too-new" signal fired only because the *latest patch* (`14.6.3`) happened to publish on the audit's run date; the package itself is the canonical `testing-library` org package with 45M weekly downloads and is already installed transitively (verified above). This is a heuristic false positive, not a real slopsquat risk. No `checkpoint:human-verify` needed, but note the "too-new" trigger in the plan for auditability. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@testing-library/user-event` (approved — see rationale above; heuristic false-positive, not a genuine slopsquat signal).

No other packages are installed by this phase — knip dead-code removal deletes code, it does not add dependencies; unused-dependency *removal* (the other 15 default-mode + 11 production-mode `package.json` findings) is explicitly deferred to a future phase per D-09.

## Architecture Patterns

### Remediation Pipeline Flow

```
                        ┌─────────────────────────────┐
                        │ npm run audit:tech-debt      │
                        │ (re-run at Wave 0 + each     │
                        │  wave boundary)               │
                        └──────────────┬───────────────┘
                                        │ writes
                                        ▼
                        ┌─────────────────────────────┐
                        │ .audit-tmp/                  │
                        │  knip-report.json (default)  │
                        │  knip-production.json        │
                        │  playwright-results.json     │
                        │  e2e-per-spec/*.json + *.log  │
                        └──────────────┬───────────────┘
                     ┌──────────────────┴───────────────────┐
                     ▼                                       ▼
        ┌─────────────────────────┐            ┌────────────────────────────┐
        │ Track A: E2E triage      │            │ Track B: knip dead-code     │
        │ (independent of Track B) │            │ removal (independent of A)  │
        └────────────┬─────────────┘            └──────────────┬─────────────┘
                     │                                          │
      ┌──────────────┼──────────────┐          ┌────────────────┼─────────────────┐
      ▼              ▼              ▼          ▼                ▼                  ▼
 11 infra-tied   83 failed,     53 skipped   61 whole-file  137 files w/     domain.ts +
 → tag/route to  unannotated    → classify:  deletions      partial export/  edge-function-
 Phase 38, no    → open per-    valid-skip / (mechanical,   type deletions   contracts.ts
 code change     spec .json/    un-skip+fix  check for      (batch by FSD    (181 findings,
 needed here     .log, decide   / delete-    Deno edge-fn   layer, safe to   dedicated review
                 real-regres-   obsolete     false-         parallelize —    plan — high
                 sion/infra/    (check       positives      no cross-file    false-positive
                 obsolete       CLAUDE.md    first — DO     coupling within  risk, registry
                                "Implemented NOT delete)     a tier)          files)
                                Features"
                                first)
      │              │              │          │                │                  │
      └──────────────┴──────────────┴──────────┴────────────────┴──────────────────┘
                                        │
                                        ▼
                        ┌─────────────────────────────┐
                        │ Re-run npm run test +        │
                        │ npm run typecheck + targeted  │
                        │ npx playwright test <spec>    │
                        │ → confirm counts dropped       │
                        └─────────────────────────────┘
```

### Recommended Wave/Plan Decomposition (Claude's Discretion per CONTEXT.md — this is the recommendation)

Do **not** treat "2135 findings" as 2135 units of planning work. The two tracks (E2E, knip) touch disjoint files and have no dependency on each other — plan them as **parallel tracks**, not sequential waves, within the same phase:

- **Wave 0 (prerequisite, both tracks):** Re-run `npm run audit:tech-debt` fresh (same-day audit, but cheap insurance — D-07 calls dead-code deletion "costly to reverse"). Confirm `.audit-tmp/knip-report.json` / `knip-production.json` / `playwright-results.json` counts still match 10-CHECKLIST.md before either track starts.
- **Track A — E2E (independent plans, can run parallel to Track B):**
  - A1: Tag the 11 confirmed-infra findings with a pointer to Phase 38 (annotation/decision-log only, no `e2e/` edits — these are explicitly "do not fix here" per D-05).
  - A2: Triage the 53 skipped tests first (cheaper — read the inline `test.skip(true, 'reason')` string, cross-check the reason against CLAUDE.md's "Implemented Features" list; many will be one-line un-skips). Batch by spec file (59 files hold the 147 findings — batching by file reuses shared fixture/seed context per spec).
  - A3: Triage the 83 unannotated failed tests — requires opening `.audit-tmp/e2e-per-spec/<spec>.json` (or re-running `npx playwright test e2e/<spec>.spec.ts`) per D-04. Batch by spec file, not by individual test — most specs have 1-5 failing tests sharing one root cause (see Code Examples below for the JSON shape).
- **Track B — knip dead-code (independent plans, can run parallel to Track A):**
  - B1: Fix the 34 unlisted findings (`@testing-library/user-event` devDependency add) — trivial, do first, immediately drops the Blocking-tier count.
  - B2: 61 whole-file deletions — mechanical sweep, EXCEPT flag and skip the `supabase/functions/*/index.ts` (Deno edge-function entry points) and any file under active dynamic reference (see Common Pitfalls) rather than deleting them.
  - B3: `domain.ts` (151 findings) + `edge-function-contracts.ts` (30 findings) — one dedicated plan, manual per-export review (these are registries, not dead code by default — see Common Pitfalls).
  - B4-Bn: Remaining ~135 files with partial export/type findings, batched by FSD layer (`entities/`, `features/`, `widgets/`, `shared/lib/` minus the two registry files, `scripts/`, `supabase/functions/_shared/`) — each layer batch is a safe parallel unit since FSD's own import-direction rule means dead code in one slice is rarely referenced by dead code in another.

This yields roughly **8-11 plans across 2 parallel tracks**, which is larger than a typical phase but is normal *plan* decomposition, not a signal to invoke the phase-split mechanism — the work is mechanically uniform (delete confirmed-dead code / triage one spec) and each plan is independently small and low-context. **Recommend against a phase-split** unless the planner's own context budget is exceeded after drafting these ~8-11 plans; the two-track structure above already keeps each individual plan's diff bounded (single FSD layer or single spec-file batch).

### knip Output Mechanics — what a single finding looks like

Raw `.audit-tmp/knip-report.json` (`npx knip --reporter json`) is a flat array under `.issues`, one object per **file**, with per-category sub-arrays. Read directly this session:

```json
// Source: .audit-tmp/knip-report.json, first array element — read this session
{
  "file": "scripts/audit-ui-drift.ts",
  "files": [{ "name": "scripts/audit-ui-drift.ts" }],
  "exports": [],
  "types": [],
  "unlisted": [],
  "dependencies": [],
  "devDependencies": [],
  "duplicates": []
}
```
[VERIFIED: .audit-tmp/knip-report.json:1-16, this session]

An "unused export" finding carries `{ "name": "...", "line": N, ... }` inside the `exports`/`types` array for that file's object — e.g. `src/shared/lib/domain.ts` has 100 distinct `(file, line, name)` export findings and 51 type findings across the union of default+production runs [VERIFIED: computed this session from `.audit-tmp/knip-report.json` + `.audit-tmp/knip-production.json` via `python3` set-union over `(file, line, name)` tuples].

**Default vs. production mode overlap (the sizing correction):**

```
                          default-mode   production-mode   union (distinct)
unused files                   43              63                63
unused exports                518             685               711
unused types                  273             340               343
duplicate-export pairs          3               3                 3
```
[VERIFIED: computed this session — `python3` script iterating `.audit-tmp/knip-report.json['issues']` and `.audit-tmp/knip-production.json['issues']`, unioning `(file, line, name)` tuples for exports/types and `file` for files]

Excluding the 37 Medium-tier `src/shared/ui/**` findings (D-08, not deleted this phase) and the deps/devDeps findings (D-09, deferred), the **real High-tier scope is 982 distinct findings across 198 distinct files** (61 whole-file deletions + 137 files needing line-level export/type edits) — verified the same way, filtering `f.startswith('src/shared/ui/')` out of both sets before unioning.

### Playwright per-spec JSON shape (for E2E triage, D-04)

`.audit-tmp/e2e-per-spec/<NN-name>.json` already exists on disk (118 files: one `.json` + one `.log` per spec file, 59 specs × 2) [VERIFIED: `ls .audit-tmp/e2e-per-spec | wc -l` → 118, this session]. Each `.json` is a full Playwright JSON-reporter output scoped to that one spec file:

```json
// Source: .audit-tmp/e2e-per-spec/03-tab-order.json — read this session
{
  "config": { ... },
  "suites": [
    {
      "title": "03-tab-order.spec.ts",
      "suites": [
        {
          "title": "Tab + Order Flow",
          "specs": [
            {
              "title": "Bartender creates a tab",
              "tests": [
                {
                  "status": "unexpected",
                  "results": [
                    { "status": "failed", "error": { "message": "Error: expect(locator).toBeHidden() failed\nLocator: getByRole('dialog')\nExpected: hidden\nReceived: visible\nTimeout: 5000ms\n..." } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "stats": { "expected": 6, "skipped": 2, "unexpected": 1, "flaky": 0 }
}
```
[VERIFIED: .audit-tmp/e2e-per-spec/03-tab-order.json, read via python this session — field names `config`/`suites`/`errors`/`stats`, nested `suites[].specs[].tests[].results[].error.message` path]

**Reading a finding:** navigate `suites[].suites[].specs[].tests[].results[].error.message` — this is the *actual* Playwright error/stack that 10-CHECKLIST.md's D-03 discipline explicitly did not open (title-only). This is what D-04's "open its actual error output" step reads. **If `.audit-tmp/e2e-per-spec/` has gone stale or missing** (it is gitignored, regenerable), regenerate a single spec's JSON with:
```bash
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/spec.json npx playwright test e2e/03-tab-order.spec.ts --reporter=json
```
(same env var the audit script itself uses, confirmed in `scripts/run-tech-debt-audit.sh:52-57` [VERIFIED: scripts/run-tech-debt-audit.sh:52-57, read this session]).

### Recommended knip fix order (per knip's own documented guidance)

[CITED: https://knip.dev/guides/handling-issues] knip's maintainers document a specific top-down order because "findings come in chains" — fixing an earlier category collapses later ones:

1. Unused files (delete first — resolves cascading export/type findings for free; verified above only 4-5 of the 982 export/type findings sit in files also flagged for whole-file deletion, so this cascade effect is small here — most export/type findings are genuinely independent of the file-deletion set)
2. Unresolved imports (none in this codebase — `unresolved: 0` both modes, confirmed in 10-CHECKLIST.md's count-reconciliation table)
3. Unused exports
4. Unused types
5. Unused dependencies (deferred, D-09)

[CITED: https://knip.dev/guides/handling-issues] "Configure first, delete last" — before deleting a flagged item, the guidance is to ask whether knip merely lacks visibility (wrong `entry`/`project` glob, missing plugin) rather than the code being truly dead. This directly supports D-07's "quick sanity check per finding for dynamic/string-based usage."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Confirming a deletion wave actually reduced debt | A custom find/grep-based verifier | `npm run audit:tech-debt` (re-run in full or `npx knip --reporter json` for a fast partial check) | Already exists, already produces the exact same report format the checklist was built from — a hand-rolled recount risks a different methodology and a false "still dead" or "now used" signal |
| Comparing default-mode vs production-mode overlap per wave | A bespoke diffing script per plan | The same `(file, line, name)`-tuple set-union approach used in this research (trivial `python3 -c` one-liner against the two JSON files) | It's a 15-line script already proven correct this session; don't reinvent per-plan, just reuse the pattern |
| Deciding whether a `supabase/functions/*/index.ts` "unused file" finding is real | Assuming knip's file-level finding is authoritative | Cross-check against `supabase/functions/` deployment (these are Deno HTTP edge functions invoked over the network, not imported by the TS module graph — 10-CHECKLIST.md already flags all of them "likely false positives; flag for human triage rather than deletion") | knip's default mode has no visibility into Supabase Edge Function invocation; deleting these would break production payment/webhook/email flows with zero compile-time signal |
| Re-triaging the 11 Phase-38-tied E2E findings | Independent investigation of `02-caja`/`04-pool-timer`/`07-reports` root causes | D-05's existing routing — these are confirmed, just tag and move on | Duplicated triage work; Phase 38 owns the actual fix |

**Key insight:** Every "don't hand-roll" item above is really the same lesson: the audit pipeline (`scripts/run-tech-debt-audit.sh` + `knip.json` + `.jscpd.json`) is the single source of truth for "is this still a finding" — re-running it (or a minimal read of its JSON output) is always cheaper and more trustworthy than a bespoke check invented mid-plan.

## Common Pitfalls

### Pitfall 1: Deleting `supabase/functions/*/index.ts` because knip flags it "unused"
**What goes wrong:** knip's default-mode module-graph analysis only sees TypeScript `import`/`export` edges. Supabase Edge Functions are Deno HTTP entry points invoked by URL (Supabase Functions gateway, or by another edge function via `fetch()`), never `import`-ed from `src/`.
**Why it happens:** No TS module imports the file, so knip's file-usage graph shows zero in-edges → flagged unused.
**How to avoid:** Every entry under `supabase/functions/*/index.ts` and `supabase/functions/_shared/audit.ts` in the High-tier "unused files" list (14 files, confirmed in 10-CHECKLIST.md lines 262-275/392-405) must be excluded from Wave B2's whole-file-deletion sweep. Either (a) leave them alone and note "confirmed false positive, not deleted" per finding, or (b) add `supabase/functions/*/index.ts` to `knip.json`'s `entry` array so future audits stop flagging them (a config fix, matching knip's own "configure first" guidance above).
**Warning signs:** Any deletion candidate under `supabase/functions/` — stop and check deployment/invocation before deleting, don't rely on the module graph alone.

### Pitfall 2: Batch-deleting `domain.ts` / `edge-function-contracts.ts` exports without per-export review
**What goes wrong:** These are CLAUDE.md-designated single-source-of-truth Zod-schema/contract registries (`domain.ts` at 2164 lines, `edge-function-contracts.ts` at 1358 lines — both already flagged Low-tier "oversized" for the same structural reason). A registry intentionally exports more than any single current consumer needs (public API surface, forward compatibility, consumed by generated types). knip has no way to distinguish "genuinely dead" from "intentionally-exported-but-not-yet-consumed" in this file shape.
**Why it happens:** knip's unused-export detection is purely reachability-from-entry-points; a registry file's whole *purpose* is to export things reachability analysis can't yet see a consumer for.
**How to avoid:** Treat domain.ts + edge-function-contracts.ts (181 combined findings) as one dedicated review plan with per-export sanity checks — grep each flagged export name across `src/` (not just rely on knip) before deleting, and check whether it's a paired `Schema`/`type X = z.infer<typeof Schema>` where only one half is currently imported (deleting the unused half of a Zod-schema/type pair is usually fine; deleting the schema itself while the type is still exported is not).
**Warning signs:** Any export whose name also appears as a `z.infer<typeof ...>` target elsewhere in the same file.

### Pitfall 3: Treating "83 unannotated failures" as 83 independent bugs
**What goes wrong:** Planning 83 separate fix-tasks when the actual root cause count is much smaller. 10-CHECKLIST.md's own cross-check section notes "a 25% suite-wide failure rate spanning unrelated feature areas is itself circumstantial evidence for shared-cause rather than 94 independent app bugs."
**Why it happens:** The Blocking-tier list is a flat per-test enumeration; it does not group by shared root cause.
**How to avoid:** Batch triage by spec **file** first (59 files), not by individual test title. Many files show a cluster of failures from one shared setup/seed issue (e.g., `16-table-status.spec.ts` has 11 failures in one file — likely 1-2 root causes, not 11). Confirm/deny a shared-cause hypothesis before writing 83 separate fix descriptions.
**Warning signs:** Multiple failures in the same spec file with different assertions but the same page/dialog visible in the error (`getByRole('dialog')` timeout pattern recurs across specs — worth checking as a possible shared UI-timing regression before assuming per-test bugs).

### Pitfall 4: Un-skipping a `test.skip(true, 'UI not implemented')` and assuming it now passes
**What goes wrong:** CLAUDE.md's "Implemented Features" list confirms many features referenced by stale skip reasons (void-order, transfer-tab, split-tab, etc.) now exist — but "the feature exists" does not guarantee "this exact test's selectors/flow still match the current UI." Un-skipping and moving on without running the test is itself a form of unverified remediation.
**Why it happens:** Optimistic pattern-matching on the skip reason text without executing the test.
**How to avoid:** Every un-skip in Track A2 must be followed by an actual `npx playwright test e2e/<spec>.spec.ts` run before being counted as "fixed," per D-04's "open its actual error output... before deciding the fix."
**Warning signs:** A skip reason that pre-dates a feature's shipped date (cross-check against the phase number embedded in nearby `TODO(NN-...)` comments or CLAUDE.md's "Implemented Features" phase attributions) is a candidate, not a confirmed fix.

## Code Examples

### Re-running a single failing spec for D-04 triage
```bash
# Source: scripts/run-tech-debt-audit.sh:52-57 pattern, read this session
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/spec-result.json npx playwright test e2e/16-table-status.spec.ts --reporter=json
```

### Regenerating just the knip reports (fast partial re-check between plans, no full audit needed)
```bash
npx knip --reporter json > .audit-tmp/knip-report.json
npx knip --production --reporter json > .audit-tmp/knip-production.json
```

### Diffing distinct dead-code count after a deletion wave
```python
# Pattern verified working this session — reuse per-wave rather than reinventing
import json
d1 = json.load(open('.audit-tmp/knip-report.json'))['issues']
d2 = json.load(open('.audit-tmp/knip-production.json'))['issues']

def collect_lines(issues, key, exclude_prefix='src/shared/ui/'):
    out = set()
    for i in issues:
        f = i['file']
        if f.startswith(exclude_prefix):
            continue
        for it in (i.get(key) or []):
            out.add((f, it.get('line'), it.get('name')))
    return out

exports_remaining = collect_lines(d1, 'exports') | collect_lines(d2, 'exports')
types_remaining = collect_lines(d1, 'types') | collect_lines(d2, 'types')
print(f'exports remaining: {len(exports_remaining)}, types remaining: {len(types_remaining)}')
```

### Adding the unlisted devDependency (fixes 34 of the 181 Blocking findings)
```diff
   "devDependencies": {
+    "@testing-library/user-event": "^14.6.1",
     "@testing-library/jest-dom": "^6.9.1",
```

## State of the Art

Not applicable in the usual sense — this phase remediates output from tooling introduced in the same milestone (Phase 10, same-day audit). There is no "old approach → new approach" drift to document; the tools (`knip ^6.31.0`, `@playwright/test ^1.59.1`, `vitest ^4.1.4`) are already current per `package.json`.

**One relevant note:** `10-REVIEW.md` (Phase 10's own code review of the audit pipeline) documents 5 warnings against the audit script itself — most relevant to this phase is **WR-04**: `.audit-tmp/` is never cleared between runs (`mkdir -p` only, no `rm -rf` first), so a broken/interrupted re-run during Wave 0 could leave stale `jscpd-out/` or Playwright artifacts masquerading as fresh. If Wave 0 re-runs the full audit, verify `.audit-tmp/knip-report.json`'s mtime updated, or apply `10-REVIEW.md`'s suggested `rm -rf "$OUT"` fix to the script first (out of this phase's stated scope per CONTEXT.md, but worth a one-line defensive check before trusting a re-run).

**Also noted, not in scope:** `CLAUDE.md`'s own "E2E Test Suite" section lists only 26 spec files, but `e2e/*.spec.ts` currently contains **59 files** [VERIFIED: `ls e2e/*.spec.ts | wc -l` → 59, this session]. This is a stale-documentation gap unrelated to Phase 39's remediation scope, but the planner should not use CLAUDE.md's 26-file list as the E2E surface area for this phase — use the 59-file/373-test reality reflected in `.audit-tmp/e2e-per-spec/`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `@testing-library/user-event` pinned at `^14.6.1` (not bumping to latest `14.6.3`) is the right choice for this remediation phase | Standard Stack | Low — if wrong, `npm install` will simply resolve a newer patch; no behavior risk either way since it's already exercised transitively at 14.6.1 |
| A2 | Many of the 53 skipped E2E tests are stale (`'UI not implemented'` reasons for now-shipped features) and can be un-skipped with low fix effort | Common Pitfalls, Wave A2 | Medium — if wrong, the planner may under-budget A2's plan; mitigated by requiring an actual `playwright test` run per un-skip (Pitfall 4), which will surface the truth immediately rather than compounding a wrong assumption |
| A3 | The 137 files needing partial export/type edits can be safely batched and parallelized by FSD layer with low cross-file coupling risk | Wave/Plan Decomposition | Medium — if a shared type is imported across layers in an unexpected way, two parallel plans could conflict on the same file; mitigate by running `npm run typecheck` after each layer-batch before merging waves |

## Open Questions

1. **Does re-running `npm run audit:tech-debt` today (2026-08-03, same day as the source audit) produce identical counts, or has anything drifted since Phase 10 completed?**
   - What we know: The audit that produced 10-CHECKLIST.md ran the same calendar day this research ran.
   - What's unclear: Whether any commits landed between the Phase 10 audit run and Phase 39 kickoff that shifted counts.
   - Recommendation: Wave 0 should re-run the full audit and diff against 10-CHECKLIST.md's header counts before trusting any downstream wave sizing — cheap insurance given D-07's "costly to reverse" note on deletions.

2. **Should `knip.json` gain an `entry` override for `supabase/functions/*/index.ts` (Pitfall 1) as part of this phase, or is that itself out of scope (a `.jscpd.json`/`knip.json`-config change, arguably tooling work rather than "remediation")?**
   - What we know: CONTEXT.md's canonical refs list `knip.json` as reusable audit tooling, not as something this phase is chartered to edit.
   - What's unclear: Whether leaving the false-positive unresolved (just skipping those 14 files with a per-finding note) is acceptable, or whether the planner should treat "stop knip from re-flagging this every future audit run" as in-scope value.
   - Recommendation: Default to "skip + annotate" (matches D-07's exact language: "note that explicitly per finding rather than batch-deleting" for ambiguous cases) unless the planner decides the config fix is trivial enough to bundle.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `knip` CLI | Re-running dead-code audit | ✓ | 6.31.0 [VERIFIED: `npx knip --version`, this session] | — |
| `npm view` / npm registry access | Package legitimacy verification | ✓ | — | — |
| `playwright` CLI + Chrome | Re-running/triaging E2E specs | ✓ (per CLAUDE.md's Ubuntu dev notes — requires a real display session + `google-chrome-stable`, not headless) | 1.59.1 [VERIFIED: package.json:90] | None documented — CLAUDE.md already states this is a hard requirement for this repo, not something this phase can work around |
| `.audit-tmp/e2e-per-spec/*.json` | D-04 per-spec triage | ✓ — already present on disk, 118 files (59 specs × json+log) [VERIFIED: `ls .audit-tmp/e2e-per-spec \| wc -l` → 118, this session] | — | If stale/missing: regenerate per-spec via the single-spec command in Code Examples above |

No missing dependencies with no fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit) + Playwright 1.59.1 (E2E) [VERIFIED: package.json:90,140] |
| Config file | `vitest.config.ts` (unit, `--project unit`), `playwright.config.ts` (E2E) |
| Quick run command | `npm run test` (unit, ~1391 tests, fast) + `npm run typecheck` |
| Full suite command | `npm run test:e2e` (59 specs, 373 tests — requires display session per CLAUDE.md) |

### Phase Requirements → Test Map

No `REQUIREMENTS.md` exists in this project yet (confirmed absent this session), and CONTEXT.md/ROADMAP.md both list this phase's `Requirements: TBD`. There are no formal REQ-IDs to map. Substituting the CONTEXT.md decision IDs (D-01–D-09) as the effective acceptance criteria:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|--------------------|--------------|
| D-01/D-07 | knip High-tier dead code removed, counts drop | static analysis | `npx knip --reporter json` / `npx knip --production --reporter json`, diff against this doc's 982-finding baseline | ✅ (audit script exists) |
| D-01 (unlisted) | `@testing-library/user-event` no longer flagged unlisted | static analysis | `npx knip --reporter json \| jq '.issues[].unlisted'` should be empty | ✅ |
| D-04/D-05/D-06 | E2E findings triaged and, where real regressions, fixed | E2E | `npx playwright test e2e/<spec>.spec.ts` per touched spec, then full `npm run test:e2e` at phase gate | ✅ |
| (all) | No regression in currently-passing 1391 unit tests | unit | `npm run test` | ✅ |
| (all) | No new typecheck/lint errors introduced by deletions | static | `npm run typecheck && npm run lint` | ✅ |

### Sampling Rate
- **Per task/plan commit:** `npm run typecheck && npm run test` (fast, catches a dead-code deletion that was actually live)
- **Per wave merge:** `npx knip --reporter json` + `npx knip --production --reporter json` re-check against this doc's baseline counts
- **Phase gate:** `npm run test:e2e` full suite (373 tests) — note CLAUDE.md states E2E is not CI-gated and requires a real Ubuntu display session with `google-chrome-stable`; this must be run locally, not assumed green from CI

### Wave 0 Gaps
None — existing test infrastructure (Vitest + Playwright + the Phase 10 audit pipeline) fully covers this phase's verification needs. No new test framework or fixtures required.

## Security Domain

Not applicable in the ASVS sense — this phase deletes dead code and fixes/triages test failures; it introduces no new authentication, session, access-control, input-validation, or cryptography surface. The one package addition (`@testing-library/user-event`, a devDependency used only in test files, never shipped in the production Tauri bundle) carries no runtime security surface.

The only category-adjacent risk is **accidental behavior change from a false-positive deletion** (Pitfalls 1-2 above) — this is a correctness/availability risk (e.g., deleting a Supabase Edge Function file would break the payment/webhook/email pipeline), not a confidentiality/integrity/authentication risk. Mitigated by the sanity-check discipline in D-07 and the specific pitfalls documented above, not by any ASVS control.

## Sources

### Primary (HIGH confidence)
- `.audit-tmp/knip-report.json`, `.audit-tmp/knip-production.json` — read and computed against directly this session (default/production overlap analysis, distinct-finding counts)
- `.audit-tmp/e2e-per-spec/03-tab-order.json` — read directly this session (Playwright per-spec JSON shape)
- `.planning/phases/10-ai-slob-technical-debt-checklist/10-CHECKLIST.md`, `10-REVIEW.md` — read directly this session
- `package.json`, `knip.json`, `.jscpd.json`, `scripts/run-tech-debt-audit.sh`, `src/app/router.tsx`, `src/shared/lib/rbac.ts`, `.storybook/main.ts` — read directly this session
- `npm ls @testing-library/user-event --all`, `npm view @testing-library/user-event version` — run directly this session

### Secondary (MEDIUM confidence)
- [Resolve reported issues | Knip](https://knip.dev/guides/handling-issues) — fix-order guidance ("configure first, delete last"; unused files → unresolved → exports → deps)
- [Configuring Project Files | Knip](https://knip.dev/guides/configuring-project-files) — dynamic-reference / entry-file configuration guidance

### Tertiary (LOW confidence)
- None used as authoritative claims — all WebSearch-sourced general guidance above was corroborated by knip's own official docs page before being cited.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new tooling, single devDependency verified against npm registry and against `npm ls`
- Architecture (wave decomposition): HIGH — based on direct computation over the raw audit JSON, not estimation
- Pitfalls: HIGH — Pitfalls 1 and 3 are directly sourced from 10-CHECKLIST.md's own annotations; Pitfall 2 is a documented knip limitation (registry/barrel files) cross-checked against this codebase's specific `domain.ts`/`edge-function-contracts.ts` finding concentration; Pitfall 4 is verified via direct `grep` of `test.skip()` call sites this session

**Research date:** 2026-08-03
**Valid until:** Effectively single-use — this research is tied to the exact `.audit-tmp/` snapshot from Phase 10's 2026-08-03 audit run. If Phase 39 planning/execution spans more than a few days, re-run `npm run audit:tech-debt` and re-diff before trusting the specific counts above (see Open Question 1).
