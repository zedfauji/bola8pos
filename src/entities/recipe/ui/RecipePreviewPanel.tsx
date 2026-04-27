import type { RecipeWithItems } from '@shared/lib/domain';

type Props = { recipe: RecipeWithItems | null | undefined; isLoading: boolean };

/**
 * RecipePreviewPanel — shows depletion amounts per ingredient for a product's recipe.
 * Displayed in the product settings form to give context when building a recipe.
 */
export function RecipePreviewPanel({ recipe, isLoading }: Props) {
  if (isLoading) return <div className="text-pos-muted text-sm">Loading recipe…</div>;
  if (recipe == null || recipe.items.length === 0) {
    return <p className="text-pos-muted text-sm italic">No recipe yet</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-pos-muted">Will deplete per sale:</p>
      <ul className="space-y-0.5">
        {recipe.items.map(item => (
          <li key={item.id} className="flex justify-between text-sm">
            <span className="font-mono text-xs">{item.ingredientId}</span>
            <span className="tabular-nums">{item.qty / recipe.yieldQty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
