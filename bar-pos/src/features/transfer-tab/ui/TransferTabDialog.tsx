import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useStaffList } from '@entities/staff';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@shared/lib/domain';
import { POSButton } from '@shared/ui/POSButton';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { useTransferTab } from '../useTransferTab';

export type TransferTabDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: Tab | null;
};

export function TransferTabDialog({ open, onOpenChange, tab }: TransferTabDialogProps) {
  const { t } = useTranslation('featOrders');
  const currentStaff = useStaffStore(s => s.currentStaff);
  const { data: staffList } = useStaffList();
  const transferMut = useTransferTab();

  const [newTableNumber, setNewTableNumber] = useState('');
  const [newStaffId, setNewStaffId] = useState('');

  function handleSubmit() {
    if (!tab || !currentStaff) return;
    if (!newTableNumber && !newStaffId) {
      toast.error(t('transferTab.selectTargetTabOrStaff'));
      return;
    }

    transferMut.mutate(
      {
        tabId: tab.id,
        newStaffId: newStaffId || undefined,
        newTableNumber: newTableNumber || undefined,
        transferredBy: currentStaff.id,
      },
      {
        onSuccess: result => {
          if (result.ok) {
            toast.success(t('transferTab.tabTransferred'));
            setNewTableNumber('');
            setNewStaffId('');
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
          <DialogTitle>{t('transferTab.transferTabTitle')}{tab ? ` — ${tab.customerName}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t('transferTab.fillFieldsHint')}
          </p>

          <div className="space-y-1">
            <Label htmlFor="transfer-table">{t('transferTab.newTableLabel')}</Label>
            <Input
              id="transfer-table"
              value={newTableNumber}
              onChange={e => {
                setNewTableNumber(e.target.value);
              }}
              placeholder={tab?.tableNumber != null ? String(tab.tableNumber) : t('transferTab.tableNumberPlaceholder')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="transfer-staff">{t('transferTab.assignToStaffLabel')}</Label>
            <select
              id="transfer-staff"
              value={newStaffId}
              onChange={e => {
                setNewStaffId(e.target.value);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('transferTab.keepCurrentOption')}</option>
              {(staffList ?? []).map(s => (
                <option key={s.id} value={s.id}>
                  {t('transferTab.staffOption', { name: s.name, role: s.role })}
                </option>
              ))}
            </select>
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
          <POSButton type="button" disabled={transferMut.isPending} onClick={handleSubmit}>
            {transferMut.isPending ? t('transferTab.transferring') : t('transferTab.transfer')}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
