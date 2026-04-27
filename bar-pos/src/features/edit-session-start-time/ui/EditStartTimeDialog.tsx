import { useState } from 'react';
import { toast } from 'sonner';
import type { PoolSession } from '@shared/lib/domain';
import { POSButton } from '@shared/ui';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { useEditSessionStartTime } from '../model/useEditSessionStartTime';

interface EditStartTimeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: PoolSession;
}

const toDatetimeLocal = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function EditStartTimeDialog({ open, onOpenChange, session }: EditStartTimeDialogProps) {
  const [value, setValue] = useState(() => toDatetimeLocal(session.startedAt));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { editStartTime, isPending } = useEditSessionStartTime();

  function handleClose() {
    setValue(toDatetimeLocal(session.startedAt));
    setFieldError(null);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      setFieldError('Invalid date/time value');
      return;
    }

    const result = await editStartTime(session, parsed);

    if (!result.ok) {
      const detail = result.error.detail;
      if (detail) {
        try {
          const fields = JSON.parse(detail) as Record<string, string>;
          setFieldError(fields['startedAt'] ?? result.error.message);
        } catch {
          setFieldError(result.error.message);
        }
      } else {
        setFieldError(result.error.message);
      }
      return;
    }

    toast.success('Session start time updated.');
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Session Start Time</DialogTitle>
        </DialogHeader>

        <form
          data-testid="edit-start-time-form"
          onSubmit={e => {
            void handleSubmit(e);
          }}
        >
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                Current:{' '}
                {session.startedAt.toLocaleString([], {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="start-time-input">New start time</Label>
              <Input
                id="start-time-input"
                type="datetime-local"
                value={value}
                onChange={e => {
                  setValue(e.target.value);
                }}
                disabled={isPending}
              />
              {fieldError && <p className="text-destructive text-sm">{fieldError}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <POSButton type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </POSButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
