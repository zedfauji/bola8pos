import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import type { Ingredient } from '@shared/lib/domain';
import { cn } from '@shared/lib/utils';
import { POSButton } from '@shared/ui/POSButton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * IngredientAutocomplete — shared/ui primitive.
 *
 * FSD: shared/* cannot import from entities/*. The parent component (widget or feature)
 * is responsible for fetching ingredients via useIngredients() and passing them as props.
 */
type IngredientAutocompleteProps = {
  value: string | null;
  onSelect: (ingredient: Ingredient) => void;
  onClear: () => void;
  ingredients?: Ingredient[];
  isLoading?: boolean;
  disabled?: boolean;
};

export function IngredientAutocomplete({
  value,
  onSelect,
  onClear,
  ingredients = [],
  isLoading = false,
  disabled = false,
}: IngredientAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const selected = ingredients.find(i => i.id === value) ?? null;

  function getStockColor(ingredient: Ingredient): string {
    if (ingredient.quantityOnHand <= 0) return 'text-destructive';
    if (
      ingredient.reorderPoint != null &&
      ingredient.quantityOnHand <= ingredient.reorderPoint
    ) {
      return 'text-yellow-500';
    }
    return 'text-pos-accent';
  }

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <POSButton
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={selected ? `Selected: ${selected.name}` : 'Select ingredient'}
            disabled={disabled}
            className="h-11 w-full justify-between"
          >
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : selected ? (
              <span className="truncate">{selected.name}</span>
            ) : (
              <span className="text-pos-muted">Select ingredient…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </POSButton>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search ingredients…" />
            <CommandList>
              <CommandEmpty>No ingredient found.</CommandEmpty>
              <CommandGroup>
                {ingredients.map(ingredient => (
                  <CommandItem
                    key={ingredient.id}
                    value={ingredient.name}
                    onSelect={() => {
                      onSelect(ingredient);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === ingredient.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="flex-1 truncate">{ingredient.name}</span>
                    <span
                      className={cn('ml-2 text-xs tabular-nums', getStockColor(ingredient))}
                    >
                      {ingredient.quantityOnHand} {ingredient.uom}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && !disabled && (
        <POSButton
          variant="ghost"
          aria-label="Clear ingredient selection"
          className="absolute right-8 top-0 h-11 px-2"
          onClick={e => {
            e.stopPropagation();
            onClear();
          }}
        >
          <X className="h-4 w-4" />
        </POSButton>
      )}
    </div>
  );
}
