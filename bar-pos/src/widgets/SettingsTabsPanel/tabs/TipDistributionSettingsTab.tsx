import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMutationUpdateSetting, useSettings } from '@entities/settings';
import type { TipDistributionSettings } from '@entities/settings';
import type { UserRole } from '@shared/lib/domain';
import { formatMoney } from '@shared/lib/format';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { computeTipDistribution } from '@shared/lib/tip-distribution-math';
import { Input, Label, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

const TERMINAL_ID = (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';

const DEFAULT_FORM: TipDistributionSettings = {
  floorPct: 34,
  barPct: 33,
  kitchenPct: 33,
};

function toNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function TipDistributionSettingsTab({ currentRole }: Props) {
  const { t } = useTranslation('wAdmin');
  const { data } = useSettings();
  const updateSetting = useMutationUpdateSetting();
  const [form, setForm] = useState<TipDistributionSettings>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data || dirty) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm(data.tipDistribution);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data, dirty]);

  const sum = form.floorPct + form.barPct + form.kitchenPct;
  const sumIsOff = Math.abs(sum - 100) > 0.001;

  const preview = computeTipDistribution(100, form);

  const save = async () => {
    const previous = data?.tipDistribution;
    const result = await updateSetting.mutateAsync({
      key: 'tip_distribution',
      value: form,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDirty(false);
    toast.success(t('tipDistributionSettingsTab.saved'));

    // Best-effort audit — never blocks the save (19-RESEARCH.md Pattern 2).
    // p_user_id not yet threaded from staff store — mirrors staff.role_change/
    // permission.toggle's existing p_user_id: null convention; cast as never
    // since the generated Args type declares p_user_id?: string (no null).
    const auditRes = await supabase.rpc('record_audit', {
      p_action: 'settings.update',
      p_entity_type: 'settings',
      p_entity_id: null,
      p_before: previous ?? null,
      p_after: form,
      p_source: 'client',
      p_terminal_id: TERMINAL_ID,
      p_user_id: null,
    } as never);
    if (auditRes.error) {
      logger.warn('settings.update.audit_failed', { message: auditRes.error.message });
    }
  };

  return (
    <ProtectedAction
      action="manage_settings"
      currentRole={currentRole}
      disabled={updateSetting.isPending}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('tipDistributionSettingsTab.title')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('tipDistributionSettingsTab.description')}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tip-split-floor">{t('tipDistributionSettingsTab.floorLabel')}</Label>
            <Input
              id="tip-split-floor"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.floorPct}
              onChange={event => {
                setDirty(true);
                setForm(current => ({ ...current, floorPct: toNumber(event.target.value) }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tip-split-bar">{t('tipDistributionSettingsTab.barLabel')}</Label>
            <Input
              id="tip-split-bar"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.barPct}
              onChange={event => {
                setDirty(true);
                setForm(current => ({ ...current, barPct: toNumber(event.target.value) }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tip-split-kitchen">
              {t('tipDistributionSettingsTab.kitchenLabel')}
            </Label>
            <Input
              id="tip-split-kitchen"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.kitchenPct}
              onChange={event => {
                setDirty(true);
                setForm(current => ({ ...current, kitchenPct: toNumber(event.target.value) }));
              }}
            />
          </div>
        </div>

        {sumIsOff && (
          <p className="text-sm text-amber-500">
            {t('tipDistributionSettingsTab.percentagesOff', { sum })}
          </p>
        )}

        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">{t('tipDistributionSettingsTab.exampleTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('tipDistributionSettingsTab.exampleBreakdown', {
              floor: formatMoney(preview.floor),
              bar: formatMoney(preview.bar),
              kitchen: formatMoney(preview.kitchen),
            })}
          </p>
        </div>

        <POSButton
          type="button"
          touchSize="large"
          disabled={!dirty || updateSetting.isPending}
          onClick={() => {
            void save();
          }}
        >
          {updateSetting.isPending
            ? t('tipDistributionSettingsTab.saving')
            : t('tipDistributionSettingsTab.saveTipSplit')}
        </POSButton>
      </div>
    </ProtectedAction>
  );
}
