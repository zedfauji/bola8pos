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
import { useTranslation } from 'react-i18next';
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
    // eslint-disable-next-line i18next/no-literal-string -- TanStack Query cache key, not UI copy
    queryKey: ['promotion_eligible_products'],
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
  const { t } = useTranslation('featMgmt');
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
      toast.error(t('managePromotions.builder.nameRequired'));
      return;
    }
    const parsedValue = parseFloat(discountValue);
    if (isNaN(parsedValue) || parsedValue < 0) {
      toast.error(t('managePromotions.builder.invalidDiscountValue'));
      return;
    }
    if (discountType === 'percentage' && parsedValue > 100) {
      toast.error(t('managePromotions.builder.percentageExceeds100'));
      return;
    }
    const parsedPriority = parseInt(priority, 10);
    if (isNaN(parsedPriority) || parsedPriority < 0) {
      toast.error(t('managePromotions.builder.invalidPriority'));
      return;
    }
    if (targetType === 'item' && targetProductId.length === 0) {
      toast.error(t('managePromotions.builder.productRequired'));
      return;
    }
    if (targetType === 'category' && targetCategoryId === null) {
      toast.error(t('managePromotions.builder.categoryRequired'));
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
          toast.success(t('managePromotions.builder.promotionSaved'));
          onSaved(promotionId);
        },
        onError: (e: unknown) => {
          toast.error(e instanceof Error ? e.message : t('managePromotions.builder.failedToSave'));
        },
      }
    );
  }

  if (!promotionId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('managePromotions.builder.selectOrCreatePrompt')}
      </p>
    );
  }

  if (promotionLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t('managePromotions.builder.loading')}</p>
    );
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
          {t('managePromotions.builder.promotionNameLabel')}
        </label>
        <Input
          id={nameInputId}
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          placeholder={t('managePromotions.builder.promotionNamePlaceholder')}
          maxLength={100}
          required
        />
      </div>

      {/* 2. Discount type */}
      <div className="space-y-1">
        <label htmlFor={discountTypeId} className="text-sm font-medium">
          {t('managePromotions.builder.discountTypeLabel')}
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
            <SelectItem value="percentage">
              {t('managePromotions.builder.percentageOff')}
            </SelectItem>
            <SelectItem value="fixed_amount">
              {t('managePromotions.builder.fixedAmountOff')}
            </SelectItem>
            <SelectItem value="fixed_price">
              {t('managePromotions.builder.fixedOverridePrice')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Discount value (conditional on discount type) */}
      {discountType === 'percentage' ? (
        <div className="space-y-1">
          <label htmlFor={discountValueId} className="text-sm font-medium">
            {t('managePromotions.builder.discountValueLabel')}
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
          label={t('managePromotions.builder.discountValueLabel')}
          value={discountValue.length > 0 ? parseFloat(discountValue) || 0 : 0}
          onChange={value => {
            setDiscountValue(String(value));
          }}
        />
      )}

      {/* 4. Fixed-price stacking hint (only for fixed_price) */}
      {discountType === 'fixed_price' && (
        <p className="text-xs text-muted-foreground">
          {t('managePromotions.builder.fixedPriceStackingHint')}
        </p>
      )}

      {/* 5. Target type */}
      <div className="space-y-1">
        <label htmlFor={targetTypeId} className="text-sm font-medium">
          {t('managePromotions.builder.appliesToLabel')}
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
            <SelectItem value="item">{t('managePromotions.tab.targetTypeItem')}</SelectItem>
            <SelectItem value="category">
              {t('managePromotions.tab.targetTypeCategory')}
            </SelectItem>
            <SelectItem value="pool_billing">
              {t('managePromotions.builder.poolTimeBilling')}
            </SelectItem>
            <SelectItem value="pool_grant">
              {t('managePromotions.builder.poolTimeBonus')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 6. Target picker (conditional on target type) */}
      {targetType === 'item' && (
        <div className="space-y-1">
          <label htmlFor={productPickerId} className="text-sm font-medium">
            {t('managePromotions.builder.productLabel')}
          </label>
          <select
            id={productPickerId}
            value={targetProductId}
            onChange={e => {
              setTargetProductId(e.target.value);
            }}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">{t('managePromotions.builder.pickProductPlaceholder')}</option>
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
          <span className="text-sm font-medium">
            {t('managePromotions.tab.targetTypeCategory')}
          </span>
          <CategoryTreePicker
            items={categoryItems}
            value={targetCategoryId}
            onChange={setTargetCategoryId}
            label={t('managePromotions.builder.selectCategoryLabel')}
          />
        </div>
      )}

      {/* 7. Priority */}
      <div className="space-y-1">
        <label htmlFor={priorityInputId} className="text-sm font-medium">
          {t('managePromotions.builder.priorityLabel')}
        </label>
        <p className="text-xs text-muted-foreground">
          {t('managePromotions.builder.priorityHint')}
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
          {t('managePromotions.builder.activeLabel')}
        </label>
      </div>

      {/* 9. Save */}
      <div className="flex justify-end">
        <Button type="button" disabled={updateMutation.isPending} onClick={handleSave}>
          {updateMutation.isPending
            ? t('common:actions.saving')
            : t('managePromotions.builder.savePromotion')}
        </Button>
      </div>
    </div>
  );
}
