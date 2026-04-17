import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useModifiers,
  useMutationCreateModifier,
  useMutationDeleteModifier,
  useMutationUpdateModifier,
} from '@entities/product';
import type { Modifier } from '@shared/lib/domain';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { FormField } from '@shared/ui/FormField';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { POSButton } from '@shared/ui/POSButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';

export function CatalogModifiersTab() {
  const { data: modifiers, isLoading, resultError } = useModifiers();
  const createMutation = useMutationCreateModifier();
  const updateMutation = useMutationUpdateModifier();
  const deleteMutation = useMutationDeleteModifier();

  const [createOpen, setCreateOpen] = useState(false);
  const [editModifier, setEditModifier] = useState<Modifier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...(modifiers ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      ),
    [modifiers]
  );

  const nextSortOrder = useMemo(() => {
    if (!sorted.length) return 0;
    return Math.max(...sorted.map(m => m.sortOrder)) + 1;
  }, [sorted]);

  if (resultError) {
    return (
      <p className="text-destructive text-sm">Could not load modifiers: {resultError.message}</p>
    );
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading modifiers…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Modifiers add optional price changes when ordering drinks.
        </p>
        <POSButton
          type="button"
          touchSize="default"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          Add modifier
        </POSButton>
      </div>

      <ul className="divide-y rounded-md border">
        {sorted.map(m => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-muted-foreground text-sm">
                Price delta <MoneyDisplay amount={m.priceDelta} /> · Sort {m.sortOrder}
              </p>
            </div>
            <div className="flex gap-1">
              <POSButton
                type="button"
                variant="outline"
                touchSize="default"
                onClick={() => {
                  setEditModifier(m);
                }}
              >
                <Pencil className="size-4" />
                <span className="sr-only">Edit</span>
              </POSButton>
              <POSButton
                type="button"
                variant="outline"
                touchSize="default"
                onClick={() => {
                  setDeleteId(m.id);
                }}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Delete</span>
              </POSButton>
            </div>
          </li>
        ))}
      </ul>

      <ModifierDialog
        title="New modifier"
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={createMutation.isPending}
        initial={null}
        defaultSortOrder={nextSortOrder}
        onSave={async (name, priceDelta, sortOrder) => {
          const r = await createMutation.mutateAsync({ name, priceDelta, sortOrder });
          if (!r.ok) toast.error(r.error.message);
          else {
            toast.success('Modifier created');
            setCreateOpen(false);
          }
        }}
      />

      <ModifierDialog
        title="Edit modifier"
        open={editModifier != null}
        onOpenChange={o => {
          if (!o) setEditModifier(null);
        }}
        submitting={updateMutation.isPending}
        initial={editModifier}
        defaultSortOrder={nextSortOrder}
        onSave={async (name, priceDelta, sortOrder) => {
          if (!editModifier) return;
          const r = await updateMutation.mutateAsync({
            id: editModifier.id,
            name,
            priceDelta,
            sortOrder,
          });
          if (!r.ok) toast.error(r.error.message);
          else {
            toast.success('Modifier saved');
            setEditModifier(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteId != null}
        title="Delete modifier?"
        description="This removes the modifier from the catalog. It will be unlinked from products that use it."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deleteId == null) return;
          const id = deleteId;
          const r = await deleteMutation.mutateAsync(id);
          setDeleteId(null);
          if (!r.ok) toast.error(r.error.message);
          else toast.success('Modifier deleted');
        }}
        onCancel={() => {
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function ModifierDialog({
  title,
  open,
  onOpenChange,
  submitting,
  initial,
  defaultSortOrder,
  onSave,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  initial: Modifier | null;
  defaultSortOrder: number;
  onSave: (name: string, priceDelta: number, sortOrder: number) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open ? (
          <ModifierDialogForm
            key={`${initial?.id ?? 'new'}-${String(defaultSortOrder)}`}
            submitting={submitting}
            initial={initial}
            defaultSortOrder={defaultSortOrder}
            onSave={onSave}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ModifierDialogForm({
  submitting,
  initial,
  defaultSortOrder,
  onSave,
  onOpenChange,
}: {
  submitting: boolean;
  initial: Modifier | null;
  defaultSortOrder: number;
  onSave: (name: string, priceDelta: number, sortOrder: number) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [priceDelta, setPriceDelta] = useState(initial?.priceDelta ?? 0);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? defaultSortOrder));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault();
        const so = Number.parseInt(sortOrder, 10);
        if (name.trim() === '') {
          toast.error('Name is required');
          return;
        }
        if (Number.isNaN(so) || so < 0) {
          toast.error('Sort order must be a non-negative integer');
          return;
        }
        void onSave(name.trim(), priceDelta, so);
      }}
    >
      <FormField label="Name" required error="">
        <Input
          value={name}
          onChange={e => {
            setName(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>
      <FormField
        label="Price delta"
        hint="Added to the drink price when this modifier is selected."
        error=""
      >
        <MoneyInput value={priceDelta} onChange={setPriceDelta} disabled={submitting} />
      </FormField>
      <FormField label="Sort order" required error="">
        <Input
          inputMode="numeric"
          value={sortOrder}
          onChange={e => {
            setSortOrder(e.target.value);
          }}
          disabled={submitting}
        />
      </FormField>
      <div className="flex justify-end gap-2 border-t pt-4">
        <POSButton
          type="button"
          variant="outline"
          touchSize="default"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </POSButton>
        <POSButton type="submit" touchSize="default" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </POSButton>
      </div>
    </form>
  );
}
