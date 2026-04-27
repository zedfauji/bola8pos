import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useMutationClockIn } from '@entities/staff/model/queries';
import { useStaffStore } from '@entities/staff/model/store';
import type { Staff } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { ConfirmDialog, MoneyInput, PINKeypad } from '@shared/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';

type Phase = 'pin' | 'opening_cash';

export type ClockInModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Staff member clocking in (must not already have an open shift). */
  staff: Staff | null;
};

export function ClockInModal({ open, onOpenChange, staff }: ClockInModalProps) {
  const [phase, setPhase] = useState<Phase>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [busy, setBusy] = useState(false);

  const clockIn = useMutationClockIn();
  const currentStaffId = useStaffStore(s => s.currentStaff?.id);

  useEffect(() => {
    if (!open) {
      setPhase('pin');
      setPin('');
      setPinError('');
      setOpeningCash(0);
      setBusy(false);
    }
  }, [open]);

  if (!staff) return null;

  const handlePinComplete = (entered: string) => {
    if (entered === staff.pin) {
      setPhase('opening_cash');
      setOpeningCash(0);
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  const handleOpeningConfirm = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await clockIn.mutateAsync({ staffId: staff.id, openingCash });
      if (!result.ok) {
        logger.error('clock_in_modal.failed', { message: result.error.message });
        toast.error(result.error.message);
        return;
      }
      if (currentStaffId === staff.id) {
        useStaffStore.getState().login(staff, result.data);
      }
      toast.success(`${staff.name} is clocked in.`);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clock in</DialogTitle>
          <DialogDescription>
            Verify PIN and enter opening drawer float for {staff.name}.
          </DialogDescription>
        </DialogHeader>

        {phase === 'pin' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {staff.name.charAt(0).toUpperCase()}
            </div>
            <PINKeypad
              value={pin}
              onChange={v => {
                setPin(v);
                if (pinError) setPinError('');
              }}
              onComplete={handlePinComplete}
              label="Enter PIN"
              error={pinError}
            />
          </div>
        )}

        <ConfirmDialog
          open={phase === 'opening_cash'}
          title="Opening cash"
          description="Enter the cash drawer float for this shift. Use zero if not counted yet."
          confirmLabel="Start shift"
          cancelLabel="Back"
          onConfirm={() => {
            void handleOpeningConfirm();
          }}
          onCancel={() => {
            setPhase('pin');
            setPin('');
          }}
          isLoading={busy}
          confirmDisabled={busy}
        >
          <div className="py-4">
            <MoneyInput
              label="Drawer float"
              value={openingCash}
              onChange={setOpeningCash}
              disabled={busy}
              placeholder="0.00"
            />
          </div>
        </ConfirmDialog>
      </DialogContent>
    </Dialog>
  );
}
