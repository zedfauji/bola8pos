import { useState } from 'react';
import { toast } from 'sonner';
import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { ConfirmDialog, Input } from '@shared/ui';
import { useStopAndMoveSession } from '../useStopAndMoveSession';

export interface StopAndMoveDialogProps {
  open: boolean;
  session: PoolSession;
  table: PoolTable;
  tabId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function parseTableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 200) return null;
  return n;
}

export function StopAndMoveDialog({
  open,
  session,
  table,
  tabId,
  onClose,
  onSuccess,
}: StopAndMoveDialogProps) {
  const [tableInput, setTableInput] = useState('');
  const mutation = useStopAndMoveSession();

  const newTableNumber = parseTableNumber(tableInput);
  const confirmDisabled = newTableNumber === null || mutation.isPending;

  const handleConfirm = async () => {
    if (newTableNumber === null) return;

    const result = await mutation.mutateAsync({
      sessionId: session.id,
      tableId: table.id,
      tabId,
      ratePerHour: table.ratePerHour,
      newTableNumber,
      version: session.version,
    });

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(`Session stopped. Tab moved to table ${String(newTableNumber)}.`);
    setTableInput('');
    onSuccess();
    onClose();
  };

  const handleCancel = () => {
    setTableInput('');
    onClose();
  };

  return (
    <ConfirmDialog
      open={open}
      title="Stop Timer & Move Table"
      description={`Stop the pool session on ${table.label} and move the tab to a regular table.`}
      confirmLabel="Stop & Move"
      variant="destructive"
      onConfirm={() => {
        void handleConfirm();
      }}
      onCancel={handleCancel}
      isLoading={mutation.isPending}
      confirmDisabled={confirmDisabled}
    >
      <div className="flex flex-col gap-2 py-2">
        <label className="text-sm font-medium" htmlFor="new-table-number">
          New table number
        </label>
        <Input
          id="new-table-number"
          type="number"
          min={1}
          max={200}
          placeholder="Table number (1–200)"
          value={tableInput}
          onChange={e => {
            setTableInput(e.target.value);
          }}
          disabled={mutation.isPending}
        />
      </div>
    </ConfirmDialog>
  );
}
