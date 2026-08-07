/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * ComboBuilderForm
 *
 * Feature component: admin creates/edits a combo product with slots and options.
 * Uses `const db = supabase as any` pre-regen cast — combo_slots and combo_slot_options
 * tables are not yet fully typed in supabase.types.ts.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCombo, useComboSlots, useComboSlotOptions, comboKeys } from '@entities/combo';
import type { ComboSlot, ComboSlotOption } from '@entities/combo';
import type { Product } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

// Pre-regen cast — remove once supabase.types.ts is regenerated after combo migrations
const db = supabase as any;

// ============================================================================
// PRODUCT PICKER (combo-eligible products)
// ============================================================================

function useComboEligibleProducts() {
  return useQuery({
    // eslint-disable-next-line i18next/no-literal-string -- TanStack Query cache key, not UI copy
    queryKey: ['combo_eligible_products'],
    queryFn: async (): Promise<Product[]> => {
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder table/column identifiers, not UI copy */
      const { data, error } = await db
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_combo', false)
        .order('name', { ascending: true });
      /* eslint-enable i18next/no-literal-string */
      if (error) {
        logger.error('useComboEligibleProducts: query failed', { error });
        throw error;
      }
      return (data ?? []) as Product[];
    },
  });
}

// ============================================================================
// SLOT FORM (inline slot creation)
// ============================================================================

interface SlotDraft {
  label: string;
  slotType: 'product' | 'pool_time';
  minQty: number;
  maxQty: number;
}

interface SlotFormProps {
  onSave: (draft: SlotDraft) => void;
  onCancel: () => void;
}

function SlotForm({ onSave, onCancel }: SlotFormProps) {
  const { t } = useTranslation('featMgmt');
  const labelId = useId();
  const slotTypeId = useId();
  const minQtyId = useId();
  const maxQtyId = useId();

  const [label, setLabel] = useState('');
  const [slotType, setSlotType] = useState<'product' | 'pool_time'>('product');
  const [minQty, setMinQty] = useState('1');
  const [maxQty, setMaxQty] = useState('1');

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error(t('manageCombos.builder.slotLabelRequired'));
      return;
    }
    const min = parseInt(minQty, 10);
    const max = parseInt(maxQty, 10);
    if (isNaN(min) || isNaN(max) || min < 1 || max < 1 || min > max) {
      toast.error(t('manageCombos.builder.invalidQtyRange'));
      return;
    }
    onSave({ label: trimmed, slotType, minQty: min, maxQty: max });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-3 space-y-3 bg-muted/30">
      <p className="text-sm font-medium">{t('manageCombos.builder.newSlotTitle')}</p>
      <Input
        id={labelId}
        value={label}
        onChange={e => {
          setLabel(e.target.value);
        }}
        placeholder={t('manageCombos.builder.slotLabelPlaceholder')}
        maxLength={100}
        required
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <label htmlFor={slotTypeId} className="text-xs text-muted-foreground">
          {t('manageCombos.builder.typeLabel')}
        </label>
        <select
          id={slotTypeId}
          value={slotType}
          onChange={e => {
            setSlotType(e.target.value as 'product' | 'pool_time');
          }}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="product">{t('manageCombos.builder.productOption')}</option>
          <option value="pool_time">{t('manageCombos.builder.poolTimeOption')}</option>
        </select>
        <label htmlFor={minQtyId} className="text-xs text-muted-foreground ml-2">
          {t('manageCombos.builder.minLabel')}
        </label>
        <Input
          id={minQtyId}
          type="number"
          min={1}
          value={minQty}
          onChange={e => {
            setMinQty(e.target.value);
          }}
          className="w-16 text-sm"
        />
        <label htmlFor={maxQtyId} className="text-xs text-muted-foreground">
          {t('manageCombos.builder.maxLabel')}
        </label>
        <Input
          id={maxQtyId}
          type="number"
          min={1}
          value={maxQty}
          onChange={e => {
            setMaxQty(e.target.value);
          }}
          className="w-16 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('manageCombos.builder.addSlot')}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// SLOT EDITOR (per-slot options)
// ============================================================================

interface SlotEditorProps {
  slot: ComboSlot;
  onDeleteSlot: () => void;
}

function SlotEditor({ slot, onDeleteSlot }: SlotEditorProps) {
  const { t } = useTranslation('featMgmt');
  const { data: options, isLoading } = useComboSlotOptions(slot.id);
  const { data: eligibleProducts } = useComboEligibleProducts();
  const qc = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<
    { type: 'slot' } | { type: 'option'; optionId: string } | null
  >(null);
  const [addingOption, setAddingOption] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const addOptionMutation = useMutation({
    mutationFn: async ({
      comboSlotId,
      childProductId,
    }: {
      comboSlotId: string;
      childProductId: string;
    }) => {
      const nextSortOrder = (options ?? []).length;
      const { error } = await db.from('combo_slot_options').insert({
        combo_slot_id: comboSlotId,
        child_product_id: childProductId,
        sort_order: nextSortOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.slotOptions(slot.id) });
      setAddingOption(false);
      setSelectedProductId('');
      toast.success(t('manageCombos.builder.optionAdded'));
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      // DB trigger raises: NESTED_COMBO_FORBIDDEN: Product % is a combo and cannot be a slot option
      const isNestedCombo =
        msg.includes('NESTED_COMBO_FORBIDDEN') ||
        // eslint-disable-next-line i18next/no-literal-string -- matching a fixed backend error substring, not UI copy
        msg.toLowerCase().includes('nested combo');
      if (isNestedCombo) {
        const prod = (eligibleProducts ?? []).find(p => p.id === selectedProductId);
        const name = prod?.name ?? t('manageCombos.builder.theSelectedProduct');
        toast.error(t('manageCombos.builder.nestedComboError', { name }));
      } else {
        toast.error(msg.length > 0 ? msg : t('manageCombos.builder.failedToAddOption'));
      }
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await db.from('combo_slot_options').delete().eq('id', optionId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.slotOptions(slot.id) });
      setDeleteConfirm(null);
      toast.success(t('manageCombos.builder.optionRemoved'));
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('manageCombos.builder.failedToRemoveOption'));
    },
  });

  const resolvedOptions = options ?? [];
  /* eslint-disable i18next/no-literal-string -- Tailwind class strings, not UI copy */
  const slotTypeBadge =
    slot.slotType === 'product'
      ? 'bg-primary/20 text-primary'
      : 'bg-muted text-muted-foreground';
  /* eslint-enable i18next/no-literal-string */

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{slot.label}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${slotTypeBadge}`}>
              {slot.slotType === 'pool_time'
                ? t('manageCombos.builder.poolTimeOption')
                : t('manageCombos.builder.productOption')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('manageCombos.builder.qtyRange', { min: slot.minQty, max: slot.maxQty })}
              {slot.isRequired
                ? t('manageCombos.builder.requiredSuffix')
                : t('manageCombos.builder.optionalSuffix')}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('manageCombos.builder.deleteSlotAria', { label: slot.label })}
          onClick={() => {
            setDeleteConfirm({ type: 'slot' });
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Options list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t('manageCombos.builder.loadingOptions')}</p>
      ) : resolvedOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t('manageCombos.builder.noOptionsYet')}
        </p>
      ) : (
        <ul className="space-y-1">
          {resolvedOptions.map((opt: ComboSlotOption) => {
            const prod = (eligibleProducts ?? []).find(p => p.id === opt.childProductId);
            const optLabel =
              prod?.name ??
              (opt.prepaidMinutes != null
                ? t('manageCombos.builder.prepaidMinutes', { minutes: opt.prepaidMinutes })
                : (opt.childProductId ?? '—'));
            return (
              <li key={opt.id} className="flex items-center justify-between text-sm py-0.5">
                <span className="truncate">{optLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('manageCombos.builder.removeOptionAria', { label: optLabel })}
                  onClick={() => {
                    setDeleteConfirm({ type: 'option', optionId: opt.id });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add option */}
      {slot.slotType === 'product' &&
        (addingOption ? (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedProductId}
              onChange={e => {
                setSelectedProductId(e.target.value);
              }}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
              aria-label={t('manageCombos.builder.pickProductAria')}
            >
              <option value="">{t('manageCombos.builder.pickProductPlaceholder')}</option>
              {(eligibleProducts ?? []).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={!selectedProductId || addOptionMutation.isPending}
              onClick={() => {
                if (selectedProductId) {
                  addOptionMutation.mutate({
                    comboSlotId: slot.id,
                    childProductId: selectedProductId,
                  });
                }
              }}
            >
              {t('manageCombos.builder.add')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddingOption(false);
                setSelectedProductId('');
              }}
            >
              {t('common:actions.cancel')}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAddingOption(true);
            }}
          >
            <Plus className="size-3.5 mr-1" />
            {t('manageCombos.builder.addOption')}
          </Button>
        ))}

      {/* Delete confirmations */}
      {deleteConfirm?.type === 'slot' && (
        <ConfirmDialog
          open
          title={t('manageCombos.builder.removeSlotTitle', { label: slot.label })}
          description={t('manageCombos.builder.removeSlotDescription')}
          confirmLabel={t('manageCombos.builder.removeSlotConfirmLabel')}
          variant="destructive"
          onConfirm={() => {
            setDeleteConfirm(null);
            onDeleteSlot();
          }}
          onCancel={() => {
            setDeleteConfirm(null);
          }}
        />
      )}
      {deleteConfirm?.type === 'option' && (
        <ConfirmDialog
          open
          title={t('manageCombos.builder.removeOptionTitle')}
          description={t('manageCombos.builder.removeOptionDescription')}
          confirmLabel={t('manageCombos.builder.removeOptionConfirmLabel')}
          variant="destructive"
          isLoading={deleteOptionMutation.isPending}
          onConfirm={() => {
            deleteOptionMutation.mutate(deleteConfirm.optionId);
          }}
          onCancel={() => {
            setDeleteConfirm(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMBO BUILDER FORM (main)
// ============================================================================

interface Props {
  comboId: string | null;
  onSaved: (newId: string) => void;
}

export function ComboBuilderForm({ comboId, onSaved }: Props) {
  const { t } = useTranslation('featMgmt');
  const nameInputId = useId();
  const priceInputId = useId();

  const { data: combo, isLoading: comboLoading } = useCombo(comboId);
  const { data: slots, isLoading: slotsLoading } = useComboSlots(comboId);
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);

  // Sync name from fetched combo (once)
  if (!nameInitialized && combo) {
    setNameInitialized(true);
    setName(combo.name);
    setPriceOverride(combo.comboPriceOverride != null ? String(combo.comboPriceOverride) : '');
  }

  const saveComboMutation = useMutation({
    mutationFn: async ({
      id,
      comboName,
      price,
    }: {
      id: string;
      comboName: string;
      price: number | null;
    }) => {
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder table/column identifiers, not UI copy */
      const { error } = await db
        .from('products')
        .update({ name: comboName, combo_price_override: price })
        .eq('id', id);
      /* eslint-enable i18next/no-literal-string */
      if (error) throw error;
      return id;
    },
    onSuccess: (id: string) => {
      void qc.invalidateQueries({ queryKey: comboKeys.all });
      toast.success(t('manageCombos.builder.comboSaved'));
      onSaved(id);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('manageCombos.builder.failedToSaveCombo'));
    },
  });

  const addSlotMutation = useMutation({
    mutationFn: async ({ draft, cId }: { draft: SlotDraft; cId: string }) => {
      const nextSortOrder = (slots ?? []).length;
      const { error } = await db.from('combo_slots').insert({
        combo_product_id: cId,
        label: draft.label,
        slot_type: draft.slotType,
        min_qty: draft.minQty,
        max_qty: draft.maxQty,
        is_required: true,
        sort_order: nextSortOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.slots(comboId ?? '') });
      setShowSlotForm(false);
      toast.success(t('manageCombos.builder.slotAdded'));
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('manageCombos.builder.failedToAddSlot'));
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await db.from('combo_slots').delete().eq('id', slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.slots(comboId ?? '') });
      toast.success(t('manageCombos.builder.slotRemoved'));
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('manageCombos.builder.failedToRemoveSlot'));
    },
  });

  function handleSave() {
    if (!comboId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('manageCombos.builder.comboNameRequired'));
      return;
    }
    const parsedPrice = priceOverride.trim().length > 0 ? parseFloat(priceOverride) : null;
    if (
      priceOverride.trim().length > 0 &&
      (parsedPrice === null || isNaN(parsedPrice) || parsedPrice < 0)
    ) {
      toast.error(t('manageCombos.builder.invalidPriceOverride'));
      return;
    }
    saveComboMutation.mutate({ id: comboId, comboName: trimmed, price: parsedPrice });
  }

  if (!comboId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('manageCombos.builder.selectOrCreatePrompt')}
      </p>
    );
  }

  if (comboLoading || slotsLoading) {
    return <p className="text-sm text-muted-foreground">{t('manageCombos.builder.loadingCombo')}</p>;
  }

  const resolvedSlots = slots ?? [];

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <label htmlFor={nameInputId} className="text-sm font-medium">
          {t('manageCombos.builder.comboNameLabel')}
        </label>
        <Input
          id={nameInputId}
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          placeholder={t('manageCombos.builder.comboNamePlaceholder')}
          maxLength={100}
        />
      </div>

      {/* Price override */}
      <div className="space-y-1">
        <label htmlFor={priceInputId} className="text-sm font-medium">
          {t('manageCombos.builder.priceOverrideLabel')}
        </label>
        <p className="text-xs text-muted-foreground">
          {t('manageCombos.builder.priceOverrideHelp')}
        </p>
        <Input
          id={priceInputId}
          type="number"
          min={0}
          step={0.01}
          value={priceOverride}
          onChange={e => {
            setPriceOverride(e.target.value);
          }}
          placeholder={t('manageCombos.builder.priceOverridePlaceholder')}
        />
      </div>

      {/* Slots */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t('manageCombos.builder.slotsCount', { count: resolvedSlots.length })}
        </p>
        {resolvedSlots.length === 0 && !showSlotForm && (
          <p className="text-xs text-muted-foreground italic">
            {t('manageCombos.builder.noSlotsYet')}
          </p>
        )}
        {resolvedSlots.map((slot: ComboSlot) => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            onDeleteSlot={() => {
              deleteSlotMutation.mutate(slot.id);
            }}
          />
        ))}
        {showSlotForm && (
          <SlotForm
            onSave={draft => {
              addSlotMutation.mutate({ draft, cId: comboId });
            }}
            onCancel={() => {
              setShowSlotForm(false);
            }}
          />
        )}
        {!showSlotForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowSlotForm(true);
            }}
          >
            <Plus className="size-3.5 mr-1" />
            {t('manageCombos.builder.addSlot')}
          </Button>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button type="button" disabled={saveComboMutation.isPending} onClick={handleSave}>
          {saveComboMutation.isPending ? t('common:actions.saving') : t('manageCombos.builder.saveCombo')}
        </Button>
      </div>
    </div>
  );
}
