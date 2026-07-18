import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useStaffStore } from '@entities/staff/model/store';
import { testPrint } from '@shared/lib/pos-printer';
import { POSButton } from '@shared/ui/POSButton';
import { ProtectedAction } from '@shared/ui/ProtectedAction';

export function SettingsPagePanel() {
  const { t } = useTranslation('wAdmin');
  const currentRole = useStaffStore(s => s.currentStaff?.role);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t('settingsPagePanel.hardwareTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settingsPagePanel.hardwareDescription')}
        </p>
        <ProtectedAction action="manage_settings" currentRole={currentRole} disabled={busy}>
          <POSButton
            type="button"
            touchSize="large"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void testPrint().then(r => {
                setBusy(false);
                if (r.ok) {
                  toast.success(t('settingsPagePanel.testPrintSent'));
                } else {
                  toast.error(r.error.message);
                }
              });
            }}
          >
            {busy ? t('settingsPagePanel.printing') : t('settingsPagePanel.testPrint')}
          </POSButton>
        </ProtectedAction>
      </section>
    </div>
  );
}
