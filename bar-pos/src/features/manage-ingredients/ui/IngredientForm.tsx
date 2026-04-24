/**
 * IngredientForm feature component
 *
 * Controlled form with 8 fields for creating or editing an ingredient.
 * No widget imports — pure feature-layer action component.
 * Uses native <select> elements (no @shared/ui/select — not yet installed).
 */
import { useEffect, useState } from 'react';
import type { Ingredient, IngredientCreate } from '@entities/ingredient';
import { Button } from '@shared/ui/button';
import { Checkbox } from '@shared/ui/checkbox';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const UOM_DISPLAY: Record<string, string> = {
  g: 'g — gram',
  kg: 'kg — kilogram',
  ml: 'ml — milliliter',
  L: 'L — liter',
  unit: 'unit — each',
  case_24: 'case_24 — case of 24',
  portion: 'portion — serving',
};

interface UomGroup {
  label: string;
  values: readonly string[];
}

const BASE_UOM_GROUPS: UomGroup[] = [
  { label: 'Weight', values: ['g', 'kg'] },
  { label: 'Volume', values: ['ml', 'L'] },
  { label: 'Count', values: ['unit', 'portion'] },
];

const ALL_UOM_GROUPS: UomGroup[] = [
  { label: 'Weight', values: ['g', 'kg'] },
  { label: 'Volume', values: ['ml', 'L'] },
  { label: 'Count', values: ['unit', 'case_24', 'portion'] },
];


interface Props {
  ingredient: Ingredient | null; // null = create mode
  isPending: boolean;
  onSubmit: (data: IngredientCreate) => void;
  onCancel: () => void;
}

export function IngredientForm({ ingredient, isPending, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(ingredient?.name ?? '');
  const [category, setCategory] = useState(ingredient?.category ?? '');
  const [uom, setUom] = useState(ingredient?.uom ?? '');
  const [purchaseUom, setPurchaseUom] = useState(ingredient?.purchaseUom ?? '');
  const [purchaseToBaseFactor, setPurchaseToBaseFactor] = useState(
    ingredient?.purchaseToBaseFactor?.toString() ?? '1',
  );
  const [costPerBaseUnit, setCostPerBaseUnit] = useState(
    ingredient?.costPerBaseUnit?.toString() ?? '0',
  );
  const [reorderPoint, setReorderPoint] = useState(
    ingredient?.reorderPoint?.toString() ?? '',
  );
  const [isPrep, setIsPrep] = useState(ingredient?.isPrep ?? false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // Reset form when ingredient changes (e.g. switching from create to edit)
  useEffect(() => {
    setName(ingredient?.name ?? '');
    setCategory(ingredient?.category ?? '');
    setUom(ingredient?.uom ?? '');
    setPurchaseUom(ingredient?.purchaseUom ?? '');
    setPurchaseToBaseFactor(ingredient?.purchaseToBaseFactor?.toString() ?? '1');
    setCostPerBaseUnit(ingredient?.costPerBaseUnit?.toString() ?? '0');
    setReorderPoint(ingredient?.reorderPoint?.toString() ?? '');
    setIsPrep(ingredient?.isPrep ?? false);
    setErrors({});
  }, [ingredient]);

  function validate(): boolean {
    const next: Partial<Record<string, string>> = {};
    if (!name.trim()) next['name'] = 'Name is required';
    if (!uom) next['uom'] = 'Base unit is required';
    const factor = parseFloat(purchaseToBaseFactor);
    if (isNaN(factor) || factor <= 0) next['purchaseToBaseFactor'] = 'Factor must be greater than 0';
    const cost = parseFloat(costPerBaseUnit);
    if (!isNaN(cost) && cost < 0) next['costPerBaseUnit'] = 'Cost must be 0 or greater';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    const data: IngredientCreate = {
      name: name.trim(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      uom: uom as any,
      purchaseUom: purchaseUom.length > 0 ? (purchaseUom as IngredientCreate['purchaseUom']) : null,
      purchaseToBaseFactor: parseFloat(purchaseToBaseFactor),
      costPerBaseUnit: parseFloat(costPerBaseUnit) || 0,
      reorderPoint: reorderPoint.length > 0 ? parseFloat(reorderPoint) : null,
      category: category.trim() || null,
      isPrep,
      isActive: true,
    };

    onSubmit(data);
  }

  const isEdit = ingredient != null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-name">Name</Label>
        <Input
          id="ing-name"
          placeholder="e.g. Corona 355ml, Wings, Salsa Mexicana"
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          disabled={isPending}
          autoFocus
          maxLength={100}
        />
        {errors['name'] !== undefined && (
          <p className="text-xs text-destructive">{errors['name']}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-category">Category</Label>
        <Input
          id="ing-category"
          placeholder="e.g. beer-regular, produce, prep"
          value={category}
          onChange={e => {
            setCategory(e.target.value);
          }}
          disabled={isPending}
        />
      </div>

      {/* Base UOM */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-uom">Base unit</Label>
        <select
          id="ing-uom"
          value={uom}
          onChange={e => {
            setUom(e.target.value);
          }}
          disabled={isPending}
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            Select base unit…
          </option>
          {BASE_UOM_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.values.map(v => (
                <option key={v} value={v}>
                  {UOM_DISPLAY[v]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The smallest unit used in recipes (e.g. g, ml, unit)
        </p>
        {errors['uom'] !== undefined && (
          <p className="text-xs text-destructive">{errors['uom']}</p>
        )}
      </div>

      {/* Purchase UOM */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-purchase-uom">Purchase unit</Label>
        <select
          id="ing-purchase-uom"
          value={purchaseUom}
          onChange={e => {
            setPurchaseUom(e.target.value);
          }}
          disabled={isPending}
          className={SELECT_CLASS}
        >
          <option value="">Select purchase unit…</option>
          {ALL_UOM_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.values.map(v => (
                <option key={v} value={v}>
                  {UOM_DISPLAY[v]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          How you receive deliveries (e.g. kg, case_24)
        </p>
      </div>

      {/* Purchase to base factor */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-factor">Units per purchase</Label>
        <Input
          id="ing-factor"
          type="number"
          step="any"
          min="0.000001"
          placeholder="e.g. 1000"
          value={purchaseToBaseFactor}
          onChange={e => {
            setPurchaseToBaseFactor(e.target.value);
          }}
          disabled={isPending}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          How many base units are in one purchase unit
        </p>
        {errors['purchaseToBaseFactor'] !== undefined && (
          <p className="text-xs text-destructive">{errors['purchaseToBaseFactor']}</p>
        )}
      </div>

      {/* Cost per base unit */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-cost">Cost per base unit (MXN)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="ing-cost"
            type="number"
            step="0.0001"
            min="0"
            placeholder="e.g. 0.012"
            value={costPerBaseUnit}
            onChange={e => {
              setCostPerBaseUnit(e.target.value);
            }}
            disabled={isPending}
            className="pl-7 font-mono"
          />
        </div>
        {errors['costPerBaseUnit'] !== undefined && (
          <p className="text-xs text-destructive">{errors['costPerBaseUnit']}</p>
        )}
      </div>

      {/* Reorder point */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-reorder">Reorder point</Label>
        <Input
          id="ing-reorder"
          type="number"
          step="1"
          min="0"
          placeholder="e.g. 2000"
          value={reorderPoint}
          onChange={e => {
            setReorderPoint(e.target.value);
          }}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Alert when stock falls below this level
        </p>
      </div>

      {/* Is prep */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="ing-is-prep"
          checked={isPrep}
          onCheckedChange={checked => {
            setIsPrep(checked === true);
          }}
          disabled={isPending}
        />
        <div className="space-y-0.5">
          <Label htmlFor="ing-is-prep" className="cursor-pointer">
            Prep item
          </Label>
          <p className="text-xs text-muted-foreground">
            Mark if this ingredient is produced in-house (e.g. Salsa Mexicana)
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add ingredient'}
        </Button>
      </div>
    </form>
  );
}
