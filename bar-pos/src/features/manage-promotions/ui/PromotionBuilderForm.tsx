/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * PromotionBuilderForm
 *
 * Feature component: admin creates/edits a promotion (discount + target rules
 * + priority + active toggle). Clone of ComboBuilderForm.tsx scaffolding,
 * adapted per 20-UI-SPEC.md §2. All discount/price values here are
 * display/config only — evaluate_promotions_for_item (server) is the sole
 * writer of a charged unit_price (20-RESEARCH.md Pitfall 1).
 *
 * Uses `const db = supabase as any` pre-regen cast — products table query
 * used for the item target picker (mirrors useComboEligibleProducts).
 */

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useCategories } from '@entities/category';
import { usePromotion, useMutationUpdatePromotion } from '@entities/promotion';
import type { Product, PromotionDiscountType, PromotionTargetType } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { CategoryTreePicker } from '@shared/ui/CategoryTreePicker';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Switch } from '@shared/ui/switch';

// Pre-regen cast — remove once supabase.types.ts is regenerated after promotions migrations
const db = supabase as any;

// ============================================================================
// PRODUCT PICKER (promotion-eligible products — active, non-combo)
// ============================================================================

function usePromotionEligibleProducts() {
  return useQuery({
    queryKey: ['promotion_eligible_products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await db
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_combo', false)
        .order('name', { ascending: true });
      if (error) {
        logger.error('usePromotionEligibleProducts: query failed', { error });
        throw error;
      }
      return (data ?? []) as Product[];
    },
  });
}

// ============================================================================
// PROMOTION BUILDER FORM (main)
// ============================================================================

interface Props {
  promotionId: string | null;
  onSaved: (newId: string) => void;
}

export function PromotionBuilderForm({ promotionId, onSaved }: Props) {
  const nameInputId = useId();
  const priorityInputId = useId();
  const productPickerId = useId();
  const activeSwitchId = useId();
  const discountTypeId = useId();
  const discountValueId = useId();
  const targetTypeId = useId();

  const { data: promotion, isLoading: promotionLoading } = usePromotion(promotionId);
  const { data: eligibleProducts } = usePromotionEligibleProducts();
  const { data: categories } = useCategories();
  const updateMutation = useMutationUpdatePromotion();

  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<PromotionDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [targetType, setTargetType] = useState<PromotionTargetType>('item');
  const [targetProductId, setTargetProductId] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState('0');
  const [isActive, setIsActive] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync form state from fetched promotion (once)
  if (!initialized && promotion) {
    setInitialized(true);
    setName(promotion.name);
    setDiscountType(promotion.discountType);
    setDiscountValue(String(promotion.discountValue));
    setTargetType(promotion.targetType);
    setTargetProductId(promotion.targetProductId ?? '');
    setTargetCategoryId(promotion.targetCategoryId ?? null);
    setPriority(String(promotion.priority));
    setIsActive(promotion.isActive);
  }

  function handleDiscountTypeChange(next: PromotionDiscountType) {
    setDiscountType(next);
    setDiscountValue(''); // clear stale value — no leftover from the previous type
  }

  function handleTargetTypeChange(next: PromotionTargetType) {
    setTargetType(next);
    setTargetProductId('');
    setTargetCategoryId(null);
  }

  function handleSave() {
    if (!promotionId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Promotion name is required.');
      return;
    }
    const parsedValue = parseFloat(discountValue);
    if (isNaN(parsedValue) || parsedValue < 0) {
      toast.error('Invalid discount value.');
      return;
    }
    if (discountType === 'percentage' && parsedValue > 100) {
      toast.error('Percentage discount cannot exceed 100.');
      return;
    }
    const parsedPriority = parseInt(priority, 10);
    if (isNaN(parsedPriority) || parsedPriority < 0) {
      toast.error('Invalid priority.');
      return;
    }

    updateMutation.mutate(
      {
        id: promotionId,
        name: trimmed,
        discountType,
        discountValue: parsedValue,
        targetType,
        targetProductId: targetType === 'item' && targetProductId.length > 0 ? targetProductId : null,
        targetCategoryId: targetType === 'category' ? targetCategoryId : null,
        priority: parsedPriority,
        isActive,
      },
      {
        onSuccess: () => {
          toast.success('Promotion saved');
          onSaved(promotionId);
        },
        onError: (e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to save promotion');
        },
      }
    );
  }

  if (!promotionId) {
    return <p className="text-sm text-muted-foreground">Select or create a promotion to edit.</p>;
  }

  if (promotionLoading) {
    return <p className="text-sm text-muted-foreground">Loading promotion…</p>;
  }

  const categoryItems = (categories ?? []).map(c => ({
    id: c.id,
    parentId: c.parentId ?? null,
    name: c.name,
    color: c.color,
  }));

  return (
    <div className="space-y-4">
      {/* 1. Promotion name */}
      <div className="space-y-1">
        <label htmlFor={nameInputId} className="text-sm font-medium">
          Promotion name
        </label>
        <Input
          id={nameInputId}
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          placeholder="e.g. Happy Hour Beers"
          maxLength={100}
          required
        />
      </div>

      {/* 2. Discount type */}
      <div className="space-y-1">
        <label htmlFor={discountTypeId} className="text-sm font-medium">
          Discount type
        </label>
        <Select
          value={discountType}
          onValueChange={value => {
            handleDiscountTypeChange(value as PromotionDiscountType);
          }}
        >
          <SelectTrigger id={discountTypeId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Percentage off</SelectItem>
            <SelectItem value="fixed_amount">Fixed amount off</SelectItem>
            <SelectItem value="fixed_price">Fixed override price</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Discount value (conditional on discount type) */}
      {discountType === 'percentage' ? (
        <div className="space-y-1">
          <label htmlFor={discountValueId} className="text-sm font-medium">
            Discount value
          </label>
          <div className="relative">
            <Input
              id={discountValueId}
              type="number"
              min={0}
              max={100}
              step={1}
              value={discountValue}
              onChange={e => {
                setDiscountValue(e.target.value);
              }}
              placeholder="0"
              className="pr-7"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>
      ) : (
        <MoneyInput
          label="Discount value"
          value={discountValue.length > 0 ? parseFloat(discountValue) || 0 : 0}
          onChange={value => {
            setDiscountValue(String(value));
          }}
        />
      )}

      {/* 4. Fixed-price stacking hint (only for fixed_price) */}
      {discountType === 'fixed_price' && (
        <p className="text-xs text-muted-foreground">
          Fixed override price replaces the running price — it does not stack with promotions
          applied before it. Set Priority to 1 if this should always apply first.
        </p>
      )}

      {/* 5. Target type */}
      <div className="space-y-1">
        <label htmlFor={targetTypeId} className="text-sm font-medium">
          Applies to
        </label>
        <Select
          value={targetType}
          onValueChange={value => {
            handleTargetTypeChange(value as PromotionTargetType);
          }}
        >
          <SelectTrigger id={targetTypeId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="item">Item</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="pool_billing">Pool time billing</SelectItem>
            <SelectItem value="pool_grant">Pool time bonus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 6. Target picker (conditional on target type) */}
      {targetType === 'item' && (
        <div className="space-y-1">
          <label htmlFor={productPickerId} className="text-sm font-medium">
            Product
          </label>
          <select
            id={productPickerId}
            value={targetProductId}
            onChange={e => {
              setTargetProductId(e.target.value);
            }}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">Pick a product…</option>
            {(eligibleProducts ?? []).map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {targetType === 'category' && (
        <div className="space-y-1">
          <span className="text-sm font-medium">Category</span>
          <CategoryTreePicker
            items={categoryItems}
            value={targetCategoryId}
            onChange={setTargetCategoryId}
            label="Select category"
          />
        </div>
      )}

      {/* 7. Priority */}
      <div className="space-y-1">
        <label htmlFor={priorityInputId} className="text-sm font-medium">
          Priority
        </label>
        <p className="text-xs text-muted-foreground">
          Lower number applies first. Promotions with the same priority apply in the order they
          were created.
        </p>
        <Input
          id={priorityInputId}
          type="number"
          min={0}
          step={1}
          value={priority}
          onChange={e => {
            setPriority(e.target.value);
          }}
        />
      </div>

      {/* 8. Active */}
      <div className="flex items-center gap-2">
        <Switch
          id={activeSwitchId}
          checked={isActive}
          onCheckedChange={checked => {
            setIsActive(checked);
          }}
        />
        <label htmlFor={activeSwitchId} className="text-sm font-medium">
          Active
        </label>
      </div>

      {/* 9. Save */}
      <div className="flex justify-end">
        <Button type="button" disabled={updateMutation.isPending} onClick={handleSave}>
          {updateMutation.isPending ? 'Saving…' : 'Save promotion'}
        </Button>
      </div>
    </div>
  );
}
