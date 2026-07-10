import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { InventoryPagePanel } from '@widgets/InventoryPagePanel';
import { PhysicalCountForm } from '@features/physical-count';
import { LowStockBadge, useInventoryAlerts, useInventoryRealtimeBridge } from '@entities/inventory';
import { useStaffStore } from '@entities/staff/model/store';
import { canAccess } from '@shared/lib/rbac';
import { Button, PageContainer } from '@shared/ui';

/**
 * Fires a Sonner toast whenever a new low-stock alert arrives.
 * Compares the current alert product IDs against the previous render
 * to detect genuinely new entries (avoids toasting on mount).
 */
function useLowStockToast() {
  const { data: alerts } = useInventoryAlerts();
  const prevIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!alerts) return;

    const currentIds = new Set(alerts.map(a => a.productId));

    if (prevIdsRef.current === null) {
      // First load — record baseline, don't toast
      prevIdsRef.current = currentIds;
      return;
    }

    // Find alerts that weren't in the previous set
    for (const alert of alerts) {
      if (!prevIdsRef.current.has(alert.productId)) {
        toast.warning(
          `Low stock: ${alert.productName} — ${String(alert.currentStock)} remaining (threshold: ${String(alert.threshold)})`
        );
      }
    }

    prevIdsRef.current = currentIds;
  }, [alerts]);
}

function InventoryPageInner() {
  // Mount the Realtime bridge once for this page
  useInventoryRealtimeBridge();
  // Fire toasts on new low-stock alerts
  useLowStockToast();

  const role = useStaffStore(s => s.currentStaff?.role);
  const canPhysicalCount = canAccess(role, 'adjust_inventory');
  const [physicalCountOpen, setPhysicalCountOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer
          title="Inventory"
          backTo="/home"
          actions={
            <>
              <LowStockBadge />
              {canPhysicalCount && (
                <Button
                  variant="outline"
                  data-testid="physical-count-btn"
                  onClick={() => {
                    setPhysicalCountOpen(true);
                  }}
                >
                  Physical Count
                </Button>
              )}
            </>
          }
        >
          <InventoryPagePanel />
          {canPhysicalCount && (
            <PhysicalCountForm open={physicalCountOpen} onOpenChange={setPhysicalCountOpen} />
          )}
        </PageContainer>
      </main>
    </div>
  );
}

export default function InventoryPage() {
  return <InventoryPageInner />;
}
