import { AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AssignPoolSessionSheet } from '@features/assign-pool-session-to-tab';
import { StartSessionSheet } from '@features/start-pool-timer';
import { StopSessionConfirm } from '@features/stop-pool-timer';
import {
  useMutationAddPoolTable,
  useMutationReleasePoolTable,
  usePoolTables,
  PoolTableCard,
} from '@entities/pool-table';
import { useAuth } from '@entities/staff/model/AuthContext';
import { useTabs } from '@entities/tab';
import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { EmptyState, POSButton, PoolTableGridSkeleton, ProtectedAction } from '@shared/ui';

export function PoolTableGrid() {
  const { profile } = useAuth();
  const { data: tables, isIdleOrLoading, isError, refetch, resultError, error } = usePoolTables();
  const { data: tabs } = useTabs();
  const addTable = useMutationAddPoolTable();
  const releaseTable = useMutationReleasePoolTable();

  const [startTable, setStartTable] = useState<PoolTable | null>(null);
  const [stopTarget, setStopTarget] = useState<{ table: PoolTable; session: PoolSession } | null>(
    null
  );
  const [assignTarget, setAssignTarget] = useState<{ sessionId: string; label: string } | null>(
    null
  );

  const openTabs = useMemo(() => (tabs ?? []).filter(t => t.status === 'open'), [tabs]);

  const availableCount = useMemo(
    () => (tables ?? []).filter(t => t.status === 'available').length,
    [tables]
  );
  const occupiedCount = useMemo(
    () => (tables ?? []).filter(t => t.status === 'occupied').length,
    [tables]
  );

  const errMsg = resultError?.message ?? error?.message ?? 'Failed to load pool tables.';

  const resolveCustomerName = (session: PoolSession | null | undefined): string | null => {
    if (!session?.tabId) return null;
    const hit = openTabs.find(t => t.id === session.tabId);
    return hit?.customerName ?? null;
  };

  const handleAddTable = async () => {
    if (!tables?.length) {
      toast.error('No existing tables to copy pricing from.');
      return;
    }
    const nextNumber = Math.max(...tables.map(t => t.number)) + 1;
    const rate = tables[tables.length - 1]?.ratePerHour ?? 12;
    const result = await addTable.mutateAsync({
      number: nextNumber,
      label: `Table ${String(nextNumber)}`,
      ratePerHour: rate,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Table added.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Pool Tables
          <span className="text-muted-foreground font-normal">
            {' '}
            | Available: {availableCount} | Occupied: {occupiedCount}
          </span>
        </h2>
        <ProtectedAction action="manage_pool_tables" currentRole={profile?.role ?? null}>
          <POSButton
            type="button"
            variant="outline"
            touchSize="default"
            disabled={addTable.isPending}
            onClick={() => {
              void handleAddTable();
            }}
          >
            {addTable.isPending ? 'Adding…' : 'Add Table'}
          </POSButton>
        </ProtectedAction>
      </div>

      {isIdleOrLoading && (
        <PoolTableGridSkeleton
          count={9}
          className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        />
      )}

      {isError && (
        <EmptyState
          icon={AlertCircle}
          title="Could not load pool tables"
          description={errMsg}
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      )}

      {!isIdleOrLoading && !isError && tables && (
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map(table => {
            const session = table.currentSession ?? null;
            return (
              <PoolTableCard
                key={table.id}
                table={table}
                session={session}
                linkedCustomerName={resolveCustomerName(session)}
                startDisabled={false}
                {...(table.status === 'available'
                  ? {
                      onStartSession: () => {
                        setStartTable(table);
                      },
                    }
                  : {})}
                {...(table.status === 'occupied' && session
                  ? {
                      onStopSession: () => {
                        setStopTarget({ table, session });
                      },
                    }
                  : {})}
                {...(table.status === 'occupied' && session && !session.tabId
                  ? {
                      onAssignToTab: () => {
                        setAssignTarget({ sessionId: session.id, label: table.label });
                      },
                    }
                  : {})}
                {...(table.status === 'reserved'
                  ? {
                      onReleaseReserved: () => {
                        void (async () => {
                          const r = await releaseTable.mutateAsync({ tableId: table.id });
                          if (!r.ok) {
                            toast.error(r.error.message);
                            return;
                          }
                          toast.success('Table released.');
                        })();
                      },
                    }
                  : {})}
              />
            );
          })}
        </div>
      )}

      <StartSessionSheet
        open={Boolean(startTable)}
        onOpenChange={open => {
          if (!open) setStartTable(null);
        }}
        table={startTable}
        openTabs={openTabs}
      />

      <StopSessionConfirm
        open={Boolean(stopTarget)}
        onOpenChange={open => {
          if (!open) setStopTarget(null);
        }}
        table={stopTarget?.table ?? null}
        session={stopTarget?.session ?? null}
        openTabs={openTabs}
      />

      <AssignPoolSessionSheet
        open={Boolean(assignTarget)}
        onOpenChange={open => {
          if (!open) setAssignTarget(null);
        }}
        sessionId={assignTarget?.sessionId ?? null}
        tableLabel={assignTarget?.label ?? ''}
        openTabs={openTabs}
      />
    </div>
  );
}
