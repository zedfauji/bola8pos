import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('featOrders');
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

    toast.success(t('stopAndMove.sessionStoppedMoved', { number: newTableNumber }));
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
      title={t('stopAndMove.title')}
      description={t('stopAndMove.description', { tableLabel: table.label })}
      confirmLabel={t('stopAndMove.confirmLabel')}
      variant="destructive"
      confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"
      onConfirm={() => {
        void handleConfirm();
      }}
      onCancel={handleCancel}
      isLoading={mutation.isPending}
      confirmDisabled={confirmDisabled}
    >
      <div className="flex flex-col gap-2 py-2">
        <label className="text-sm font-medium" htmlFor="new-table-number">
          {t('stopAndMove.newTableNumberLabel')}
        </label>
        <Input
          id="new-table-number"
          type="number"
          min={1}
          max={200}
          placeholder={t('stopAndMove.tableNumberPlaceholder')}
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
