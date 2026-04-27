/**
 * Normalizes Rappi (or partner) webhook JSON into a row shape for `rappi_orders`.
 * Keep in sync with `supabase/functions/rappi-webhook/index.ts` body parsing.
 */

import { z } from 'zod';

import { RAPPI_DEFAULT_TENANT_ID } from '@shared/lib/rappi-constants';

const WebhookItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  unit_price: z.coerce.number().nonnegative(),
});

/** Flexible top-level: common marketplace-style keys */
export const RappiWebhookBodySchema = z.object({
  order_id: z.string().min(1).max(128),
  customer_name: z.string().default(''),
  delivery_address: z.string().default(''),
  items: z.array(WebhookItemSchema).default([]),
  subtotal: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional(),
});

export type RappiWebhookBody = z.infer<typeof RappiWebhookBodySchema>;

export type RappiOrderInsertRow = {
  rappi_order_id: string;
  tab_id: null;
  status: 'pending_acceptance';
  customer_name: string;
  delivery_address: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  rappi_total: number;
  tenant_id: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum line totals from normalized items */
export function sumLineTotals(
  items: { name: string; quantity: number; unitPrice: number }[]
): number {
  const raw = items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  return roundMoney(raw);
}

/**
 * Parse unknown JSON body from webhook POST.
 * @returns parsed body or ZodError issues
 */
export function parseRappiWebhookBody(
  body: unknown
): { ok: true; data: RappiWebhookBody } | { ok: false; issues: z.core.$ZodIssue[] } {
  const r = RappiWebhookBodySchema.safeParse(body);
  if (!r.success) return { ok: false, issues: r.error.issues };
  return { ok: true, data: r.data };
}

/** Build DB insert fields (excluding id timestamps with DB defaults). */
export function mapWebhookToInsertRow(
  body: RappiWebhookBody,
  tenantId: string = RAPPI_DEFAULT_TENANT_ID
): RappiOrderInsertRow {
  const items = body.items.map(i => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: roundMoney(i.unit_price),
  }));
  const computedSubtotal = sumLineTotals(items);
  const subtotal =
    body.subtotal != null && !Number.isNaN(body.subtotal)
      ? roundMoney(body.subtotal)
      : computedSubtotal;
  const rappiTotal =
    body.total != null && !Number.isNaN(body.total) ? roundMoney(body.total) : subtotal;

  return {
    rappi_order_id: body.order_id.trim(),
    tab_id: null,
    status: 'pending_acceptance',
    customer_name: body.customer_name.trim() || 'Rappi customer',
    delivery_address: body.delivery_address.trim(),
    items,
    subtotal,
    rappi_total: rappiTotal,
    tenant_id: tenantId,
  };
}
