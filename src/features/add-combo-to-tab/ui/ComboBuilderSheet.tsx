/**
 * ComboBuilderSheet — bottom sheet for selecting combo slot options.
 *
 * Follows the ModifierSheet.tsx pattern. Opens when ProductGrid signals a combo
 * product selection. Shows one ComboSlotCard per slot, ordered by sort_order.
 * Confirm is disabled until all required slots have a selection.
 */
import { useMemo, useState } from 'react';

import { useComboSlots, useComboSlotOptions } from '@entities/combo';
import { useProducts } from '@entities/product/model/queries';
import type { ComboSlot, SlotSelection, Product } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { ComboSlotCard } from '@shared/ui/ComboSlotCard/ComboSlotCard';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';

import { useAddComboToTab } from '../model/useAddComboToTab';

// ---------------------------------------------------------------------------
// Per-slot component — each slot gets its own options query (hook rule compliant)
// ---------------------------------------------------------------------------

interface SingleSlotRowProps {
  slot: ComboSlot;
  productMap: Record<string, { name: string; basePrice: number }>;
  value: SlotSelection;
  onChange: (v: SlotSelection) => void;
}

function SingleSlotRow({ slot, productMap, value, onChange }: SingleSlotRowProps) {
  const { data: options = [] } = useComboSlotOptions(slot.id);

  return (
    <ComboSlotCard
      slot={slot}
      options={options}
      productMap={productMap}
      value={value}
      onChange={onChange}
    />
  );
}

// ---------------------------------------------------------------------------
// ComboBuilderSheetInner — only rendered when combo is non-null
// ---------------------------------------------------------------------------

interface ComboBuilderSheetInnerProps {
  combo: Product;
  tabId: string;
  open: boolean;
  overrideActive: boolean;
  onClose: () => void;
}

function ComboBuilderSheetInner({
  combo,
  tabId,
  open,
  overrideActive,
  onClose,
}: ComboBuilderSheetInnerProps) {
  const { data: slots = [] } = useComboSlots(combo.id);
  const { data: allProducts = [] } = useProducts();
  const mutation = useAddComboToTab();

  // Build productMap from all products — used by ComboSlotCard to display option labels
  const productMap = useMemo(() => {
    const map: Record<string, { name: string; basePrice: number }> = {};
    for (const p of Array.isArray(allProducts) ? allProducts : []) {
      map[p.id] = { name: p.name, basePrice: p.basePrice };
    }
    return map;
  }, [allProducts]);

  // Initialize slot selections — each slot starts with no selection
  const buildInitialSelections = (currentSlots: ComboSlot[]) =>
    Object.fromEntries(
      currentSlots.map(s => [
        s.id,
        { slotId: s.id, childProductId: null as string | null, qty: 0 },
      ])
    );

  const [slotSelections, setSlotSelections] = useState<Record<string, SlotSelection>>(
    () => buildInitialSelections(slots)
  );

  // Re-initialize when slots load (combo change)
  const [lastComboId, setLastComboId] = useState<string>(combo.id);
  if (lastComboId !== combo.id) {
    setLastComboId(combo.id);
    setSlotSelections(buildInitialSelections(slots));
  }

  const allSlotsFilled = useMemo(
    () => slots.every(s => !s.isRequired || slotSelections[s.id]?.childProductId != null),
    [slots, slotSelections]
  );

  const runningTotal = useMemo(() => {
    if (combo.comboPriceOverride != null) return combo.comboPriceOverride;
    let total = 0;
    for (const sel of Object.values(slotSelections)) {
      if (sel.childProductId != null) {
        const p = productMap[sel.childProductId];
        if (p) total += p.basePrice * (sel.qty > 0 ? sel.qty : 1);
      }
    }
    return total > 0 ? total : combo.basePrice;
  }, [combo, slotSelections, productMap]);

  const handleSelectionChange = (slotId: string, v: SlotSelection) => {
    setSlotSelections(prev => ({ ...prev, [slotId]: v }));
  };

  const resetSelections = () => {
    setSlotSelections(buildInitialSelections(slots));
  };

  const handleConfirm = () => {
    const selections = Object.values(slotSelections).filter(s => s.childProductId != null);
    if (selections.length === 0) {
      logger.warn('ComboBuilderSheet: confirm called with no filled slots');
      return;
    }
    mutation.mutate(
      {
        comboProductId: combo.id,
        tabId,
        slotSelections: selections,
        overrideAvailability: overrideActive,
        overrideReason: null,
      },
      {
        onSuccess: () => {
          resetSelections();
          onClose();
        },
      }
    );
  };

  const handleCancel = () => {
    resetSelections();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) handleCancel();
      }}
    >
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>{combo.name}</SheetTitle>
          <SheetDescription>Select options for each slot</SheetDescription>
          <div className="flex items-center justify-between border-t pt-4 mt-2">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <MoneyDisplay amount={runningTotal} size="lg" />
          </div>
        </SheetHeader>

        <div className="max-h-[calc(80vh-240px)] overflow-y-auto space-y-4 py-4">
          {overrideActive && (
            <Alert className="border-yellow-500 bg-yellow-950/20 mb-4">
              <AlertDescription>Manager override — availability check bypassed</AlertDescription>
            </Alert>
          )}

          {slots.map(slot => {
            const value = slotSelections[slot.id] ?? {
              slotId: slot.id,
              childProductId: null,
              qty: 0,
            };
            return (
              <SingleSlotRow
                key={slot.id}
                slot={slot}
                productMap={productMap}
                value={value}
                onChange={v => {
                  handleSelectionChange(slot.id, v);
                }}
              />
            );
          })}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCancel}>
            Discard selection
          </Button>
          <Button
            className="flex-1"
            disabled={!allSlotsFilled || mutation.isPending}
            onClick={handleConfirm}
          >
            Add to Order
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// ComboBuilderSheet — public component
// ---------------------------------------------------------------------------

export interface ComboBuilderSheetProps {
  combo: Product | null;
  tabId: string;
  open: boolean;
  overrideActive: boolean;
  onClose: () => void;
}

/**
 * ComboBuilderSheet renders a bottom sheet with slot selection for combo products.
 * Validates all required slots are filled before enabling "Add to Order".
 * On confirm, calls add_combo_to_tab RPC via useAddComboToTab mutation.
 */
export function ComboBuilderSheet({
  combo,
  tabId,
  open,
  overrideActive,
  onClose,
}: ComboBuilderSheetProps) {
  if (!combo) return null;

  return (
    <ComboBuilderSheetInner
      combo={combo}
      tabId={tabId}
      open={open}
      overrideActive={overrideActive}
      onClose={onClose}
    />
  );
}
