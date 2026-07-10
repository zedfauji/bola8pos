import { useMemo, useState } from 'react';
import type { Product, Modifier } from '@entities/product/model/types';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Button } from '@shared/ui/button';
import { Checkbox } from '@shared/ui/checkbox';
import { Label } from '@shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@shared/ui/sheet';

interface ModifierSheetProps {
  product: Product;
  open: boolean;
  onConfirm: (selectedModifiers: Modifier[]) => void;
  onClose: () => void;
}

export function ModifierSheet({ product, open, onConfirm, onClose }: ModifierSheetProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);

  const runningTotal = useMemo(() => {
    const modifierSum = selectedModifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    return Math.round((product.basePrice + modifierSum) * 100) / 100;
  }, [product, selectedModifiers]);

  const handleToggleModifier = (modifier: Modifier, checked: boolean) => {
    setSelectedModifiers(prev =>
      checked ? [...prev, modifier] : prev.filter(m => m.id !== modifier.id)
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedModifiers);
    setSelectedModifiers([]);
    onClose();
  };

  const handleCancel = () => {
    setSelectedModifiers([]);
    onClose();
  };

  const availableModifiers = product.modifiers;

  return (
    <Sheet
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          handleCancel();
        } else {
          setSelectedModifiers([]);
        }
      }}
    >
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Customize {product.name}</SheetTitle>
          <SheetDescription>Select any modifiers for this item</SheetDescription>
          <div className="flex items-center justify-between gap-4 border-t pt-4 mt-2">
            <span className="text-sm font-medium text-muted-foreground">Item total</span>
            <MoneyDisplay amount={runningTotal} size="lg" />
          </div>
        </SheetHeader>

        <div className="max-h-[calc(80vh-240px)] space-y-4 overflow-y-auto py-6">
          {availableModifiers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No modifiers available for this product
            </p>
          ) : (
            availableModifiers.map(modifier => (
              <div key={modifier.id} className="flex items-center space-x-3 rounded-lg border p-3">
                <Checkbox
                  id={modifier.id}
                  checked={selectedModifiers.some(m => m.id === modifier.id)}
                  onCheckedChange={checked => {
                    handleToggleModifier(modifier, checked === true);
                  }}
                />
                <Label htmlFor={modifier.id} className="flex flex-1 cursor-pointer justify-between">
                  <span>{modifier.name}</span>
                  <span className="font-medium">
                    {modifier.priceDelta > 0
                      ? `+$${modifier.priceDelta.toFixed(2)}`
                      : modifier.priceDelta < 0
                        ? `-$${Math.abs(modifier.priceDelta).toFixed(2)}`
                        : 'Free'}
                  </span>
                </Label>
              </div>
            ))
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Add to Order
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
