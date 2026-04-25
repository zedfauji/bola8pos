/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Table2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@shared/lib/supabase';
import { cn } from '@shared/lib/utils';
import { EmptyState } from '@shared/ui';

// ────────────────────────────────────────────────────────────────────────────
// Pool tables inline query (no @entities/pool-table entity yet)
// ────────────────────────────────────────────────────────────────────────────
const db = supabase as any;

type PoolTable = { id: string; name: string; status: string };

function usePoolTables() {
  return useQuery({
    queryKey: ['pool_tables'],
    queryFn: async (): Promise<PoolTable[]> => {
      const { data, error } = await db
        .from('pool_tables')
        .select('id, name, status')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PoolTable[];
    },
    staleTime: 30 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PoolTableOccupancyPanel() {
  const { data: tables = [], isLoading } = usePoolTables();
  const available = tables.filter(
    (t) => t.status === 'available' || t.status === 'idle' || t.status === 'free',
  );

  if (isLoading) return null;

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={Table2}
        title="No tables configured"
        description="Configure pool tables in Settings."
      />
    );
  }

  return (
    <div className="space-y-3" aria-label="Pool table occupancy">
      <h2 className="text-lg font-semibold">Tables</h2>

      {/* Summary row */}
      <div className="flex items-center gap-3 text-sm" role="status">
        <div className="flex items-center gap-1 text-pos-accent">
          <span className="text-2xl font-semibold font-mono">{available.length}</span>
          <span>available</span>
        </div>
        <div className="text-muted-foreground">/</div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="font-mono">{tables.length}</span>
          <span>total</span>
        </div>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-2 gap-2">
        {tables.map((table) => {
          const isAvailable =
            table.status === 'available' || table.status === 'idle' || table.status === 'free';
          return (
            <div
              key={table.id}
              className={cn(
                'rounded-md border p-3',
                isAvailable
                  ? 'border-pos-accent/50 bg-pos-accent/5'
                  : 'border-pos-danger/50 bg-pos-danger/5 opacity-75',
              )}
            >
              <span className="block text-sm font-semibold">{table.name}</span>
              <span className="text-sm text-muted-foreground">
                {isAvailable ? 'Free' : 'Occupied'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
