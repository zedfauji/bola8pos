# Stack Research

**Domain:** UI standardization tooling for an existing Tauri 2 + React 19 + Tailwind v3 + shadcn/ui + Playwright v1.59 + Storybook v10 app (v2.2 milestone)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (Context7 unavailable in this session; verified via npm registry metadata + official GitHub/docs, cross-checked against installed `package.json` versions)

This milestone adds **zero new architectural technology**. Everything below is either (a) a lint plugin that reads the *existing* Tailwind/ESLint config, or (b) a testing capability already built into the *already-installed* `@playwright/test`. No new CSS system, no new component library, no new state layer.

## Recommended Stack

### Core Technologies

No new core technologies. Tailwind v3.4.19, shadcn/ui, ESLint 9.39.4 (flat config), Playwright 1.59.1, Storybook 10.3.5 are locked and already installed — this milestone configures them, it doesn't replace them.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint-plugin-tailwindcss` | `^3.18.3` (**not** the `latest`/`4.x` tag) | Lints Tailwind class strings: `classnames-order`, `no-custom-classname`, `no-contradicting-classname`, `enforces-shorthand`, `enforces-negative-arbitrary-values`, `no-unnecessary-arbitrary-value` | Add to `eslint.config.ts` as a new flat-config block. Catches ad-hoc spacing (`px-2 px-4` on one element), raw arbitrary values (`bg-[#1a2b3c]`, `p-[13px]`), and classnames that don't resolve against the project's `tailwind.config.ts` theme — directly serves "design tokens/spacing/color discipline" |
| `@axe-core/playwright` | `^4.12.1` | Injects `axe-core` accessibility scans into Playwright pages (contrast, ARIA, focus order, some touch-target heuristics) | Add 1-2 assertions per existing E2E spec (or one new `e2e/43-a11y-scan.spec.ts` that walks all 12 routes) — serves "accessibility + touch-target consistency" with real rendered DOM, which static ESLint a11y rules and Storybook's `addon-a11y` (component-isolation only) cannot catch |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@playwright/test` `toHaveScreenshot()` | Visual regression / screenshot-diff | **Already installed** (`^1.59.1`). No new package. Needs a *second*, purpose-built Playwright config (see below) — the existing `playwright.config.ts` is tuned for functional E2E (headed real Chrome via `channel: 'chrome'`, `slowMo`, `headless: false`) which is the wrong profile for deterministic pixel diffs |
| Existing `no-restricted-syntax` ESLint rule | Ban raw hex-color literals in JSX `style={{...}}` | `eslint.config.ts` already has a `no-restricted-syntax` block (used today to ban `ExportAllDeclaration`). Add one more selector matching hex-literal strings in `style` attributes — zero new dependency, reuses a mechanism already in the codebase |
| Storybook `storybook-static/index.json` + Playwright | Screenshot every story for component-level visual diffing | No new package. `npm run build-storybook` emits `storybook-static/`; a small script (~20 lines) reads `index.json`, opens each story's `iframe.html?id=...&viewMode=story` URL, and calls `toHaveScreenshot()` — reuses the same visual Playwright config as the route-level screenshots |

## Installation

```bash
# Dev dependencies only — nothing goes into `dependencies`
npm install -D eslint-plugin-tailwindcss@^3.18.3 @axe-core/playwright@^4.12.1
```

No install needed for visual regression itself — `@playwright/test` (already a devDependency) ships `toHaveScreenshot()`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `eslint-plugin-tailwindcss@3.x` | `eslint-plugin-better-tailwindcss` (successor to the now-frozen `readable-tailwind`) | If the team also wants auto-formatting/line-wrapping of long `className` strings, not just consistency linting. Skip for this milestone — it overlaps with `classnames-order` and adds a second opinion on class ordering; pick one, not both |
| Playwright built-in `toHaveScreenshot()` | Chromatic (the `@chromatic-com/storybook` devDependency is already present, but unused/inactive) | If the team later wants a hosted PR-review UI for visual diffs with team approvals. It's a **paid SaaS** ($149/mo tier referenced in current pricing) — not justified for a single-location on-prem POS with no existing SaaS billing relationship. `toHaveScreenshot()` gives the same pixel-diff capability for $0, already wired into `e2e/` |
| Playwright + `storybook-static/index.json` | `@storybook/test-runner` (`^0.24.4`) | If the team wants Storybook-native `test-storybook` CLI integration. Its dependency tree pulls in **Jest 30 + Babel + SWC** — a second, Jest-based test runner duplicating the Vitest + `@storybook/addon-vitest` wiring this project already uses for `npm run test:storybook`. Not worth the duplication for a screenshot-only need |
| Reuse existing `no-restricted-syntax` for hex-color ban | A dedicated plugin (e.g. `eslint-plugin-no-inline-styles`) | Only if inline `style` props with dynamic/computed colors become common (they're rare in a shadcn/Tailwind codebase). One more rule in an existing block is simpler than a new plugin for one check |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `eslint-plugin-tailwindcss@latest` (currently resolves to `4.1.0`) | Its `peerDependencies` require `tailwindcss: ^4.0.0` — this project is locked to Tailwind **v3.4.19**. Installing `latest` will either fail peer-dep resolution or silently misparse the v3 config format | Pin `eslint-plugin-tailwindcss@^3.18.3` explicitly (last v3-line release, published 2026-04-13, still peer-compatible with `tailwindcss ^3.4.0`) |
| Stylelint | The entire codebase has exactly one raw CSS file (`src/app/globals.css`, mostly `@tailwind` directives + CSS-variable theme declarations). Styling is Tailwind-utility-class-only by convention. Stylelint would be a second linter config with near-zero coverage gain over what `eslint-plugin-tailwindcss` + code review already catch | Nothing — the one `globals.css` file is small enough for manual review |
| Percy / Applitools / Lost Pixel / Argos (hosted visual-diff SaaS) | All require an external account, API key, and (for most) a paid tier once past a small free-snapshot quota. This is a single-location on-prem desktop app with no existing SaaS billing relationship for this concern | `@playwright/test`'s built-in `toHaveScreenshot()` — free, local, git-committed baselines, no new vendor |
| `@storybook/test-runner` | Jest-based; duplicates the Vitest + `addon-vitest` test runner already wired for Storybook in this repo (`npm run test:storybook`) | Script that screenshots `storybook-static/index.json` story URLs via the already-installed `@playwright/test` |
| A new CSS-in-JS system (styled-components, emotion, vanilla-extract) | Explicitly out of scope — Tailwind + shadcn is locked per `CLAUDE.md`/`PROJECT.md` constraints | Tailwind utility classes + CSS variables (existing) |

## Stack Patterns by Variant

**Visual regression config (route-level, all 12 pages):**
- Add a **separate** Playwright config, e.g. `playwright.visual.config.ts`, extending `defineConfig` with: `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]` (bundled Chromium, **not** `channel: 'chrome'`), `headless: true`, no `slowMo`, `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } }`.
- Because — the existing `playwright.config.ts` deliberately uses a real installed Chrome channel + `headless: false` + `slowMo: 400` for human-watchable functional E2E debugging. That combination is the wrong profile for pixel-diff determinism: real-Chrome-channel version drift between machines and non-headless GPU compositing differences are exactly the flakiness sources the ecosystem research flags. Keep the two configs (and two npm scripts, e.g. `test:visual`) separate rather than retrofitting the functional config.

**Screenshot baseline storage:**
- Commit baseline PNGs to the repo (e.g. `e2e/visual/__screenshots__/`) rather than an external snapshot service.
- Because — this project is single-platform (Windows dev machines, WebView2/Chromium-based Tauri target) and single-browser for testing (Chromium only, per the existing `projects` array). The "triples your baseline count across 3 browser engines" problem the ecosystem research warns about doesn't apply here. Git-committed baselines match the existing convention (`test:e2e` is already a manually-run, not CI-auto-gated, suite per `CLAUDE.md`).
- Never auto-regenerate baselines in CI/on merge — regenerate manually and review the diff, same discipline already implied by "run `npm run test:e2e` manually before releases."

**Storybook story visual diffing:**
- Reuse the *same* `playwright.visual.config.ts` against `storybook-static/` (built via `build-storybook`), not a separate visual tool for components vs. pages. One config, one baseline convention, one `maxDiffPixelRatio` threshold for the whole milestone.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-------------------|-------|
| `eslint-plugin-tailwindcss@3.18.3` | `tailwindcss@3.4.19` (installed) | Peer dep is `^3.4.0 \|\| ^4.0.0` — v3 line supports both; confirmed via npm registry metadata |
| `eslint-plugin-tailwindcss@3.18.3` | `eslint@9.39.4` flat config (installed, `eslint.config.ts`) | Flat-config support landed in the 3.16.x beta line and is stable by 3.18.x; no `eslint` peerDependency is declared (only a `devDependency` of `^8.57.0` used for the plugin's own test suite) — verify the flat-config import path (`eslintPluginTailwindcss.configs['flat/recommended']` or similar) against the installed version's README at implementation time, since docs online mix v3/v4 examples |
| `@axe-core/playwright@4.12.1` | `playwright-core@1.59.1` (installed, via `@playwright/test`) | Peer dep is `playwright-core: >=1.0.0` — no version conflict |
| `@playwright/test@1.59.1` `toHaveScreenshot()` | N/A | Built-in since early 1.x; no compatibility risk, already the exact version this project runs |
| Tailwind v3 `settings.tailwindcss.config` option | `tailwind.config.ts` (installed, TS not JS) | v3-line of `eslint-plugin-tailwindcss` expects a config file path (`config: './tailwind.config.ts'`); the `cssConfigPath` option shown in most current docs is v4-only (points at a `.css` `@theme` file) — do not copy v4 config examples verbatim |

## Sources

- npm registry (`registry.npmjs.org`) direct metadata fetch — `eslint-plugin-tailwindcss` (latest = `4.1.0`, peer `tailwindcss ^4.0.0`; 3.x line latest = `3.18.3`, published 2026-04-13, peer `tailwindcss ^3.4.0 || ^4.0.0`) — HIGH confidence (primary source, registry JSON)
- npm registry — `@axe-core/playwright@4.12.1`, peer `playwright-core >=1.0.0` — HIGH confidence
- npm registry — `@storybook/test-runner@0.24.4` dependency tree (Jest 30, Babel, SWC) — HIGH confidence
- [github.com/francoismassart/eslint-plugin-tailwindcss](https://github.com/francoismassart/eslint-plugin-tailwindcss) — rule list and flat-config example (fetched content mixed v3/v4 docs; MEDIUM confidence, flagged for verification at implementation) — WebSearch/WebFetch
- WebSearch: "Playwright toHaveScreenshot best practices CI 2026" — `maxDiffPixelRatio` guidance, commit-baselines-to-git pattern, animation-disable pattern, OS/browser-engine drift as flakiness source — MEDIUM confidence (multiple independent sources agreed: TestDino, Bug0, BrowserStack guides)
- [markus.oberlehner.net — "Running Visual Regression Tests with Storybook and Playwright for Free"](https://markus.oberlehner.net/blog/running-visual-regression-tests-with-storybook-and-playwright-for-free) — confirms `storybook-static/index.json` iteration pattern, font-rendering OS drift gotcha — MEDIUM confidence (single source, but directly matches the approach recommended here and the pattern is mechanically verifiable)
- WebSearch: "Storybook test runner Playwright visual regression vs Chromatic free alternative" — Chromatic pricing tier reference, confirms Playwright-built-in as the zero-dependency option — MEDIUM confidence
- Local inspection: `bar-pos/package.json`, `bar-pos/playwright.config.ts`, `bar-pos/eslint.config.ts`, `bar-pos/src/app/globals.css` (only raw CSS file) — HIGH confidence (primary source, this repo)

---
*Stack research for: UI standardization / visual regression tooling additions, v2.2 milestone*
*Researched: 2026-07-10*
