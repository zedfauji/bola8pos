import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

const BAR_POS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd: string): void {
  execSync(cmd, { cwd: BAR_POS, stdio: 'inherit', shell: process.env.ComSpec ?? 'cmd.exe' });
}

test.describe('CI Checks', () => {
  test('npm run typecheck exits 0', () => {
    run('npm run typecheck');
  });

  test('npm run lint exits 0', () => {
    run('npm run lint');
  });

  test('npm run test exits 0 (unit project)', () => {
    // Verbose reporter: dot-only output looks frozen when many tests don't log to stdout.
    run('npx vitest run --project unit --reporter=verbose');
  });
});
