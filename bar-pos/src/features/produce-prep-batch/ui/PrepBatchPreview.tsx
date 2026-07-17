import type { RecipeWithItems } from '@shared/lib/domain';
import { computePrepConsumption } from '@shared/lib/prep-math';

export interface PrepBatchPreviewProps {
  recipe: RecipeWithItems;
  qtyProduced: number;
  prepIngredient: { name: string; uom: string };
  currentStock: Map<string, { qty: number; uom: string; name: string }>;
}

export function PrepBatchPreview({
  recipe,
  qtyProduced,
  prepIngredient,
  currentStock,
}: PrepBatchPreviewProps) {
  const rows = computePrepConsumption(
    qtyProduced,
    recipe.items.map(i => ({ ingredientId: i.ingredientId, qty: i.qty })),
    recipe.yieldQty,
  );

  return (
    <div
      className="space-y-3 rounded-lg border bg-muted p-4"
      aria-label="Ingredient consumption preview"
      role="status"
    >
      <p className="text-sm font-semibold">Raw material consumption preview</p>
      <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
        <span>Ingredient</span>
        <span className="text-right">Quantity</span>
      </div>
      <div className="space-y-2">
        {rows.map(row => {
          const stock = currentStock.get(row.ingredientId);
          const need = Math.abs(row.delta);
          const isInsufficient = stock ? stock.qty < need : true;
          const label = stock?.name ?? row.ingredientId;
          return (
            <div
              key={row.ingredientId}
              className="grid grid-cols-2 gap-2 rounded border border-border bg-background px-2 py-1 text-sm"
              aria-label={
                isInsufficient
                  ? `${label}: insufficient — need ${need.toFixed(2)}, have ${stock ? String(stock.qty) : '0'}`
                  : undefined
              }
            >
              <span className="truncate">{label}</span>
              <span
                className={`text-right font-mono tabular-nums ${isInsufficient ? 'text-pos-danger' : ''}`}
              >
                {row.delta.toFixed(2)} {stock?.uom ?? ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t pt-2 text-sm text-pos-accent font-mono tabular-nums">
        +{qtyProduced.toFixed(2)} {prepIngredient.uom} ({prepIngredient.name})
      </div>
    </div>
  );
}
