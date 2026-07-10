/**
 * audit-ui-drift.ts — Standalone Node script (not bundled into the app, never imported by src/).
 *
 * Scans src/pages, src/widgets, src/features for design-system drift: raw <button>/<input>
 * elements, hardcoded hex/rgb colors, and arbitrary-value Tailwind spacing classes. Also
 * cross-checks the real registered route count (src/app/router.tsx) against the CLAUDE.md
 * routes table row count.
 *
 * Writes .planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md and prints a summary to stdout.
 *
 * Usage:
 *   npx tsx scripts/audit-ui-drift.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Config ──────────────────────────────────────────────────────────────────

const SCAN_ROOTS = ['src/pages', 'src/widgets', 'src/features'];
const ROUTER_PATH = 'src/app/router.tsx';
const CLAUDE_MD_PATH = 'CLAUDE.md';
const OUTPUT_PATH = '.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md';

const CATEGORY_PATTERNS: { name: string; label: string; patterns: RegExp[] }[] = [
  { name: 'raw-button', label: 'Raw <button> elements', patterns: [/<button[\s>]/] },
  { name: 'raw-input', label: 'Raw <input> elements', patterns: [/<input[\s>]/] },
  {
    name: 'hardcoded-color',
    label: 'Hardcoded hex/rgb colors',
    patterns: [/#[0-9a-fA-F]{3,8}\b/, /rgba?\(/],
  },
  {
    name: 'arbitrary-spacing',
    label: 'Arbitrary-value Tailwind spacing classes',
    patterns: [
      /\b(?:[a-z:]+:)?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\[[^\]]+\]/,
    ],
  },
];

// ─── File collection (Pattern 1: filtered walk) ─────────────────────────────

function collectFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { recursive: true, withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    if (/\.stories\.tsx?$/.test(entry.name)) continue;
    const full = path.join(entry.parentPath, entry.name);
    if (full.includes(`${path.sep}shared${path.sep}ui${path.sep}`)) continue;
    out.push(full);
  }
  return out;
}

// ─── Per-category scan ───────────────────────────────────────────────────────

interface Match {
  file: string;
  line: number;
  snippet: string;
}

function scanCategory(files: string[], patterns: RegExp[]): Match[] {
  const matches: Match[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      if (patterns.some((pattern) => pattern.test(line))) {
        matches.push({ file, line: i + 1, snippet: line.trim() });
      }
    }
  }
  return matches;
}

function countUniqueFiles(matches: Match[]): number {
  return new Set(matches.map((m) => m.file)).size;
}

// ─── Route cross-check (D-06) ────────────────────────────────────────────────

interface RouteCrossCheck {
  realPageRoutes: number;
  claudeMdRows: number;
  missingRoutes: string[];
}

function crossCheckRoutes(): RouteCrossCheck {
  const routerSrc = fs.readFileSync(ROUTER_PATH, 'utf-8');
  const routeMatches = routerSrc.match(/<Route\s/g) ?? [];
  const navigateRedirects = (routerSrc.match(/<Navigate\s/g) ?? []).length;
  const realPageRoutes = routeMatches.length - navigateRedirects;

  const routerPaths = [...routerSrc.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p): p is string => p !== undefined && p !== '/');

  const claudeMd = fs.readFileSync(CLAUDE_MD_PATH, 'utf-8');
  const claudeMdRows = (claudeMd.match(/^\| `\//gm) ?? []).length;
  const claudeMdPaths = [...claudeMd.matchAll(/^\| `([^`]+)`/gm)]
    .map((m) => m[1])
    .filter((p): p is string => p !== undefined);

  const missingRoutes = routerPaths.filter((p) => !claudeMdPaths.includes(p));

  return { realPageRoutes, claudeMdRows, missingRoutes };
}

// ─── Markdown rendering ───────────────────────────────────────────────────────

function normalizePath(file: string): string {
  return file.replace(/\\/g, '/');
}

function renderCategorySection(
  label: string,
  matches: Match[]
): string {
  const byFile = new Map<string, Match[]>();
  for (const match of matches) {
    const key = normalizePath(match.file);
    const existing = byFile.get(key);
    if (existing) {
      existing.push(match);
    } else {
      byFile.set(key, [match]);
    }
  }

  const fileCount = byFile.size;
  const lines: string[] = [`## ${label} (${fileCount} files)`, ''];

  if (fileCount === 0) {
    lines.push('_No violations found._', '');
    return lines.join('\n');
  }

  const sortedFiles = [...byFile.keys()].sort();
  for (const file of sortedFiles) {
    lines.push(`### ${file}`, '');
    const fileMatches = byFile.get(file);
    if (fileMatches) {
      for (const match of fileMatches) {
        lines.push(`- [ ] line ${match.line}: \`${match.snippet}\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderMarkdown(
  categoryResults: { label: string; matches: Match[] }[],
  routeCheck: RouteCrossCheck
): string {
  const summaryLines = categoryResults.map(
    (r) => `- ${r.label}: ${countUniqueFiles(r.matches)} files`
  );

  const missingList =
    routeCheck.missingRoutes.length > 0
      ? routeCheck.missingRoutes.map((p) => `\`${p}\``).join(', ')
      : '(none)';

  const parts: string[] = [
    '# UI Drift Audit',
    '',
    `Generated by \`scripts/audit-ui-drift.ts\`. Do not hand-edit — regenerate via the script.`,
    '',
    '## Summary',
    '',
    ...summaryLines,
    '',
    '### Route count cross-check',
    '',
    `- Real page routes (${ROUTER_PATH}): ${routeCheck.realPageRoutes}`,
    `- CLAUDE.md routes table rows: ${routeCheck.claudeMdRows}`,
    `- Routes missing from CLAUDE.md: ${missingList}`,
    '',
  ];

  for (const result of categoryResults) {
    parts.push(renderCategorySection(result.label, result.matches));
  }

  return parts.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const files = SCAN_ROOTS.flatMap(collectFiles);

  const categoryResults = CATEGORY_PATTERNS.map((category) => ({
    label: category.label,
    matches: scanCategory(files, category.patterns),
  }));

  const routeCheck = crossCheckRoutes();

  const markdown = renderMarkdown(categoryResults, routeCheck);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf-8');

  console.log('UI Drift Audit');
  for (const result of categoryResults) {
    console.log(`  ${result.label}: ${countUniqueFiles(result.matches)} files`);
  }
  console.log(
    `  Route cross-check: ${routeCheck.realPageRoutes} real routes vs ${routeCheck.claudeMdRows} CLAUDE.md rows`
  );
  console.log(
    `  Routes missing from CLAUDE.md: ${routeCheck.missingRoutes.length > 0 ? routeCheck.missingRoutes.join(', ') : '(none)'}`
  );
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
