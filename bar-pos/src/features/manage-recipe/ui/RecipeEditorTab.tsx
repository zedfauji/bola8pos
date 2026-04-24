import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useIngredientsActive } from '@entities/ingredient';
import { useRecipe, RecipePreviewPanel } from '@entities/recipe';
import type { Ingredient, RecipeItemCreate } from '@shared/lib/domain';
import { IngredientAutocomplete, Input, Label, LoadingSpinner, POSButton } from '@shared/ui';
import { useManageRecipe } from '../model/useManageRecipe';

type RecipeRow = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  qty: string;
};

type RecipeEditorTabProps = {
  productId: string;
  productName: string;
};

let rowCounter = 0;
function nextRowId(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export function RecipeEditorTab({ productId, productName }: RecipeEditorTabProps) {
  const { data: savedRecipe, isLoading } = useRecipe(productId);
  const { data: ingredients = [], isLoading: ingredientsLoading } = useIngredientsActive();
  const { saveRecipe, isSaving } = useManageRecipe();
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [yieldQty, setYieldQty] = useState('1');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (savedRecipe == null) {
      setRows([]);
      setYieldQty('1');
    } else {
      setRows(
        savedRecipe.items.map(item => ({
          id: nextRowId(),
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientId,
          qty: String(item.qty),
        })),
      );
      setYieldQty(String(savedRecipe.yieldQty));
    }
    setIsDirty(false);
  }, [savedRecipe]);

  function handleAddRow() {
    setRows(prev => [...prev, { id: nextRowId(), ingredientId: '', ingredientName: '', qty: '1' }]);
    setIsDirty(true);
  }

  function handleRemoveRow(rowId: string) {
    setRows(prev => prev.filter(r => r.id !== rowId));
    setIsDirty(true);
  }

  function handleSelectIngredient(rowId: string, ingredient: Ingredient) {
    setRows(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, ingredientId: ingredient.id, ingredientName: ingredient.name }
          : r,
      ),
    );
    setIsDirty(true);
  }

  function handleClearIngredient(rowId: string) {
    setRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, ingredientId: '', ingredientName: '' } : r)),
    );
    setIsDirty(true);
  }

  function handleQtyChange(rowId: string, value: string) {
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, qty: value } : r)));
    setIsDirty(true);
  }

  function handleDiscard() {
    if (savedRecipe == null) {
      setRows([]);
      setYieldQty('1');
    } else {
      setRows(
        savedRecipe.items.map(item => ({
          id: nextRowId(),
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientId,
          qty: String(item.qty),
        })),
      );
      setYieldQty(String(savedRecipe.yieldQty));
    }
    setIsDirty(false);
  }

  async function handleSave() {
    const items: RecipeItemCreate[] = rows
      .filter(r => r.ingredientId.length > 0 && parseFloat(r.qty) > 0)
      .map(r => ({ recipeId: '', ingredientId: r.ingredientId, qty: parseFloat(r.qty) }));
    await saveRecipe({
      productId,
      yieldQty: parseFloat(yieldQty) || 1,
      notes: undefined,
      items,
    });
    setIsDirty(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_260px]">
      {/* Left column — ingredient rows */}
      <div className="space-y-3">
        <p className="text-sm font-medium">
          Ingredients for <span className="font-semibold">{productName}</span>
        </p>

        {rows.length === 0 && (
          <p className="text-pos-muted text-sm italic">No recipe yet</p>
        )}

        {rows.map(row => (
          <div key={row.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <IngredientAutocomplete
                value={row.ingredientId || null}
                ingredients={ingredients}
                isLoading={ingredientsLoading}
                onSelect={ingredient => {
                  handleSelectIngredient(row.id, ingredient);
                }}
                onClear={() => {
                  handleClearIngredient(row.id);
                }}
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={row.qty}
                onChange={e => {
                  handleQtyChange(row.id, e.target.value);
                }}
                className="font-mono text-right"
                aria-label="Quantity"
              />
            </div>
            <POSButton
              variant="ghost"
              aria-label="Remove ingredient row"
              onClick={() => {
                handleRemoveRow(row.id);
              }}
              className="shrink-0 px-2"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </POSButton>
          </div>
        ))}

        <POSButton variant="outline" onClick={handleAddRow} className="mt-1">
          + Add ingredient
        </POSButton>
      </div>

      {/* Right column — yield + save controls + preview */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="yield-qty">Yield (servings)</Label>
          <Input
            id="yield-qty"
            type="number"
            min="0.001"
            step="0.001"
            value={yieldQty}
            onChange={e => {
              setYieldQty(e.target.value);
              setIsDirty(true);
            }}
            className="mt-1 font-mono"
          />
        </div>

        <div className="flex flex-col gap-2">
          <POSButton
            touchSize="large"
            onClick={() => {
              void handleSave();
            }}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
            Save recipe
          </POSButton>
          {isDirty && (
            <POSButton variant="outline" onClick={handleDiscard} disabled={isSaving}>
              Discard changes
            </POSButton>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs text-pos-muted">Depletion preview</p>
          <RecipePreviewPanel recipe={savedRecipe ?? null} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
