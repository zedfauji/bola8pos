import { AlertCircle, Package } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { ModifierSheet } from '@features/add-item-to-tab/ui/ModifierSheet';
import { useProducts, useCategories } from '@entities/product/model/queries';
import type { Product, Modifier } from '@entities/product/model/types';
import { CategoryTabs } from '@entities/product/ui/CategoryTabs';
import { ProductCard } from '@entities/product/ui/ProductCard';
import { useCartStore } from '@entities/tab/model/cartStore';
import { resolveProductPrice, getCurrentTime } from '@shared/lib/domain-helpers';
import { EmptyState } from '@shared/ui/EmptyState';
import { CardSkeleton } from '@shared/ui/LoadingSkeletons';
import { ScrollAreaRoot } from '@shared/ui/scroll-area';
import { HappyHourBanner } from './HappyHourBanner';

function gridClockFromWallTime(): Date {
  const d = new Date();
  const [h = 0, m = 0] = getCurrentTime().split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export interface ProductGridProps {
  className?: string;
}

export function ProductGrid({ className }: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogNow, setCatalogNow] = useState(() => gridClockFromWallTime());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false);

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
    if (product.modifiers.length > 0) {
      setSelectedProduct(product);
      setModifierSheetOpen(true);
    } else {
      const category = categories?.find(c => c.id === product.categoryId);
      const resolvedPrice = category
        ? resolveProductPrice(product, category, catalogNow)
        : product.basePrice;
      addItem(product, [], resolvedPrice);
    }
  };

  const handleModifierConfirm = (selectedModifiers: Modifier[]) => {
    if (selectedProduct) {
      const category = categories?.find(c => c.id === selectedProduct.categoryId);
      const resolvedPrice = category
        ? resolveProductPrice(selectedProduct, category, catalogNow)
        : selectedProduct.basePrice;
      addItem(selectedProduct, selectedModifiers, resolvedPrice);
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
      <HappyHourBanner categories={categories ?? []} now={catalogNow} />
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
          title="Failed to load products"
          description="There was an error loading the product catalog."
          action={{
            label: 'Retry',
            onClick: () => {
              void refetch();
            },
          }}
        />
      )}

      {!hasError && isLoading && (
        <div className="mt-4 grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <CardSkeleton key={i} height="160px" />
          ))}
        </div>
      )}

      {!hasError && !isLoading && filteredProducts.length > 0 && (
        <ScrollAreaRoot className="mt-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {filteredProducts.map(product => {
              const category = categories?.find(c => c.id === product.categoryId);
              if (!category) return null;
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
          title={activeCategory ? 'No products found' : 'No products available'}
          description={activeCategory ? 'No products in this category.' : 'No products available.'}
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
    </div>
  );
}
