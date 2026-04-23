/**
 * Writes repo-root VERIFICATION_REPORT.md from Playwright JSON output.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BAR_POS = path.join(__dirname, '..');
const RESULTS = path.join(BAR_POS, 'e2e-results', 'results.json');
const REPO_ROOT = path.join(BAR_POS, '..');
const REPORT = path.join(REPO_ROOT, 'VERIFICATION_REPORT.md');

type ResultEntry = { status: string; error?: { message?: string } };

type SpecEntry = {
  title: string;
  file?: string;
  tests?: { results?: ResultEntry[] }[];
};

type Suite = {
  title: string;
  file?: string;
  suites?: Suite[];
  specs?: SpecEntry[];
  /** Legacy Playwright JSON shape */
  tests?: { title: string; results?: ResultEntry[] }[];
};

const SUITE_MAP: { match: RegExp; label: string }[] = [
  { match: /^01-ci/, label: 'CI Checks' },
  { match: /^02-caja/, label: 'Caja Management' },
  { match: /^03-tab-order/, label: 'Tab + Order Flow' },
  { match: /^04-pool-timer/, label: 'Pool Timer' },
  { match: /^05-payments/, label: 'Payments' },
  { match: /^06-transfer/, label: 'Transfer' },
  { match: /^07-reports/, label: 'Reports' },
  { match: /^08-settings-receipt/, label: 'Settings / Receipt' },
  { match: /^09-rbac/, label: 'RBAC' },
  { match: /^10-inventory/, label: 'Inventory' },
  { match: /^11-offline/, label: 'Offline Resilience' },
  { match: /^12-infrastructure/, label: 'Infrastructure' },
  { match: /^13-tauri-build/, label: 'Tauri Build' },
  { match: /^14-manual/, label: 'Manual verification stubs' },
  { match: /^15-home-navigation/, label: 'Home Navigation' },
  { match: /^16-table-status/, label: 'Table Status Page' },
  { match: /^17-payment-pane/, label: 'Payment Pane' },
  { match: /^18-void-order/, label: 'Void Order' },
  { match: /^19-caja-entries/, label: 'Caja Entries' },
  { match: /^20-error-scenarios/, label: 'Error Scenarios' },
  { match: /^21-product-management/, label: 'Product Management' },
  { match: /^22-staff-management/, label: 'Staff Management' },
  { match: /^23-payment-edge-cases/, label: 'Payment Edge Cases' },
  { match: /^24-pool-advanced/, label: 'Advanced Pool Operations' },
  { match: /^25-rappi-orders/, label: 'Rappi Orders' },
  { match: /^26-field-validation/, label: 'Field Validation' },
];

function lastStatus(results: ResultEntry[] | undefined): string {
  if (!results?.length) return 'unknown';
  return results[results.length - 1]?.status ?? 'unknown';
}

function walkSuite(s: Suite, fileHint: string | undefined, onTest: (file: string, status: string) => void) {
  const file = s.file ?? fileHint;
  const nextFile = file ?? fileHint;
  for (const spec of s.specs ?? []) {
    const specFile = spec.file ?? nextFile;
    for (const tr of spec.tests ?? []) {
      const st = lastStatus(tr.results);
      if (specFile) onTest(specFile, st);
    }
  }
  for (const t of s.tests ?? []) {
    const st = lastStatus(t.results);
    if (nextFile) onTest(nextFile, st);
  }
  for (const ch of s.suites ?? []) {
    walkSuite(ch, nextFile, onTest);
  }
}

function basenameFile(f: string): string {
  return path.basename(f);
}

async function waitForResultsFile(maxMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (existsSync(RESULTS)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return existsSync(RESULTS);
}

export default async function globalTeardown(): Promise<void> {
  await waitForResultsFile(15_000);
  if (!existsSync(RESULTS)) {
    const fallback = `# Bar POS — Playwright Verification Report
**Date:** ${new Date().toISOString().slice(0, 10)}
**Note:** No results.json found — tests may not have run.

## Summary
Run \`cd bar-pos && npx playwright test\` after configuring \`.env.local\`.
`;
    writeFileSync(REPORT, fallback, 'utf8');
    // eslint-disable-next-line no-console
    console.log('E2E COMPLETE — Pass: 0 | Fail: 0 | Skip: 0 (no results file)');
    return;
  }

  const raw = JSON.parse(readFileSync(RESULTS, 'utf8')) as { suites?: Suite[] };
  const counts = new Map<string, { pass: number; fail: number; skip: number; total: number }>();

  for (const { label } of SUITE_MAP) {
    counts.set(label, { pass: 0, fail: 0, skip: 0, total: 0 });
  }
  counts.set('Other', { pass: 0, fail: 0, skip: 0, total: 0 });

  const failures: { title: string; file: string; error: string }[] = [];

  const classify = (file: string): string => {
    const base = basenameFile(file);
    for (const { match, label } of SUITE_MAP) {
      if (match.test(base)) return label;
    }
    return 'Other';
  };

  const onTest = (file: string, status: string) => {
    const label = classify(file);
    const c = counts.get(label);
    if (!c) return;
    c.total += 1;
    if (status === 'passed') c.pass += 1;
    else if (status === 'skipped') c.skip += 1;
    else c.fail += 1;
  };

  for (const root of raw.suites ?? []) {
    walkSuite(root, undefined, onTest);
  }

  const walkFailures = (s: Suite, fileHint: string | undefined) => {
    const file = s.file ?? fileHint;
    for (const spec of s.specs ?? []) {
      const specFile = spec.file ?? file;
      for (const tr of spec.tests ?? []) {
        const results = tr.results ?? [];
        const r = results[results.length - 1];
        if (r?.status === 'failed' || r?.status === 'timedOut') {
          failures.push({
            title: spec.title,
            file: basenameFile(specFile ?? 'unknown'),
            error: r.error?.message ?? r.status,
          });
        }
      }
    }
    for (const t of s.tests ?? []) {
      const results = t.results ?? [];
      const r = results[results.length - 1];
      if (r?.status === 'failed' || r?.status === 'timedOut') {
        failures.push({
          title: t.title,
          file: basenameFile(file ?? 'unknown'),
          error: r.error?.message ?? r.status,
        });
      }
    }
    for (const ch of s.suites ?? []) walkFailures(ch, file);
  };
  for (const root of raw.suites ?? []) walkFailures(root, undefined);

  let totalP = 0,
    totalF = 0,
    totalS = 0,
    totalT = 0;
  for (const label of counts.keys()) {
    const c = counts.get(label)!;
    totalP += c.pass;
    totalF += c.fail;
    totalS += c.skip;
    totalT += c.total;
  }

  const pwVersion =
    (JSON.parse(readFileSync(path.join(BAR_POS, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string> })
      .devDependencies?.['@playwright/test'] ?? 'unknown';

  const lines: string[] = [
    '# Bar POS — Playwright Verification Report',
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    `**Playwright version:** ${pwVersion}`,
    '**Browser:** Chromium',
    '',
    '## Summary',
    '| Suite | Total | Pass | Fail | Skip |',
    '|-------|-------|------|------|------|',
  ];

  for (const { label } of SUITE_MAP) {
    const c = counts.get(label)!;
    lines.push(`| ${label} | ${String(c.total)} | ${String(c.pass)} | ${String(c.fail)} | ${String(c.skip)} |`);
  }
  const other = counts.get('Other');
  if (other && other.total > 0) {
    lines.push(`| Other | ${String(other.total)} | ${String(other.pass)} | ${String(other.fail)} | ${String(other.skip)} |`);
  }
  lines.push(`| **TOTAL** | ${String(totalT)} | ${String(totalP)} | ${String(totalF)} | ${String(totalS)} |`);
  lines.push('');
  lines.push('## Videos');
  lines.push('All videos saved to: `bar-pos/e2e-results/`');
  lines.push('HTML report: `bar-pos/e2e-report/index.html`');
  lines.push('');
  lines.push('## Failures');
  if (failures.length === 0) {
    lines.push('_None._');
  } else {
    for (const f of failures) {
      lines.push('');
      lines.push(`### FAIL: ${f.title}`);
      lines.push(`**File:** e2e/${f.file}`);
      lines.push(`**Error:** ${f.error.replace(/\r?\n/g, ' ')}`);
      lines.push('**Video:** see `bar-pos/e2e-results/` for matching `.webm`');
      lines.push('**Trace:** see `bar-pos/e2e-results/` for matching trace `.zip`');
      lines.push('**Likely cause:** See error message above (selector vs app state vs env).');
    }
  }
  lines.push('');

  writeFileSync(REPORT, lines.join('\n'), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`E2E COMPLETE — Pass: ${String(totalP)} | Fail: ${String(totalF)} | Skip: ${String(totalS)}`);
}
