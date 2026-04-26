import type { RappiOrder } from '@shared/lib/domain';
import { RAPPI_LINE_ITEM_PRODUCT_ID } from '@shared/lib/rappi-constants';
import { err, ok, supabaseMutation, supabaseQuery, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Json, TablesInsert } from '@shared/lib/supabase.types';

type RpcPayload = {
  p_tab_id: string;
  p_staff_id: string;
  p_status: 'pending';
  p_notes: string;
  p_items: Json;
  p_skip_depletion: boolean;
};

function buildOrderItemsPayload(order: RappiOrder) {
  return order.items.map(it => ({
    product_id: RAPPI_LINE_ITEM_PRODUCT_ID,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    modifier_ids: [] as string[],
    modifier_price_delta: 0,
    notes: it.name,
  }));
}

/**
 * Open POS tab, add one pending order with Rappi lines, link `rappi_orders.tab_id`.
 */
export async function acceptRappiOrder(
  order: RappiOrder,
  staffId: string,
  shiftId: string
): Promise<Result<{ tabId: string }>> {
  if (order.status !== 'pending_acceptance') {
    return err({ code: 'VALIDATION_ERROR', message: 'Order is not awaiting acceptance' });
  }

  const customerName = `Rappi — ${order.customerName}`.slice(0, 100);
  const notes = order.deliveryAddress.slice(0, 500);

  const insertTab: TablesInsert<'tabs'> = {
    customer_name: customerName,
    table_number: null,
    staff_id: staffId,
    shift_id: shiftId,
    status: 'open',
    notes,
    rappi_order_id: order.rappiOrderId,
  };

  const tabRes = await supabaseMutation<{ id: string }>(() =>
    supabase.from('tabs').insert(insertTab).select('id').single()
  );

  if (!tabRes.ok) return tabRes;

  const row = tabRes.data;
  if (row == null) {
    return err({ code: 'SUPABASE_ERROR', message: 'Tab insert returned no row' });
  }
  const tabId = row.id;

  const rpcPayload: RpcPayload = {
    p_tab_id: tabId,
    p_staff_id: staffId,
    p_status: 'pending',
    p_notes: 'Rappi delivery',
    p_items: buildOrderItemsPayload(order) as unknown as Json,
    p_skip_depletion: false,
  };

  const rpcRes = await supabaseQuery(() => supabase.rpc('create_order_with_items', rpcPayload));

  if (!rpcRes.ok) {
    await supabase.from('tabs').delete().eq('id', tabId);
    return rpcRes;
  }

  const upd = await supabaseMutation(() =>
    supabase
      .from('rappi_orders')
      .update({
        tab_id: tabId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'pending_acceptance')
  );

  if (!upd.ok) {
    return err({ code: 'SUPABASE_ERROR', message: 'Failed to link Rappi order to tab' });
  }

  return ok({ tabId });
}

export async function rejectRappiOrder(orderId: string, reason: string): Promise<Result<void>> {
  const res = await supabaseMutation(() =>
    supabase
      .from('rappi_orders')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim().slice(0, 2000),
      })
      .eq('id', orderId)
      .in('status', ['pending_acceptance'])
  );
  if (!res.ok) return res;
  return ok(undefined);
}

export async function markRappiOrderReady(orderId: string): Promise<Result<void>> {
  const res = await supabaseMutation(() =>
    supabase
      .from('rappi_orders')
      .update({ status: 'ready_for_pickup' })
      .eq('id', orderId)
      .in('status', ['accepted', 'preparing'])
  );
  if (!res.ok) return res;
  return ok(undefined);
}

export async function setRappiOrderPreparing(orderId: string): Promise<Result<void>> {
  const res = await supabaseMutation(() =>
    supabase
      .from('rappi_orders')
      .update({ status: 'preparing' })
      .eq('id', orderId)
      .eq('status', 'accepted')
  );
  if (!res.ok) return res;
  return ok(undefined);
}

export async function markRappiOrderCompleted(orderId: string): Promise<Result<void>> {
  const res = await supabaseMutation(() =>
    supabase
      .from('rappi_orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'ready_for_pickup')
  );
  if (!res.ok) return res;
  return ok(undefined);
}
