import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useResources } from '@entities/resource';
import { useStaffStore } from '@entities/staff/model/store';
import type { PoolSession, Resource } from '@shared/lib/domain';
import { POSButton } from '@shared/ui/POSButton';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import { useTransferPoolSession } from '../useTransferPoolSession';

export type TransferPoolDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: PoolSession | null;
};

export function TransferPoolDialog({ open, onOpenChange, session }: TransferPoolDialogProps) {
  const { t } = useTranslation('featOrders');
  const currentStaff = useStaffStore(s => s.currentStaff);
  const { data: tables } = useResources();
  const transferMut = useTransferPoolSession();

  const [targetTableId, setTargetTableId] = useState('');

  const availableTables = (tables ?? []).filter(
    (tbl: Resource) => tbl.status === 'available' && tbl.id !== session?.tableId
  );

  function handleSubmit() {
    if (!session || !currentStaff || !targetTableId) {
      toast.error(t('transferTab.selectTargetTable'));
      return;
    }

    transferMut.mutate(
      {
        sessionId: session.id,
        currentTableId: session.tableId,
        targetTableId,
        transferredBy: currentStaff.id,
      },
      {
        onSuccess: result => {
          if (result.ok) {
            toast.success(t('transferTab.poolSessionMoved'));
            setTargetTableId('');
            onOpenChange(false);
          } else {
            toast.error(result.error.message);
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('transferTab.movePoolSessionTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t('transferTab.sessionTimePreserved')}
          </p>

          <div className="space-y-1">
            <Label htmlFor="target-table">{t('transferTab.targetPoolTable')}</Label>
            <select
              id="target-table"
              value={targetTableId}
              onChange={e => {
                setTargetTableId(e.target.value);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('transferTab.selectTableOption')}</option>
              {availableTables.map((tbl: Resource) => (
                <option key={tbl.id} value={tbl.id}>
                  {t('transferTab.tableOption', { number: tbl.number })}
                </option>
              ))}
            </select>
            {availableTables.length === 0 && (
              <p className="text-xs text-destructive">{t('transferTab.noFreeTables')}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <POSButton
            type="button"
            disabled={transferMut.isPending || !targetTableId}
            onClick={handleSubmit}
          >
            {transferMut.isPending ? t('transferTab.moving') : t('transferTab.moveSession')}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
