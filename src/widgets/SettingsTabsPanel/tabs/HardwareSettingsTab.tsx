import { useState } from 'react';
import { toast } from 'sonner';
import type { UserRole } from '@shared/lib/domain';
import { openCashDrawer, testPrint } from '@shared/lib/pos-printer';
import { POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

export function HardwareSettingsTab({ currentRole }: Props) {
  const [printing, setPrinting] = useState(false);
  const [openingDrawer, setOpeningDrawer] = useState(false);

  const runTestPrint = async () => {
    setPrinting(true);
    const result = await testPrint();
    setPrinting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Test print sent.');
  };

  const runOpenDrawer = async () => {
    setOpeningDrawer(true);
    const result = await openCashDrawer();
    setOpeningDrawer(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Cash drawer command sent.');
  };

  return (
    <ProtectedAction
      action="manage_settings"
      currentRole={currentRole}
      disabled={printing || openingDrawer}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Hardware</h2>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Printer type</p>
          <p className="text-muted-foreground">58mm USB thermal (ESC/POS).</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <POSButton
            type="button"
            touchSize="large"
            disabled={printing || openingDrawer}
            onClick={() => {
              void runTestPrint();
            }}
          >
            {printing ? 'Printing...' : 'Test Print'}
          </POSButton>
          <POSButton
            type="button"
            touchSize="large"
            variant="outline"
            disabled={printing || openingDrawer}
            onClick={() => {
              void runOpenDrawer();
            }}
          >
            {openingDrawer ? 'Opening...' : 'Open Cash Drawer'}
          </POSButton>
        </div>
      </div>
    </ProtectedAction>
  );
}
