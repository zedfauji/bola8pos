import { useState } from 'react';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { printReceipt } from '@shared/lib/pos-printer';
import { buildThermalReceiptText } from '@shared/lib/receipt-format';
import { POSButton } from '@shared/ui';
import { EmailReceiptDialog } from './EmailReceiptDialog';

export interface ReceiptPreviewProps {
  receipt: ReceiptData;
  onDone: () => void;
}

export function ReceiptPreview({ receipt, onDone }: ReceiptPreviewProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const text = buildThermalReceiptText(receipt);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Receipt</h2>
      <pre className="max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-tight whitespace-pre">
        {text}
      </pre>
      <div className="flex flex-col gap-2 sm:flex-row">
        <POSButton
          type="button"
          touchSize="large"
          className="flex-1"
          disabled={printBusy}
          onClick={() => {
            setPrintBusy(true);
            void printReceipt(receipt).finally(() => {
              setPrintBusy(false);
            });
          }}
        >
          {printBusy ? 'Printing…' : 'Print receipt'}
        </POSButton>
        <POSButton
          type="button"
          variant="outline"
          touchSize="large"
          className="flex-1"
          onClick={() => {
            setEmailOpen(true);
          }}
        >
          Email receipt
        </POSButton>
        <POSButton
          type="button"
          variant="secondary"
          touchSize="large"
          className="flex-1"
          onClick={onDone}
        >
          Done
        </POSButton>
      </div>
      <EmailReceiptDialog receipt={receipt} open={emailOpen} onOpenChange={setEmailOpen} />
    </div>
  );
}
