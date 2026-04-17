import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useCategories,
  useMutationCreateCategory,
  useMutationUpdateCategory,
} from '@entities/product';
import type { Category } from '@shared/lib/domain';
import { POSButton } from '@shared/ui/POSButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';

import { CategoryForm } from './CategoryForm';

export function CatalogCategoriesTab() {
  const { data: categories, isLoading, resultError } = useCategories();
  const createMutation = useMutationCreateCategory();
  const updateMutation = useMutationUpdateCategory();

  const [createOpen, setCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  const sorted = useMemo(
    () =>
      [...(categories ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      ),
    [categories]
  );

  async function swapOrder(a: Category, b: Category) {
    const r1 = await updateMutation.mutateAsync({
      id: a.id,
      sortOrder: b.sortOrder,
    });
    if (!r1.ok) {
      toast.error(r1.error.message);
      return;
    }
    const r2 = await updateMutation.mutateAsync({
      id: b.id,
      sortOrder: a.sortOrder,
    });
    if (!r2.ok) toast.error(r2.error.message);
    else toast.success('Order updated');
  }

  if (resultError) {
    return (
      <p className="text-destructive text-sm">Could not load categories: {resultError.message}</p>
    );
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading categories…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Drag-free reorder with arrows. Happy hour windows apply to drinks in this category.
        </p>
        <POSButton
          type="button"
          touchSize="default"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          Add category
        </POSButton>
      </div>

      <ul className="divide-y rounded-md border">
        {sorted.map((c, index) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <span
              className="size-4 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: c.color }}
              title={c.color}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="text-muted-foreground text-xs">
                Sort {c.sortOrder}
                {c.happyHourStart && c.happyHourEnd
                  ? ` · Happy hour ${c.happyHourStart.slice(0, 5)}–${c.happyHourEnd.slice(0, 5)}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <POSButton
                type="button"
                variant="outline"
                touchSize="default"
                disabled={index === 0 || updateMutation.isPending}
                aria-label="Move up"
                onClick={() => {
                  const prev = sorted[index - 1];
                  if (prev) void swapOrder(c, prev);
                }}
              >
                <ArrowUp className="size-4" />
              </POSButton>
              <POSButton
                type="button"
                variant="outline"
                touchSize="default"
                disabled={index >= sorted.length - 1 || updateMutation.isPending}
                aria-label="Move down"
                onClick={() => {
                  const next = sorted[index + 1];
                  if (next) void swapOrder(c, next);
                }}
              >
                <ArrowDown className="size-4" />
              </POSButton>
              <POSButton
                type="button"
                variant="outline"
                touchSize="default"
                onClick={() => {
                  setEditCategory(c);
                }}
              >
                <Pencil className="size-4" />
                <span className="sr-only">Edit</span>
              </POSButton>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <CategoryForm
            submitting={createMutation.isPending}
            onCancel={() => {
              setCreateOpen(false);
            }}
            onSubmitCreate={data => {
              void createMutation.mutateAsync(data, {
                onSuccess: r => {
                  if (!r.ok) toast.error(r.error.message);
                  else {
                    toast.success('Category created');
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
        open={editCategory != null}
        onOpenChange={o => {
          if (!o) setEditCategory(null);
        }}
      >
        <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          {editCategory ? (
            <CategoryForm
              key={editCategory.id}
              initialCategory={editCategory}
              submitting={updateMutation.isPending}
              onCancel={() => {
                setEditCategory(null);
              }}
              onSubmitCreate={() => {}}
              onSubmitUpdate={data => {
                void updateMutation.mutateAsync(data, {
                  onSuccess: r => {
                    if (!r.ok) toast.error(r.error.message);
                    else {
                      toast.success('Category saved');
                      setEditCategory(null);
                    }
                  },
                });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
