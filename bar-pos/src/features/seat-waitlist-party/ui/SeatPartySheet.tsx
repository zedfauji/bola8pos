/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useQuery } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import { useState } from 'react';

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
    queryKey: ['pool_tables'],
    queryFn: async (): Promise<PoolTable[]> => {
      const { data, error } = await db
        .from('pool_tables')
        .select('id, label, number, status')
        .order('number', { ascending: true });

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
      tableName: 'Table ' + String(table.number) + ' – ' + table.label,
    });
    if (result.ok) {
      handleClose();
    }
    // On error: stay open, toast shown by hook
  }

  const guestLabel = partySize === 1 ? '1 guest' : `${String(partySize)} guests`;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <SheetContent side="right" className="max-w-md w-full flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>Seat party</SheetTitle>
          <SheetDescription>
            Assign {entryName} ({guestLabel}) to a table.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 py-4 flex-1 overflow-y-auto">
          {/* Available tables */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-foreground">Available tables</p>
            {availableTables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tables available right now.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    aria-pressed={selectedTableId === table.id}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-colors',
                      selectedTableId === table.id
                        ? 'border-pos-accent bg-pos-accent/10'
                        : 'hover:bg-accent',
                    )}
                    onClick={() => { setSelectedTableId(table.id); }}
                  >
                    <span className="text-base font-semibold">Table {table.number} – {table.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Occupied tables */}
          {occupiedTables.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-muted-foreground">Occupied tables</p>
              <div className="grid grid-cols-2 gap-3">
                {occupiedTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    disabled
                    aria-label={`Table ${String(table.number)} – ${table.label}: occupied`}
                    className="rounded-lg border p-4 text-left opacity-50 cursor-not-allowed"
                  >
                    <span className="text-base font-semibold">Table {table.number} – {table.label}</span>
                    <span className="block text-sm text-muted-foreground">Occupied</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Close
          </Button>
          <Button
            className="flex-1"
            disabled={!selectedTableId || isPending}
            onClick={() => { void handleSeat(); }}
          >
            {isPending ? (
              <LoadingSpinner size={16} className="p-0" />
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-1" aria-hidden="true" />
                Seat party
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
