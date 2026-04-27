import { toast } from 'sonner';
import { useMutationSaveRecipe } from '@entities/recipe';
import type { RecipeItemCreate, RecipeWithItems } from '@shared/lib/domain';

type SaveRecipeArgs = {
  productId: string;
  yieldQty: number;
  notes: string | undefined;
  items: RecipeItemCreate[];
};

type UseManageRecipeReturn = {
  saveRecipe: (input: SaveRecipeArgs) => Promise<RecipeWithItems | null>;
  isSaving: boolean;
};

export function useManageRecipe(): UseManageRecipeReturn {
  const mutation = useMutationSaveRecipe();

  const saveRecipe = async (input: SaveRecipeArgs): Promise<RecipeWithItems | null> => {
    const result = await mutation.mutateAsync(input);
    if (!result.ok) {
      toast.error(result.error.message);
      return null;
    }
    toast.success('Recipe saved');
    return result.data;
  };

  return { saveRecipe, isSaving: mutation.isPending };
}
