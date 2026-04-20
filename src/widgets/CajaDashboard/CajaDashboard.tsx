import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCajaStore,
  useCurrentCaja,
  useMutationOpenCaja,
  useMutationCloseCaja,
} from '@entities/caja';
import { usePermissions } from '@entities/staff';
import { useStaffStore } from '@entities/staff/model/store';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { POSButton } from '@shared/ui/POSButton';
import { SectionHeader } from '@shared/ui/SectionHeader';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CajaDashboard() {
  const { can } = usePermissions();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const isCajaOpen = useCajaStore(s => s.isCajaOpen);
  const currentCaja = useCajaStore(s => s.currentCaja);

  // Sync store — CajaListener already does this globally, but hook is idempotent
  useCurrentCaja();

  const openCajaMut = useMutationOpenCaja();
  const closeCajaMut = useMutationCloseCaja();

  // Open caja dialog state
  const [openDialogVisible, setOpenDialogVisible] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);

  // Close caja dialog state
  const [closeDialogVisible, setCloseDialogVisible] = useState(false);
  const [closingCash, setClosingCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  function handleOpenCaja() {
    if (!currentStaff) return;
    openCajaMut.mutate(
      { openingCash, openedBy: currentStaff.id },
      {
        onSuccess: result => {
          if (result.ok) {
            toast.success('Caja opened successfully.');
            setOpenDialogVisible(false);
            setOpeningCash(0);
          } else {
            toast.error(result.error.message);
          }
        },
      }
    );
  }

  function handleCloseCaja() {
    if (!currentCaja || !currentStaff) return;
    closeCajaMut.mutate(
      {
        cajaId: currentCaja.id,
        closedBy: currentStaff.id,
        closingCash,
        notes: closeNotes || undefined,
      },
      {
        onSuccess: result => {
          if (result.ok) {
            toast.success('Caja closed successfully.');
            setCloseDialogVisible(false);
            setClosingCash(0);
            setCloseNotes('');
          } else {
            const msg =
              result.error.code === 'OPEN_TABS_EXIST'
                ? `Cannot close caja — there are open tabs. Close all tabs first.`
                : result.error.message;
            toast.error(msg);
          }
        },
      }
    );
  }

  if (!can('manage_caja')) return null;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <SectionHeader
        title="Caja"
        description="Daily business session. All tabs require an open caja."
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={isCajaOpen ? 'default' : 'secondary'}>
            {isCajaOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>

        {currentCaja && (
          <>
            <div className="text-sm text-muted-foreground">
              Opened:{' '}
              <span className="text-foreground">{formatDateTime(currentCaja.openedAt)}</span>
            </div>
            {currentCaja.openedByName && (
              <div className="text-sm text-muted-foreground">
                By: <span className="text-foreground">{currentCaja.openedByName}</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Opening cash:{' '}
              <span className="text-foreground font-mono">
                ${currentCaja.openingCash.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isCajaOpen && (
          <POSButton
            type="button"
            size="sm"
            onClick={() => {
              setOpenDialogVisible(true);
            }}
          >
            Open Caja
          </POSButton>
        )}
        {isCajaOpen && currentCaja && (
          <POSButton
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              setCloseDialogVisible(true);
            }}
          >
            Close Caja
          </POSButton>
        )}
      </div>

      {/* Open Caja Dialog */}
      <Dialog open={openDialogVisible} onOpenChange={setOpenDialogVisible}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <MoneyInput
              label="Opening Cash"
              value={openingCash}
              onChange={setOpeningCash}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpenDialogVisible(false);
              }}
            >
              Cancel
            </Button>
            <POSButton type="button" disabled={openCajaMut.isPending} onClick={handleOpenCaja}>
              {openCajaMut.isPending ? 'Opening…' : 'Open Caja'}
            </POSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Caja Dialog */}
      <Dialog open={closeDialogVisible} onOpenChange={setCloseDialogVisible}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <MoneyInput
              label="Closing Cash Count"
              value={closingCash}
              onChange={setClosingCash}
              placeholder="0.00"
            />
            <div className="space-y-1">
              <label htmlFor="close-notes" className="text-sm font-medium">
                Notes (optional)
              </label>
              <textarea
                id="close-notes"
                value={closeNotes}
                onChange={e => {
                  setCloseNotes(e.target.value);
                }}
                placeholder="End of day notes…"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCloseDialogVisible(false);
              }}
            >
              Cancel
            </Button>
            <POSButton
              type="button"
              variant="destructive"
              disabled={closeCajaMut.isPending}
              onClick={handleCloseCaja}
            >
              {closeCajaMut.isPending ? 'Closing…' : 'Close Caja'}
            </POSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
