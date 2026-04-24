import { useState } from 'react';
import { toast } from 'sonner';
import { LogoUploader } from '@features/upload-logo';
import { useSettings, useMutationUpdateSetting } from '@entities/settings';
import type { ReceiptSettings } from '@entities/settings';
import type { UserRole } from '@shared/lib/domain';
import { openCashDrawer, testPrint } from '@shared/lib/pos-printer';
import { POSButton, ProtectedAction } from '@shared/ui';
import { Label } from '@shared/ui/label';

type Props = {
  currentRole: UserRole | null;
};

const PAPER_OPTIONS = [
  { value: 32, label: '58mm (32 chars)' },
  { value: 40, label: '80mm standard (40 chars)' },
  { value: 48, label: '80mm wide (48 chars)' },
] as const;

export function HardwareSettingsTab({ currentRole }: Props) {
  const [printing, setPrinting] = useState(false);
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const { data: settings } = useSettings();
  const updateSetting = useMutationUpdateSetting();

  // Optimistic local state — mirrors server value, updated immediately on change.
  // Lazy initializer captures the first available server value; afterwards
  // patchReceipt drives all state changes (optimistic + rollback on error).
  const [localReceipt, setLocalReceipt] = useState<ReceiptSettings | undefined>(
    () => settings?.receipt
  );

  const receipt = localReceipt ?? settings?.receipt;

  function patchReceipt(patch: Partial<ReceiptSettings>) {
    if (!receipt) return;
    const next: ReceiptSettings = { ...receipt, ...patch };
    // Apply optimistically so controlled inputs reflect the new value immediately
    setLocalReceipt(next);
    updateSetting.mutate(
      { key: 'receipt', value: next },
      {
        onSuccess: result => {
          if (!result.ok) {
            // Roll back optimistic update on failure
            setLocalReceipt(receipt);
            toast.error(result.error.message);
          }
        },
      }
    );
  }

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
      <div className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Hardware</h2>
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

        {receipt && <LogoUploader receipt={receipt} />}

        {receipt && (
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">Receipt Settings</h3>

            <div className="space-y-1">
              <Label htmlFor="paper-width">Paper width</Label>
              <select
                id="paper-width"
                value={receipt.paperWidthChars}
                onChange={e => {
                  patchReceipt({ paperWidthChars: Number(e.target.value) as 32 | 40 | 48 });
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PAPER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {(
                [
                  { key: 'showCashierName', label: 'Show cashier name' },
                  { key: 'showCustomerName', label: 'Show customer name' },
                  { key: 'showReceiptNumber', label: 'Show receipt number' },
                  { key: 'boldTotals', label: 'Bold totals line' },
                  { key: 'printOnStart', label: 'Print start ticket' },
                  { key: 'autoCut', label: 'Auto-cut paper after each receipt' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`receipt-${key}`}
                    checked={receipt[key]}
                    onChange={e => {
                      patchReceipt({ [key]: e.target.checked });
                    }}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Label htmlFor={`receipt-${key}`}>{label}</Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedAction>
  );
}
