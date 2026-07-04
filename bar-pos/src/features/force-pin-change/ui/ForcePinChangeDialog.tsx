import { toast } from 'sonner';

import type { Staff } from '@shared/lib/domain';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';

import { useForcePinChange } from '../model/useForcePinChange';

export interface ForcePinChangeDialogProps {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Manager/admin confirmation dialog that flags a staff member's account so
 * they must set a new PIN before their next login (force_pin_change RPC).
 */
export function ForcePinChangeDialog({ staff, open, onOpenChange }: ForcePinChangeDialogProps) {
  const mutation = useForcePinChange();

  async function handleConfirm(): Promise<void> {
    if (!staff) return;

    const result = await mutation.mutateAsync({ staffId: staff.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(`${staff.name}'s PIN will be changed on next login.`);
    onOpenChange(false);
  }

  return (
    <ConfirmDialog
      open={open && staff !== null}
      title={`Force PIN change for ${staff?.name ?? ''}?`}
      description={`${staff?.name ?? 'This staff member'} will be required to set a new PIN before they can log in again. This does not log them out of an active shift.`}
      confirmLabel="Force PIN change"
      cancelLabel="Cancel"
      onConfirm={handleConfirm}
      onCancel={() => {
        onOpenChange(false);
      }}
      isLoading={mutation.isPending}
    />
  );
}
