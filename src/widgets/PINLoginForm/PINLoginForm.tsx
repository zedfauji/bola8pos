import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLoginUiStore } from '@entities/staff/model/loginUiStore';
import { useMutationClockIn } from '@entities/staff/model/queries';
import { useStaffStore } from '@entities/staff/model/store';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { PINKeypad } from '@shared/ui/PINKeypad';

type Phase = 'pin' | 'opening_cash';

export function PINLoginForm() {
  const selectedStaff = useLoginUiStore(s => s.selectedStaff);
  const clearSelection = useLoginUiStore(s => s.clearSelection);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('pin');
  const [openingCash, setOpeningCash] = useState(0);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const navigate = useNavigate();
  const clockInMutation = useMutationClockIn();

  if (!selectedStaff) return null;

  const handlePinComplete = async (enteredPin: string): Promise<void> => {
    if (enteredPin !== selectedStaff.pin) {
      setError('Incorrect PIN. Try again.');
      setPin('');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: selectedStaff.email,
      password: enteredPin,
    });
    if (signInError) {
      logger.error('login.supabase_sign_in_failed', { message: signInError.message });
      setError('Sign-in failed. Please try again or contact your manager.');
      setPin('');
      return;
    }

    // Check for an existing open shift — if found, resume it instead of starting a new one.
    const { data: existingShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('staff_id', selectedStaff.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .single();

    if (existingShift) {
      useStaffStore.getState().login(selectedStaff, {
        id: existingShift.id,
        staffId: existingShift.staff_id,
        clockIn: new Date(existingShift.clock_in),
        clockOut: null,
        openingCash: existingShift.opening_cash,
        closingCash: existingShift.closing_cash,
      });
      clearSelection();
      navigate('/home');
      return;
    }

    // No open shift — ask for opening cash to start a new one.
    setPhase('opening_cash');
    setOpeningCash(0);
  };

  const handleOpeningCashCancel = () => {
    setPhase('pin');
    setPin('');
    setOpeningCash(0);
  };

  const handleOpeningCashConfirm = async (): Promise<void> => {
    setIsClockingIn(true);
    try {
      const result = await clockInMutation.mutateAsync({
        staffId: selectedStaff.id,
        openingCash,
      });

      if (!result.ok) {
        logger.error('login.clock_in.failed', { message: result.error.message });
        toast.error(result.error.message);
        return;
      }

      useStaffStore.getState().login(selectedStaff, result.data);
      clearSelection();
      navigate('/home');
    } finally {
      setIsClockingIn(false);
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    if (error) setError('');
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-xs">
      <div className="text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-2xl mx-auto mb-2">
          {selectedStaff.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{selectedStaff.name}</h2>
        <p className="text-sm text-muted-foreground capitalize">{selectedStaff.role}</p>
      </div>

      {phase === 'pin' && (
        <PINKeypad
          value={pin}
          onChange={handlePinChange}
          onComplete={pin => {
            void handlePinComplete(pin);
          }}
          label="Enter PIN"
          error={error}
        />
      )}

      {phase === 'opening_cash' && (
        <p className="text-center text-sm text-muted-foreground">
          Enter opening cash float, then confirm.
        </p>
      )}

      <button
        type="button"
        onClick={clearSelection}
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Not you? Go back
      </button>

      <ConfirmDialog
        open={phase === 'opening_cash'}
        title="Opening cash"
        description="Enter the cash drawer float for this shift. You can use zero if nothing is counted yet."
        confirmLabel="Start shift"
        cancelLabel="Back"
        onConfirm={handleOpeningCashConfirm}
        onCancel={handleOpeningCashCancel}
        isLoading={isClockingIn}
        confirmDisabled={isClockingIn}
      >
        <div className="py-4">
          <MoneyInput
            label="Drawer float"
            value={openingCash}
            onChange={setOpeningCash}
            disabled={isClockingIn}
            placeholder="0.00"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
