import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StartSessionSheet } from '@features/start-pool-timer';
import { StopSessionConfirm } from '@features/stop-pool-timer';
import {
  useMutationAddPoolTable,
  useMutationReleasePoolTable,
  usePoolTables,
  PoolTableCard,
} from '@entities/pool-table';
import { useSettings } from '@entities/settings';
import { useStaffStore } from '@entities/staff/model/store';
import { usePermissions } from '@entities/staff/model/usePermissions';
import { useTabs } from '@entities/tab';
import type { PoolSession, PoolTable, PoolTableType } from '@shared/lib/domain';
import { rbacDenialMessage } from '@shared/lib/rbac';
import { usePersistedBool } from '@shared/lib/usePersistedBool';
import { EmptyState, POSButton, PoolTableGridSkeleton, ProtectedAction } from '@shared/ui';

type TypeFilter = 'all' | PoolTableType;

const TYPE_FILTER_LABELS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pool', label: 'Pool' },
  { value: 'carom', label: 'Carom' },
  { value: 'consumption', label: 'Consumption' },
];

export function PoolTableGrid() {
  const navigate = useNavigate();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const { can } = usePermissions();
  const { data: tables, isIdleOrLoading, isError, refetch, resultError, error } = usePoolTables();
  const { data: tabs } = useTabs();
  const { data: settings } = useSettings();
  const firstHourMode = settings?.billing.firstHourMode ?? 'prorated';
  const addTable = useMutationAddPoolTable();
  const releaseTable = useMutationReleasePoolTable();

  const [startTable, setStartTable] = useState<PoolTable | null>(null);
  const [stopTarget, setStopTarget] = useState<{ table: PoolTable; session: PoolSession } | null>(
    null
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filtersCollapsed, setFiltersCollapsed] = usePersistedBool('pool_filters_collapsed', false);

  const openTabs = useMemo(() => (tabs ?? []).filter(t => t.status === 'open'), [tabs]);

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (typeFilter === 'all') return tables;
    return tables.filter(t => t.tableType === typeFilter);
  }, [tables, typeFilter]);

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
        <ProtectedAction action="manage_settings" currentRole={currentStaff?.role ?? null}>
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

      {/* Type filter buttons */}
      <div className="space-y-2">
        <POSButton
          type="button"
          variant="ghost"
          touchSize="default"
          data-testid="pool-filters-toggle"
          aria-expanded={!filtersCollapsed}
          onClick={() => {
            setFiltersCollapsed(prev => !prev);
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {filtersCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Filters
        </POSButton>
        {!filtersCollapsed && (
          <div data-testid="pool-filters" className="flex flex-wrap gap-2">
            {TYPE_FILTER_LABELS.map(({ value, label }) => (
              <POSButton
                key={value}
                type="button"
                touchSize="default"
                variant={typeFilter === value ? 'default' : 'outline'}
                onClick={() => {
                  setTypeFilter(value);
                }}
              >
                {label}
              </POSButton>
            ))}
          </div>
        )}
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
          {filteredTables.map(table => {
            const session = table.currentSession ?? null;
            return (
              <PoolTableCard
                key={table.id}
                table={table}
                session={session}
                linkedCustomerName={resolveCustomerName(session)}
                firstHourMode={firstHourMode}
                startDisabled={!can('start_pool_timer')}
                {...(!can('start_pool_timer')
                  ? { startDisabledTitle: rbacDenialMessage('start_pool_timer') }
                  : {})}
                stopDisabled={!can('stop_pool_timer')}
                {...(!can('stop_pool_timer')
                  ? { stopDisabledTitle: rbacDenialMessage('stop_pool_timer') }
                  : {})}
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
                {...(table.status === 'occupied'
                  ? {
                      onViewStatus: () => {
                        navigate(`/pool-tables/${table.id}`);
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
    </div>
  );
}
