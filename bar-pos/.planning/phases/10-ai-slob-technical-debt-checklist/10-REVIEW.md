---
phase: 10-ai-slob-technical-debt-checklist
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - knip.json
  - .jscpd.json
  - scripts/run-tech-debt-audit.sh
  - package.json
  - .gitignore
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the five config/tooling files that make up Phase 10's tech-debt audit pipeline (`knip.json`, `.jscpd.json`, `scripts/run-tech-debt-audit.sh`, plus the `package.json`/`.gitignore` edits that wire it up). These are dev-tooling files, not production/runtime code, so there's no user-facing security or data-loss surface — no Critical findings. However, the pipeline itself has several correctness gaps that undermine its own purpose (finding tech debt reliably): a broken exclude regex in the `madge` invocation, an `as-any` probe that misses a large class of the `any` usage CLAUDE.md actually forbids, a cwd-dependent script whose `|| true`-everywhere design can silently produce empty/garbage reports with no failure signal, and no cleanup of prior-run output before each run. Traced each finding against actual repo state (verified regex behavior with Node, grepped for the `any` patterns the probe misses, confirmed `graphify-out/` is untracked and un-ignored) rather than taking the code at face value.

## Warnings

### WR-01: `madge --exclude` regex never matches files nested inside `graphify-out/`

**File:** `scripts/run-tech-debt-audit.sh:20-22`
**Issue:** The exclude pattern is:
```
--exclude '(graphify-out|supabase\.types\.ts|\.stories\.tsx|\.test\.tsx?)$'
```
The trailing `$` binds to the whole `(...)` group, so the `graphify-out` alternative only matches a path that literally *ends* in the string `graphify-out` (i.e. a bare directory entry with nothing after it) — it never matches `src/graphify-out/foo.ts`, which ends in `foo.ts`. Verified directly:
```js
new RegExp('(graphify-out|supabase\\.types\\.ts|\\.stories\\.tsx|\\.test\\.tsx?)$').test('src/graphify-out/foo.ts')
// => false
```
This is currently harmless only by accident — `src/graphify-out/` presently contains no `.ts`/`.tsx` files (only `.json` cache artifacts from the graphify skill), so `madge`'s `--extensions ts,tsx` scope never picks anything up there today. But the intent stated in the commit message ("graphify-out exclude") and mirrored correctly in `knip.json`/`.jscpd.json` (both use working glob-based `graphify-out/**` ignores) is not actually achieved here — this is a latent bug that will silently stop working the moment any `.ts`/`.tsx` file lands under `src/graphify-out/`.
**Fix:**
```bash
npx madge --circular --json --ts-config tsconfig.json --extensions ts,tsx \
  --exclude '(^|/)graphify-out/|supabase\.types\.ts$|\.stories\.tsx$|\.test\.tsx?$' \
  src > "$OUT/madge-circular.json" || true
```

### WR-02: `as any` probe misses bare `: any` annotations that CLAUDE.md's rule also covers

**File:** `scripts/run-tech-debt-audit.sh:29-31`
**Issue:** The probe only matches the literal token sequence `as any`:
```bash
grep -rn --include='*.ts' --include='*.tsx' --exclude-dir=graphify-out \
  -E '\bas any\b' src | ... > "$OUT/as-any.txt"
```
CLAUDE.md's actual rule is broader: *"No `any` without a justification comment on the same line"* — this covers bare type annotations, return types, and generic params, not just `as any` casts. Confirmed the gap exists today, outside test files:
```
src/entities/tab/model/queries.ts   (bare `: any` usage)
src/widgets/PINLoginForm/PINLoginForm.tsx   (bare `: any` usage)
```
plus dozens more in `*.integration.test.ts` files (e.g. `function getServiceDb(): any`). None of these are captured by the `as-any.txt` probe, so the D-02 "unjustified any" checklist item Plan 03 builds from this file will under-report real occurrences of the forbidden pattern.
**Fix:** Broaden the pattern (or better, drive this off ESLint's `@typescript-eslint/no-explicit-any` rule, which is already installed and understands syntax context that grep can't):
```bash
grep -rn --include='*.ts' --include='*.tsx' --exclude-dir=graphify-out \
  -E '\bas any\b|:\s*any\b|<any>|\bany\[\]' src | ... > "$OUT/as-any.txt"
```

### WR-03: Script is cwd-dependent everywhere except its own `$OUT` resolution, and every failure is swallowed silently

**File:** `scripts/run-tech-debt-audit.sh:12-57`
**Issue:** `OUT` is deliberately computed with a cwd-independent trick (`cd "$(dirname "$0")/.." && pwd`), but every subsequent command uses paths relative to the *invocation* directory: `src`, `tsconfig.json`, `e2e`, `.` (lines 15-57). If the script is ever run from anywhere other than `bar-pos/` — e.g. `bash bar-pos/scripts/run-tech-debt-audit.sh` from the git root, which CLAUDE.md itself notes is one level above `bar-pos/` — every `npx`/`grep`/`find` invocation fails to resolve its target. Because *every single invocation* is `|| true`-guarded and the script never checks whether any report actually contains data, the script still exits 0 and unconditionally prints `"Reports written to $OUT"` (line 59) even though every report file would be empty or contain an error message instead of audit data. There is no signal anywhere in the script that distinguishes "tool ran and found 0 issues" from "tool never ran because paths didn't resolve."
**Fix:** Reuse the same cwd-independent resolution already used for `OUT` for the whole script, and cd into it once at the top:
```bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.audit-tmp"
mkdir -p "$OUT"
cd "$ROOT"
```
Optionally also assert non-empty output at the end (e.g. `[ -s "$OUT/knip-report.json" ] || echo "WARNING: knip-report.json is empty" >&2`) so a broken run is visible instead of silently indistinguishable from a clean one.

### WR-04: `$OUT` is never cleared between runs — stale reports can masquerade as current

**File:** `scripts/run-tech-debt-audit.sh:12-13`
**Issue:** `mkdir -p "$OUT"` only ensures the directory exists; it does not remove prior contents. Most reports are simple-redirect files (`>`) so they get truncated/overwritten on a successful run, but directory-based reporters — `jscpd`'s `--output "$OUT/jscpd-out"` (line 18) and Playwright's own artifact output under the same tree — are not guaranteed to be fully rewritten if the tool crashes or is interrupted partway through. A broken current run can leave last-run's `jscpd-out/jscpd-report.json` sitting untouched, silently presenting stale duplication data as if it were fresh, compounding the silent-failure risk in WR-03.
**Fix:**
```bash
rm -rf "$OUT"
mkdir -p "$OUT"
```

### WR-05: `.gitignore` doesn't exclude `graphify-out/`, even though this phase's own configs treat it as generated/ignorable

**File:** `.gitignore` (cross-ref `knip.json:8-9`, `.jscpd.json:11-12`)
**Issue:** `knip.json` and `.jscpd.json` both explicitly special-case `graphify-out/**` and `src/graphify-out/**` as tool-ignorable, generated output (5309-node/13496-edge knowledge-graph cache per `CLAUDE.md`). But `.gitignore` has no corresponding entry, and per the session's git status both `graphify-out/` and `src/graphify-out/` are currently **untracked** — one `git add -A` / `git add .` away from committing thousands of generated cache/JSON files into the repo. Since this phase is the one that formalized "graphify-out is generated, ignore it" in two separate tool configs, it's the natural place to also add the corresponding `.gitignore` entries (they're missing a shared source of truth otherwise — two configs know it should be ignored, the one file whose job is exactly that doesn't).
**Fix:** Add to `.gitignore` alongside the other generated-output entries:
```
graphify-out/
src/graphify-out/
```

## Info

### IN-01: `.jscpd.json`'s `reporters` config is redundant with the CLI flag that overrides it

**File:** `.jscpd.json:5` / `scripts/run-tech-debt-audit.sh:18`
**Issue:** `.jscpd.json` sets `"reporters": ["json"]`, and the audit script separately passes `--reporters json` on the CLI (`npx jscpd . --reporters json --output ...`). Not a functional bug (CLI flags win, values agree), but there are now two places that must be kept in sync for one setting, with no indication either was aware of the other.
**Fix:** Drop `--reporters json` from the script (the config already sets it) or drop `reporters` from `.jscpd.json` (the script already sets it) — pick one source of truth.

### IN-02: `todo-fixme.txt` probe is the only one of the three structural-smell grep/find probes that doesn't exclude `graphify-out`

**File:** `scripts/run-tech-debt-audit.sh:35-36`
**Issue:** The `as-any` probe explicitly does `--exclude-dir=graphify-out` (line 29) and the file-sizes probe explicitly does `-not -path 'src/graphify-out/*'` (line 42), but the TODO/FIXME probe scans `src e2e` with no such exclusion. Currently harmless (no `.ts`/`.tsx` under `graphify-out` today, per WR-01's investigation), but inconsistent with its sibling probes and will start polluting the debt report with generated-artifact noise the moment that changes.
**Fix:**
```bash
grep -rn --include='*.ts' --include='*.tsx' --exclude-dir=graphify-out \
  -E 'TODO|FIXME' src e2e > "$OUT/todo-fixme.txt" || true
```

---

_Reviewed: 2026-08-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
