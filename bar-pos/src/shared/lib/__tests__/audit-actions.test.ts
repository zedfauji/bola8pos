/**
 * audit-actions.test.ts
 *
 * CI enforcement: every record_audit() call in migration files must use
 * an action string present in AuditActionSchema.options.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { describe, it, expect } from 'vitest';

import { AuditActionSchema } from '../audit-actions';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const VALID_ACTIONS = new Set<string>(AuditActionSchema.options);

describe('audit-actions enforcement', () => {
  it('AuditActionSchema has at least 20 enumerated actions', () => {
    expect(AuditActionSchema.options.length).toBeGreaterThanOrEqual(20);
  });

  it('every record_audit() call in migrations uses an enumerated action', () => {
    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => join(MIGRATIONS_DIR, f));

    const violations: string[] = [];

    for (const file of migrationFiles) {
      const content = readFileSync(file, 'utf-8');
      // Match: PERFORM record_audit('action.label', ... ) — first string param
      const matches = content.matchAll(/PERFORM\s+record_audit\s*\(\s*'([^']+)'/g);
      for (const match of matches) {
        const action = match[1];
        if (action !== undefined && !VALID_ACTIONS.has(action)) {
          violations.push(`${file}: '${action}' not in AuditActionSchema`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
