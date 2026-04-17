import {
  RappiOrderItemSchema,
  RappiOrderSchema,
  type RappiOrder,
  type RappiOrderItem,
} from '@shared/lib/domain';
import { err, ok, unknownError, type Result } from '@shared/lib/result';
import type { Tables } from '@shared/lib/supabase.types';

function parseItemsJson(raw: unknown): RappiOrderItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RappiOrderItem[] = [];
  for (const el of raw) {
    const r = RappiOrderItemSchema.safeParse(el);
    if (r.success) out.push(r.data);
  }
  return out;
}

export function mapRappiOrderRow(row: Tables<'rappi_orders'>): Result<RappiOrder> {
  try {
    return ok(
      RappiOrderSchema.parse({
        id: row.id,
        rappiOrderId: row.rappi_order_id,
        tabId: row.tab_id,
        status: row.status,
        customerName: row.customer_name,
        deliveryAddress: row.delivery_address,
        items: parseItemsJson(row.items),
        subtotal: row.subtotal,
        rappiTotal: row.rappi_total,
        receivedAt: new Date(row.received_at),
        acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
        tenantId: row.tenant_id,
        rejectionReason: row.rejection_reason,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}
