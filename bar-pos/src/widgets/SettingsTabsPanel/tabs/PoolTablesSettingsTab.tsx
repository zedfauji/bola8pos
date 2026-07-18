import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useMutationAddPoolTable,
  useMutationDeletePoolTable,
  useMutationUpdatePoolTable,
  usePoolTables,
} from '@entities/pool-table';
import type { PoolTable, PoolTableType, UserRole } from '@shared/lib/domain';
import { ConfirmDialog, Input, Label, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

type EditDraft = {
  label: string;
  ratePerHour: string;
  tableType: PoolTableType;
};

export function PoolTablesSettingsTab({ currentRole }: Props) {
  const { t } = useTranslation('wAdmin');
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
        tableType: table.tableType,
      }
    );
  };

  const setDraft = (tableId: string, partial: Partial<EditDraft>) => {
    setDrafts(current => ({
      ...current,
      [tableId]: {
        label: current[tableId]?.label ?? '',
        ratePerHour: current[tableId]?.ratePerHour ?? '',
        tableType: current[tableId]?.tableType ?? 'pool',
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
    toast.success(t('poolTablesSettingsTab.tableAdded'));
  };

  const handleSaveTable = async (table: PoolTable) => {
    const draft = getDraft(table);
    const ratePerHour = Number(draft.ratePerHour);
    if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) {
      toast.error(t('poolTablesSettingsTab.rateMustBeGreaterThanZero'));
      return;
    }
    const label = draft.label.trim();
    if (label.length === 0) {
      toast.error(t('poolTablesSettingsTab.labelRequired'));
      return;
    }
    const result = await updateTable.mutateAsync({
      tableId: table.id,
      label,
      ratePerHour,
      tableType: draft.tableType,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t('poolTablesSettingsTab.tableUpdated', { label }));
  };

  const handleDeleteTable = async () => {
    if (!deleteTarget) return;
    const result = await deleteTable.mutateAsync({ tableId: deleteTarget.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDeleteTarget(null);
    toast.success(t('poolTablesSettingsTab.tableRemoved'));
  };

  return (
    <ProtectedAction
      action="manage_products"
      currentRole={currentRole}
      disabled={addTable.isPending}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">{t('poolTablesSettingsTab.title')}</h2>
          <POSButton
            type="button"
            touchSize="default"
            variant="outline"
            disabled={addTable.isPending || updateTable.isPending || deleteTable.isPending}
            onClick={() => {
              void handleAddTable();
            }}
          >
            {addTable.isPending
              ? t('poolTablesSettingsTab.adding')
              : t('poolTablesSettingsTab.addTable')}
          </POSButton>
        </div>
        <div className="space-y-3">
          {sortedTables.map(table => {
            const draft = getDraft(table);
            return (
              <div key={table.id} className="rounded-md border p-3">
                <div className="mb-3 text-sm font-medium text-muted-foreground">
                  {t('poolTablesSettingsTab.tableStatusLine', {
                    number: table.number,
                    status: table.status,
                  })}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`table-label-${table.id}`}>
                      {t('poolTablesSettingsTab.labelLabel')}
                    </Label>
                    <Input
                      id={`table-label-${table.id}`}
                      value={draft.label}
                      onChange={event => {
                        setDraft(table.id, { label: event.target.value });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`table-rate-${table.id}`}>
                      {t('poolTablesSettingsTab.ratePerHourLabel')}
                    </Label>
                    <Input
                      id={`table-rate-${table.id}`}
                      value={draft.ratePerHour}
                      onChange={event => {
                        setDraft(table.id, { ratePerHour: event.target.value });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`table-type-${table.id}`}>
                      {t('poolTablesSettingsTab.typeLabel')}
                    </Label>
                    <select
                      id={`table-type-${table.id}`}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={draft.tableType}
                      onChange={event => {
                        setDraft(table.id, {
                          tableType: event.target.value as 'pool' | 'carom' | 'consumption',
                        });
                      }}
                    >
                      <option value="pool">{t('poolTablesSettingsTab.typePool')}</option>
                      <option value="carom">{t('poolTablesSettingsTab.typeCarom')}</option>
                      <option value="consumption">
                        {t('poolTablesSettingsTab.typeConsumption')}
                      </option>
                    </select>
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
                      {t('poolTablesSettingsTab.save')}
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
                      {t('poolTablesSettingsTab.remove')}
                    </POSButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ConfirmDialog
          open={deleteTarget != null}
          title={t('poolTablesSettingsTab.removeConfirmTitle')}
          description={
            deleteTarget
              ? t('poolTablesSettingsTab.removeConfirmDescription', { label: deleteTarget.label })
              : t('poolTablesSettingsTab.removeThisTable')
          }
          confirmLabel={
            deleteTable.isPending
              ? t('poolTablesSettingsTab.removing')
              : t('poolTablesSettingsTab.removeTableLabel')
          }
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
