import { Trash2 } from 'lucide-react';
import { useEffect, useReducer, useRef } from 'react';
import { useIngredientsActive } from '@entities/ingredient';
import { useModifierInventoryRules } from '@entities/modifier-inventory-rule';
import type {
  Ingredient,
  ModifierInventoryRule,
  ModifierInventoryRuleCreate,
} from '@shared/lib/domain';
import { IngredientAutocomplete, Input, LoadingSpinner, POSButton } from '@shared/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { useManageModifierInventoryRules } from '../model/useManageModifierInventoryRules';

type RuleRow = {
  id: string;
  ingredientId: string;
  delta: string;
};

type EditorState = {
  rows: RuleRow[];
  isDirty: boolean;
};

type EditorAction =
  | { type: 'RESET'; savedRules: ModifierInventoryRule[] | null | undefined }
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'SELECT_INGREDIENT'; rowId: string; ingredient: Ingredient }
  | { type: 'CLEAR_INGREDIENT'; rowId: string }
  | { type: 'SET_DELTA'; rowId: string; value: string }
  | { type: 'MARK_CLEAN' };

let rowCounter = 0;
function nextRowId(): string {
  rowCounter += 1;
  return `rule-row-${String(rowCounter)}`;
}

function rowsFromRules(savedRules: ModifierInventoryRule[]): RuleRow[] {
  return savedRules.map(rule => ({
    id: nextRowId(),
    ingredientId: rule.ingredientId,
    delta: String(rule.delta),
  }));
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'RESET':
      if (action.savedRules == null) {
        return { rows: [], isDirty: false };
      }
      return { rows: rowsFromRules(action.savedRules), isDirty: false };
    case 'ADD_ROW':
      return {
        ...state,
        rows: [...state.rows, { id: nextRowId(), ingredientId: '', delta: '0' }],
        isDirty: true,
      };
    case 'REMOVE_ROW':
      return { ...state, rows: state.rows.filter(r => r.id !== action.rowId), isDirty: true };
    case 'SELECT_INGREDIENT':
      return {
        ...state,
        rows: state.rows.map(r =>
          r.id === action.rowId ? { ...r, ingredientId: action.ingredient.id } : r,
        ),
        isDirty: true,
      };
    case 'CLEAR_INGREDIENT':
      return {
        ...state,
        rows: state.rows.map(r => (r.id === action.rowId ? { ...r, ingredientId: '' } : r)),
        isDirty: true,
      };
    case 'SET_DELTA':
      return {
        ...state,
        rows: state.rows.map(r => (r.id === action.rowId ? { ...r, delta: action.value } : r)),
        isDirty: true,
      };
    case 'MARK_CLEAN':
      return { ...state, isDirty: false };
    default:
      return state;
  }
}

type ModifierIngredientRulesFormProps = {
  modifierId: string;
  onOpenChange: (open: boolean) => void;
};

function ModifierIngredientRulesForm({
  modifierId,
  onOpenChange,
}: ModifierIngredientRulesFormProps) {
  const { data: savedRules, isLoading } = useModifierInventoryRules(modifierId);
  const { data: ingredients = [], isLoading: ingredientsLoading } = useIngredientsActive();
  const { saveRules, isSaving } = useManageModifierInventoryRules();

  const [state, dispatch] = useReducer(reducer, { rows: [], isDirty: false });

  // Sync to saved rules when data arrives — track previous value to avoid spurious resets
  const prevRulesRef = useRef<ModifierInventoryRule[] | null | undefined>(undefined);
  useEffect(() => {
    if (savedRules !== prevRulesRef.current) {
      prevRulesRef.current = savedRules;
      dispatch({ type: 'RESET', savedRules });
    }
  }, [savedRules]);

  async function handleSave() {
    const rules: ModifierInventoryRuleCreate[] = state.rows
      .filter(r => {
        const parsed = parseFloat(r.delta);
        return r.ingredientId.length > 0 && !Number.isNaN(parsed) && parsed !== 0;
      })
      .map(r => ({ modifierId, ingredientId: r.ingredientId, delta: parseFloat(r.delta) }));
    const result = await saveRules({ modifierId, rules });
    if (result != null) {
      dispatch({ type: 'MARK_CLEAN' });
      onOpenChange(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Delta</p>
        <p className="text-xs text-muted-foreground">
          Positive adds usage (e.g. extra cheese). Negative reduces usage (e.g. no ice).
        </p>
      </div>

      <div className="space-y-3">
        {state.rows.length === 0 && (
          <p className="text-muted-foreground text-sm italic">No ingredient rules yet</p>
        )}

        {state.rows.map(row => (
          <div key={row.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <IngredientAutocomplete
                value={row.ingredientId || null}
                ingredients={ingredients}
                isLoading={ingredientsLoading}
                onSelect={ingredient => {
                  dispatch({ type: 'SELECT_INGREDIENT', rowId: row.id, ingredient });
                }}
                onClear={() => {
                  dispatch({ type: 'CLEAR_INGREDIENT', rowId: row.id });
                }}
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                step="0.001"
                value={row.delta}
                onChange={e => {
                  dispatch({ type: 'SET_DELTA', rowId: row.id, value: e.target.value });
                }}
                className="font-mono text-right"
                aria-label="Delta"
              />
            </div>
            <POSButton
              variant="ghost"
              aria-label="Remove ingredient rule row"
              onClick={() => {
                dispatch({ type: 'REMOVE_ROW', rowId: row.id });
              }}
              className="shrink-0 px-2"
            >
              <Trash2 className="size-4 text-destructive" />
            </POSButton>
          </div>
        ))}

        <POSButton
          variant="outline"
          onClick={() => {
            dispatch({ type: 'ADD_ROW' });
          }}
        >
          + Add ingredient
        </POSButton>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <POSButton
          type="button"
          variant="outline"
          touchSize="default"
          onClick={() => {
            onOpenChange(false);
          }}
          disabled={isSaving}
        >
          Cancel
        </POSButton>
        <POSButton
          type="button"
          touchSize="default"
          onClick={() => {
            void handleSave();
          }}
          disabled={!state.isDirty || isSaving}
        >
          {isSaving ? <LoadingSpinner className="mr-2 size-4" /> : null}
          {isSaving ? 'Saving…' : 'Save rules'}
        </POSButton>
      </div>
    </div>
  );
}

type ModifierIngredientRulesDialogProps = {
  modifierId: string | null;
  modifierName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ModifierIngredientRulesDialog({
  modifierId,
  modifierName,
  open,
  onOpenChange,
}: ModifierIngredientRulesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Ingredient rules — {modifierName}</DialogTitle>
        </DialogHeader>
        {open && modifierId != null ? (
          <ModifierIngredientRulesForm
            key={modifierId}
            modifierId={modifierId}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
