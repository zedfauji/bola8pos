/**
 * IngredientForm feature component
 *
 * Controlled form with 8 fields for creating or editing an ingredient.
 * No widget imports — pure feature-layer action component.
 * Uses native <select> elements (no @shared/ui/select — not yet installed).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('featMgmt');
  const [name, setName] = useState(ingredient?.name ?? '');
  const [category, setCategory] = useState(ingredient?.category ?? '');
  const [uom, setUom] = useState(ingredient?.uom ?? '');
  const [purchaseUom, setPurchaseUom] = useState(ingredient?.purchaseUom ?? '');
  const [purchaseToBaseFactor, setPurchaseToBaseFactor] = useState(
    ingredient?.purchaseToBaseFactor.toString() ?? '1',
  );
  const [costPerBaseUnit, setCostPerBaseUnit] = useState(
    ingredient?.costPerBaseUnit.toString() ?? '0',
  );
  const [reorderPoint, setReorderPoint] = useState(
    ingredient?.reorderPoint?.toString() ?? '',
  );
  const [isPrep, setIsPrep] = useState(ingredient?.isPrep ?? false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});


  function validate(): boolean {
    const next: Partial<Record<string, string>> = {};
    if (!name.trim()) next['name'] = t('manageIngredients.form.nameRequired');
    if (!uom) next['uom'] = t('manageIngredients.form.baseUnitRequired');
    const factor = parseFloat(purchaseToBaseFactor);
    if (isNaN(factor) || factor <= 0)
      next['purchaseToBaseFactor'] = t('manageIngredients.form.factorMustBeGreaterThanZero');
    const cost = parseFloat(costPerBaseUnit);
    if (!isNaN(cost) && cost < 0)
      next['costPerBaseUnit'] = t('manageIngredients.form.costMustBeZeroOrGreater');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    const data: IngredientCreate = {
      name: name.trim(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
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
        <Label htmlFor="ing-name">{t('manageIngredients.form.nameLabel')}</Label>
        <Input
          id="ing-name"
          placeholder={t('manageIngredients.form.namePlaceholder')}
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          disabled={isPending}
          maxLength={100}
        />
        {errors['name'] !== undefined && (
          <p className="text-xs text-destructive">{errors['name']}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-category">{t('manageIngredients.form.categoryLabel')}</Label>
        <Input
          id="ing-category"
          placeholder={t('manageIngredients.form.categoryPlaceholder')}
          value={category}
          onChange={e => {
            setCategory(e.target.value);
          }}
          disabled={isPending}
        />
      </div>

      {/* Base UOM */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-uom">{t('manageIngredients.form.baseUnitLabel')}</Label>
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
            {t('manageIngredients.form.selectBaseUnit')}
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
          {t('manageIngredients.form.baseUnitHelp')}
        </p>
        {errors['uom'] !== undefined && (
          <p className="text-xs text-destructive">{errors['uom']}</p>
        )}
      </div>

      {/* Purchase UOM */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-purchase-uom">{t('manageIngredients.form.purchaseUnitLabel')}</Label>
        <select
          id="ing-purchase-uom"
          value={purchaseUom}
          onChange={e => {
            setPurchaseUom(e.target.value);
          }}
          disabled={isPending}
          className={SELECT_CLASS}
        >
          <option value="">{t('manageIngredients.form.selectPurchaseUnit')}</option>
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
          {t('manageIngredients.form.purchaseUnitHelp')}
        </p>
      </div>

      {/* Purchase to base factor */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-factor">{t('manageIngredients.form.unitsPerPurchaseLabel')}</Label>
        <Input
          id="ing-factor"
          type="number"
          step="any"
          min="0.000001"
          placeholder={t('manageIngredients.form.unitsPerPurchasePlaceholder')}
          value={purchaseToBaseFactor}
          onChange={e => {
            setPurchaseToBaseFactor(e.target.value);
          }}
          disabled={isPending}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {t('manageIngredients.form.unitsPerPurchaseHelp')}
        </p>
        {errors['purchaseToBaseFactor'] !== undefined && (
          <p className="text-xs text-destructive">{errors['purchaseToBaseFactor']}</p>
        )}
      </div>

      {/* Cost per base unit */}
      <div className="space-y-1.5">
        <Label htmlFor="ing-cost">{t('manageIngredients.form.costPerBaseUnitLabel')}</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="ing-cost"
            type="number"
            step="0.0001"
            min="0"
            placeholder={t('manageIngredients.form.costPerBaseUnitPlaceholder')}
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
        <Label htmlFor="ing-reorder">{t('manageIngredients.form.reorderPointLabel')}</Label>
        <Input
          id="ing-reorder"
          type="number"
          step="1"
          min="0"
          placeholder={t('manageIngredients.form.reorderPointPlaceholder')}
          value={reorderPoint}
          onChange={e => {
            setReorderPoint(e.target.value);
          }}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          {t('manageIngredients.form.reorderPointHelp')}
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
            {t('manageIngredients.form.isPrepLabel')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('manageIngredients.form.isPrepHelp')}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? t('common:actions.saving')
            : isEdit
              ? t('manageIngredients.form.saveChanges')
              : t('manageIngredients.form.addIngredient')}
        </Button>
      </div>
    </form>
  );
}
