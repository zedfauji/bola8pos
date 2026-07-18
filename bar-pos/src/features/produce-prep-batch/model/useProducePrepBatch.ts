/**
 * Orchestrates prep batch recording with user-facing toasts.
 */
import { toast } from 'sonner';

import { useMutationCreatePrepProduction } from '@entities/prep';
import type { PrepProduction, PrepProductionCreate } from '@entities/prep';
import i18n from '@shared/lib/i18n';
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
      toast.success(
        i18n.t('featMgmt:producePrepBatch.batchRecorded', {
          name: ingredientName,
          qty: input.qtyProduced,
          uom,
        })
      );
      return result;
    }

    switch (result.error.code) {
      case 'PREP_INGREDIENT_REQUIRED':
        toast.error(i18n.t('featMgmt:producePrepBatch.errorPrepIngredientRequired'));
        break;
      case 'INVENTORY_NEGATIVE':
        toast.error(i18n.t('featMgmt:producePrepBatch.errorInventoryNegative'));
        break;
      case 'NOT_FOUND':
        toast.error(i18n.t('featMgmt:producePrepBatch.errorNotFound'));
        break;
      default:
        toast.error(i18n.t('featMgmt:producePrepBatch.errorDefault'));
    }

    return result;
  }

  return {
    produce,
    isPending: mutation.isPending,
  };
}
