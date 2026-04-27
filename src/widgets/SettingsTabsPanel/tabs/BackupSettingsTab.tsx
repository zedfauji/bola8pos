import { Database } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useMutationCreateSettingsBackup,
  useMutationRestoreSettingsBackup,
  useSettingsBackups,
} from '@entities/settings';
import type { SettingsBackupSummary, UserRole } from '@shared/lib/domain';
import { ConfirmDialog, EmptyState, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

export function BackupSettingsTab({ currentRole }: Props) {
  const backupsQuery = useSettingsBackups();
  const createBackup = useMutationCreateSettingsBackup();
  const restoreBackup = useMutationRestoreSettingsBackup();
  const [restoreTarget, setRestoreTarget] = useState<SettingsBackupSummary | null>(null);

  const defaultLabel = useMemo(
    () => `Manual backup ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    []
  );

  const handleCreateBackup = async () => {
    const result = await createBackup.mutateAsync(defaultLabel);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Backup created.');
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget) return;
    const result = await restoreBackup.mutateAsync({ backupId: restoreTarget.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setRestoreTarget(null);
    toast.success('Backup restored.');
  };

  return (
    <ProtectedAction
      action="manage_settings"
      currentRole={currentRole}
      disabled={restoreBackup.isPending}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Backup</h2>
        <POSButton
          type="button"
          touchSize="large"
          disabled={createBackup.isPending || restoreBackup.isPending}
          onClick={() => {
            void handleCreateBackup();
          }}
        >
          {createBackup.isPending ? 'Creating backup...' : 'Create Manual Backup'}
        </POSButton>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Backup history</h3>
          {backupsQuery.data == null || backupsQuery.data.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No backups yet"
              description="Create a manual backup to start history."
            />
          ) : (
            <div className="space-y-2">
              {backupsQuery.data.map(backup => (
                <div
                  key={backup.id}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{backup.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {backup.createdAt.toLocaleString()}
                      {backup.restoredAt ? ` · Restored ${backup.restoredAt.toLocaleString()}` : ''}
                    </p>
                  </div>
                  <POSButton
                    type="button"
                    touchSize="default"
                    variant="outline"
                    disabled={restoreBackup.isPending}
                    onClick={() => {
                      setRestoreTarget(backup);
                    }}
                  >
                    Restore
                  </POSButton>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={restoreTarget != null}
          title="Restore backup?"
          description="This applies backup data to settings and catalog. Continue only if you trust this snapshot."
          confirmLabel={restoreBackup.isPending ? 'Restoring...' : 'Restore backup'}
          isLoading={restoreBackup.isPending}
          onCancel={() => {
            setRestoreTarget(null);
          }}
          onConfirm={() => {
            void handleRestoreBackup();
          }}
        />
      </div>
    </ProtectedAction>
  );
}
