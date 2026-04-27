import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useMutationUpdateSetting, useSettings } from '@entities/settings';
import type { PaymentMethodLabels } from '@entities/settings';
import type { UserRole } from '@shared/lib/domain';
import { Input, Label, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

type BillingForm = {
  taxRatePercent: string;
  tipPercentagesCsv: string;
  paymentMethods: {
    cash: boolean;
    bbvaCard: boolean;
    rappi: boolean;
  };
  firstHourMode: 'full' | 'prorated';
};

const DEFAULT_FORM: BillingForm = {
  taxRatePercent: '16',
  tipPercentagesCsv: '10, 15, 18, 20',
  paymentMethods: { cash: true, bbvaCard: true, rappi: true },
  firstHourMode: 'prorated',
};

function parseTipPercentages(raw: string): number[] | null {
  const parsed = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 100);

  if (parsed.length === 0 || parsed.length > 4) return null;
  return parsed.map(value => Math.round(value));
}

const DEFAULT_LABELS: PaymentMethodLabels = {
  cash: 'Efectivo',
  card: 'Terminal BBVA',
  rappi: 'Rappi',
};

export function BillingSettingsTab({ currentRole }: Props) {
  const { data } = useSettings();
  const updateSetting = useMutationUpdateSetting();
  const [form, setForm] = useState<BillingForm>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);
  const [labels, setLabels] = useState<PaymentMethodLabels>(DEFAULT_LABELS);
  const [labelsDirty, setLabelsDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!dirty) {
      setForm({
        taxRatePercent: String(data.billing.taxRatePercent),
        tipPercentagesCsv: data.billing.defaultTipPercentages.join(', '),
        paymentMethods: {
          cash: data.billing.paymentMethods.cash,
          bbvaCard: data.billing.paymentMethods.bbvaCard,
          rappi: data.billing.paymentMethods.rappi,
        },
        firstHourMode: data.billing.firstHourMode,
      });
    }
    if (!labelsDirty) {
      setLabels(data.paymentLabels);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data, dirty, labelsDirty]);

  const paymentMethodButtons = useMemo(
    () =>
      [
        { key: 'cash', label: 'Cash' },
        { key: 'bbvaCard', label: 'BBVA Card' },
        { key: 'rappi', label: 'Rappi' },
      ] as const,
    []
  );

  const save = async () => {
    const tips = parseTipPercentages(form.tipPercentagesCsv);
    const taxRatePercent = Number(form.taxRatePercent);
    if (tips == null) {
      toast.error('Tip percentages must be 1-4 comma-separated values between 0 and 100.');
      return;
    }
    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
      toast.error('Tax rate must be between 0 and 100.');
      return;
    }

    const result = await updateSetting.mutateAsync({
      key: 'billing',
      value: {
        taxRatePercent,
        defaultTipPercentages: tips,
        paymentMethods: form.paymentMethods,
        firstHourMode: form.firstHourMode,
      },
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDirty(false);
    toast.success('Billing settings saved.');
  };

  return (
    <ProtectedAction
      action="manage_products"
      currentRole={currentRole}
      disabled={updateSetting.isPending}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Billing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-tax-rate">Tax rate (IVA %)</Label>
            <Input
              id="settings-tax-rate"
              value={form.taxRatePercent}
              onChange={event => {
                setDirty(true);
                setForm(current => ({ ...current, taxRatePercent: event.target.value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-tip-defaults">Default tip percentages</Label>
            <Input
              id="settings-tip-defaults"
              value={form.tipPercentagesCsv}
              placeholder="10, 15, 18, 20"
              onChange={event => {
                setDirty(true);
                setForm(current => ({ ...current, tipPercentagesCsv: event.target.value }));
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Enabled payment methods</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {paymentMethodButtons.map(button => (
              <POSButton
                key={button.key}
                type="button"
                touchSize="large"
                variant={form.paymentMethods[button.key] ? 'default' : 'outline'}
                onClick={() => {
                  setDirty(true);
                  setForm(current => ({
                    ...current,
                    paymentMethods: {
                      ...current.paymentMethods,
                      [button.key]: !current.paymentMethods[button.key],
                    },
                  }));
                }}
              >
                {button.label}
              </POSButton>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>First hour billing mode</Label>
          <p className="text-xs text-muted-foreground">
            Controls how sessions under 60 minutes are billed.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                value: 'prorated' as const,
                label: 'Prorated',
                description: 'Bill in 15-minute blocks (default)',
              },
              {
                value: 'full' as const,
                label: 'Full Hour',
                description: 'Charge minimum 1 full hour for short sessions',
              },
            ].map(option => (
              <POSButton
                key={option.value}
                type="button"
                touchSize="large"
                variant={form.firstHourMode === option.value ? 'default' : 'outline'}
                onClick={() => {
                  setDirty(true);
                  setForm(current => ({ ...current, firstHourMode: option.value }));
                }}
              >
                <span className="flex flex-col items-start gap-0.5 text-left">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs font-normal opacity-80">{option.description}</span>
                </span>
              </POSButton>
            ))}
          </div>
        </div>

        <POSButton
          type="button"
          touchSize="large"
          disabled={!dirty || updateSetting.isPending}
          onClick={() => {
            void save();
          }}
        >
          {updateSetting.isPending ? 'Saving...' : 'Save Billing'}
        </POSButton>

        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">Payment button labels</h3>
          <p className="text-xs text-muted-foreground">
            Customize the label shown on payment buttons in the POS and on receipts.
          </p>
          {(
            [
              { key: 'cash', placeholder: 'Efectivo' },
              { key: 'card', placeholder: 'Terminal BBVA' },
              { key: 'rappi', placeholder: 'Rappi' },
            ] as const
          ).map(({ key, placeholder }) => (
            <div key={key} className="flex items-center gap-3">
              <Label htmlFor={`label-${key}`} className="w-12 shrink-0 capitalize">
                {key}
              </Label>
              <Input
                id={`label-${key}`}
                value={labels[key]}
                placeholder={placeholder}
                maxLength={40}
                onChange={e => {
                  setLabelsDirty(true);
                  setLabels(prev => ({ ...prev, [key]: e.target.value }));
                }}
              />
            </div>
          ))}
          <POSButton
            type="button"
            touchSize="large"
            disabled={!labelsDirty || updateSetting.isPending}
            onClick={() => {
              updateSetting.mutate(
                { key: 'payment_labels', value: labels },
                {
                  onSuccess: result => {
                    if (!result.ok) {
                      toast.error(result.error.message);
                      return;
                    }
                    setLabelsDirty(false);
                    toast.success('Payment labels saved.');
                  },
                }
              );
            }}
          >
            {updateSetting.isPending ? 'Saving...' : 'Save Labels'}
          </POSButton>
        </div>
      </div>
    </ProtectedAction>
  );
}
