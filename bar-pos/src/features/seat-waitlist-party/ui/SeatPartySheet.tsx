/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useQuery } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { supabase } from '@shared/lib/supabase';
import { cn } from '@shared/lib/utils';
import {
  Button,
  LoadingSpinner,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui';
import { useSeatWaitlistParty } from '../model/useSeatWaitlistParty';

// ────────────────────────────────────────────────────────────────────────────
// Pool table data (inline query — pool-table entity not in this FSD slice)
// ────────────────────────────────────────────────────────────────────────────

type PoolTable = {
  id: string;
  label: string;
  number: number;
  status: string;
};

const db = supabase as any;

function usePoolTables() {
  return useQuery({
    // eslint-disable-next-line i18next/no-literal-string -- TanStack Query cache key, not UI copy
    queryKey: ['pool_tables'],
    queryFn: async (): Promise<PoolTable[]> => {
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder chain:
         table/column names, not UI copy */
      const { data, error } = await db
        .from('pool_tables')
        .select('id, label, number, status')
        .order('number', { ascending: true });
      /* eslint-enable i18next/no-literal-string */

      if (error) throw error;
      return (data ?? []) as PoolTable[];
    },
    staleTime: 30 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export interface SeatPartySheetProps {
  open: boolean;
  onClose: () => void;
  entryId: string;
  entryName: string;
  partySize: number;
}

export function SeatPartySheet({
  open,
  onClose,
  entryId,
  entryName,
  partySize,
}: SeatPartySheetProps) {
  const { t } = useTranslation('featMgmt');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { data: tables = [] } = usePoolTables();
  const { seatParty, isPending } = useSeatWaitlistParty();

  const availableTables = tables.filter((t) => t.status === 'available');
  const occupiedTables = tables.filter((t) => t.status !== 'available');

  function handleClose() {
    setSelectedTableId(null);
    onClose();
  }

  async function handleSeat() {
    if (!selectedTableId || isPending) return;
    const table = tables.find((t) => t.id === selectedTableId);
    if (!table) return;
    const result = await seatParty({
      entryId,
      entryName,
      tableId: selectedTableId,
      tableName: t('seatWaitlistParty.tableLabel', { number: table.number, label: table.label }),
    });
    if (result.ok) {
      handleClose();
    }
    // On error: stay open, toast shown by hook
  }

  const guestLabel =
    partySize === 1
      ? t('seatWaitlistParty.oneGuest')
      : t('seatWaitlistParty.nGuests', { count: partySize });

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      {/* Focus is trapped by Radix UI SheetContent — no explicit autoFocus needed */}
      <SheetContent side="right" className="max-w-md w-full flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>{t('seatWaitlistParty.dialogTitle')}</SheetTitle>
          <SheetDescription>
            {t('seatWaitlistParty.assignDescription', { name: entryName, guestLabel })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 py-4 flex-1 overflow-y-auto">
          {/* Available tables */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-foreground">
              {t('seatWaitlistParty.availableTables')}
            </p>
            {availableTables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('seatWaitlistParty.noTablesAvailable')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableTables.map((table) => (
                  <Button
                    key={table.id}
                    type="button"
                    variant="outline"
                    aria-pressed={selectedTableId === table.id}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-colors',
                      selectedTableId === table.id
                        ? 'border-pos-accent bg-pos-accent/10'
                        : 'hover:bg-accent',
                    )}
                    onClick={() => { setSelectedTableId(table.id); }}
                  >
                    <span className="text-base font-semibold">
                      {t('seatWaitlistParty.tableLabel', { number: table.number, label: table.label })}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Occupied tables */}
          {occupiedTables.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t('seatWaitlistParty.occupiedTables')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {occupiedTables.map((table) => (
                  <Button
                    key={table.id}
                    type="button"
                    variant="outline"
                    disabled
                    aria-label={t('seatWaitlistParty.occupiedTableAria', {
                      number: table.number,
                      label: table.label,
                    })}
                    className="rounded-lg border p-4 text-left opacity-50 cursor-not-allowed"
                  >
                    <span className="text-base font-semibold">
                      {t('seatWaitlistParty.tableLabel', { number: table.number, label: table.label })}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {t('seatWaitlistParty.occupied')}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 flex gap-3">
          <Button size="lg" variant="outline" className="flex-1" onClick={handleClose}>
            {t('seatWaitlistParty.close')}
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={!selectedTableId || isPending}
            onClick={() => { void handleSeat(); }}
          >
            {isPending ? (
              <LoadingSpinner size={16} className="p-0" />
            ) : (
              <>
                <CheckSquare className="size-4 mr-1" aria-hidden="true" />
                {t('seatWaitlistParty.seatParty')}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
