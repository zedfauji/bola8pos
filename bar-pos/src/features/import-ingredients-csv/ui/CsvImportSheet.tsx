/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * CsvImportSheet
 *
 * 3-state Sheet: select → staged → importing.
 * CSV parsing via native FileReader + manual string split (no papaparse — no new deps).
 * Each row validated with IngredientCreateSchema.safeParse().
 * Bulk insert via supabase.from('ingredients').insert(validRows) after user confirms.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { IngredientCreate } from '@entities/ingredient';
import { IngredientCreateSchema, ingredientKeys } from '@entities/ingredient';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';
import { parseCsvText } from './csv-parse';

// Re-export for unit testing (csv-parse.ts is the canonical home)
// eslint-disable-next-line react-refresh/only-export-components
export { parseCsvText } from './csv-parse';

// Pre-regen cast — remove once supabase.types.ts is regenerated after ingredient migrations
const db = supabase as any;

// Expected CSV column order (header row):
// name,base_uom,purchase_uom,purchase_to_base_factor,cost_per_base_unit,reorder_point,category,is_prep
const CSV_TEMPLATE = [
  'name,base_uom,purchase_uom,purchase_to_base_factor,cost_per_base_unit,reorder_point,category,is_prep',
  'Tomato,g,kg,1000,0.012,2000,produce,false',
  'Salsa Mexicana,portion,,1,0.50,20,prep,true',
  'Corona 355ml,unit,case_24,24,12.50,48,beer-regular,false',
].join('\n');

type ImportState =
  | { step: 'select' }
  | {
      step: 'staged';
      validRows: IngredientCreate[];
      failedRows: Array<{ rowNum: number; reason: string }>;
    }
  | { step: 'importing' };

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ingredients-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvImportSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>({ step: 'select' });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;

      const rows = parseCsvText(text);
      if (rows.length === 0) {
        toast.error('CSV file is empty or could not be parsed');
        return;
      }

      // Skip header row (first row)
      const dataRows = rows.slice(1);

      const MAX_IMPORT_ROWS = 500;
      if (dataRows.length > MAX_IMPORT_ROWS) {
        toast.error(`CSV has ${String(dataRows.length)} rows — max ${String(MAX_IMPORT_ROWS)} allowed. Split into smaller files.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const validRows: IngredientCreate[] = [];
      const failedRows: Array<{ rowNum: number; reason: string }> = [];

      dataRows.forEach((cols, i) => {
        const rowNum = i + 2; // 1-indexed, +1 for header
        const [
          name,
          base_uom,
          purchase_uom,
          purchase_to_base_factor,
          cost_per_base_unit,
          reorder_point,
          category,
          is_prep,
        ] = cols;

        const raw = {
          name: name ?? '',
          uom: base_uom ?? '',
          purchaseUom:
            purchase_uom !== undefined && purchase_uom.length > 0 ? purchase_uom : null,
          purchaseToBaseFactor: purchase_to_base_factor ? Number(purchase_to_base_factor) : 1,
          costPerBaseUnit: cost_per_base_unit ? Number(cost_per_base_unit) : 0,
          reorderPoint:
            reorder_point !== undefined && reorder_point.length > 0
              ? Number(reorder_point)
              : null,
          category: category !== undefined && category.length > 0 ? category : null,
          isPrep: is_prep === 'true',
          isActive: true,
        };

        const result = IngredientCreateSchema.safeParse(raw);
        if (result.success) {
          validRows.push(result.data);
        } else {
          const firstIssue = result.error.issues[0];
          failedRows.push({
            rowNum,
            reason: firstIssue
              ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
              : 'Validation failed',
          });
        }
      });

      setImportState({ step: 'staged', validRows, failedRows });
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleConfirmImport() {
    if (importState.step !== 'staged' || importState.validRows.length === 0) return;

    const { validRows } = importState;
    setImportState({ step: 'importing' });

    const dbRows = validRows.map(r => ({
      name: r.name,
      uom: r.uom,
      purchase_uom: r.purchaseUom ?? null,
      purchase_to_base_factor: r.purchaseToBaseFactor,
      cost_per_base_unit: r.costPerBaseUnit,
      reorder_point: r.reorderPoint ?? null,
      is_prep: r.isPrep,
      is_active: true,
      category: r.category ?? null,
    }));

    const { error } = await db.from('ingredients').insert(dbRows);

    if (error) {
      logger.error('CsvImportSheet: bulk insert failed', { error });
      toast.error(`Import failed: ${String(error.message)}`);
      setImportState({ step: 'staged', validRows, failedRows: importState.failedRows });
      return;
    }

    void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
    toast.success(`${String(validRows.length)} ingredients imported`);
    setImportState({ step: 'select' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  }

  function handleReset() {
    setImportState({ step: 'select' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setImportState({ step: 'select' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    onOpenChange(nextOpen);
  }

  const validCount = importState.step === 'staged' ? importState.validRows.length : 0;
  const failedRows = importState.step === 'staged' ? importState.failedRows : [];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import ingredients</SheetTitle>
          <SheetDescription>
            Upload a CSV file to bulk-add ingredients. Download the template to see the required
            format.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {importState.step === 'select' && (
            <>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                <Download className="size-3.5" />
                Download template
              </button>

              <div className="space-y-1.5">
                <Label htmlFor="csv-file">CSV file</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">UTF-8 encoded · max 500 rows</p>
              </div>
            </>
          )}

          {importState.step === 'staged' && (
            <div className="space-y-3">
              <p className="font-semibold text-sm">
                Preview — {validCount + failedRows.length} rows found
              </p>

              {failedRows.length === 0 && validCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {validCount} ingredients ready to import
                </p>
              )}

              {failedRows.length > 0 && validCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {validCount} of {validCount + failedRows.length} rows valid ·{' '}
                  {failedRows.length} rows have errors (shown below)
                </p>
              )}

              {failedRows.length > 0 && validCount === 0 && (
                <p className="text-sm text-destructive">
                  0 rows valid — check your file format and try again
                </p>
              )}

              {failedRows.length > 0 && (
                <ul className="divide-y rounded-md border max-h-48 overflow-y-auto">
                  {failedRows.map(row => (
                    <li key={row.rowNum} className="px-3 py-2 text-xs text-destructive">
                      Row {row.rowNum}: {row.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {importState.step === 'importing' && (
            <p className="text-sm text-muted-foreground">Importing…</p>
          )}
        </div>

        <SheetFooter className="mt-6">
          {importState.step === 'select' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled>Import ingredients</Button>
            </>
          )}

          {importState.step === 'staged' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Choose different file
              </Button>
              <Button
                disabled={validCount === 0}
                onClick={() => {
                  void handleConfirmImport();
                }}
              >
                Import {validCount} ingredients
              </Button>
            </>
          )}

          {importState.step === 'importing' && (
            <>
              <Button variant="outline" disabled>
                Choose different file
              </Button>
              <Button disabled>Importing…</Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
