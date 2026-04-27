import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useMutationClockOut, useShiftClosePreview } from '@entities/staff/model/queries';
import type { Shift, Staff } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { ConfirmDialog, MoneyDisplay, MoneyInput } from '@shared/ui';

export type ClockOutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  shift: Shift | null;
};

function formatDurationMs(ms: number): string {
  const totalM = Math.floor(ms / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  if (h <= 0) return `${String(m)}m`;
  return `${String(h)}h ${String(m)}m`;
}

export function ClockOutDialog({ open, onOpenChange, staff, shift }: ClockOutDialogProps) {
  const [closingCash, setClosingCash] = useState(0);
  const [durationMs, setDurationMs] = useState(() =>
    shift ? Date.now() - shift.clockIn.getTime() : 0
  );
  const clockOut = useMutationClockOut();
  const previewQuery = useShiftClosePreview(shift?.id ?? null, staff?.id ?? null);

  useEffect(() => {
    if (!open || !shift) return;
    const id = window.setInterval(() => {
      setDurationMs(Date.now() - shift.clockIn.getTime());
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, [open, shift]);

  const summary = previewQuery.data;
  const effectiveOpen = open && staff != null && shift != null;

  const handleConfirm = async (): Promise<void> => {
    if (!staff || !shift) return;
    const result = await clockOut.mutateAsync({
      shiftId: shift.id,
      staffId: staff.id,
      closingCash,
    });
    if (!result.ok) {
      logger.error('clock_out_dialog.failed', { message: result.error.message });
      toast.error(result.error.message);
      return;
    }
    toast.success(`${staff.name} clocked out.`);
    onOpenChange(false);
    setClosingCash(0);
  };

  return (
    <ConfirmDialog
      open={effectiveOpen}
      title="End shift?"
      description={staff && shift ? `Close shift for ${staff.name}.` : ''}
      confirmLabel="Clock out"
      variant="destructive"
      onConfirm={() => {
        void handleConfirm();
      }}
      onCancel={() => {
        onOpenChange(false);
      }}
      isLoading={clockOut.isPending}
      confirmDisabled={clockOut.isPending}
    >
      {staff && shift ? (
        <div className="space-y-4 py-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Shift duration</span>
            <span className="font-medium tabular-nums">{formatDurationMs(durationMs)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Clock in</span>
            <span className="font-medium tabular-nums">
              {shift.clockIn.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          {previewQuery.isIdleOrLoading && (
            <p className="text-muted-foreground text-xs">Loading shift totals…</p>
          )}
          {summary && (
            <>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Orders taken</span>
                <span className="font-medium">{String(summary.orderCount)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Sales (payments)</span>
                <MoneyDisplay amount={summary.totalSales} size="sm" />
              </div>
            </>
          )}
          <MoneyInput
            label="Closing cash count"
            value={closingCash}
            onChange={setClosingCash}
            disabled={clockOut.isPending}
            placeholder="0.00"
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
