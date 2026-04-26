/**
 * Orchestrates prep batch recording with user-facing toasts.
 */
import { toast } from 'sonner';

import { useMutationCreatePrepProduction } from '@entities/prep';
import type { PrepProduction, PrepProductionCreate } from '@entities/prep';
import type { Result } from '@shared/lib/result';

export function useProducePrepBatch() {
  const mutation = useMutationCreatePrepProduction();

  async function produce(
    input: PrepProductionCreate,
    ingredientName: string,
    uom: string,
  ): Promise<Result<PrepProduction>> {
    const result = await mutation.mutateAsync(input);

    if (result.ok) {
      toast.success(`Batch recorded. ${ingredientName} +${String(input.qtyProduced)} ${uom}.`);
      return result;
    }

    switch (result.error.code) {
      case 'PREP_INGREDIENT_REQUIRED':
        toast.error(
          'That ingredient is not marked as a prep ingredient. Check ingredient settings.',
        );
        break;
      case 'INVENTORY_NEGATIVE':
        toast.error('Insufficient stock — reduce batch size or check raw ingredient levels.');
        break;
      case 'NOT_FOUND':
        toast.error('Prep ingredient not found. Refresh and try again.');
        break;
      default:
        toast.error('Could not record batch. Check your connection and try again.');
    }

    return result;
  }

  return {
    produce,
    isPending: mutation.isPending,
  };
}
