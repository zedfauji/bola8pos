import { useState } from 'react';
import { toast } from 'sonner';
import { useStaffStore } from '@entities/staff/model/store';
import { testPrint } from '@shared/lib/pos-printer';
import { POSButton } from '@shared/ui/POSButton';
import { ProtectedAction } from '@shared/ui/ProtectedAction';

export function SettingsPagePanel() {
  const currentRole = useStaffStore(s => s.currentStaff?.role);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Hardware</h2>
        <p className="text-sm text-muted-foreground">
          Uses the Windows default printer with RAW / ESC-POS. Connect your 58mm USB thermal printer
          and set it as default before testing.
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
                  toast.success('Test print sent.');
                } else {
                  toast.error(r.error.message);
                }
              });
            }}
          >
            {busy ? 'Printing…' : 'Test print'}
          </POSButton>
        </ProtectedAction>
      </section>
    </div>
  );
}
