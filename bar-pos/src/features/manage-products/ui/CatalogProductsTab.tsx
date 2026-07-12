import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { RecipeEditorTab } from '@features/manage-recipe';
import { useCategories } from '@entities/category';
import {
  useModifiers,
  useMutationCreateProduct,
  useMutationDeactivateProduct,
  useMutationUpdateProduct,
  useProductsForManagement,
  type CreateProductInput,
  type UpdateProductInput,
} from '@entities/product';
import type { Category, Product } from '@shared/lib/domain';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { DataTable } from '@shared/ui/DataTable';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { POSButton } from '@shared/ui/POSButton';
import { Badge } from '@shared/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

import { ProductForm } from './ProductForm';

function modifierIdsOf(p: Product): string[] {
  return p.modifiers.map(m => m.id);
}

function ProductNameCell({
  product,
  draftName,
  onDraftChange,
  onCommit,
}: {
  product: Product;
  draftName: string;
  onDraftChange: (name: string) => void;
  onCommit: (name: string) => void;
}) {
  return (
    <Input
      className="h-8 min-w-[8rem]"
      value={draftName}
      onChange={e => {
        onDraftChange(e.target.value);
      }}
      onBlur={() => {
        if (draftName !== product.name) {
          onCommit(draftName);
        }
      }}
    />
  );
}

function ProductCategoryCell({
  product,
  categories,
  draftCategoryId,
  onDraftChange,
  onCommit,
}: {
  product: Product;
  categories: Category[];
  draftCategoryId: string;
  onDraftChange: (id: string) => void;
  onCommit: (categoryId: string) => void;
}) {
  return (
    <select
      className="border-input bg-background h-8 max-w-[10rem] rounded-md border px-2 text-sm"
      value={draftCategoryId}
      onChange={e => {
        const categoryId = e.target.value;
        onDraftChange(categoryId);
        if (categoryId !== product.categoryId) onCommit(categoryId);
      }}
    >
      {categories.map(c => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ProductBasePriceCell({
  product,
  draftPrice,
  onDraftChange,
  onCommit,
}: {
  product: Product;
  draftPrice: number;
  onDraftChange: (v: number) => void;
  onCommit: (basePrice: number) => void;
}) {
  return (
    <div className="min-w-[6rem]">
      <MoneyInput
        value={draftPrice}
        onChange={onDraftChange}
        onBlurCommit={() => {
          if (draftPrice !== product.basePrice) {
            onCommit(draftPrice);
          }
        }}
      />
    </div>
  );
}

export function CatalogProductsTab() {
  const { data: products, isLoading, resultError } = useProductsForManagement();
  const { data: categories } = useCategories();
  const { data: modifiers } = useModifiers();

  const createMutation = useMutationCreateProduct();
  const updateMutation = useMutationUpdateProduct();
  const deactivateMutation = useMutationDeactivateProduct();

  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<
    Record<string, { name: string; basePrice: number; categoryId: string }>
  >({});

  const getDraft = (p: Product) =>
    drafts[p.id] ?? {
      name: p.name,
      basePrice: p.basePrice,
      categoryId: p.categoryId,
    };

  const setDraft = (
    id: string,
    partial: Partial<{ name: string; basePrice: number; categoryId: string }>
  ) => {
    setDrafts(prev => {
      const base = prev[id];
      const product = products?.find(x => x.id === id);
      if (!product) return prev;
      const cur = base ?? {
        name: product.name,
        basePrice: product.basePrice,
        categoryId: product.categoryId,
      };
      return { ...prev, [id]: { ...cur, ...partial } };
    });
  };

  const clearDraft = useCallback((id: string) => {
    setDrafts(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)));
  }, []);

  const runUpdate = useCallback(
    (input: UpdateProductInput, successMessage: string, clearId?: string) => {
      void updateMutation.mutateAsync(input, {
        onSuccess: r => {
          if (!r.ok) toast.error(r.error.message);
          else {
            toast.success(successMessage);
            if (clearId) clearDraft(clearId);
          }
        },
      });
    },
    [updateMutation, clearDraft]
  );

  const catList = categories ?? [];

  const columns: ColumnDef<Product>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const p = row.original;
        const d = getDraft(p);
        return (
          <ProductNameCell
            product={p}
            draftName={d.name}
            onDraftChange={name => {
              setDraft(p.id, { name });
            }}
            onCommit={name => {
              runUpdate({ id: p.id, name, modifierIds: modifierIdsOf(p) }, 'Product updated', p.id);
            }}
          />
        );
      },
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const p = row.original;
        const d = getDraft(p);
        return (
          <ProductCategoryCell
            product={p}
            categories={catList}
            draftCategoryId={d.categoryId}
            onDraftChange={categoryId => {
              setDraft(p.id, { categoryId });
            }}
            onCommit={categoryId => {
              runUpdate(
                { id: p.id, categoryId, modifierIds: modifierIdsOf(p) },
                'Category updated',
                p.id
              );
            }}
          />
        );
      },
    },
    {
      id: 'basePrice',
      header: 'Base',
      cell: ({ row }) => {
        const p = row.original;
        const d = getDraft(p);
        return (
          <ProductBasePriceCell
            product={p}
            draftPrice={d.basePrice}
            onDraftChange={basePrice => {
              setDraft(p.id, { basePrice });
            }}
            onCommit={basePrice => {
              runUpdate(
                { id: p.id, basePrice, modifierIds: modifierIdsOf(p) },
                'Price updated',
                p.id
              );
            }}
          />
        );
      },
    },
    {
      id: 'active',
      header: 'Status',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <Badge variant={p.isActive ? 'default' : 'secondary'}>
            {p.isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            <POSButton
              type="button"
              touchSize="default"
              variant="outline"
              onClick={() => {
                setEditProduct(p);
              }}
            >
              Edit
            </POSButton>
            <POSButton
              type="button"
              touchSize="default"
              variant="outline"
              disabled={!p.isActive}
              onClick={() => {
                setDeactivateId(p.id);
              }}
            >
              Deactivate
            </POSButton>
          </div>
        );
      },
    },
  ];

  if (resultError) {
    return (
      <p className="text-destructive text-sm">Could not load products: {resultError.message}</p>
    );
  }

  const modList = modifiers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Edit name, category, or prices inline (saved on blur). Use Edit for modifiers and SKU.
        </p>
        <POSButton
          type="button"
          touchSize="default"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          Add product
        </POSButton>
      </div>

      <DataTable<Product>
        columns={columns}
        data={products ?? []}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Search products…"
        enableSorting
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <ProductForm
            categories={catList}
            modifiers={modList}
            submitting={createMutation.isPending}
            onCancel={() => {
              setCreateOpen(false);
            }}
            onSubmitCreate={payload => {
              const input: CreateProductInput = { ...payload, modifierIds: payload.modifierIds };
              void createMutation.mutateAsync(input, {
                onSuccess: r => {
                  if (!r.ok) toast.error(r.error.message);
                  else {
                    toast.success('Product created');
                    setCreateOpen(false);
                  }
                },
              });
            }}
            onSubmitUpdate={() => {}}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editProduct != null}
        onOpenChange={o => {
          if (!o) setEditProduct(null);
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          {editProduct ? (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="recipe">Recipe</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <ProductForm
                  key={editProduct.id}
                  categories={catList}
                  modifiers={modList}
                  initialProduct={editProduct}
                  submitting={updateMutation.isPending}
                  onCancel={() => {
                    setEditProduct(null);
                  }}
                  onSubmitCreate={() => {}}
                  onSubmitUpdate={payload => {
                    void updateMutation.mutateAsync(payload, {
                      onSuccess: r => {
                        if (!r.ok) toast.error(r.error.message);
                        else {
                          toast.success('Product saved');
                          setEditProduct(null);
                        }
                      },
                    });
                  }}
                />
              </TabsContent>
              <TabsContent value="recipe">
                <RecipeEditorTab
                  productId={editProduct.id}
                  productName={editProduct.name}
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateId != null}
        title="Deactivate product?"
        description="The product will be hidden from the POS menu. Existing orders are unchanged."
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={deactivateMutation.isPending}
        onConfirm={async () => {
          if (deactivateId == null) return;
          const id = deactivateId;
          const r = await deactivateMutation.mutateAsync(id);
          setDeactivateId(null);
          if (!r.ok) toast.error(r.error.message);
          else toast.success('Product deactivated');
        }}
        onCancel={() => {
          setDeactivateId(null);
        }}
      />
    </div>
  );
}
