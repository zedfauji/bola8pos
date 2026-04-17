import { useState } from 'react';
import { toast } from 'sonner';
import { useMutationStartSession } from '@entities/pool-table/model/queries';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab';
import type { PoolTable } from '@shared/lib/domain';
import {
  MoneyDisplay,
  POSButton,
  ProtectedAction,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui';
import { Label } from '@shared/ui/label';

const UNLINKED = '__unlinked__';

export interface StartSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: PoolTable | null;
  openTabs: Tab[];
}

export function StartSessionSheet({ open, onOpenChange, table, openTabs }: StartSessionSheetProps) {
  const startSession = useMutationStartSession();
  const currentRole = useStaffStore(s => s.currentStaff?.role);
  const [tabChoice, setTabChoice] = useState<string>(UNLINKED);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTabChoice(UNLINKED);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!table) return;
    if (table.status !== 'available') {
      toast.error('This table is not available to start a session.');
      return;
    }
    const tabId = tabChoice === UNLINKED ? null : tabChoice;
    const result = await startSession.mutateAsync({ tableId: table.id, tabId });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Pool session started.');
    handleOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>Start pool session</SheetTitle>
          <SheetDescription>
            {table
              ? `Table ${String(table.number)} · ${table.label}`
              : 'Select a table from the grid.'}
          </SheetDescription>
        </SheetHeader>

        {table && (
          <div className="space-y-6 py-4">
            <div>
              <p className="text-muted-foreground mb-1 text-sm">Rate per hour</p>
              <MoneyDisplay amount={table.ratePerHour} size="xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pool-start-tab">Link to open tab</Label>
              <select
                id="pool-start-tab"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={tabChoice}
                onChange={e => {
                  setTabChoice(e.target.value);
                }}
              >
                <option value={UNLINKED}>Unlinked — pay separately at end</option>
                {openTabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.customerName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <ProtectedAction
            action="start_pool_timer"
            currentRole={currentRole}
            disabled={!table || startSession.isPending}
          >
            <POSButton
              type="button"
              touchSize="large"
              className="w-full"
              disabled={!table || startSession.isPending}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {startSession.isPending ? 'Starting…' : 'Start Session'}
            </POSButton>
          </ProtectedAction>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
