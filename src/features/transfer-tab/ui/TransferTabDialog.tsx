import { useState } from 'react';
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
  const currentStaff = useStaffStore(s => s.currentStaff);
  const { data: staffList } = useStaffList();
  const transferMut = useTransferTab();

  const [newTableNumber, setNewTableNumber] = useState('');
  const [newStaffId, setNewStaffId] = useState('');

  function handleSubmit() {
    if (!tab || !currentStaff) return;
    if (!newTableNumber && !newStaffId) {
      toast.error('Select a new table or staff member to transfer to.');
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
            toast.success('Tab transferred successfully.');
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
          <DialogTitle>Transfer Tab{tab ? ` — ${tab.customerName}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Fill in the field(s) you want to change. Leave blank to keep unchanged.
          </p>

          <div className="space-y-1">
            <Label htmlFor="transfer-table">New Table</Label>
            <Input
              id="transfer-table"
              value={newTableNumber}
              onChange={e => {
                setNewTableNumber(e.target.value);
              }}
              placeholder={tab?.tableNumber != null ? String(tab.tableNumber) : 'Table number'}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="transfer-staff">Assign to Staff</Label>
            <select
              id="transfer-staff"
              value={newStaffId}
              onChange={e => {
                setNewStaffId(e.target.value);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— keep current —</option>
              {(staffList ?? []).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
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
            Cancel
          </Button>
          <POSButton type="button" disabled={transferMut.isPending} onClick={handleSubmit}>
            {transferMut.isPending ? 'Transferring…' : 'Transfer'}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
