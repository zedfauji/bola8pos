/**
 * TAB ENTITY QUERIES — TanStack Query + Result wrappers (no throws).
 */

import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useCajaStore } from '@entities/caja/model/store';
import { useStaffStore } from '@entities/staff/model/store';
import { isOnline } from '@shared/lib/connectivity';
import {
  ProductSchema,
  type Order,
  type OrderItem,
  type PoolSessionSummary,
  type Product,
  type Tab,
} from '@shared/lib/domain';
import { generateIdempotencyKey } from '@shared/lib/domain-helpers';
import { logger } from '@shared/lib/logger-instance';
import {
  err,
  networkOfflineError,
  ok,
  staleVersionError,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type AppError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Json, Tables, TablesInsert } from '@shared/lib/supabase.types';
import { handleVersionError } from '@shared/lib/version-error';
import { useTabStore } from './store';
import {
  TabSchema,
  OrderSchema,
  OrderItemSchema,
  type CreateTab,
  type CreateOrder,
  type CreateOrderItem,
} from './types';

export const tabKeys = {
  all: ['tabs'] as const,
  lists: () => [...tabKeys.all, 'list'] as const,
  list: (filters?: { shiftId?: string; status?: string; bartenderScope?: string }) =>
    [...tabKeys.lists(), filters ?? {}] as const,
  details: () => [...tabKeys.all, 'detail'] as const,
  detail: (id: string) => [...tabKeys.details(), id] as const,
  subTabs: (parentTabId: string) => [...tabKeys.all, 'sub-tabs', parentTabId] as const,
};

interface CategoryEmbed {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

interface ProductRowWithCategory extends Tables<'products'> {
  category?: CategoryEmbed | null;
}

interface OrderItemRow extends Tables<'order_items'> {
  product?: ProductRowWithCategory | null;
}

interface OrderRow extends Tables<'orders'> {
  order_items?: OrderItemRow[] | null;
}

interface PoolTableEmbed {
  number: number;
  label: string;
  rate_per_hour: number;
}

interface PoolSessionRow extends Tables<'pool_sessions'> {
  pool_tables?: PoolTableEmbed | null;
}

interface TabRow extends Tables<'tabs'> {
  orders?: OrderRow[] | null;
  pool_sessions?: PoolSessionRow[] | null;
}

function mapProductRow(
  p: ProductRowWithCategory | Tables<'products'> | null | undefined
): Product | undefined {
  if (p == null) return undefined;
  try {
    const catEmbed = 'category' in p ? p.category : null;
    return ProductSchema.parse({
      id: p.id,
      name: p.name,
      categoryId: p.category_id,
      basePrice: p.base_price,
      // legacy HH price column retired (Phase 20, D-01) — superseded by the
      // promotions engine; always null (vestigial nullable field).
      happyHourPrice: null,
      sku: p.sku,
      isActive: p.is_active,
      imageUrl: p.image_url,
      stock_threshold: p.stock_threshold ?? null,
      modifiers: [],
      ...(catEmbed
        ? {
            category: {
              id: catEmbed.id,
              name: catEmbed.name,
              color: catEmbed.color,
              sortOrder: catEmbed.sort_order,
              // legacy HH start/end columns retired (Phase 20, D-01) — superseded
              // by the promotions engine; always null.
              happyHourStart: null,
              happyHourEnd: null,
              createdAt: new Date(catEmbed.created_at),
            },
          }
        : {}),
    });
  } catch {
    return undefined;
  }
}

function mapPoolSessionsRow(sessions: PoolSessionRow[] | null | undefined): {
  poolCharges: PoolSessionSummary[];
  hasActivePoolSession: boolean;
  activePoolTableNumber: number | null | undefined;
} {
  let hasActivePoolSession = false;
  let activePoolTableNumber: number | null | undefined;
  const poolCharges: PoolSessionSummary[] = [];

  for (const s of sessions ?? []) {
    const table = s.pool_tables ?? undefined;
    if (s.stopped_at === null) {
      hasActivePoolSession = true;
      if (table != null && activePoolTableNumber === undefined) {
        activePoolTableNumber = table.number;
      }
      continue;
    }
    if (table == null || s.total_charge == null || s.billed_minutes == null) continue;
    poolCharges.push({
      sessionId: s.id,
      tableNumber: table.number,
      tableLabel: table.label,
      billedMinutes: s.billed_minutes,
      ratePerHour: table.rate_per_hour,
      totalCharge: s.total_charge,
    });
  }

  return { poolCharges, hasActivePoolSession, activePoolTableNumber };
}

function mapOrderItemRow(item: OrderItemRow): Result<OrderItem> {
  try {
    return ok(
      OrderItemSchema.parse({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        modifierIds: item.modifier_ids,
        modifierPriceDelta: item.modifier_price_delta,
        notes: item.notes,
        modifiers: [],
        product: mapProductRow(item.product ?? undefined),
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

function mapOrderRow(order: OrderRow): Result<Order> {
  try {
    const items: OrderItem[] = [];
    for (const item of order.order_items ?? []) {
      const m = mapOrderItemRow(item);
      if (!m.ok) return m;
      items.push(m.data);
    }
    return ok(
      OrderSchema.parse({
        id: order.id,
        tabId: order.tab_id,
        staffId: order.staff_id,
        createdAt: new Date(order.created_at),
        status: order.status,
        notes: order.notes,
        items,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

function mapTabRow(row: TabRow): Result<Tab> {
  try {
    const orders: Order[] = [];
    for (const order of row.orders ?? []) {
      const m = mapOrderRow(order);
      if (!m.ok) return m;
      orders.push(m.data);
    }
    const flatItems = orders.flatMap(o => o.items);
    const { poolCharges, hasActivePoolSession, activePoolTableNumber } = mapPoolSessionsRow(
      row.pool_sessions
    );
    return ok(
      TabSchema.parse({
        id: row.id,
        customerName: row.customer_name ?? '',
        tableNumber: row.table_number,
        staffId: row.staff_id,
        shiftId: row.shift_id,
        openedAt: new Date(row.opened_at),
        closedAt: row.closed_at ? new Date(row.closed_at) : null,
        status: row.status,
        notes: row.notes,
        orders,
        items: flatItems,
        poolCharges,
        ...(row.rappi_order_id != null && row.rappi_order_id !== ''
          ? { rappiOrderId: row.rappi_order_id }
          : {}),
        ...(hasActivePoolSession ? { hasActivePoolSession: true, activePoolTableNumber } : {}),
        // Phase 15: optimistic-concurrency version (column added by 20260512000001_versioned_rows)
        ...(typeof (row as { version?: number }).version === 'number'
          ? { version: (row as { version?: number }).version }
          : {}),
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

const TERMINAL_ID =
  (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';

const tabListSelect = `
  *,
  orders(
    *,
    order_items(
      *,
      product:products(
        *,
        category:categories(id, name, color, sort_order, created_at)
      )
    )
  ),
  pool_sessions(
    id,
    tab_id,
    table_id,
    started_at,
    stopped_at,
    billed_minutes,
    total_charge,
    pool_tables!pool_sessions_table_id_fkey(number, label, rate_per_hour)
  )
`;

/** Open tabs for the current shift; syncs {@link useTabStore} on success. */
export function useTabs() {
  const shiftId = useStaffStore(s => s.currentShift?.id);
  const viewerRole = useStaffStore(s => s.currentStaff?.role);
  const viewerStaffId = useStaffStore(s => s.currentStaff?.id);
  const isDisabled = !shiftId;

  const listFilters =
    shiftId != null
      ? viewerRole === 'bartender' && viewerStaffId != null
        ? { shiftId, status: 'open' as const, bartenderScope: viewerStaffId }
        : { shiftId, status: 'open' as const }
      : { status: 'open' as const };

  const query = useQuery({
    queryKey: tabKeys.list(listFilters),
    enabled: Boolean(shiftId),
    queryFn: async (): Promise<Result<Tab[]>> => {
      if (!shiftId) {
        return ok([]);
      }

      const res = await supabaseQuery(() =>
        supabase
          .from('tabs')
          .select(tabListSelect)
          .eq('status', 'open')
          .eq('shift_id', shiftId)
          .is('parent_tab_id', null) // sub-tabs must NOT appear in the main POS list (S4, Pitfall 4)
          .order('opened_at', { ascending: false })
      );

      if (!res.ok) {
        logger.error('tabs.list.fetch_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const tabs: Tab[] = [];
      for (const row of res.data as TabRow[]) {
        const m = mapTabRow(row);
        if (!m.ok) {
          logger.error('tabs.list.map_failed', { message: m.error.message });
          return m;
        }
        tabs.push(m.data);
      }

      const role = useStaffStore.getState().currentStaff?.role;
      const ownId = useStaffStore.getState().currentStaff?.id;
      if (role === 'bartender' && ownId) {
        return ok(tabs.filter(t => t.staffId === ownId));
      }
      return ok(tabs);
    },
  });

  useEffect(() => {
    if (query.data?.ok) {
      useTabStore.getState().loadTabs(query.data.data);
    }
  }, [query.data]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
    isDisabled,
  };
}

/** Single tab with nested orders and items. */
export function useTab(id: string) {
  const query = useQuery({
    queryKey: tabKeys.detail(id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Result<Tab>> => {
      const res = await supabaseQuery(() =>
        supabase.from('tabs').select(tabListSelect).eq('id', id).single()
      );

      if (!res.ok) {
        logger.error('tabs.detail.fetch_failed', {
          tabId: id,
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const m = mapTabRow(res.data as unknown as TabRow);
      if (!m.ok) {
        logger.error('tabs.detail.map_failed', { tabId: id, message: m.error.message });
        return m;
      }
      return m;
    },
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.orders.length === 0 && r.data.items.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

/** Sub-tabs for a given parent tab (split-bill). Returns [] when parentTabId is null. */
export function useSubTabs(parentTabId: string | null) {
  return useQuery({
    queryKey: tabKeys.subTabs(parentTabId ?? ''),
    enabled: parentTabId != null && parentTabId.length > 0,
    queryFn: async (): Promise<Result<Tab[]>> => {
      if (!parentTabId) return ok([]);
      const res = await supabaseQuery(() =>
        supabase
          .from('tabs')
          .select(tabListSelect)
          .eq('parent_tab_id', parentTabId)
          .order('created_at', { ascending: true })
      );
      if (!res.ok) {
        logger.error('tabs.subtabs.fetch_failed', { code: res.error.code });
        return res;
      }
      const tabs: Tab[] = [];
      for (const row of res.data as TabRow[]) {
        const m = mapTabRow(row);
        if (!m.ok) return m;
        tabs.push(m.data);
      }
      return ok(tabs);
    },
  });
}

type OpenTabMutationContext = {
  previousLists: [QueryKey, unknown][];
  tempId: string;
};

export function useMutationOpenTab() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTab): Promise<Result<Tab>> => {
      if (!isOnline()) {
        return err(networkOfflineError());
      }
      const cajaState = useCajaStore.getState();
      if (!cajaState.isCajaOpen || !cajaState.currentCaja) {
        const cajaErr: AppError = {
          code: 'CAJA_CLOSED',
          message: 'No caja is open. Ask a manager to open the caja first.',
        };
        return err(cajaErr);
      }
      const cajaSessionId = cajaState.currentCaja.id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData: any = {
        customer_name: input.customerName,
        table_number: input.tableNumber,
        staff_id: input.staffId,
        shift_id: input.shiftId,
        status: input.status,
        notes: input.notes,
        caja_session_id: cajaSessionId,
        ...(input.rappiOrderId != null && input.rappiOrderId !== ''
          ? { rappi_order_id: input.rappiOrderId }
          : {}),
      };

      const res = await supabaseMutation(() =>
        supabase.from('tabs').insert(insertData).select().single()
      );

      if (!res.ok) {
        logger.error('tabs.open.insert_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const m = mapTabRow(res.data as unknown as TabRow);
      if (!m.ok) {
        logger.error('tabs.open.map_failed', { message: m.error.message });
        return m;
      }
      return ok(m.data);
    },

    onMutate: async (input): Promise<OpenTabMutationContext> => {
      const tempId = crypto.randomUUID();
      await queryClient.cancelQueries({ queryKey: tabKeys.lists() });
      const previousLists = queryClient.getQueriesData({ queryKey: tabKeys.lists() });

      const optimistic: Tab = TabSchema.parse({
        id: tempId,
        customerName: input.customerName,
        tableNumber: input.tableNumber,
        staffId: input.staffId,
        shiftId: input.shiftId,
        openedAt: new Date(),
        closedAt: null,
        status: input.status,
        notes: input.notes,
        orders: [],
        items: [],
        poolCharges: [],
        hasActivePoolSession: false,
        cajaSessionId: useCajaStore.getState().currentCaja?.id ?? null,
        ...(input.rappiOrderId != null && input.rappiOrderId !== ''
          ? { rappiOrderId: input.rappiOrderId }
          : {}),
      });

      useTabStore.getState().openTab(optimistic);

      queryClient.setQueriesData<Result<Tab[]>>({ queryKey: tabKeys.lists() }, old => {
        if (!old || typeof old !== 'object' || !('ok' in old)) return old;
        const o = old;
        if (!o.ok) return old;
        return ok([optimistic, ...o.data]);
      });

      return { previousLists, tempId };
    },

    onSuccess: (result, input, ctx) => {
      const c = ctx as OpenTabMutationContext | undefined;
      if (!result.ok) {
        logger.error('tabs.open.mutation_failed', { message: result.error.message });
        if (result.error.code === 'NETWORK_OFFLINE') {
          // Phase 15 Plan 04: open-tab creates a row — no prior version exists,
          // so capture expectedVersion: 0.
          useTabStore.getState().enqueueOfflineAction({
            type: 'open-tab',
            payload: input,
            expectedVersion: 0,
          });
          // Keep the optimistic tab in place so the UI stays usable offline.
          return;
        }
        if (c?.tempId) {
          useTabStore.setState(s => ({ tabs: s.tabs.filter(t => t.id !== c.tempId) }));
        }
        if (c?.previousLists) {
          for (const [key, data] of c.previousLists) {
            queryClient.setQueryData(key, data);
          }
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(result.data.id) });
      useTabStore.setState(s => ({
        tabs: [result.data, ...s.tabs.filter(t => t.id !== c?.tempId)],
      }));
    },

    onError: (_e, _input, ctx) => {
      const c = ctx;
      if (c?.tempId) {
        useTabStore.setState(s => ({ tabs: s.tabs.filter(t => t.id !== c.tempId) }));
      }
      if (c?.previousLists) {
        for (const [key, data] of c.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },
  });
}

function buildRpcItemsJson(items: Omit<CreateOrderItem, 'orderId'>[]): {
  product_id: string;
  quantity: number;
  unit_price: number;
  modifier_ids: string[];
  modifier_price_delta: number;
  notes: string | null;
}[] {
  return items.map(item => ({
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    modifier_ids: item.modifierIds,
    modifier_price_delta: item.modifierPriceDelta,
    notes: item.notes,
  }));
}

type RpcOrderResult = {
  order: Tables<'orders'>;
  items: Tables<'order_items'>[];
};

function mapRpcOrderPayload(data: Json | null): Result<RpcOrderResult> {
  try {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return err(unknownError('invalid_rpc_payload'));
    }
    const o = data as { order: Tables<'orders'>; items: Tables<'order_items'>[] };
    if (!Array.isArray(o.items)) {
      return err(unknownError('invalid_rpc_shape'));
    }
    return ok(o);
  } catch (e) {
    return err(unknownError(e));
  }
}

type AddOrderContext = { previousDetail: Result<Tab> | undefined };

export function useMutationAddOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tabId,
      order,
      items,
    }: {
      tabId: string;
      order: Omit<CreateOrder, 'tabId'>;
      items: Omit<CreateOrderItem, 'orderId'>[];
    }): Promise<Result<{ order: Order; items: OrderItem[] }>> => {
      if (!isOnline()) {
        return err(networkOfflineError());
      }
      // Phase 15 Group A (D-04 revised): pass p_expected_version when cached
      // tab carries a version. Server-side RPC raises P0V01 (STALE_VERSION) on
      // mismatch; parseSupabaseError maps that to staleVersionError.
      const cachedTab = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(tabId));
      const expectedVersion =
        cachedTab?.ok && typeof cachedTab.data.version === 'number'
          ? cachedTab.data.version
          : undefined;
      const payload = {
        p_tab_id: tabId,
        p_staff_id: order.staffId,
        p_status: order.status,
        p_notes: order.notes ?? '',
        p_items: buildRpcItemsJson(items) as unknown as Json,
        p_skip_depletion: false,
        ...(expectedVersion !== undefined ? { p_expected_version: expectedVersion } : {}),
      };

      const res = await supabaseQuery(() => supabase.rpc('create_order_with_items', payload));

      if (!res.ok) {
        logger.error('tabs.add_order.rpc_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const parsed = mapRpcOrderPayload(res.data as Json);
      if (!parsed.ok) {
        logger.error('tabs.add_order.payload_invalid', { message: parsed.error.message });
        return parsed;
      }

      const { order: orderRow, items: itemRows } = parsed.data;
      const itemsMapped: OrderItem[] = [];
      for (const row of itemRows) {
        const m = mapOrderItemRow(row as OrderItemRow);
        if (!m.ok) return m;
        itemsMapped.push(m.data);
      }
      const orderMapped = OrderSchema.parse({
        id: orderRow.id,
        tabId: orderRow.tab_id,
        staffId: orderRow.staff_id,
        createdAt: new Date(orderRow.created_at),
        status: orderRow.status,
        notes: orderRow.notes,
        items: itemsMapped,
      });
      return ok({ order: orderMapped, items: itemsMapped });
    },

    onMutate: async ({ tabId, order, items }): Promise<AddOrderContext> => {
      await queryClient.cancelQueries({ queryKey: tabKeys.detail(tabId) });
      const previousDetail = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(tabId));
      const tempOrderId = crypto.randomUUID();
      const optimisticItems: OrderItem[] = items.map(it =>
        OrderItemSchema.parse({
          id: crypto.randomUUID(),
          orderId: tempOrderId,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          modifierIds: it.modifierIds,
          modifierPriceDelta: it.modifierPriceDelta,
          notes: it.notes,
          modifiers: [],
        })
      );
      const optimisticOrder = OrderSchema.parse({
        id: tempOrderId,
        tabId,
        staffId: order.staffId,
        createdAt: new Date(),
        status: order.status,
        notes: order.notes,
        items: optimisticItems,
      });

      if (previousDetail?.ok) {
        const t = previousDetail.data;
        const next: Tab = TabSchema.parse({
          ...t,
          orders: [...t.orders, optimisticOrder],
          items: [...t.items, ...optimisticItems],
        });
        queryClient.setQueryData(tabKeys.detail(tabId), ok(next));
      }

      return { previousDetail };
    },

    onSuccess: (result, variables, ctx) => {
      const c = ctx as AddOrderContext | undefined;
      if (!result.ok) {
        if (result.error.code === 'NETWORK_OFFLINE') {
          // Phase 15 Plan 04: capture cached tab.version at enqueue time so the
          // OfflineQueueProcessor can drop the action on STALE_VERSION.
          {
            const cachedTab = queryClient.getQueryData<Result<Tab>>(
              tabKeys.detail(variables.tabId)
            );
            const expectedVersion =
              cachedTab?.ok && typeof cachedTab.data.version === 'number'
                ? cachedTab.data.version
                : 0;
            useTabStore.getState().enqueueOfflineAction({
              type: 'place-order',
              payload: variables,
              expectedVersion,
            });
          }
          // Leave the optimistic order visible — the cache already has it.
          return;
        }
        if (c?.previousDetail !== undefined) {
          queryClient.setQueryData(tabKeys.detail(variables.tabId), c.previousDetail);
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(variables.tabId) });
    },

    onError: (_e, variables, ctx) => {
      const prev = ctx?.previousDetail;
      if (prev !== undefined) {
        queryClient.setQueryData(tabKeys.detail(variables.tabId), prev);
      }
    },
    // Phase 15: surface STALE_VERSION via handleVersionError when the cached
    // Result carries a typed conflict error (set by mutationFn return path).
  });
}

type UpdateTabStatusContext = {
  previousDetail: Result<Tab> | undefined;
  previousStatus: Tab['status'] | undefined;
};

export function useMutationUpdateTabStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tabId,
      status,
    }: {
      tabId: string;
      status: Tab['status'];
    }): Promise<Result<Tab>> => {
      // Phase 14-05: status transitions now go through the close_tab
      // SECURITY DEFINER RPC (audits 'tab.close') which preserves the
      // Phase 15 optimistic-concurrency contract server-side — the RPC
      // raises P0V01/P0V02 exactly like the prior .eq('version', expected)
      // UPDATE did (via PGRST116), and supabaseMutation's parseSupabaseError
      // maps those SQLSTATEs to the same staleVersionError/notFoundVersioned
      // AppErrors the hook already handles below.
      const cached = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(tabId));
      const expected =
        cached?.ok && typeof cached.data.version === 'number' ? cached.data.version : undefined;

      const rpcRes = await supabaseMutation(() =>
        supabase.rpc('close_tab', {
          p_tab_id: tabId,
          p_status: status,
          p_expected_version: expected ?? null,
          p_terminal_id: TERMINAL_ID,
        })
      );

      if (!rpcRes.ok) {
        logger.error('tabs.status.update_failed', {
          tabId,
          code: rpcRes.error.code,
          message: rpcRes.error.message,
        });
        return rpcRes;
      }

      // close_tab returns {ok:true} only (no row) — re-fetch the authoritative
      // row so callers get the canonical mapped Tab.
      const tabRes = await supabaseQuery(() =>
        supabase.from('tabs').select(tabListSelect).eq('id', tabId).single()
      );
      if (!tabRes.ok) return tabRes;
      return mapTabRow(tabRes.data as unknown as TabRow);
    },

    onMutate: async ({ tabId, status }): Promise<UpdateTabStatusContext> => {
      await queryClient.cancelQueries({ queryKey: tabKeys.detail(tabId) });
      const previousDetail = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(tabId));
      let previousStatus: Tab['status'] | undefined;
      const t = useTabStore.getState().tabs.find(x => x.id === tabId);
      if (t) previousStatus = t.status;
      useTabStore.getState().updateTabStatus(tabId, status);

      if (previousDetail?.ok) {
        queryClient.setQueryData(tabKeys.detail(tabId), ok({ ...previousDetail.data, status }));
      }

      return { previousDetail, previousStatus };
    },

    onSuccess: (result, variables, ctx) => {
      const c = ctx as UpdateTabStatusContext | undefined;
      if (!result.ok) {
        logger.error('tabs.status.mutation_failed', { message: result.error.message });
        // Phase 15: STALE_VERSION / NOT_FOUND_VERSIONED → invalidate + toast + audit
        const cachedVersion = c?.previousDetail?.ok
          ? (c.previousDetail.data.version ?? 0)
          : 0;
        handleVersionError(result.error, {
          queryClient,
          queryKey: tabKeys.detail(variables.tabId),
          entity: 'tabs',
          entityId: variables.tabId,
          expectedVersion: cachedVersion,
          supabase,
          terminalId: TERMINAL_ID,
        });
        if (c?.previousStatus) {
          useTabStore.getState().updateTabStatus(variables.tabId, c.previousStatus);
        }
        if (c?.previousDetail !== undefined) {
          queryClient.setQueryData(tabKeys.detail(variables.tabId), c.previousDetail);
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(variables.tabId) });
    },

    onError: (_e, variables, ctx) => {
      const c = ctx;
      if (c?.previousStatus) {
        useTabStore.getState().updateTabStatus(variables.tabId, c.previousStatus);
      }
      if (c?.previousDetail !== undefined) {
        queryClient.setQueryData(tabKeys.detail(variables.tabId), c.previousDetail);
      }
    },
  });
}

/** Records payment and marks tab paid (Square/cash path). For POS “close tab” shell validation, use `useCloseTab` from `@features/close-tab`. */
export function useMutationRecordTabPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tabId,
      amount,
      tipAmount,
      method,
      processedBy,
      squarePaymentId,
      squareReceiptUrl,
      idempotencyKey,
      tenderedAmount,
      referenceNumber,
    }: {
      tabId: string;
      amount: number;
      tipAmount: number;
      method: 'cash' | 'card' | 'rappi';
      processedBy: string;
      squarePaymentId?: string;
      squareReceiptUrl?: string;
      idempotencyKey?: string;
      tenderedAmount?: number | null;
      referenceNumber?: string | null;
    }): Promise<Result<Tables<'payments'>>> => {
      // Phase 15 Group B: optimistic-concurrency UPDATE on tabs (close path).
      // Uses .eq('version', expected) when cached version is available.
      const cachedTab = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(tabId));
      const expected =
        cachedTab?.ok && typeof cachedTab.data.version === 'number'
          ? cachedTab.data.version
          : undefined;

      if (expected !== undefined) {
        const { data: updRow, error: updErr } = await supabase
          .from('tabs')
          .update({
            status: 'paid',
            closed_at: new Date().toISOString(),
            version: expected + 1,
          })
          .eq('id', tabId)
          .eq('version', expected)
          .select('id')
          .single();
        if (updErr?.code === 'PGRST116') {
          return err(staleVersionError(updErr));
        }
        if (updErr) {
          logger.error('tabs.close.update_failed', {
            tabId,
            code: updErr.code,
            message: updErr.message,
          });
          return err(unknownError(updErr));
        }
        // updRow.id confirms the row was actually updated; PGRST116 already
        // handled above so updRow should be non-null here.
        void updRow;
      } else {
        const tabRes = await supabaseMutation(() =>
          supabase
            .from('tabs')
            .update({
              status: 'paid',
              closed_at: new Date().toISOString(),
            })
            .eq('id', tabId)
        );

        if (!tabRes.ok) {
          logger.error('tabs.close.update_failed', {
            tabId,
            code: tabRes.error.code,
            message: tabRes.error.message,
          });
          return tabRes;
        }
        // update() without select returns null data on success
      }

      const paymentInsert: TablesInsert<'payments'> = {
        tab_id: tabId,
        amount,
        tip_amount: tipAmount,
        method,
        processed_by: processedBy,
        square_payment_id: squarePaymentId || null,
        square_receipt_url: squareReceiptUrl || null,
        idempotency_key: idempotencyKey ?? generateIdempotencyKey('payment'),
        tendered_amount: tenderedAmount ?? null,
        reference_number: referenceNumber ?? null,
      };

      const payRes = await supabaseMutation(() =>
        supabase.from('payments').insert(paymentInsert).select().single()
      );

      if (!payRes.ok) {
        logger.error('tabs.close.payment_failed', {
          tabId,
          code: payRes.error.code,
          message: payRes.error.message,
        });
        return payRes;
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow for ok()
      if (payRes.data == null) {
        logger.error('tabs.close.payment_failed', { tabId, message: 'no_row' });
        return err(unknownError('payment_no_row'));
      }

      return ok(payRes.data);
    },

    onSuccess: (result, variables) => {
      if (!result.ok) {
        // Phase 15: surface STALE_VERSION on the tabs close UPDATE
        const cachedTab = queryClient.getQueryData<Result<Tab>>(tabKeys.detail(variables.tabId));
        const expected =
          cachedTab?.ok && typeof cachedTab.data.version === 'number'
            ? cachedTab.data.version
            : 0;
        handleVersionError(result.error, {
          queryClient,
          queryKey: tabKeys.detail(variables.tabId),
          entity: 'tabs',
          entityId: variables.tabId,
          expectedVersion: expected,
          supabase,
          terminalId: TERMINAL_ID,
        });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(variables.tabId) });
    },
  });
}

export function useVoidOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tabId: string): Promise<Result<Tab>> => {
      const ordersRes = await supabaseQuery<Pick<Tables<'orders'>, 'id'>[]>(() =>
        supabase.from('orders').select('id').eq('tab_id', tabId)
      );

      if (!ordersRes.ok) {
        logger.error('tabs.void.fetch_orders_failed', {
          tabId,
          code: ordersRes.error.code,
          message: ordersRes.error.message,
        });
        return ordersRes;
      }

      if (ordersRes.data.length === 0) {
        const tabRes = await supabaseQuery(() =>
          supabase.from('tabs').select(tabListSelect).eq('id', tabId).single()
        );
        if (!tabRes.ok) return tabRes;
        return mapTabRow(tabRes.data as unknown as TabRow);
      }

      const orderIds = ordersRes.data.map(o => o.id);
      const delRes = await supabaseMutation(() =>
        supabase.from('order_items').delete().in('order_id', orderIds)
      );

      if (!delRes.ok) {
        logger.error('tabs.void.delete_items_failed', { tabId, message: delRes.error.message });
        return delRes;
      }

      const tabRes = await supabaseQuery(() =>
        supabase.from('tabs').select(tabListSelect).eq('id', tabId).single()
      );
      if (!tabRes.ok) return tabRes;
      return mapTabRow(tabRes.data as unknown as TabRow);
    },

    onSuccess: (result, tabId) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(tabId) });
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
    },
  });
}

// ============================================================================
// OPEN TABS PENDING TOTAL
// ============================================================================

/**
 * Sums the revenue of all open tabs that belong to the given caja session.
 * Uses order_items joined through orders → tabs to compute the total.
 */
export function useOpenTabsPendingTotal(cajaId: string | null) {
  return useQuery({
    queryKey: ['tabs', 'pending-total', cajaId] as const,
    enabled: cajaId !== null,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Result<number>> => {
      if (!cajaId) return ok(0);

      // Fetch open tabs for the caja session with their order_items
      const { data, error } = await supabase
        .from('tabs')
        .select('id, orders(order_items(quantity, unit_price, modifier_price_delta))')
        .eq('caja_session_id', cajaId)
        .eq('status', 'open');

      if (error) {
        logger.error('tabs.pending_total.fetch_failed', { message: error.message });
        return err(unknownError(error));
      }

      type PendingOrderItem = {
        quantity: number;
        unit_price: number;
        modifier_price_delta: number;
      };
      type PendingOrder = { order_items: PendingOrderItem[] | null };
      type PendingTabRow = { id: string; orders: PendingOrder[] | null };

      const rows = data as unknown as PendingTabRow[];
      let total = 0;
      for (const tab of rows) {
        for (const order of tab.orders ?? []) {
          for (const item of order.order_items ?? []) {
            total += item.quantity * (item.unit_price + item.modifier_price_delta);
          }
        }
      }

      return ok(Math.round(total * 100) / 100);
    },
  });
}
