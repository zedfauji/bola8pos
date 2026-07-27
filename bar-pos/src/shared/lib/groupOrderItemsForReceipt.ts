/**
 * Groups flat receipt/pre-cheque item rows into 2-level Category → Item
 * buckets (D-01), plus a modifier-line formatter shared by both text
 * builders (D-05).
 *
 * Pure functions, no I/O. Callers resolve category names before calling —
 * this module never fetches or joins against `categories`. The
 * uncategorized bucket (rows with no category) is always the LAST group in
 * the returned array. See `groupOrderItemsForReceipt.test.ts` for the full
 * contract (grouping, ordering, sanitization).
 */

/**
 * Row shape accepted by {@link groupByCategory} — the category fields it groups on.
 * Optional (not just nullable) so callers with an untouched `ReceiptData['items']`
 * element (`categoryId`/`categoryName` are `.optional()` in the Zod schema) satisfy
 * this constraint without an intermediate mapping step.
 */
export type CategorizedRow = {
  categoryId?: string | null | undefined;
  categoryName?: string | null | undefined;
};

/** One category bucket: resolved category identity plus its items, in input order. */
export type CategoryGroup<T> = {
  categoryId: string | null;
  categoryName: string | null;
  items: T[];
};

/** Sentinel map key for rows with no usable category (never exposed to callers). */
const UNCATEGORIZED_KEY = '__uncategorized__';

/** Strips C0/C1 control characters (e.g. ESC/POS command bytes) and trims. */
function sanitize(s: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping control bytes (T-25-01)
  return s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

/**
 * Groups rows into category buckets, sorted by `categoryName` (locale
 * compare), with a single trailing uncategorized bucket (rows whose
 * `categoryId`/`categoryName` is null/undefined/empty) if any exist. Never
 * mutates the input array; preserves input order within each group.
 */
export function groupByCategory<T extends CategorizedRow>(rows: readonly T[]): CategoryGroup<T>[] {
  const map = new Map<string, CategoryGroup<T>>();

  for (const row of rows) {
    const catId = row.categoryId ?? null;
    const trimmedName = row.categoryName?.trim() ?? '';
    const key = catId == null || !trimmedName ? UNCATEGORIZED_KEY : catId;

    let group = map.get(key);
    if (!group) {
      group = {
        categoryId: key === UNCATEGORIZED_KEY ? null : catId,
        categoryName: key === UNCATEGORIZED_KEY ? null : sanitize(trimmedName),
        items: [],
      };
      map.set(key, group);
    }
    group.items.push(row);
  }

  const named: CategoryGroup<T>[] = [];
  let uncategorized: CategoryGroup<T> | undefined;
  for (const [key, group] of map) {
    if (key === UNCATEGORIZED_KEY) {
      uncategorized = group;
    } else {
      named.push(group);
    }
  }
  named.sort((a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? ''));

  return uncategorized ? [...named, uncategorized] : named;
}

/**
 * Formats modifier names into the two-space plus-sign line convention
 * (`  + Extra cheese`). Empty/whitespace-only names are dropped.
 */
export function formatModifierLines(modifierNames: readonly string[]): string[] {
  const lines: string[] = [];
  for (const name of modifierNames) {
    const clean = sanitize(name);
    if (clean) lines.push(`  + ${clean}`);
  }
  return lines;
}
