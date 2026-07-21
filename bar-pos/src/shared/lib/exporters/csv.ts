// Generic rows->CSV serializer (D-11). Reuses xlsx's own sheet writer so RFC-4180
// escaping (commas, quotes, newlines) is never hand-rolled here.
import * as XLSX from 'xlsx';

export type CsvColumn<T> = { key: keyof T; header: string };

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const mapped = rows.map(row =>
    Object.fromEntries(columns.map(c => [c.header, row[c.key]]))
  );
  const ws = XLSX.utils.json_to_sheet(mapped, { header: columns.map(c => c.header) });
  return XLSX.utils.sheet_to_csv(ws);
}

export function csvToBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv);
}
