import { cn } from '@shared/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import type { PhysicalCountVarianceRow } from '../model/usePhysicalCount';

type Props = {
  rows: PhysicalCountVarianceRow[];
};

/**
 * Displays a variance report table after a physical count submission.
 *
 * - Negative variance rows (actual < expected) → red highlight
 * - Zero variance rows → no highlight
 * - Positive variance rows → green highlight
 */
export function VarianceReport({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-4">
        No variance — all stock counts match.
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-auto rounded-md border" data-testid="variance-report">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow
              key={row.productId}
              data-testid={`variance-row-${row.productId}`}
              data-variance={row.variance}
              className={cn(
                row.variance < 0 && 'bg-destructive/10 text-destructive',
                row.variance > 0 && 'bg-emerald-500/10 text-emerald-400'
              )}
            >
              <TableCell className="font-medium">{row.productName}</TableCell>
              <TableCell className="text-right">{row.expectedStock}</TableCell>
              <TableCell className="text-right">{row.actualCount}</TableCell>
              <TableCell className="text-right font-semibold">
                {row.variance > 0 ? `+${String(row.variance)}` : String(row.variance)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
