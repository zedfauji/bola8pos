import { useMemo, useState, type SyntheticEvent } from 'react';
import { z } from 'zod';
import type { Category, Modifier, Product } from '@shared/lib/domain';
import { ProductCreateSchema, ProductUpdateSchema, UuidSchema } from '@shared/lib/domain';
import { FormField } from '@shared/ui/FormField';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { POSButton } from '@shared/ui/POSButton';
import { ScrollArea } from '@shared/ui/ScrollArea';
import { Checkbox } from '@shared/ui/checkbox';
import { Input } from '@shared/ui/input';

const ModifierIdsSchema = z.array(UuidSchema);

export type ProductFormProps = {
  categories: Category[];
  modifiers: Modifier[];
  /** When set, form is in edit mode */
  initialProduct?: Product | null;
  submitting?: boolean;
  onSubmitCreate: (
    payload: z.infer<typeof ProductCreateSchema> & { modifierIds: string[] }
  ) => void;
  onSubmitUpdate: (
    payload: z.infer<typeof ProductUpdateSchema> & { modifierIds: string[] }
  ) => void;
  onCancel: () => void;
};

export function ProductForm({
  categories,
  modifiers,
  initialProduct,
  submitting = false,
  onSubmitCreate,
  onSubmitUpdate,
  onCancel,
}: ProductFormProps) {
  const isEdit = initialProduct != null;

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [categoryId, setCategoryId] = useState(
    initialProduct?.categoryId ?? categories[0]?.id ?? ''
  );
  const [basePrice, setBasePrice] = useState(initialProduct?.basePrice ?? 0);
  const [happyHourPrice, setHappyHourPrice] = useState<number | null>(
    initialProduct?.happyHourPrice ?? null
  );
  const [sku, setSku] = useState(initialProduct?.sku ?? '');
  const [isActive, setIsActive] = useState(initialProduct?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(initialProduct?.imageUrl ?? '');
  const [modifierIds, setModifierIds] = useState<string[]>(
    () => initialProduct?.modifiers.map(m => m.id) ?? []
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const sortedModifiers = useMemo(
    () => [...modifiers].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [modifiers]
  );

  function toggleModifier(id: string) {
    setModifierIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});

    const modParsed = ModifierIdsSchema.safeParse(modifierIds);
    if (!modParsed.success) {
      setFieldErrors({ modifiers: 'Invalid modifier selection' });
      return;
    }

    const skuVal = sku.trim() === '' ? null : sku.trim();
    const imageVal = imageUrl.trim() === '' ? null : imageUrl.trim();

    const happyHourNormalized =
      happyHourPrice === null || happyHourPrice === 0 ? null : happyHourPrice;

    if (initialProduct != null) {
      const parsed = ProductUpdateSchema.safeParse({
        id: initialProduct.id,
        name,
        categoryId,
        basePrice,
        happyHourPrice: happyHourNormalized,
        sku: skuVal,
        isActive,
        imageUrl: imageVal,
      });
      if (!parsed.success) {
        const flat = z.flattenError(parsed.error);
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(flat.fieldErrors)) {
          const first = Array.isArray(v) ? v[0] : undefined;
          if (first) next[k] = first;
        }
        if (Object.keys(next).length === 0 && parsed.error.issues[0]) {
          next._form = parsed.error.issues[0].message;
        }
        setFieldErrors(next);
        return;
      }
      onSubmitUpdate({ ...parsed.data, modifierIds: modParsed.data });
      return;
    }

    const parsed = ProductCreateSchema.safeParse({
      name,
      categoryId,
      basePrice,
      happyHourPrice: happyHourNormalized,
      sku: skuVal,
      isActive,
      imageUrl: imageVal,
    });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat.fieldErrors)) {
        const first = Array.isArray(v) ? v[0] : undefined;
        if (first) next[k] = first;
      }
      if (Object.keys(next).length === 0 && parsed.error.issues[0]) {
        next._form = parsed.error.issues[0].message;
      }
      setFieldErrors(next);
      return;
    }

    onSubmitCreate({ ...parsed.data, modifierIds: modParsed.data });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[min(70vh,560px)] flex-col gap-4">
      {fieldErrors._form ? <p className="text-sm text-destructive">{fieldErrors._form}</p> : null}

      <FormField label="Name" required error={fieldErrors.name ?? ''}>
        <Input
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>

      <FormField label="Category" required error={fieldErrors.categoryId ?? ''}>
        <select
          className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
          value={categoryId}
          onChange={e => {
            setCategoryId(e.target.value);
          }}
          disabled={submitting || categories.length === 0}
        >
          {categories.length === 0 ? <option value="">No categories</option> : null}
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Base price" required error={fieldErrors.basePrice ?? ''}>
        <MoneyInput value={basePrice} onChange={setBasePrice} disabled={submitting} />
      </FormField>

      <FormField
        label="Happy hour price"
        hint="Optional — leave at 0.00 and clear to use base price during happy hour."
        error={fieldErrors.happyHourPrice ?? ''}
      >
        <MoneyInput
          value={happyHourPrice ?? 0}
          onChange={v => {
            setHappyHourPrice(v === 0 ? null : v);
          }}
          disabled={submitting}
        />
      </FormField>

      <FormField label="SKU" error={fieldErrors.sku ?? ''}>
        <Input
          value={sku}
          onChange={e => {
            setSku(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>

      <FormField label="Image URL" error={fieldErrors.imageUrl ?? ''}>
        <Input
          value={imageUrl}
          onChange={e => {
            setImageUrl(e.target.value);
          }}
          placeholder="https://…"
          disabled={submitting}
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="product-active"
          checked={isActive}
          onCheckedChange={v => {
            setIsActive(v === true);
          }}
          disabled={submitting}
        />
        <label htmlFor="product-active" className="text-sm font-medium">
          Active
        </label>
      </div>

      <FormField label="Modifiers" error={fieldErrors.modifiers ?? ''}>
        <ScrollArea className="max-h-40 rounded-md border p-2">
          <ul className="space-y-2 pr-2">
            {sortedModifiers.length === 0 ? (
              <li className="text-muted-foreground text-sm">No modifiers defined.</li>
            ) : (
              sortedModifiers.map(m => (
                <li key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`mod-${m.id}`}
                    checked={modifierIds.includes(m.id)}
                    onCheckedChange={() => {
                      toggleModifier(m.id);
                    }}
                    disabled={submitting}
                  />
                  <label htmlFor={`mod-${m.id}`} className="text-sm">
                    {m.name}{' '}
                    <span className="text-muted-foreground">
                      ({m.priceDelta >= 0 ? '+' : ''}
                      {m.priceDelta.toFixed(2)})
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </FormField>

      <div className="mt-auto flex flex-wrap justify-end gap-2 border-t pt-4">
        <POSButton
          type="button"
          variant="outline"
          touchSize="default"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </POSButton>
        <POSButton
          type="submit"
          touchSize="default"
          disabled={submitting || categories.length === 0}
        >
          {submitting ? 'Saving…' : isEdit ? 'Save product' : 'Create product'}
        </POSButton>
      </div>
    </form>
  );
}
