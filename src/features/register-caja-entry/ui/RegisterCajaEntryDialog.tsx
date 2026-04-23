import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useStaffStore } from '@entities/staff/model/store';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { useRegisterCajaEntry } from '../model/useRegisterCajaEntry';

const FormSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  concept: z
    .string()
    .min(1, 'Concept is required')
    .max(200, 'Concept must be 200 characters or less'),
});

interface RegisterCajaEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterCajaEntryDialog({ open, onOpenChange }: RegisterCajaEntryDialogProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentStaff = useStaffStore(s => s.currentStaff);
  const { registerEntry, isPending } = useRegisterCajaEntry();

  function resetForm() {
    setType('expense');
    setAmount('');
    setConcept('');
    setErrors({});
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const validation = FormSchema.safeParse({ type, amount, concept });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach(issue => {
        const key = issue.path[0];
        if (key !== undefined) {
          fieldErrors[String(key)] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!currentStaff) {
      toast.error('No active staff session.');
      return;
    }

    const result = await registerEntry({
      type: validation.data.type,
      amount: validation.data.amount,
      concept: validation.data.concept,
      staffId: currentStaff.id,
    });

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(
      type === 'expense'
        ? `Expense recorded: $${validation.data.amount.toFixed(2)}`
        : `Income recorded: $${validation.data.amount.toFixed(2)}`
    );
    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Register Expense / Income</DialogTitle>
        </DialogHeader>

        <form
          data-testid="entry-form"
          onSubmit={e => {
            void handleSubmit(e);
          }}
        >
          <div className="space-y-4 py-2">
            {/* Type toggle */}
            <div className="space-y-1">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === 'expense' ? 'destructive' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setType('expense');
                  }}
                >
                  Expense
                </Button>
                <Button
                  type="button"
                  variant={type === 'income' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setType('income');
                  }}
                >
                  Income
                </Button>
              </div>
              {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <Label htmlFor="entry-amount">
                Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="entry-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                }}
                placeholder="0.00"
                disabled={isPending}
              />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
            </div>

            {/* Concept */}
            <div className="space-y-1">
              <Label htmlFor="entry-concept">
                Concept <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="entry-concept"
                value={concept}
                onChange={e => {
                  setConcept(e.target.value);
                }}
                maxLength={200}
                rows={3}
                placeholder="Describe this entry…"
                disabled={isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.concept && <p className="text-sm text-destructive">{errors.concept}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
