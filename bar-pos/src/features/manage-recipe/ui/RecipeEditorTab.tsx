import { Trash2 } from 'lucide-react';
import { useEffect, useReducer, useRef } from 'react';
import { useIngredientsActive } from '@entities/ingredient';
import { useRecipe, RecipePreviewPanel } from '@entities/recipe';
import type { Ingredient, RecipeItemCreate, RecipeWithItems } from '@shared/lib/domain';
import { IngredientAutocomplete, Input, Label, LoadingSpinner, POSButton } from '@shared/ui';
import { useManageRecipe } from '../model/useManageRecipe';

type RecipeRow = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  qty: string;
};

type EditorState = {
  rows: RecipeRow[];
  yieldQty: string;
  isDirty: boolean;
};

type EditorAction =
  | { type: 'RESET'; savedRecipe: RecipeWithItems | null | undefined }
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'SELECT_INGREDIENT'; rowId: string; ingredient: Ingredient }
  | { type: 'CLEAR_INGREDIENT'; rowId: string }
  | { type: 'SET_QTY'; rowId: string; value: string }
  | { type: 'SET_YIELD'; value: string }
  | { type: 'MARK_CLEAN' };

let rowCounter = 0;
function nextRowId(): string {
  rowCounter += 1;
  return `row-${String(rowCounter)}`;
}

function rowsFromRecipe(savedRecipe: RecipeWithItems): RecipeRow[] {
  return savedRecipe.items.map(item => ({
    id: nextRowId(),
    ingredientId: item.ingredientId,
    ingredientName: item.ingredientId,
    qty: String(item.qty),
  }));
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'RESET':
      if (action.savedRecipe == null) {
        return { rows: [], yieldQty: '1', isDirty: false };
      }
      return {
        rows: rowsFromRecipe(action.savedRecipe),
        yieldQty: String(action.savedRecipe.yieldQty),
        isDirty: false,
      };
    case 'ADD_ROW':
      return {
        ...state,
        rows: [...state.rows, { id: nextRowId(), ingredientId: '', ingredientName: '', qty: '1' }],
        isDirty: true,
      };
    case 'REMOVE_ROW':
      return { ...state, rows: state.rows.filter(r => r.id !== action.rowId), isDirty: true };
    case 'SELECT_INGREDIENT':
      return {
        ...state,
        rows: state.rows.map(r =>
          r.id === action.rowId
            ? { ...r, ingredientId: action.ingredient.id, ingredientName: action.ingredient.name }
            : r,
        ),
        isDirty: true,
      };
    case 'CLEAR_INGREDIENT':
      return {
        ...state,
        rows: state.rows.map(r =>
          r.id === action.rowId ? { ...r, ingredientId: '', ingredientName: '' } : r,
        ),
        isDirty: true,
      };
    case 'SET_QTY':
      return {
        ...state,
        rows: state.rows.map(r => (r.id === action.rowId ? { ...r, qty: action.value } : r)),
        isDirty: true,
      };
    case 'SET_YIELD':
      return { ...state, yieldQty: action.value, isDirty: true };
    case 'MARK_CLEAN':
      return { ...state, isDirty: false };
    default:
      return state;
  }
}

type RecipeEditorTabProps = {
  productId: string;
  productName: string;
};

export function RecipeEditorTab({ productId, productName }: RecipeEditorTabProps) {
  const { data: savedRecipe, isLoading } = useRecipe(productId);
  const { data: ingredients = [], isLoading: ingredientsLoading } = useIngredientsActive();
  const { saveRecipe, isSaving } = useManageRecipe();

  const [state, dispatch] = useReducer(reducer, {
    rows: [],
    yieldQty: '1',
    isDirty: false,
  });

  // Sync to saved recipe when data arrives — track previous value to avoid spurious resets
  const prevRecipeRef = useRef<RecipeWithItems | null | undefined>(undefined);
  useEffect(() => {
    if (savedRecipe !== prevRecipeRef.current) {
      prevRecipeRef.current = savedRecipe;
      dispatch({ type: 'RESET', savedRecipe });
    }
  }, [savedRecipe]);

  async function handleSave() {
    const items: RecipeItemCreate[] = state.rows
      .filter(r => r.ingredientId.length > 0 && parseFloat(r.qty) > 0)
      .map(r => ({ recipeId: '', ingredientId: r.ingredientId, qty: parseFloat(r.qty) }));
    await saveRecipe({
      productId,
      yieldQty: parseFloat(state.yieldQty) || 1,
      notes: undefined,
      items,
    });
    dispatch({ type: 'MARK_CLEAN' });
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

        {state.rows.length === 0 && (
          <p className="text-muted-foreground text-sm italic">No recipe yet</p>
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
                min="0.001"
                step="0.001"
                value={row.qty}
                onChange={e => {
                  dispatch({ type: 'SET_QTY', rowId: row.id, value: e.target.value });
                }}
                className="font-mono text-right"
                aria-label="Quantity"
              />
            </div>
            <POSButton
              variant="ghost"
              aria-label="Remove ingredient row"
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
          className="mt-1"
        >
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
            value={state.yieldQty}
            onChange={e => {
              dispatch({ type: 'SET_YIELD', value: e.target.value });
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
            disabled={!state.isDirty || isSaving}
          >
            {isSaving ? <LoadingSpinner className="mr-2 size-4" /> : null}
            Save recipe
          </POSButton>
          {state.isDirty && (
            <POSButton
              variant="outline"
              onClick={() => {
                dispatch({ type: 'RESET', savedRecipe });
              }}
              disabled={isSaving}
            >
              Discard changes
            </POSButton>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs text-muted-foreground">Depletion preview</p>
          <RecipePreviewPanel recipe={savedRecipe ?? null} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
