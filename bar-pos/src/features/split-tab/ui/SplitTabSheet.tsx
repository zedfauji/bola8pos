/**
 * SplitTabSheet — bottom sheet for splitting a tab four ways.
 *
 * Four modes: Evenly, By Item, By Person, By Amount.
 * Height: h-[85vh]. Default mode: evenly.
 * Confirm disabled until isValid per mode; ConfirmDialog on cancel if assignments made.
 */

import { Plus, X } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';

import type { OrderItem, Tab } from '@shared/lib/domain';
import { computeEvenSplit, toCents } from '@shared/lib/split-math';
import { cn } from '@shared/lib/utils';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { MoneyInput } from '@shared/ui/MoneyInput';
import { POSButton } from '@shared/ui/POSButton';
import { PersonCard } from '@shared/ui/PersonCard';
import { SubTabColumn } from '@shared/ui/SubTabColumn';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

import {
  useSplitByAmount,
  useSplitByItem,
  useSplitByPerson,
  useSplitEvenly,
} from '../model/useSplitTab';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SplitTabSheetProps {
  open: boolean;
  onClose: () => void;
  tab: Tab;
  orderItems: OrderItem[];
}

type SplitMode = 'evenly' | 'item' | 'person' | 'amount';

interface ColumnState {
  id: string;
  label: string;
  itemIds: string[];
}

interface PersonState {
  id: string;
  name: string;
  itemIds: string[];
}

interface AmountRow {
  id: string;
  label: string;
  amount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeTabTotalCents(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + toCents(i.unitPrice) * i.quantity, 0);
}

function getItemById(items: OrderItem[], id: string): OrderItem | undefined {
  return items.find(i => i.id === id);
}

function columnTotal(itemIds: string[], allItems: OrderItem[]): number {
  return itemIds.reduce((sum, id) => {
    const item = getItemById(allItems, id);
    return sum + (item ? toCents(item.unitPrice) * item.quantity : 0);
  }, 0);
}

// ── SplitTabSheet ──────────────────────────────────────────────────────────

export function SplitTabSheet({ open, onClose, tab, orderItems }: SplitTabSheetProps) {
  const uid = useId();

  // ── Mode ──
  const [activeMode, setActiveMode] = useState<SplitMode>('evenly');

  // ── Evenly state ──
  const [n, setN] = useState<number>(0);

  // ── Item mode state ──
  const [itemColumns, setItemColumns] = useState<ColumnState[]>(() => [
    { id: `${uid}-col-1`, label: 'Check 1', itemIds: [] },
  ]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // ── Person mode state ──
  const [personColumns, setPersonColumns] = useState<PersonState[]>(() => [
    { id: `${uid}-p-1`, name: 'Person 1', itemIds: [] },
    { id: `${uid}-p-2`, name: 'Person 2', itemIds: [] },
  ]);
  const [selectedPersonItemId, setSelectedPersonItemId] = useState<string | null>(null);

  // ── Amount mode state ──
  const [amountRows, setAmountRows] = useState<AmountRow[]>(() => [
    { id: `${uid}-a-1`, label: 'Check 1', amount: 0 },
    { id: `${uid}-a-2`, label: 'Check 2', amount: 0 },
  ]);

  // ── Cancel confirm ──
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // ── Mutations ──
  const splitEvenly = useSplitEvenly();
  const splitByItem = useSplitByItem();
  const splitByPerson = useSplitByPerson();
  const splitByAmount = useSplitByAmount();

  const isMutating =
    splitEvenly.isPending ||
    splitByItem.isPending ||
    splitByPerson.isPending ||
    splitByAmount.isPending;

  // ── Computed values ──
  const tabTotalCents = computeTabTotalCents(orderItems);
  const tabTotal = tabTotalCents / 100;

  // Evenly preview
  const evenSplit = n >= 2 ? computeEvenSplit(tabTotalCents, n) : null;

  // Item mode
  const assignedItemIdSet = new Set(itemColumns.flatMap(c => c.itemIds));
  const unassignedItems = orderItems.filter(i => !assignedItemIdSet.has(i.id));

  // Person mode
  const assignedPersonItemIdSet = new Set(personColumns.flatMap(c => c.itemIds));
  const unassignedPersonItems = orderItems.filter(i => !assignedPersonItemIdSet.has(i.id));

  // Amount mode totals
  const enteredTotal = amountRows.reduce((s, r) => s + r.amount, 0);
  const remaining = tabTotal - enteredTotal;
  const remainingExact = Math.abs(remaining) <= 0.01;

  // ── isValid per mode ──
  const isValid: boolean =
    activeMode === 'evenly'
      ? n >= 2
      : activeMode === 'item'
        ? unassignedItems.length === 0 && itemColumns.length >= 1
        : activeMode === 'person'
          ? personColumns.length >= 2
          : remainingExact && amountRows.every(r => r.amount > 0) && amountRows.length >= 2;

  // ── hasUnsavedAssignments — true if any non-evenly mode was interacted with ──
  const hasUnsavedAssignments =
    (activeMode === 'item' && (itemColumns.some(c => c.itemIds.length > 0) || selectedItemId !== null)) ||
    (activeMode === 'person' && (personColumns.some(c => c.itemIds.length > 0) || selectedPersonItemId !== null)) ||
    (activeMode === 'amount' && amountRows.some(r => r.amount > 0));

  // ── Reset all state ──
  const resetAllState = useCallback(() => {
    setActiveMode('evenly');
    setN(0);
    setItemColumns([{ id: `${uid}-col-1`, label: 'Check 1', itemIds: [] }]);
    setSelectedItemId(null);
    setPersonColumns([
      { id: `${uid}-p-1`, name: 'Person 1', itemIds: [] },
      { id: `${uid}-p-2`, name: 'Person 2', itemIds: [] },
    ]);
    setSelectedPersonItemId(null);
    setAmountRows([
      { id: `${uid}-a-1`, label: 'Check 1', amount: 0 },
      { id: `${uid}-a-2`, label: 'Check 2', amount: 0 },
    ]);
    setConfirmDiscardOpen(false);
  }, [uid]);

  // ── Cancel / discard ──
  const handleCancel = useCallback(() => {
    if (hasUnsavedAssignments) {
      setConfirmDiscardOpen(true);
    } else {
      resetAllState();
      onClose();
    }
  }, [hasUnsavedAssignments, resetAllState, onClose]);

  // ── Error toast helper ──
  function showErrorToast(message: string) {
    toast.error(message);
  }

  // ── Confirm handler ──
  const handleConfirm = async () => {
    if (!isValid || isMutating) return;

    if (activeMode === 'evenly') {
      const result = await splitEvenly.mutateAsync({
        parentTabId: tab.id,
        n,
        tabTotalCents,
        method: 'cash',
        tenderedAmount: null,
      });
      if (!result.ok) {
        showErrorToast(result.error.message);
        return;
      }
      toast.success(`Tab split ${String(n)} ways. Each payment: ${evenSplit ? `$${(evenSplit.baseAmount / 100).toFixed(2)}` : ''}`);
      resetAllState();
      onClose();
      return;
    }

    if (activeMode === 'item') {
      const assignments = itemColumns.map(col => ({
        sub_tab_label: col.label,
        order_item_ids: col.itemIds,
      }));
      const result = await splitByItem.mutateAsync({ parentTabId: tab.id, assignments });
      if (!result.ok) {
        showErrorToast(result.error.message);
        return;
      }
      toast.success(`Tab split into ${String(itemColumns.length)} checks.`);
      resetAllState();
      onClose();
      return;
    }

    if (activeMode === 'person') {
      const assignments = personColumns.map(col => ({
        sub_tab_label: col.name,
        order_item_ids: col.itemIds,
      }));
      const result = await splitByPerson.mutateAsync({
        parentTabId: tab.id,
        n: personColumns.length,
        assignments,
      });
      if (!result.ok) {
        showErrorToast(result.error.message);
        return;
      }
      toast.success(`Tab split between ${String(personColumns.length)} persons.`);
      resetAllState();
      onClose();
      return;
    }

    // amount mode (only remaining case — TypeScript narrows activeMode to 'amount' here)
    const amounts = amountRows.map(row => ({
      sub_tab_label: row.label,
      amount: row.amount,
    }));
    const amountResult = await splitByAmount.mutateAsync({ parentTabId: tab.id, amounts });
    if (!amountResult.ok) {
      showErrorToast(amountResult.error.message);
      return;
    }
    toast.success(`Tab split into ${String(amountRows.length)} checks by amount.`);
    resetAllState();
    onClose();
  };

  // ── Item mode handlers ──
  function handleItemColumnSelect(colId: string) {
    if (!selectedItemId) return;
    // Move item to this column (remove from Unassigned or other columns)
    setItemColumns(prev =>
      prev.map(col => {
        if (col.id === colId) {
          if (col.itemIds.includes(selectedItemId)) return col;
          return { ...col, itemIds: [...col.itemIds, selectedItemId] };
        }
        return { ...col, itemIds: col.itemIds.filter(id => id !== selectedItemId) };
      })
    );
    setSelectedItemId(null);
  }

  function handleMoveItemToUnassigned(itemId: string) {
    setItemColumns(prev =>
      prev.map(col => ({ ...col, itemIds: col.itemIds.filter(id => id !== itemId) }))
    );
    if (selectedItemId === itemId) setSelectedItemId(null);
  }

  function handleUnassignedColumnSelect() {
    if (!selectedItemId) return;
    // Move item back to unassigned
    setItemColumns(prev =>
      prev.map(col => ({ ...col, itemIds: col.itemIds.filter(id => id !== selectedItemId) }))
    );
    setSelectedItemId(null);
  }

  function handleSelectUnassignedItem(itemId: string) {
    setSelectedItemId(prev => (prev === itemId ? null : itemId));
  }

  function addItemColumn() {
    const nextNum = itemColumns.length + 1;
    setItemColumns(prev => [
      ...prev,
      { id: `${uid}-col-${String(nextNum)}-${String(Date.now())}`, label: `Check ${String(nextNum)}`, itemIds: [] },
    ]);
  }

  // ── Person mode handlers ──
  function handlePersonItemSelect(itemId: string) {
    setSelectedPersonItemId(prev => (prev === itemId ? null : itemId));
  }

  function handlePersonColumnSelect(colId: string) {
    if (!selectedPersonItemId) return;
    setPersonColumns(prev =>
      prev.map(col => {
        if (col.id === colId) {
          if (col.itemIds.includes(selectedPersonItemId)) return col;
          return { ...col, itemIds: [...col.itemIds, selectedPersonItemId] };
        }
        return { ...col, itemIds: col.itemIds.filter(id => id !== selectedPersonItemId) };
      })
    );
    setSelectedPersonItemId(null);
  }

  function handlePersonMoveItemToUnassigned(itemId: string) {
    setPersonColumns(prev =>
      prev.map(col => ({ ...col, itemIds: col.itemIds.filter(id => id !== itemId) }))
    );
    if (selectedPersonItemId === itemId) setSelectedPersonItemId(null);
  }

  function handlePersonUnassignedSelect() {
    if (!selectedPersonItemId) return;
    setPersonColumns(prev =>
      prev.map(col => ({ ...col, itemIds: col.itemIds.filter(id => id !== selectedPersonItemId) }))
    );
    setSelectedPersonItemId(null);
  }

  function addPersonColumn() {
    const nextNum = personColumns.length + 1;
    setPersonColumns(prev => [
      ...prev,
      {
        id: `${uid}-p-${String(nextNum)}-${String(Date.now())}`,
        name: `Person ${String(nextNum)}`,
        itemIds: [],
      },
    ]);
  }

  // ── Amount mode handlers ──
  function addAmountRow() {
    const nextNum = amountRows.length + 1;
    setAmountRows(prev => [
      ...prev,
      { id: `${uid}-a-${String(nextNum)}-${String(Date.now())}`, label: `Check ${String(nextNum)}`, amount: 0 },
    ]);
  }

  function removeAmountRow(rowId: string) {
    setAmountRows(prev => prev.filter(r => r.id !== rowId));
  }

  function updateAmountLabel(rowId: string, label: string) {
    setAmountRows(prev => prev.map(r => (r.id === rowId ? { ...r, label } : r)));
  }

  function updateAmount(rowId: string, amount: number) {
    setAmountRows(prev => prev.map(r => (r.id === rowId ? { ...r, amount } : r)));
  }

  // ── Unassigned column items for item mode (rendered as clickable list) ──
  function renderItemModeUnassignedItems(items: OrderItem[]) {
    return items.map(item => (
      <li
        key={item.id}
        role="option"
        aria-selected={selectedItemId === item.id}
        tabIndex={0}
        className={cn(
          'flex items-center justify-between px-3 py-2 gap-2 hover:bg-accent/30 cursor-pointer transition-colors',
          selectedItemId === item.id && 'ring-2 ring-primary bg-primary/10'
        )}
        onClick={() => {
          handleSelectUnassignedItem(item.id);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelectUnassignedItem(item.id);
          }
        }}
      >
        <span className="text-sm truncate flex-1">{item.product?.name ?? item.productId}</span>
        <span className="text-sm text-muted-foreground font-mono">×{item.quantity}</span>
        <MoneyDisplay amount={item.unitPrice} size="sm" />
      </li>
    ));
  }

  // ── Unassigned column items for person mode ──
  function renderPersonModeUnassignedItems(items: OrderItem[]) {
    return items.map(item => (
      <li
        key={item.id}
        role="option"
        aria-selected={selectedPersonItemId === item.id}
        tabIndex={0}
        className={cn(
          'flex items-center justify-between px-3 py-2 gap-2 hover:bg-accent/30 cursor-pointer transition-colors',
          selectedPersonItemId === item.id && 'ring-2 ring-primary bg-primary/10'
        )}
        onClick={() => {
          handlePersonItemSelect(item.id);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePersonItemSelect(item.id);
          }
        }}
      >
        <span className="text-sm truncate flex-1">{item.product?.name ?? item.productId}</span>
        <span className="text-sm text-muted-foreground font-mono">×{item.quantity}</span>
        <MoneyDisplay amount={item.unitPrice} size="sm" />
      </li>
    ));
  }

  const tabLabel = tab.customerName.length > 0 ? tab.customerName : tab.id.slice(0, 8);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={isOpen => {
          if (!isOpen) handleCancel();
        }}
      >
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-4 pb-2 shrink-0">
            <SheetTitle>Split tab — {tabLabel}</SheetTitle>
            <SheetDescription>
              Total:{' '}
              <MoneyDisplay amount={tabTotal} size="md" />
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeMode}
            onValueChange={v => {
              setActiveMode(v as SplitMode);
              setSelectedItemId(null);
              setSelectedPersonItemId(null);
            }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="mx-6 mb-0 mt-2 grid grid-cols-4 shrink-0">
              <TabsTrigger value="evenly">Evenly</TabsTrigger>
              <TabsTrigger value="item">By Item</TabsTrigger>
              <TabsTrigger value="person">By Person</TabsTrigger>
              <TabsTrigger value="amount">By Amount</TabsTrigger>
            </TabsList>

            {/* ── Evenly mode ── */}
            <TabsContent value="evenly" className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 flex flex-col items-center gap-6">
                <p className="text-sm text-muted-foreground">
                  How many people are splitting this tab?
                </p>

                <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <POSButton
                      key={num}
                      touchSize="xl"
                      variant={n === num ? 'default' : 'outline'}
                      onClick={() => {
                        setN(num);
                      }}
                      aria-label={`Split ${String(num)} ways`}
                      aria-pressed={n === num}
                    >
                      {num}
                    </POSButton>
                  ))}
                </div>

                {evenSplit !== null && n >= 2 && (
                  <div className="rounded-lg bg-card border p-4 w-full space-y-2">
                    <p className="text-sm font-semibold">Preview</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {n - 1} × payments
                      </span>
                      <MoneyDisplay amount={evenSplit.baseAmount / 100} size="sm" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        1 × payment (absorbs rounding)
                      </span>
                      <MoneyDisplay amount={evenSplit.lastAmount / 100} size="sm" />
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-sm font-semibold">Total</span>
                      <MoneyDisplay amount={tabTotal} size="md" />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Item mode ── */}
            <TabsContent value="item" className="flex-1 overflow-hidden flex flex-col">
              {selectedItemId !== null && (
                <div className="mx-6 mb-3 flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2">
                  <span className="text-sm text-primary">
                    &ldquo;{getItemById(orderItems, selectedItemId)?.product?.name ?? selectedItemId}&rdquo; selected
                  </span>
                  <span className="text-sm text-muted-foreground ml-auto">Tap a column to assign</span>
                </div>
              )}

              <div className="flex gap-3 overflow-x-auto px-6 pb-3 flex-1">
                {/* Unassigned column */}
                <div
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  className={cn(
                    'flex flex-col min-w-[140px] bg-card rounded-lg border cursor-pointer transition-colors',
                    selectedItemId !== null ? 'border-primary/40' : 'border-border'
                  )}
                  onClick={() => {
                    if (selectedItemId !== null) handleUnassignedColumnSelect();
                  }}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ' ') && selectedItemId !== null) {
                      e.preventDefault();
                      handleUnassignedColumnSelect();
                    }
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-semibold truncate max-w-[100px]">Unassigned</span>
                    <span className="text-xs text-muted-foreground">{unassignedItems.length}</span>
                  </div>
                  <ul
                    data-item-list
                    className="flex-1 overflow-y-auto divide-y min-h-[120px] list-none p-0 m-0"
                  >
                    {renderItemModeUnassignedItems(unassignedItems)}
                  </ul>
                  {unassignedItems.length === 0 && (
                    <div className="px-3 py-2 text-sm text-pos-accent text-center border-t">
                      All items assigned
                    </div>
                  )}
                </div>

                {/* SubTab columns */}
                {itemColumns.map(col => {
                  const colItems = col.itemIds
                    .map(id => getItemById(orderItems, id))
                    .filter((i): i is OrderItem => i !== undefined);
                  return (
                    <SubTabColumn
                      key={col.id}
                      label={col.label}
                      items={colItems}
                      total={columnTotal(col.itemIds, orderItems)}
                      isSelected={selectedItemId !== null}
                      onSelect={() => {
                        handleItemColumnSelect(col.id);
                      }}
                      onRemoveItem={itemId => {
                        handleMoveItemToUnassigned(itemId);
                      }}
                    />
                  );
                })}

                {/* Add check button */}
                <POSButton
                  variant="outline"
                  touchSize="large"
                  type="button"
                  className="min-w-[140px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  onClick={addItemColumn}
                  aria-label="Add sub-check column"
                >
                  <Plus className="size-5" />
                  <span className="text-sm">Add check</span>
                </POSButton>
              </div>

              {unassignedItems.length > 0 && (
                <p className="px-6 pb-2 text-sm text-pos-danger">
                  {unassignedItems.length} item(s) not assigned. Assign all items before confirming.
                </p>
              )}
            </TabsContent>

            {/* ── By Person mode ── */}
            <TabsContent value="person" className="flex-1 overflow-hidden flex flex-col">
              {selectedPersonItemId !== null && (
                <div className="mx-6 mb-3 flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2">
                  <span className="text-sm text-primary">
                    &ldquo;{getItemById(orderItems, selectedPersonItemId)?.product?.name ?? selectedPersonItemId}&rdquo; selected
                  </span>
                  <span className="text-sm text-muted-foreground ml-auto">Tap a column to assign</span>
                </div>
              )}

              <div className="flex gap-3 overflow-x-auto px-6 pb-3 flex-1">
                {/* Unassigned (split evenly) column */}
                <div
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  className={cn(
                    'flex flex-col min-w-[140px] bg-card rounded-lg border cursor-pointer transition-colors',
                    selectedPersonItemId !== null ? 'border-primary/40' : 'border-border'
                  )}
                  onClick={() => {
                    if (selectedPersonItemId !== null) handlePersonUnassignedSelect();
                  }}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ' ') && selectedPersonItemId !== null) {
                      e.preventDefault();
                      handlePersonUnassignedSelect();
                    }
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-semibold truncate max-w-[100px] italic text-muted-foreground">
                      Unassigned (split evenly)
                    </span>
                  </div>
                  <ul
                    data-item-list
                    className="flex-1 overflow-y-auto divide-y min-h-[120px] list-none p-0 m-0"
                  >
                    {renderPersonModeUnassignedItems(unassignedPersonItems)}
                  </ul>
                  {unassignedPersonItems.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground text-center border-t">
                      No unassigned items
                    </div>
                  )}
                </div>

                {/* PersonCard columns */}
                {personColumns.map((col, idx) => {
                  const colItems = col.itemIds
                    .map(id => getItemById(orderItems, id))
                    .filter((i): i is OrderItem => i !== undefined);
                  return (
                    <PersonCard
                      key={col.id}
                      name={col.name}
                      onNameChange={name => {
                        setPersonColumns(prev =>
                          prev.map(p => (p.id === col.id ? { ...p, name } : p))
                        );
                      }}
                      items={colItems}
                      total={columnTotal(col.itemIds, orderItems)}
                      isSelected={selectedPersonItemId !== null}
                      onSelect={() => {
                        handlePersonColumnSelect(col.id);
                      }}
                      onRemoveItem={itemId => {
                        handlePersonMoveItemToUnassigned(itemId);
                      }}
                      autoFocusName={idx === personColumns.length - 1 && personColumns.length > 2}
                    />
                  );
                })}

                {/* Add person button */}
                <POSButton
                  variant="outline"
                  touchSize="large"
                  type="button"
                  className="min-w-[140px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  onClick={addPersonColumn}
                  aria-label="Add person"
                >
                  <Plus className="size-5" />
                  <span className="text-sm">Add person</span>
                </POSButton>
              </div>
            </TabsContent>

            {/* ── By Amount mode ── */}
            <TabsContent value="amount" className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 flex flex-col gap-4">
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Amount split does not preserve item-level reporting. Use By Item when possible.
                  </p>
                </div>

                <div className="space-y-3">
                  {amountRows.map((row, i) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <Input
                        placeholder={`Check ${String(i + 1)} label`}
                        value={row.label}
                        onChange={e => {
                          updateAmountLabel(row.id, e.target.value);
                        }}
                        className="flex-1"
                        maxLength={30}
                      />
                      <MoneyInput
                        value={row.amount}
                        onChange={v => {
                          updateAmount(row.id, v);
                        }}
                        className="w-28"
                        placeholder="0.00"
                      />
                      {amountRows.length > 2 && (
                        <POSButton
                          variant="ghost"
                          touchSize="xl"
                          focusEmphasis="high"
                          type="button"
                          className="w-[72px]"
                          onClick={() => {
                            removeAmountRow(row.id);
                          }}
                          aria-label={`Remove check ${String(i + 1)}`}
                        >
                          <X className="size-4 text-muted-foreground hover:text-destructive" />
                        </POSButton>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addAmountRow}
                    className="w-full"
                  >
                    <Plus className="size-4 mr-2" />
                    Add check
                  </Button>
                </div>

                <div className="rounded-lg bg-card border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Entered total</span>
                    <MoneyDisplay
                      amount={enteredTotal}
                      size="sm"
                      className={remainingExact ? '' : 'text-pos-danger'}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <MoneyDisplay
                      amount={Math.abs(remaining)}
                      size="sm"
                      className={remaining === 0 ? 'text-pos-accent' : 'text-pos-danger'}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-semibold">Tab total</span>
                    <MoneyDisplay amount={tabTotal} size="md" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="px-6 pb-6 pt-4 border-t flex gap-3 shrink-0">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Keep tab open
            </Button>
            <POSButton
              touchSize="xl"
              focusEmphasis="high"
              className="flex-1"
              disabled={!isValid || isMutating}
              onClick={() => {
                void handleConfirm();
              }}
            >
              Confirm Split
            </POSButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard split?"
        description="Your assignments will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        onConfirm={() => {
          resetAllState();
          onClose();
        }}
        onCancel={() => {
          setConfirmDiscardOpen(false);
        }}
      />
    </>
  );
}
