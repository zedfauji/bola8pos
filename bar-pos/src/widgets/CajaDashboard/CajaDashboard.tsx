import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { RegisterCajaEntryDialog } from '@features/register-caja-entry';
import {
  useCajaStore,
  useCurrentCaja,
  useMutationOpenCaja,
  useMutationCloseCaja,
  useCajaPaymentSummary,
  useCajaEntries,
  useMutationDeleteCajaEntry,
} from '@entities/caja';
import { useSettings } from '@entities/settings';
import { usePermissions } from '@entities/staff';
import { useStaffStore } from '@entities/staff/model/store';
import { useOpenTabsPendingTotal } from '@entities/tab';

import { printRawText } from '@shared/lib/pos-printer';
import { LoadingSpinner, MoneyDisplay } from '@shared/ui';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { POSButton } from '@shared/ui/POSButton';
import { SectionHeader } from '@shared/ui/SectionHeader';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip';

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type SummaryCardProps = {
  label: string;
  amount: number;
  isLoading: boolean;
  highlight?: string | undefined;
};

function SummaryCard({ label, amount, isLoading, highlight }: SummaryCardProps) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border p-3 ${highlight ?? ''}`}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {isLoading ? (
        <LoadingSpinner size={16} className="p-0 justify-start" />
      ) : (
        <MoneyDisplay amount={amount} size="lg" />
      )}
    </div>
  );
}

export function CajaDashboard() {
  const { can } = usePermissions();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const settings = useSettings();
  const isCajaOpen = useCajaStore(s => s.isCajaOpen);
  const currentCaja = useCajaStore(s => s.currentCaja);

  // Sync store — CajaListener already does this globally, but hook is idempotent
  useCurrentCaja();

  const openCajaMut = useMutationOpenCaja();
  const closeCajaMut = useMutationCloseCaja();

  // Payment summary
  const summaryQuery = useCajaPaymentSummary(
    isCajaOpen && currentCaja ? { id: currentCaja.id, openedAt: currentCaja.openedAt } : null
  );
  const pendingQuery = useOpenTabsPendingTotal(isCajaOpen && currentCaja ? currentCaja.id : null);

  const summaryData = summaryQuery.data?.ok ? summaryQuery.data.data : null;
  const pendingTotal = pendingQuery.data?.ok ? pendingQuery.data.data : 0;
  const isSummaryLoading = summaryQuery.isLoading;
  const isPendingLoading = pendingQuery.isLoading;

  const cash = summaryData?.cash ?? 0;
  const card = summaryData?.card ?? 0;
  const rappi = summaryData?.rappi ?? 0;

  // Caja entries
  const entriesResult = useCajaEntries(currentCaja?.id ?? null);
  const deleteCajaEntryMut = useMutationDeleteCajaEntry();
  const entries = entriesResult.data?.ok ? entriesResult.data.data : [];
  const totalExpenses = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const net = cash + card + rappi + totalIncome - totalExpenses;

  // Entry dialog state
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);

  // Open caja dialog state
  const [openDialogVisible, setOpenDialogVisible] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);

  // Close caja dialog state
  const [closeDialogVisible, setCloseDialogVisible] = useState(false);
  const [closingCash, setClosingCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  const [isPrinting, setIsPrinting] = useState(false);

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

  async function handlePrintSummary() {
    if (!currentCaja) return;
    setIsPrinting(true);

    const openedAt = formatDateTime(currentCaja.openedAt);
    const lines = [
      '================================',
      '         CAJA SUMMARY',
      '================================',
      `Opened: ${openedAt}`,
      currentCaja.openedByName ? `By: ${currentCaja.openedByName}` : '',
      '--------------------------------',
      `Cash:        $${cash.toFixed(2)}`,
      `Card:        $${card.toFixed(2)}`,
      `Rappi:       $${rappi.toFixed(2)}`,
      '--------------------------------',
      `Net Total:   $${net.toFixed(2)}`,
      `Open Tabs:   $${pendingTotal.toFixed(2)}`,
      '================================',
    ]
      .filter(l => l !== '')
      .join('\n');

    const result = await printRawText(lines, { autoCut: settings.data?.receipt.autoCut });
    setIsPrinting(false);

    if (result.ok) {
      toast.success('Summary printed.');
    } else {
      toast.error('Print failed: ' + result.error.message);
    }
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

      {/* 5-card cash intelligence summary */}
      {isCajaOpen && currentCaja !== null && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard label="Cash" amount={cash} isLoading={isSummaryLoading} />
            <SummaryCard label="Card" amount={card} isLoading={isSummaryLoading} />
            <SummaryCard label="Rappi" amount={rappi} isLoading={isSummaryLoading} />
            <SummaryCard
              label="Pending (open tabs)"
              amount={pendingTotal}
              isLoading={isPendingLoading}
              highlight="border-amber-500/40"
            />
            <SummaryCard
              label="Net"
              amount={net}
              isLoading={isSummaryLoading}
              highlight="border-emerald-500/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('manage_caja') && (
              <POSButton
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  setEntryDialogOpen(true);
                }}
              >
                Register Expense / Income
              </POSButton>
            )}
            <Link
              to="/payments"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              View Tabs →
            </Link>
          </div>

          {/* Entries list */}
          {can('manage_caja') && entries.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Recent Entries</h4>
              <div className="space-y-1">
                {entries.slice(-10).map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.type === 'expense' ? 'destructive' : 'default'}
                        className="capitalize"
                      >
                        {entry.type}
                      </Badge>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {entry.concept}
                      </span>
                      {entry.staffName && (
                        <span className="text-xs text-muted-foreground">— {entry.staffName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={
                          entry.type === 'expense'
                            ? 'text-red-400 font-mono'
                            : 'text-green-400 font-mono'
                        }
                      >
                        {entry.type === 'expense' ? '-' : '+'}${entry.amount.toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-6 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deleteCajaEntryMut.isPending}
                        onClick={() => {
                          deleteCajaEntryMut.mutate(entry.id, {
                            onSuccess: result => {
                              if (result.ok) {
                                toast.success('Entry deleted.');
                              } else {
                                toast.error(result.error.message);
                              }
                            },
                          });
                        }}
                        aria-label={`Delete entry: ${entry.concept}`}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {totalExpenses > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total expenses: <span className="text-red-400">${totalExpenses.toFixed(2)}</span>
                  {totalIncome > 0 && (
                    <>
                      {' '}
                      | Total income:{' '}
                      <span className="text-green-400">${totalIncome.toFixed(2)}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Print Summary — always visible; disabled with tooltip when no open caja */}
      <div className="flex flex-wrap items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <POSButton
                  size="sm"
                  type="button"
                  disabled={!isCajaOpen || !currentCaja || isPrinting}
                  onClick={() => {
                    void handlePrintSummary();
                  }}
                >
                  {isPrinting ? 'Printing…' : 'Print Summary'}
                </POSButton>
              </span>
            </TooltipTrigger>
            {(!isCajaOpen || !currentCaja) && (
              <TooltipContent>Open a caja session first</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Register Entry Dialog */}
      <RegisterCajaEntryDialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen} />

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
