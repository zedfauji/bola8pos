import { useReducer, useMemo } from 'react';

import { useIngredientsActive } from '@entities/ingredient';
import { useRecipeByPrepIngredient } from '@entities/prep';
import { PrepProductionCreateSchema } from '@shared/lib/domain';
import {
  FormField,
  IngredientAutocomplete,
  Input,
  Label,
  LoadingSpinner,
  POSButton,
} from '@shared/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { useProducePrepBatch } from '../model/useProducePrepBatch';
import { PrepBatchPreview } from './PrepBatchPreview';

type State = {
  selectedIngredientId: string | null;
  qty: string;
  notes: string;
};

type Action =
  | { type: 'SET_INGREDIENT'; id: string | null }
  | { type: 'SET_QTY'; qty: string }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_INGREDIENT':
      return { ...state, selectedIngredientId: action.id };
    case 'SET_QTY':
      return { ...state, qty: action.qty };
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'RESET':
      return { selectedIngredientId: null, qty: '', notes: '' };
    default:
      return state;
  }
}

export interface PrepProductionFormProps {
  open: boolean;
  onClose: () => void;
}

export function PrepProductionForm({ open, onClose }: PrepProductionFormProps) {
  const [state, dispatch] = useReducer(reducer, {
    selectedIngredientId: null,
    qty: '',
    notes: '',
  });
  const { data: ingredients = [], isLoading } = useIngredientsActive();
  const prepIngredients = useMemo(() => ingredients.filter(i => i.isPrep), [ingredients]);
  const { data: recipe, isLoading: recipeLoading } = useRecipeByPrepIngredient(state.selectedIngredientId);
  const { produce, isPending } = useProducePrepBatch();

  const selected = ingredients.find(i => i.id === state.selectedIngredientId) ?? null;
  const parsedQty = parseFloat(state.qty);
  const isValid =
    state.selectedIngredientId !== null && !Number.isNaN(parsedQty) && parsedQty > 0;

  const stockMap = useMemo(
    () =>
      new Map(
        ingredients.map(i => [i.id, { qty: i.quantityOnHand, uom: i.uom, name: i.name }] as const),
      ),
    [ingredients],
  );

  function handleClose() {
    dispatch({ type: 'RESET' });
    onClose();
  }

  async function handleSubmit() {
    if (!selected || !isValid) return;
    const parsed = PrepProductionCreateSchema.safeParse({
      prepIngredientId: selected.id,
      qtyProduced: parsedQty,
      notes: state.notes.trim() === '' ? undefined : state.notes.trim(),
      producedBy: undefined,
    });
    if (!parsed.success) return;

    const result = await produce(parsed.data, selected.name, selected.uom);
    if (result.ok) {
      handleClose();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record prep batch</DialogTitle>
          <DialogDescription>Credit a prep ingredient and consume raw materials.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FormField label="Prep ingredient">
            <IngredientAutocomplete
              value={state.selectedIngredientId}
              onSelect={ing => {
                dispatch({ type: 'SET_INGREDIENT', id: ing.id });
              }}
              onClear={() => {
                dispatch({ type: 'SET_INGREDIENT', id: null });
              }}
              ingredients={prepIngredients}
              isLoading={isLoading}
              disabled={isPending}
              commandInputPlaceholder="Search prep ingredients…"
            />
          </FormField>

          <FormField
            label="Quantity produced"
            hint={selected ? `Unit: ${selected.uom}` : 'Select an ingredient to see units.'}
          >
            <Input
              type="number"
              min={0.01}
              step={0.01}
              placeholder="e.g. 10"
              value={state.qty}
              onChange={e => {
                dispatch({ type: 'SET_QTY', qty: e.target.value });
              }}
              disabled={isPending}
            />
          </FormField>

          <div className="space-y-2">
            <Label htmlFor="prep-notes">Notes (optional)</Label>
            <textarea
              id="prep-notes"
              maxLength={200}
              rows={2}
              placeholder="e.g. Morning batch — double yield"
              value={state.notes}
              onChange={e => {
                dispatch({ type: 'SET_NOTES', notes: e.target.value });
              }}
              disabled={isPending}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {recipe != null && parsedQty > 0 ? (
            <PrepBatchPreview
              recipe={recipe}
              qtyProduced={parsedQty}
              prepIngredient={{ name: selected?.name ?? '', uom: selected?.uom ?? '' }}
              currentStock={stockMap}
            />
          ) : null}

          {state.selectedIngredientId != null && recipeLoading ? (
            <LoadingSpinner size={20} className="py-2" />
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <POSButton
            type="button"
            touchSize="large"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              handleClose();
            }}
          >
            Discard batch
          </POSButton>
          <POSButton
            type="button"
            touchSize="xl"
            disabled={!isValid || isPending || recipeLoading}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {isPending ? <LoadingSpinner size={20} className="p-0" /> : 'Record batch'}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
