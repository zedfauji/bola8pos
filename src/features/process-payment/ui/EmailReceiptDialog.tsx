import { useState } from 'react';
import { toast } from 'sonner';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { sendReceiptByEmail } from '@shared/lib/email-receipt';
import { ReceiptEmailSchema } from '@shared/lib/email-schema';
import { POSButton } from '@shared/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

export interface EmailReceiptDialogProps {
  receipt: ReceiptData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailReceiptDialog({ receipt, open, onOpenChange }: EmailReceiptDialogProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmail('');
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setError(null);
    const parsed = ReceiptEmailSchema.safeParse(email);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid email';
      setError(msg);
      return;
    }
    setPending(true);
    const result = await sendReceiptByEmail(receipt, parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success('Receipt sent.');
    setEmail('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email receipt</DialogTitle>
          <DialogDescription>Send a copy to the customer&apos;s email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="receipt-email">Email</Label>
          <Input
            id="receipt-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
            }}
            placeholder="name@example.com"
            disabled={pending}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <POSButton
            type="button"
            variant="outline"
            touchSize="large"
            disabled={pending}
            onClick={() => {
              handleOpenChange(false);
            }}
          >
            Cancel
          </POSButton>
          <POSButton
            type="button"
            touchSize="large"
            disabled={pending}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {pending ? 'Sending…' : 'Send Receipt'}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
