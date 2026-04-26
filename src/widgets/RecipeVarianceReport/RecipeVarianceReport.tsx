import { FlaskConical } from 'lucide-react';
import { ExportButtons } from '@features/export-report';
import { useRecipeVarianceReport } from '@entities/tab/model/queries-reports';
import type { RecipeVarianceRow } from '@shared/lib/domain';
import { EmptyState, LoadingSpinner } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = { dateRange: { from: Date; to: Date } };

export function RecipeVarianceReport({ dateRange }: Props) {
  const { data: result, isLoading } = useRecipeVarianceReport(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: RecipeVarianceRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No variance data"
        description="No stock movements recorded for this date range and category."
      />
    );
  }

  const totalTheoretical = rows.reduce((s, r) => s + r.theoreticalUsed, 0);
  const totalPhysical = rows.reduce((s, r) => s + r.physicalDelta, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          reportType="recipe-variance"
          data={{ rows, dateRange }}
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Ingredient</TableHead>
              <TableHead className="tabular-nums">Theoretical Used</TableHead>
              <TableHead className="tabular-nums">Physical Delta</TableHead>
              <TableHead className="tabular-nums">Variance %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow
                key={`${row.date}-${row.ingredientId}`}
                className={
                  Math.abs(row.variancePct) > 10
                    ? 'border-l-4 border-l-amber-400 bg-amber-50/5'
                    : undefined
                }
              >
                <TableCell className="font-mono text-sm">{row.date}</TableCell>
                <TableCell>{row.ingredientName}</TableCell>
                <TableCell className="tabular-nums">{row.theoreticalUsed.toFixed(3)}</TableCell>
                <TableCell className="tabular-nums">{row.physicalDelta.toFixed(3)}</TableCell>
                <TableCell className="tabular-nums font-mono">
                  {row.variancePct.toFixed(2)}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-semibold bg-muted/20">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="tabular-nums">{totalTheoretical.toFixed(3)}</TableCell>
              <TableCell className="tabular-nums">{totalPhysical.toFixed(3)}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
