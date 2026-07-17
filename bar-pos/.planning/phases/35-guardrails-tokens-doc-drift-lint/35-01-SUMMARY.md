---
phase: 35-guardrails-tokens-doc-drift-lint
plan: 01
subsystem: ui
tags: [tailwindcss, design-tokens, codegen, docs]

requires: []
provides:
  - DESIGN-TOKENS.md reference doc (root) documenting colors, border-radius, spacing/typography, touch targets, focus emphasis, dark mode
  - scripts/generate-design-tokens.ts idempotent generator (marker-scoped write)
  - package.json docs:tokens script
affects: [35-02, 35-03]

tech-stack:
  added: []
  patterns:
    - "Marker-scoped codegen: generator only rewrites text between <!-- GENERATED:START --> / <!-- GENERATED:END -->, preserving hand-written doc sections"
    - "Structured tailwind.config.ts import + regex-extracted globals.css :root vars, mirroring scripts/audit-ui-drift.ts conventions"

key-files:
  created:
    - DESIGN-TOKENS.md
    - scripts/generate-design-tokens.ts
  modified:
    - package.json

key-decisions:
  - "DESIGN-TOKENS.md is gitignored by the project's existing bar-pos/.gitignore:65 (*.md, only CLAUDE.md + .planning/** exempt) — same as FSD-STRUCTURE.md/DOMAIN-CONTRACTS.md/SUPABASE-CONTRACTS.md, which are also root docs that exist on disk but are not committed. The file was created and populated on disk exactly as the plan specifies; it is simply not part of git history, consistent with pre-existing project convention."

patterns-established:
  - "Design-tokens generator pattern (scripts/generate-design-tokens.ts) for any future token-source addition — reuse the marker-replace regex + structured-import approach"

requirements-completed: [DOCS-01]

coverage:
  - id: D1
    description: "DESIGN-TOKENS.md exists at repo root with generated color/border-radius tables plus hand-written Touch Targets, Focus Emphasis, Dark Mode, and Do/Don't sections"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "node -e marker/section presence check (Task 1 verify command) + manual read of full file content"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/generate-design-tokens.ts generates real color + border-radius tables from tailwind.config.ts/globals.css and is idempotent on re-run"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "npm run docs:tokens (exit 0) + byte-identical file comparison across two consecutive runs"
        status: pass
      - kind: other
        ref: "npm run typecheck (2 pre-existing unrelated errors only, no new errors from the generator)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-17
status: complete
---

# Phase 35 Plan 01: Design Tokens Doc + Generator Summary

**DESIGN-TOKENS.md reference doc + scripts/generate-design-tokens.ts idempotent generator, sourcing 20 color rows + 4 border-radius rows directly from tailwind.config.ts/globals.css, plus hand-written touch-target/focus-emphasis/dark-mode conventions from Phases 30-33**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3 (DESIGN-TOKENS.md created but not git-tracked — see Deviations; scripts/generate-design-tokens.ts created; package.json modified)

## Accomplishments
- `DESIGN-TOKENS.md` created at repo root with the required `<!-- GENERATED:START/END -->` marker pair, a D-04 cross-reference to `eslint-rules/no-ui-drift.js`, and hand-written Touch Targets (44/56/72px), Focus Emphasis (default/high), Dark Mode, and Do/Don't sections
- `scripts/generate-design-tokens.ts` built following `scripts/audit-ui-drift.ts`'s conventions: structured `import config from '../tailwind.config'` for colors/borderRadius, regex-extracted `:root` custom properties from `src/app/globals.css`, marker-replace write preserving all hand-written content
- `npm run docs:tokens` script added to `package.json`; running it populated the generated block with 20 color rows (14 top-level tokens, several with DEFAULT+foreground pairs) and 4 border-radius rows (`lg`/`md`/`sm` + base `--radius`)
- Confirmed idempotency: two consecutive `npm run docs:tokens` runs produce byte-identical output
- `npm run typecheck` confirmed clean relative to baseline — only the 2 pre-existing unrelated errors (`src/entities/tab/model/queries.ts`, `src/shared/lib/agent/rag.ts`) remain, no new errors from the generator's imports

## Task Commits

1. **Task 1: Hand-author the DESIGN-TOKENS.md skeleton** — no git commit (file is gitignored; see Deviations below). Verified via the plan's automated marker/section check.
2. **Task 2: Build the generator script + docs:tokens npm script + populate the generated block** — `cceaae3` (feat)

**Plan metadata:** pending final `docs(35-01)` commit (this SUMMARY.md + STATE.md/ROADMAP.md/REQUIREMENTS.md)

## Files Created/Modified
- `DESIGN-TOKENS.md` - root design-tokens reference doc (generated block + hand-written sections); exists on disk, gitignored (not committed)
- `scripts/generate-design-tokens.ts` - idempotent generator reading tailwind.config.ts + globals.css, writing only between the GENERATED markers
- `package.json` - added `docs:tokens` npm script

## Decisions Made
- Kept `DESIGN-TOKENS.md` gitignored per the project's own pre-existing convention (`bar-pos/.gitignore:65`, `*.md` ignored except `CLAUDE.md`/`.planning/**`) rather than force-adding it — `FSD-STRUCTURE.md`, `DOMAIN-CONTRACTS.md`, and `SUPABASE-CONTRACTS.md` (the exact three docs D-05 says this file mirrors) are already in this same untracked-but-present state, so this is consistent with established project behavior, not a gap.
- Colors table renders one row per top-level `tailwind.config.ts` color key: a single row for plain string values (`background`, `border`, `input`, `ring`, `pos-accent`, `pos-danger`), or two rows (base + `-foreground`) for object-shaped tokens (`card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`) — matches the actual config shape with no invented tokens.
- Generic `bg-{key}` / `text-{key}-foreground` class names shown per PATTERNS.md guidance (illustrative Tailwind class form), not an exhaustive list of every utility each token supports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, CLAUDE.md precedence] DESIGN-TOKENS.md cannot be `git add`ed — respected existing project `.gitignore` rule instead of force-adding**
- **Found during:** Task 1, attempting the standard `git add DESIGN-TOKENS.md && git commit`
- **Issue:** `git add DESIGN-TOKENS.md` failed with "The following paths are ignored by one of your .gitignore files". `bar-pos/.gitignore` line 65 ignores all `*.md` files except `CLAUDE.md`, with `.planning/**` separately exempted. This is a project-authored, deliberate rule (not an accident) — verified `FSD-STRUCTURE.md`, `DOMAIN-CONTRACTS.md`, and `SUPABASE-CONTRACTS.md` (the exact docs `DESIGN-TOKENS.md` is meant to sit alongside per D-05) are themselves gitignored and untracked in this repo's history.
- **Fix:** Did not force-add (`git add -f`) the file — per the destructive-git-prohibition guidance and CLAUDE.md precedence over plan wording, an existing project-level `.gitignore` rule takes priority over the plan's literal "commit DESIGN-TOKENS.md" phrasing. The file was created and populated on disk exactly as specified (all acceptance criteria hold), it is simply not tracked by git, matching the project's own established pattern for this class of root reference doc.
- **Files affected:** `DESIGN-TOKENS.md` (created on disk, not committed)
- **Verification:** File exists at repo root with correct content (marker + sections verified via the plan's Task 1 automated check); `scripts/generate-design-tokens.ts` and `package.json` (the two git-trackable deliverables) were committed normally in Task 2.
- **Committed in:** N/A (file intentionally left untracked)

---

**Total deviations:** 1 auto-fixed (1 blocking/precedence)
**Impact on plan:** No functional impact — `DESIGN-TOKENS.md` exists, is correctly populated, and is idempotently regenerable exactly as the plan requires. The only change from the plan's literal wording is that the doc isn't part of git history, which mirrors pre-existing, intentional project behavior for this exact class of file.

## Issues Encountered
None beyond the gitignore deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `DESIGN-TOKENS.md` and its D-04 cross-reference to `eslint-rules/no-ui-drift.js` are ready for Plan 35-02/35-03 to build the actual lint rule against.
- No blockers for the next plan in this phase.

---
*Phase: 35-guardrails-tokens-doc-drift-lint*
*Completed: 2026-07-17*
