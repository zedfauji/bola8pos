import { useState } from 'react';
import { toast } from 'sonner';
import { useMutationLinkPoolSessionToTab } from '@entities/pool-table/model/queries';
import type { Tab } from '@entities/tab';
import {
  POSButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui';
import { Label } from '@shared/ui/label';

export interface AssignPoolSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  tableLabel: string;
  openTabs: Tab[];
}

export function AssignPoolSessionSheet({
  open,
  onOpenChange,
  sessionId,
  tableLabel,
  openTabs,
}: AssignPoolSessionSheetProps) {
  const link = useMutationLinkPoolSessionToTab();
  const [tabId, setTabId] = useState<string>('');

  const handleClose = (next: boolean) => {
    if (!next) {
      setTabId('');
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!sessionId || !tabId) {
      toast.error('Select an open tab.');
      return;
    }
    const result = await link.mutateAsync({ sessionId, tabId });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Session linked to tab.');
    handleClose(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assign to tab</SheetTitle>
          <SheetDescription>
            Link the active session on {tableLabel} to a customer tab.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="assign-tab">Open tab</Label>
            <select
              id="assign-tab"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={tabId}
              onChange={e => {
                setTabId(e.target.value);
              }}
            >
              <option value="">Select tab…</option>
              {openTabs.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {tab.customerName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <SheetFooter>
          <POSButton
            type="button"
            touchSize="large"
            className="w-full"
            disabled={!sessionId || !tabId || link.isPending}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {link.isPending ? 'Saving…' : 'Link session'}
          </POSButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
