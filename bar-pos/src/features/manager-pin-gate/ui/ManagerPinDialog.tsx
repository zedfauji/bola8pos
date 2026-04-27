import { useMemo, useState } from 'react';

import { useStaffList } from '@entities/staff/model/queries';
import { canAccess } from '@shared/lib/rbac';
import type { StaffAction } from '@shared/lib/rbac';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  PINKeypad,
} from '@shared/ui';

export interface ManagerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredAction: StaffAction;
  onSuccess: () => void;
}

export function ManagerPinDialog({
  open,
  onOpenChange,
  requiredAction,
  onSuccess,
}: ManagerPinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { data: staffList, isIdleOrLoading } = useStaffList();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPin('');
      setError('');
    }
    onOpenChange(next);
  }

  const eligibleStaff = useMemo(
    () => (staffList ?? []).filter(s => canAccess(s.role, requiredAction)),
    [staffList, requiredAction]
  );

  function handlePinComplete(enteredPin: string) {
    const match = eligibleStaff.find(s => s.pin === enteredPin);
    if (match) {
      onSuccess();
    } else {
      setError('Incorrect PIN. Ask a manager to enter their PIN.');
      setPin('');
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Manager Access Required</AlertDialogTitle>
          <AlertDialogDescription>
            A manager or admin PIN is required to access this section.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <PINKeypad
          value={pin}
          onChange={setPin}
          onComplete={handlePinComplete}
          label="Enter manager PIN"
          error={error}
          isLoading={isIdleOrLoading}
        />

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
