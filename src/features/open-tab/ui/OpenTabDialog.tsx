import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useStaffStore } from '@entities/staff/model/store';
import { useMutationOpenTab } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { CreateTab } from '@entities/tab/model/types';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

const FormSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required'),
  tableNumber: z
    .number()
    .int()
    .min(1, 'Table number must be between 1 and 200')
    .max(200, 'Table number must be between 1 and 200')
    .optional(),
});

interface OpenTabDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OpenTabDialog({ open, onClose }: OpenTabDialogProps) {
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shiftError, setShiftError] = useState('');

  const currentStaff = useStaffStore(s => s.currentStaff);
  const currentShift = useStaffStore(s => s.currentShift);
  const mutation = useMutationOpenTab();

  const canOpen = Boolean(currentStaff?.id && currentShift?.id);
  const isSubmitting = mutation.isPending;

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setShiftError('');

    let parsedTable: number | undefined;
    if (tableNumber.trim() !== '') {
      const n = parseInt(tableNumber, 10);
      if (Number.isNaN(n)) {
        setErrors({ tableNumber: 'Enter a valid table number' });
        return;
      }
      parsedTable = n;
    }

    const validation = FormSchema.safeParse({
      customerName,
      tableNumber: parsedTable,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach(issue => {
        const key = issue.path[0];
        if (key !== undefined) {
          fieldErrors[String(key)] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!currentStaff?.id || !currentShift?.id) {
      setShiftError('No active shift. Clock in before opening tabs.');
      return;
    }

    const v = validation.data;
    const payload: CreateTab = {
      customerName: v.customerName,
      tableNumber: v.tableNumber ?? null,
      staffId: currentStaff.id,
      shiftId: currentShift.id,
      status: 'open',
      notes: null,
      items: [],
    };

    const result = await mutation.mutateAsync(payload);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    useTabStore.getState().selectTab(result.data.id);
    toast.success(`Tab opened for ${result.data.customerName}`);

    setCustomerName('');
    setTableNumber('');
    onClose();
  };

  const handleClose = () => {
    setCustomerName('');
    setTableNumber('');
    setErrors({});
    setShiftError('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Tab</DialogTitle>
          <DialogDescription>Create a new tab for a customer or table</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            void handleSubmit(e);
          }}
        >
          <div className="space-y-4 py-4">
            {!canOpen && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                No active shift — clock in before opening tabs.
              </p>
            )}
            {shiftError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {shiftError}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="customerName">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);
                }}
                placeholder="Enter customer name"
                disabled={isSubmitting}
              />
              {errors.customerName && (
                <p className="text-sm text-destructive">{errors.customerName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tableNumber">Table Number (Optional)</Label>
              <Input
                id="tableNumber"
                type="number"
                value={tableNumber}
                onChange={e => {
                  setTableNumber(e.target.value);
                }}
                placeholder="Enter table number"
                min="1"
                max="200"
                disabled={isSubmitting}
              />
              {errors.tableNumber && (
                <p className="text-sm text-destructive">{errors.tableNumber}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canOpen}>
              {isSubmitting ? 'Opening...' : 'Open Tab'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
