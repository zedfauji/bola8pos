/**
 * CSV parsing utility for CsvImportSheet.
 * Extracted to its own file to satisfy react-refresh/only-export-components.
 */

/**
 * Parse a CSV text string into a 2D array of trimmed cell values.
 * Handles both LF and CRLF line endings. Blank lines are filtered out.
 */
export function parseCsvText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(line => line.trim().length > 0)
    .map(line => line.split(',').map(cell => cell.trim()));
}
