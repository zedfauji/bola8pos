# Phase 35: Guardrails — Tokens Doc & Drift Lint - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 6 (2 new, 4 modified) + 1 remediation fix
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `DESIGN-TOKENS.md` | config/doc | file-I/O (generated doc) | `FSD-STRUCTURE.md` (root doc convention) | role-match |
| `scripts/generate-design-tokens.ts` | utility (codegen script) | transform (config → markdown) | `scripts/audit-ui-drift.ts` | exact |
| `eslint-rules/no-ui-drift.js` | config (lint rule module) | transform (AST selector export) | inline `no-restricted-syntax` block in `eslint.config.js` | exact |
| `eslint.config.js` (modified) | config | transform | itself (existing structure) | exact |
| `package.json` (modified) | config | — | itself (`scripts` block) | exact |
| `src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx` (modified — D-16 fix) | component | request-response (form UI) | `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` | exact (near-identical day/time editor, already fixed in Phase 31) |

## Pattern Assignments

### `scripts/generate-design-tokens.ts` (utility, transform)

**Analog:** `scripts/audit-ui-drift.ts` (full file read, 245 lines)

**Header/doc-comment pattern** (lines 1-13):
```ts
/**
 * audit-ui-drift.ts — Standalone Node script (not bundled into the app, never imported by src/).
 *
 * Scans src/pages, src/widgets, src/features for design-system drift: ...
 *
 * Writes .planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md and prints a summary to stdout.
 *
 * Usage:
 *   npx tsx scripts/audit-ui-drift.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
```
Mirror this exact shape for `generate-design-tokens.ts`: top-of-file doc comment stating it's standalone/not imported by `src/`, states its output path, states its `npm run docs:tokens` invocation.

**Config constants block** (lines 18-40): `OUTPUT_PATH` constant, category/section definitions as plain arrays — reuse this convention: define an `OUTPUT_PATH = 'DESIGN-TOKENS.md'` constant and a `GENERATED_START = '<!-- GENERATED:START -->'` / `GENERATED_END = '<!-- GENERATED:END -->'` marker-constant pair per D-07.

**Structured-read-then-render-then-write pattern** (`main()`, lines 216-244): read source → build markdown string via small pure render functions → `fs.writeFileSync`. For the generator, per RESEARCH.md's Code Examples section, source reads are:
```ts
// tailwind.config.ts — structured import (tsx resolves .ts natively, same runner)
import config from '../tailwind.config';
const colors = config.theme?.extend?.colors ?? {};
const borderRadius = config.theme?.extend?.borderRadius ?? {};

// globals.css — regex-extracted custom properties (no structured import for .css)
const css = fs.readFileSync('src/app/globals.css', 'utf-8');
const rootBlockMatch = css.match(/:root\s*\{([^}]+)\}/);
const varPattern = /--([\w-]+):\s*([^;]+);/g;
```

**Marker-replace write pattern (D-07 — new, no direct analog in `audit-ui-drift.ts` since that script fully overwrites its output):**
```ts
const existing = fs.readFileSync(OUTPUT_PATH, 'utf-8');
const updated = existing.replace(
  /<!-- GENERATED:START -->[\s\S]*<!-- GENERATED:END -->/,
  `<!-- GENERATED:START -->\n${generatedMarkdown}\n<!-- GENERATED:END -->`
);
fs.writeFileSync(OUTPUT_PATH, updated, 'utf-8');
```

**Console summary pattern** (lines 231-241): `console.log` a short human-readable summary after writing — reuse verbatim style (`console.log('...');` then per-category counts, then `Wrote ${OUTPUT_PATH}`).

---

### `DESIGN-TOKENS.md` (doc, file-I/O)

**Analog:** `FSD-STRUCTURE.md` (root-level doc convention — header read, lines 1-30)

**Header pattern:**
```markdown
# Feature-Sliced Design Structure

This document describes the complete FSD folder structure for the Bar & Pool Parlor POS application.

## 📁 Directory Structure

```
```
Mirror: `# Design Tokens` title, one-line purpose sentence, then sectioned content. Root-level placement alongside `FSD-STRUCTURE.md`/`DOMAIN-CONTRACTS.md`/`SUPABASE-CONTRACTS.md` (D-05).

**Generated-block skeleton (structural requirement, D-07):**
```markdown
# Design Tokens

[one-line purpose + D-04 cross-reference: "These conventions are enforced by `eslint-rules/no-ui-drift.js`."]

<!-- GENERATED:START -->
[colors / spacing / typography / border-radius tables — regenerate via `npm run docs:tokens`]
<!-- GENERATED:END -->

## Touch Targets
[hand-written, D-01 — 44/56/72px conventions from POSButton.tsx]

## Focus Emphasis
[hand-written, D-01 — focusEmphasis prop from button.tsx]

## Dark Mode
[hand-written, D-03 — one-liner: colors are var(--x) CSS vars, dark mode is `media`/auto]
```

**Token source values to document (from direct read):**
- Colors (`tailwind.config.ts` lines 18-57): `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `pos-accent`, `pos-danger` — all `var(--x)`, resolving to `oklch(...)` in `src/app/globals.css` `:root` (light, lines 8-47) and `@media (prefers-color-scheme: dark)` block (lines 50-89).
- Border radius (`tailwind.config.ts` lines 13-17): `lg = var(--radius)`, `md = calc(var(--radius) - 2px)`, `sm = calc(var(--radius) - 4px)`; `--radius: 0.625rem` (globals.css line 29).
- No custom spacing/typography scale exists — `tailwind.config.ts` has no `spacing`/`fontSize` extension, so the "typography" and "spacing" sections should state this explicitly (Tailwind defaults apply, nothing project-specific to document) rather than fabricate one.
- Touch targets (`POSButton.tsx` lines 39-43): `default: min-h-[44px]`, `large: min-h-[56px] text-base`, `xl: min-h-[72px] text-lg font-semibold`.
- Focus emphasis (`button.tsx` lines 36-39): `default: ''`, `high: 'focus-visible:ring-4 focus-visible:ring-ring'` (CVA variant on `Button`).

**Do/don't example convention (D-02):** use `bg-primary`, not `bg-blue-600` / hardcoded hex — matches the exact phrasing already used in RESEARCH.md's proposed lint message strings (see below), keep doc and lint messages consistent.

---

### `eslint-rules/no-ui-drift.js` (config, transform)

**Analog:** the existing inline `no-restricted-syntax` block in `eslint.config.js` (lines 125-131)

**Exact existing shape to extend, not replace (critical — see Shared Patterns below):**
```js
'no-restricted-syntax': [
  'error',
  {
    selector: 'ExportAllDeclaration',
    message: 'Barrel exports (export *) are banned. Export only what you explicitly need.',
  },
],
```

**New file must export a plain array of selector objects (not a full rule/config), per RESEARCH.md Pattern 1:**
```js
// eslint-rules/no-ui-drift.js
export const uiDriftSelectors = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: 'Use POSButton or Button from @shared/ui/button instead of a raw <button> element. See DESIGN-TOKENS.md.',
  },
  {
    selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(color|time|date|file)$/]))",
    message: 'Use FormField or the correct shared/ui input primitive instead of a raw <input> element. See DESIGN-TOKENS.md. (Native type=color/time/date/file inputs are a documented, permanent exception — 31-CONTEXT.md D-05/D-07.)',
  },
  {
    selector: "Literal[value=/^#([0-9a-fA-F]{3}){1,2}$/]",
    message: 'Use a Tailwind CSS-variable token (e.g. bg-primary, text-foreground) instead of a hardcoded color value. See DESIGN-TOKENS.md.',
  },
  {
    selector: "Literal[value=/rgba?\\(/]",
    message: 'Use a Tailwind CSS-variable token instead of a hardcoded rgb()/rgba() value. See DESIGN-TOKENS.md.',
  },
];
```
Regex sourced 1:1 from `scripts/audit-ui-drift.ts`'s `CATEGORY_PATTERNS` (lines 25-40): raw-button `/<button[\s>]/`, raw-input `/<input[\s>]/`, hardcoded-color `/#[0-9a-fA-F]{3,8}\b/` + `/rgba?\(/`. The `no-restricted-syntax` selectors are the AST-equivalent of these regexes.

**Arbitrary-spacing selector (D-15 amendment — narrow regex, NOT `no-arbitrary-value`):** mirror `audit-ui-drift.ts` line 37 exactly:
```js
{
  selector: "Literal[value=/\\b(?:[a-z:]+:)?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\\[[^\\]]+\\]/]",
  message: 'Arbitrary-value spacing classes are banned — use a Tailwind spacing scale utility (e.g. p-4, gap-2). See DESIGN-TOKENS.md.',
}
```

---

### `eslint.config.js` (modified)

**Analog:** itself — existing plugin-import + settings + rules wiring (lines 1-148, full file read)

**Plugin import convention** (lines 1-12): flat `import x from 'plugin-name'` at top, no namespacing tricks.

**Wiring `eslint-plugin-tailwindcss` — new scoped config object, per RESEARCH.md Pattern 2 (append after the existing `files: ['**/*.{ts,tsx}']` block, before the test-override block at line 134):**
```js
import tailwind from 'eslint-plugin-tailwindcss';
import { uiDriftSelectors } from './eslint-rules/no-ui-drift.js';
```
```js
{
  files: ['src/pages/**/*.tsx', 'src/widgets/**/*.tsx', 'src/features/**/*.tsx'],
  plugins: { tailwindcss: tailwind },
  settings: {
    tailwindcss: {
      config: './tailwind.config.ts',
      callees: ['cn', 'clsx', 'classnames', 'ctl', 'cva', 'tv'],
      whitelist: ['^(animate|fade|slide|zoom)-(in|out)(-from-\\w+)?$'],
    },
  },
  rules: {
    'tailwindcss/no-custom-classname': 'error',
    'tailwindcss/enforces-shorthand': 'error',
    // no-arbitrary-value intentionally NOT enabled here — D-15 amendment;
    // arbitrary-spacing is covered by the narrow custom selector in uiDriftSelectors instead.
  },
},
```

**Extending the existing `no-restricted-syntax` array (must be the SAME array, same config object at line 125-131 — do NOT add a second `no-restricted-syntax` key on an overlapping `files` glob, see Shared Patterns):**
```js
'no-restricted-syntax': [
  'error',
  {
    selector: 'ExportAllDeclaration',
    message: 'Barrel exports (export *) are banned. Export only what you explicitly need.',
  },
  ...uiDriftSelectors,
],
```

---

### `package.json` (modified)

**Analog:** itself — `scripts` block (lines 6-32), specifically the existing `scripts/*.ts` + `npm run <verb>:<noun>` convention already used for `setup:dev-users`, `seed:dev`, `index-codebase`:
```json
"setup:dev-users": "npx tsx scripts/setup-dev-users.ts",
"seed:dev": "npx tsx scripts/seed-dev-data.ts",
"index-codebase": "tsx scripts/indexCodebase.ts"
```
New entry per D-06 (insert alongside these, same invocation style):
```json
"docs:tokens": "npx tsx scripts/generate-design-tokens.ts",
```

**New devDependency** (D-08, pinned per RESEARCH.md — do not use `^` or `latest`):
```json
"eslint-plugin-tailwindcss": "3.18.3",
```
Install via `npm install -D eslint-plugin-tailwindcss@3.18.3`.

---

### `src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx` (D-16 remediation fix)

**Analog:** `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` — same day-of-week-toggle-chip + time-window pattern, already converted in an earlier phase (30-33) from an identical raw-`<button>` shape.

**Current violation** (`PromotionAvailabilityEditor.tsx` lines 91-105):
```tsx
<button
  key={iso}
  type="button"
  aria-pressed={selected}
  onClick={() => {
    onToggleDay(idx, iso);
  }}
  className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${
    selected
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-background text-foreground border-input hover:bg-accent'
  }`}
>
  {label}
</button>
```

**Target shape — copy directly from `ComboAvailabilityEditor.tsx` lines 88-105 (the already-fixed sibling file):**
```tsx
<Button
  variant="outline"
  key={iso}
  type="button"
  aria-pressed={selected}
  onClick={() => {
    onToggleDay(idx, iso);
  }}
  className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${
    selected
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-background text-foreground border-input hover:bg-accent'
  }`}
>
  {label}
</Button>
```
`Button` is already imported in `PromotionAvailabilityEditor.tsx` (line 20: `import { Button } from '@shared/ui/button';`) — no new import needed, this is a straight element-tag swap. The two `type="time"` raw `<input>` elements (lines 116-124, 128-136) need NO fix — they are covered by the type-based AST exemption in `uiDriftSelectors` (Pitfall 2), matching `ComboAvailabilityEditor.tsx`'s own still-raw `type="time"` inputs (lines 113-121 there) which were never converted either.

## Shared Patterns

### Flat-config `no-restricted-syntax` merge hazard
**Source:** `eslint.config.js` lines 125-131, RESEARCH.md Pattern 1
**Apply to:** `eslint.config.js` modification task
ESLint flat config replaces (not merges) a rule key across config objects matching the same file. `uiDriftSelectors` MUST be spread into the existing `no-restricted-syntax` array in the same config object (`files: ['**/*.{ts,tsx}']` block) — never declared as a second `no-restricted-syntax` key on an overlapping `files` glob, or the existing `ExportAllDeclaration` (barrel-export) ban silently stops firing project-wide.

### `shared/ui/*.tsx` exemption (D-12)
**Source:** `scripts/audit-ui-drift.ts` line 54 (`if (full.includes('shared/ui')) continue;`)
**Apply to:** both the `eslint-plugin-tailwindcss` config object's `files` glob and (implicitly) the `no-ui-drift` selectors, since `no-restricted-syntax` selectors apply file-wide unless scoped
The audit script already excludes `shared/ui` from its scan (Phase 29 precedent). Mirror this: scope `eslint-plugin-tailwindcss`'s `files` glob to `src/pages|widgets|features/**/*.tsx` only (excludes `shared/ui` by construction, per RESEARCH.md Pattern 2). For the custom `no-restricted-syntax` selectors (which apply to `**/*.{ts,tsx}` via the existing broader config block), either scope them into a files-limited second block, or rely on the fact that `POSButton.tsx`/`button.tsx`/`Input`'s internal raw elements are the only ones under `shared/ui/` and add an explicit narrower `files`-scoped override disabling the 2 element selectors for `src/shared/ui/**` if the planner keeps them in the shared broad block. Recommend: put `uiDriftSelectors` in a NEW config object scoped to `files: ['src/pages/**/*.tsx', 'src/widgets/**/*.tsx', 'src/features/**/*.tsx']` (same glob as the tailwindcss block) rather than the existing repo-wide `**/*.{ts,tsx}` block, to keep both `shared/ui` exemption and `entities/` exclusion consistent and avoid the merge hazard above entirely (a wholly separate config object, no shared key with the barrel-export rule).

### Pre-negotiated suppression sites (Phase 31, prose-only comments need conversion)
**Source:** RESEARCH.md Common Pitfalls #2 — `CategoryForm.tsx:34-35`, `CategoryTreeEditor.tsx:470-471`, `InventoryPagePanel.tsx:353`, `AuditLogFilterBar.tsx` (2 date inputs), `ComboAvailabilityEditor.tsx` (2 time inputs)
**Apply to:** verification/checkpoint task before flipping severity to `error` (D-14)
Type-based exceptions (`type="color"/"time"/"date"/"file"`) are handled structurally by the `:not(:has(...))` selector clause above — no per-site comment needed. The signed-delta number input (`InventoryPagePanel.tsx:353`) and `category.color` hex literals (`CategoryTreeEditor.tsx:472`, `CategoryForm.tsx:36,138`) have no clean AST-selector exemption and need a literal `// eslint-disable-next-line no-restricted-syntax -- <cite 31-CONTEXT.md decision id>` comment converted from the existing prose-only note.

### Package legitimacy checkpoint (D-08 install)
**Source:** RESEARCH.md Package Legitimacy Audit
**Apply to:** the `npm install -D eslint-plugin-tailwindcss@3.18.3` task
Automated verdict is SUS (`too-new`) but only because it checks the package's *latest* tag (4.2.0, 2 days old); the pinned `3.18.3` is ~3 months old with 1.4M weekly downloads. Planner should add a `checkpoint:human-verify` before this install task per the SUS protocol, noting this context so the human reviewer isn't alarmed by the automated flag.

## No Analog Found

None — every file in scope has a direct or role-match analog in the existing codebase.

## Metadata

**Analog search scope:** `bar-pos/` root docs (`FSD-STRUCTURE.md`, `DOMAIN-CONTRACTS.md`, `SUPABASE-CONTRACTS.md`), `scripts/*.ts`, `eslint.config.js`, `package.json`, `src/shared/ui/{button,POSButton}.tsx`, `tailwind.config.ts`, `src/app/globals.css`, `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx`, `src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx`
**Files scanned:** 10 read directly, full or targeted; 3 grepped
**Pattern extraction date:** 2026-07-15
