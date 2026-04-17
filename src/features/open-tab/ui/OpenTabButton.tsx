/**
 * OPEN TAB BUTTON
 *
 * Triggers the open-tab flow using the currently logged-in staff member.
 * Requires an active shift — staff must clock in before opening tabs.
 */

import { useState } from 'react';
import { useAuthStore } from '@entities/staff/model/authStore';
import { POSButton } from '@shared/ui/POSButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { useOpenTab } from '../model/useOpenTab';

export function OpenTabButton() {
  const { openTab, isPending } = useOpenTab();
  const selectedStaff = useAuthStore(s => s.selectedStaff);
  const currentShiftId = useAuthStore(s => s.currentShiftId);
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [submitError, setSubmitError] = useState('');

  const canOpen = !!selectedStaff && !!currentShiftId;

  const handleOpenTab = async () => {
    if (!selectedStaff?.id || !currentShiftId) {
      setSubmitError('No active shift. Please clock in before opening tabs.');
      return;
    }
    setSubmitError('');

    const result = await openTab({
      customerName: customerName.trim() || 'Guest',
      tableNumber: tableNumber ? parseInt(tableNumber, 10) : null,
      staffId: selectedStaff.id,
      shiftId: currentShiftId,
      status: 'open',
      notes: null,
      items: [],
    });

    if (result.ok) {
      setIsOpen(false);
      setCustomerName('');
      setTableNumber('');
    } else {
      setSubmitError(result.error.message);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open);
        if (!open) {
          setSubmitError('');
        }
      }}
    >
      <DialogTrigger asChild>
        <POSButton touchSize="large" variant="default" disabled={!selectedStaff}>
          Open Tab
        </POSButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Tab</DialogTitle>
          <DialogDescription>Enter customer name and optional table number</DialogDescription>
        </DialogHeader>

        {!canOpen && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            No active shift — clock in before opening tabs.
          </p>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              placeholder="Guest"
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value);
              }}
              disabled={isPending || !canOpen}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tableNumber">Table Number (Optional)</Label>
            <Input
              id="tableNumber"
              type="number"
              min="1"
              max="200"
              placeholder="Leave empty if no table"
              value={tableNumber}
              onChange={e => {
                setTableNumber(e.target.value);
              }}
              disabled={isPending || !canOpen}
            />
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <POSButton
            touchSize="large"
            variant="default"
            onClick={() => {
              void handleOpenTab();
            }}
            disabled={isPending || !canOpen}
          >
            {isPending ? 'Opening...' : 'Open Tab'}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
