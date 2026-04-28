import { useState } from 'react';
import { toast } from 'sonner';
import { useMutationUpdateStaffRole } from '@entities/staff/model/queries';
import type { Staff } from '@shared/lib/domain';
import { UserRoleSchema } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';

export type EditRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
  currentStaffId: string | null;
  preSelectedStaffId: string | undefined;
};

const ROLE_OPTIONS = UserRoleSchema.options;

export function EditRoleDialog({
  open,
  onOpenChange,
  staff,
  currentStaffId,
  preSelectedStaffId,
}: EditRoleDialogProps) {
  const editableStaff = staff.filter(s => s.id !== currentStaffId);

  const [selectedStaffId, setSelectedStaffId] = useState<string>(preSelectedStaffId ?? '');
  const [selectedRole, setSelectedRole] = useState<string>('');

  const mutation = useMutationUpdateStaffRole();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedStaffId('');
      setSelectedRole('');
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!selectedStaffId || !selectedRole) return;

    const parsed = UserRoleSchema.safeParse(selectedRole);
    if (!parsed.success) {
      toast.error('Invalid role selected.');
      return;
    }

    const result = await mutation.mutateAsync({
      staffId: selectedStaffId,
      role: parsed.data,
    });

    if (!result.ok) {
      logger.error('edit-staff-role.submit.failed', { message: result.error.message });
      toast.error('Failed to update role', { description: result.error.message });
      return;
    }

    const member = editableStaff.find(s => s.id === selectedStaffId);
    toast.success('Role updated', {
      description: `${member?.name ?? 'Staff'} is now a ${parsed.data}.`,
    });
    handleOpenChange(false);
  }

  const canSubmit = Boolean(selectedStaffId) && Boolean(selectedRole) && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Staff Role</DialogTitle>
          <DialogDescription>
            Change the role for a team member. You cannot change your own role.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-role-staff">Staff member</Label>
            <Select
              value={selectedStaffId}
              onValueChange={setSelectedStaffId}
              disabled={editableStaff.length === 0}
            >
              <SelectTrigger id="edit-role-staff">
                <SelectValue placeholder="Select staff…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {editableStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-role-role">New role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="edit-role-role">
                <SelectValue placeholder="Select role…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ROLE_OPTIONS.map(role => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {editableStaff.length === 0 && (
            <p className="text-sm text-muted-foreground">No other staff members to edit.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleOpenChange(false);
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
