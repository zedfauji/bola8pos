import { toast } from 'sonner';
import { useMutationSaveModifierInventoryRules } from '@entities/modifier-inventory-rule';
import type { ModifierInventoryRule, ModifierInventoryRuleCreate } from '@shared/lib/domain';
import i18n from '@shared/lib/i18n';

type SaveModifierInventoryRulesArgs = {
  modifierId: string;
  rules: ModifierInventoryRuleCreate[];
};

type UseManageModifierInventoryRulesReturn = {
  saveRules: (input: SaveModifierInventoryRulesArgs) => Promise<ModifierInventoryRule[] | null>;
  isSaving: boolean;
};

export function useManageModifierInventoryRules(): UseManageModifierInventoryRulesReturn {
  const mutation = useMutationSaveModifierInventoryRules();

  const saveRules = async (
    input: SaveModifierInventoryRulesArgs,
  ): Promise<ModifierInventoryRule[] | null> => {
    const result = await mutation.mutateAsync(input);
    if (!result.ok) {
      toast.error(result.error.message);
      return null;
    }
    toast.success(i18n.t('featMgmt:manageModifierInventoryRules.rulesSaved'));
    return result.data;
  };

  return { saveRules, isSaving: mutation.isPending };
}
