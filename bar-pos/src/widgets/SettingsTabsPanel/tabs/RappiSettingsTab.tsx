import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useMutationSyncRappiMenu,
  useMutationUpdateSetting,
  useSettings,
} from '@entities/settings';
import type { UserRole } from '@shared/lib/domain';
import { Input, Label, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

export function RappiSettingsTab({ currentRole }: Props) {
  const { t } = useTranslation('wAdmin');
  const { data } = useSettings();
  const updateSetting = useMutationUpdateSetting();
  const syncMenu = useMutationSyncRappiMenu();
  const [storeId, setStoreId] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data || dirty) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStoreId(data.rappi.storeId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data, dirty]);

  const lastSyncLabel = useMemo(() => {
    const raw = data?.rappi.lastSyncAt ?? null;
    if (!raw) return t('rappiSettingsTab.neverSynced');
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return t('rappiSettingsTab.invalidDate');
    return date.toLocaleString();
  }, [data?.rappi.lastSyncAt, t]);

  const webhookSecret = import.meta.env.VITE_RAPPI_WEBHOOK_SECRET ?? '';
  const webhookDisplay = webhookSecret.length > 0 ? webhookSecret : t('rappiSettingsTab.notSet');

  const saveStoreId = async () => {
    const result = await updateSetting.mutateAsync({
      key: 'rappi',
      value: {
        storeId: storeId.trim(),
        lastSyncAt: data?.rappi.lastSyncAt ?? null,
      },
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDirty(false);
    toast.success(t('rappiSettingsTab.saved'));
  };

  const runSyncMenu = async () => {
    const result = await syncMenu.mutateAsync();
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t('rappiSettingsTab.menuSynced'));
  };

  return (
    <ProtectedAction
      action="manage_settings"
      currentRole={currentRole}
      disabled={updateSetting.isPending}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('rappiSettingsTab.title')}</h2>
        <div className="space-y-2">
          <Label htmlFor="settings-rappi-store-id">{t('rappiSettingsTab.storeIdLabel')}</Label>
          <Input
            id="settings-rappi-store-id"
            value={storeId}
            onChange={event => {
              setDirty(true);
              setStoreId(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-rappi-webhook-secret">
            {t('rappiSettingsTab.webhookSecretLabel')}
          </Label>
          <Input id="settings-rappi-webhook-secret" value={webhookDisplay} readOnly />
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <span className="font-medium">{t('rappiSettingsTab.menuSyncStatusLabel')}</span>{' '}
          {t('rappiSettingsTab.lastSync', { label: lastSyncLabel })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <POSButton
            type="button"
            touchSize="large"
            disabled={!dirty || updateSetting.isPending || syncMenu.isPending}
            onClick={() => {
              void saveStoreId();
            }}
          >
            {updateSetting.isPending ? t('rappiSettingsTab.saving') : t('rappiSettingsTab.saveRappi')}
          </POSButton>
          <POSButton
            type="button"
            touchSize="large"
            variant="outline"
            disabled={syncMenu.isPending || updateSetting.isPending}
            onClick={() => {
              void runSyncMenu();
            }}
          >
            {syncMenu.isPending
              ? t('rappiSettingsTab.syncing')
              : t('rappiSettingsTab.syncMenuToRappi')}
          </POSButton>
        </div>
      </div>
    </ProtectedAction>
  );
}
