import { AlertCircle, Package } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ComboBuilderSheet } from '@features/add-combo-to-tab';
import { ModifierSheet } from '@features/add-item-to-tab/ui/ModifierSheet';
import { ManagerPinDialog } from '@features/manager-pin-gate';
import { useComboAvailability } from '@entities/combo';
import { useProducts, useCategories } from '@entities/product/model/queries';
import type { Product, Modifier } from '@entities/product/model/types';
import { CategoryTabs } from '@entities/product/ui/CategoryTabs';
import { ProductCard } from '@entities/product/ui/ProductCard';
import { useActivePromotions } from '@entities/promotion';
import { useCartStore } from '@entities/tab/model/cartStore';
import { useTabStore } from '@entities/tab/model/store';
import { getCurrentTime } from '@shared/lib/domain-helpers';
import { ComboBadge } from '@shared/ui/ComboBadge';
import { ComboUnavailableBadge } from '@shared/ui/ComboUnavailableBadge';
import { EmptyState } from '@shared/ui/EmptyState';
import { CardSkeleton } from '@shared/ui/LoadingSkeletons';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { ScrollAreaRoot } from '@shared/ui/scroll-area';
import { HappyHourBanner } from './HappyHourBanner';

function gridClockFromWallTime(): Date {
  const d = new Date();
  const [h = 0, m = 0] = getCurrentTime().split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// ComboAwareProductCard — per-card sub-component that checks availability.
// Avoids N+1 by using useComboAvailability(id) per card (staleTime=30s).
// ---------------------------------------------------------------------------

interface ComboAwareProductCardProps {
  product: Product;
  category: { id: string; name: string; color: string } & Record<string, unknown>;
  now: Date;
  onSelect: (p: Product) => void;
  onUnavailableSelect: (p: Product) => void;
}

function ComboAwareProductCard({
  product,
  category,
  now,
  onSelect,
  onUnavailableSelect,
}: ComboAwareProductCardProps) {
  const { t } = useTranslation('wPanels');
  const { data: isAvailable = true } = useComboAvailability(product.id);
  return (
    <div className="relative">
      <ProductCard
        product={product}
        category={category as Parameters<typeof ProductCard>[0]['category']}
        now={now}
        onSelect={() => {
          if (isAvailable) {
            onSelect(product);
          } else {
            onUnavailableSelect(product);
          }
        }}
        {...(!isAvailable ? { className: 'opacity-60' } : {})}
      />
      <div className="absolute top-2 right-2 pointer-events-none">
        {isAvailable ? (
          <ComboBadge />
        ) : (
          <ComboUnavailableBadge availabilityHint={t('productGrid.checkSchedule')} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductGrid
// ---------------------------------------------------------------------------

export interface ProductGridProps {
  className?: string;
}

export function ProductGrid({ className }: ProductGridProps) {
  const { t } = useTranslation('wPanels');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogNow, setCatalogNow] = useState(() => gridClockFromWallTime());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false);

  // Combo routing state — consumed by ComboBuilderSheet in Plan 05
  const [selectedCombo, setSelectedCombo] = useState<Product | null>(null);
  const [comboBuilderOpen, setComboBuilderOpen] = useState(false);
  const [unavailableCombo, setUnavailableCombo] = useState<Product | null>(null);
  const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false);
  const [overrideActive, setOverrideActive] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const activeTabId = useTabStore(s => s.activeTabId);
  const { addItem } = useCartStore();

  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
    refetch,
  } = useProducts();
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories();
  const { data: activePromotions } = useActivePromotions();

  useEffect(() => {
    const interval = setInterval(() => {
      setCatalogNow(gridClockFromWallTime());
    }, 60000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    if (!activeCategory) return products.filter(p => p.isActive);
    return products.filter(p => p.isActive && p.categoryId === activeCategory);
  }, [products, activeCategory]);

  const handleProductSelect = (product: Product) => {
    if (product.isCombo) {
      setSelectedCombo(product);
      setComboBuilderOpen(true);
      return;
    }
    if (product.modifiers.length > 0) {
      setSelectedProduct(product);
      setModifierSheetOpen(true);
      return;
    }
    // Intentional: send the undiscounted base price — evaluate_promotions_for_item
    // (server) is the sole authority for the charged unit_price (Pitfall 1).
    addItem(product, [], product.basePrice);
  };

  const handleUnavailableComboSelect = (product: Product) => {
    setUnavailableCombo(product);
    setUnavailableDialogOpen(true);
  };

  const handleModifierConfirm = (selectedModifiers: Modifier[]) => {
    if (selectedProduct) {
      // Intentional: send the undiscounted base price — evaluate_promotions_for_item
      // (server) is the sole authority for the charged unit_price (Pitfall 1).
      addItem(selectedProduct, selectedModifiers, selectedProduct.basePrice);
      setSelectedProduct(null);
    }
  };

  const handleModifierClose = () => {
    setModifierSheetOpen(false);
    setSelectedProduct(null);
  };

  const isLoading = productsLoading || categoriesLoading;
  const hasError = productsError || categoriesError;

  return (
    <div className={className}>
      <HappyHourBanner activePromotions={activePromotions ?? []} />
      {categories && Array.isArray(categories) && categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onChange={setActiveCategory}
        />
      )}

      {hasError && (
        <EmptyState
          icon={AlertCircle}
          title={t('productGrid.loadFailedTitle')}
          description={t('productGrid.loadFailedDescription')}
          action={{
            label: t('productGrid.retry'),
            onClick: () => {
              void refetch();
            },
          }}
        />
      )}

      {!hasError && isLoading && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <CardSkeleton key={i} height="160px" />
          ))}
        </div>
      )}

      {!hasError && !isLoading && filteredProducts.length > 0 && (
        <ScrollAreaRoot className="mt-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {filteredProducts.map(product => {
              const category = categories?.find(c => c.id === product.categoryId);
              if (!category) return null;
              if (product.isCombo) {
                return (
                  <ComboAwareProductCard
                    key={product.id}
                    product={product}
                    category={category}
                    now={catalogNow}
                    onSelect={handleProductSelect}
                    onUnavailableSelect={handleUnavailableComboSelect}
                  />
                );
              }
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={category}
                  now={catalogNow}
                  onSelect={handleProductSelect}
                />
              );
            })}
          </div>
        </ScrollAreaRoot>
      )}

      {!hasError && !isLoading && filteredProducts.length === 0 && (
        <EmptyState
          icon={Package}
          title={
            activeCategory
              ? t('productGrid.noProductsFoundTitle')
              : t('productGrid.noProductsAvailableTitle')
          }
          description={
            activeCategory
              ? t('productGrid.noProductsInCategory')
              : t('productGrid.noProductsAvailableDescription')
          }
        />
      )}

      {selectedProduct && (
        <ModifierSheet
          product={selectedProduct}
          open={modifierSheetOpen}
          onConfirm={handleModifierConfirm}
          onClose={handleModifierClose}
        />
      )}

      {/* Combo unavailable dialog */}
      <Dialog open={unavailableDialogOpen} onOpenChange={setUnavailableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('productGrid.comboNotAvailableTitle')}</DialogTitle>
            <DialogDescription>
              {t('productGrid.comboNotAvailableDescription', { name: unavailableCombo?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setUnavailableDialogOpen(false);
              }}
            >
              {t('productGrid.cancel')}
            </Button>
            <Button
              onClick={() => {
                setUnavailableDialogOpen(false);
                setPinDialogOpen(true);
              }}
            >
              {t('productGrid.requestOverride')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager PIN override for combo availability */}
      <ManagerPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        requiredAction="manage_products"
        onSuccess={() => {
          setPinDialogOpen(false);
          setOverrideActive(true);
          if (unavailableCombo) {
            setSelectedCombo(unavailableCombo);
            setUnavailableCombo(null);
            setComboBuilderOpen(true);
          }
        }}
      />

      <ComboBuilderSheet
        combo={selectedCombo}
        tabId={activeTabId ?? ''}
        open={comboBuilderOpen}
        overrideActive={overrideActive}
        onClose={() => {
          setComboBuilderOpen(false);
          setSelectedCombo(null);
          setOverrideActive(false);
        }}
      />
    </div>
  );
}
