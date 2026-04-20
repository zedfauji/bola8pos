import { useState } from 'react';
import { toast } from 'sonner';
import { usePoolTables } from '@entities/pool-table';
import { useStaffStore } from '@entities/staff/model/store';
import type { PoolSession, PoolTable } from '@shared/lib/domain';
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
  const currentStaff = useStaffStore(s => s.currentStaff);
  const { data: tables } = usePoolTables();
  const transferMut = useTransferPoolSession();

  const [targetTableId, setTargetTableId] = useState('');

  const availableTables = (tables ?? []).filter(
    (t: PoolTable) => t.status === 'available' && t.id !== session?.tableId
  );

  function handleSubmit() {
    if (!session || !currentStaff || !targetTableId) {
      toast.error('Select a target pool table.');
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
            toast.success('Pool session moved. Timer continues from original start time.');
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
          <DialogTitle>Move Pool Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Session time is preserved — billing continues from when it started.
          </p>

          <div className="space-y-1">
            <Label htmlFor="target-table">Target Pool Table</Label>
            <select
              id="target-table"
              value={targetTableId}
              onChange={e => {
                setTargetTableId(e.target.value);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— select table —</option>
              {availableTables.map((t: PoolTable) => (
                <option key={t.id} value={t.id}>
                  Table {String(t.number)}
                </option>
              ))}
            </select>
            {availableTables.length === 0 && (
              <p className="text-xs text-destructive">No free pool tables available.</p>
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
            Cancel
          </Button>
          <POSButton
            type="button"
            disabled={transferMut.isPending || !targetTableId}
            onClick={handleSubmit}
          >
            {transferMut.isPending ? 'Moving…' : 'Move Session'}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
