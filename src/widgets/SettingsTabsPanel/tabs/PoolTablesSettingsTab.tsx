import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useMutationAddPoolTable,
  useMutationDeletePoolTable,
  useMutationUpdatePoolTable,
  usePoolTables,
} from '@entities/pool-table';
import type { PoolTable, UserRole } from '@shared/lib/domain';
import { ConfirmDialog, Input, Label, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

type EditDraft = {
  label: string;
  ratePerHour: string;
};

export function PoolTablesSettingsTab({ currentRole }: Props) {
  const { data: tables } = usePoolTables();
  const addTable = useMutationAddPoolTable();
  const updateTable = useMutationUpdatePoolTable();
  const deleteTable = useMutationDeletePoolTable();
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
  const [deleteTarget, setDeleteTarget] = useState<PoolTable | null>(null);

  const sortedTables = useMemo(
    () => [...(tables ?? [])].sort((a, b) => a.number - b.number),
    [tables]
  );

  const getDraft = (table: PoolTable): EditDraft => {
    return (
      drafts[table.id] ?? {
        label: table.label,
        ratePerHour: String(table.ratePerHour),
      }
    );
  };

  const setDraft = (tableId: string, partial: Partial<EditDraft>) => {
    setDrafts(current => ({
      ...current,
      [tableId]: {
        label: current[tableId]?.label ?? '',
        ratePerHour: current[tableId]?.ratePerHour ?? '',
        ...partial,
      },
    }));
  };

  const handleAddTable = async () => {
    const nextNumber = Math.max(0, ...sortedTables.map(table => table.number)) + 1;
    const result = await addTable.mutateAsync({
      number: nextNumber,
      label: `Table ${String(nextNumber)}`,
      ratePerHour: sortedTables[sortedTables.length - 1]?.ratePerHour ?? 12,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Pool table added.');
  };

  const handleSaveTable = async (table: PoolTable) => {
    const draft = getDraft(table);
    const ratePerHour = Number(draft.ratePerHour);
    if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) {
      toast.error('Rate per hour must be greater than zero.');
      return;
    }
    const label = draft.label.trim();
    if (label.length === 0) {
      toast.error('Table label is required.');
      return;
    }
    const result = await updateTable.mutateAsync({ tableId: table.id, label, ratePerHour });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Updated ${label}.`);
  };

  const handleDeleteTable = async () => {
    if (!deleteTarget) return;
    const result = await deleteTable.mutateAsync({ tableId: deleteTarget.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDeleteTarget(null);
    toast.success('Pool table removed.');
  };

  return (
    <ProtectedAction
      action="manage_products"
      currentRole={currentRole}
      disabled={addTable.isPending}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Pool Tables</h2>
          <POSButton
            type="button"
            touchSize="default"
            variant="outline"
            disabled={addTable.isPending || updateTable.isPending || deleteTable.isPending}
            onClick={() => {
              void handleAddTable();
            }}
          >
            {addTable.isPending ? 'Adding...' : 'Add Table'}
          </POSButton>
        </div>
        <div className="space-y-3">
          {sortedTables.map(table => {
            const draft = getDraft(table);
            return (
              <div key={table.id} className="rounded-md border p-3">
                <div className="mb-3 text-sm font-medium text-muted-foreground">
                  Table {table.number} · Current status: {table.status}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`table-label-${table.id}`}>Label</Label>
                    <Input
                      id={`table-label-${table.id}`}
                      value={draft.label}
                      onChange={event => {
                        setDraft(table.id, { label: event.target.value });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`table-rate-${table.id}`}>Rate per hour</Label>
                    <Input
                      id={`table-rate-${table.id}`}
                      value={draft.ratePerHour}
                      onChange={event => {
                        setDraft(table.id, { ratePerHour: event.target.value });
                      }}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <POSButton
                      type="button"
                      touchSize="default"
                      disabled={updateTable.isPending || deleteTable.isPending}
                      onClick={() => {
                        void handleSaveTable(table);
                      }}
                    >
                      Save
                    </POSButton>
                    <POSButton
                      type="button"
                      touchSize="default"
                      variant="outline"
                      disabled={table.status !== 'available' || deleteTable.isPending}
                      onClick={() => {
                        setDeleteTarget(table);
                      }}
                    >
                      Remove
                    </POSButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ConfirmDialog
          open={deleteTarget != null}
          title="Remove pool table?"
          description={
            deleteTarget
              ? `Remove ${deleteTarget.label}. Only available tables can be removed.`
              : 'Remove this table.'
          }
          confirmLabel={deleteTable.isPending ? 'Removing...' : 'Remove table'}
          variant="destructive"
          isLoading={deleteTable.isPending}
          onCancel={() => {
            setDeleteTarget(null);
          }}
          onConfirm={() => {
            void handleDeleteTable();
          }}
        />
      </div>
    </ProtectedAction>
  );
}
