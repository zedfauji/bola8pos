// Supabase Edge Function — void-order (Deno)
//
// Voids an order by setting orders.status = 'voided' (see supabase/migrations/
// 20260414000001_enums.sql — order_status enum: 'pending' | 'served' | 'voided',
// and 20260414000004_tabs_and_orders.sql — orders.status column).
//
// Inventory reversal is NOT performed here — the calling client
// (src/features/void-order/model/useVoidOrder.ts) reverses ingredient
// depletion via deplete_for_order_item(-1) AFTER this function returns
// { success: true }. This function only flips the order's status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { recordAudit } from '../_shared/audit.ts';

const BodySchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  staffId: z.string().uuid(),
  amount: z.number().nonnegative().multipleOf(0.01).optional(),
  inventoryRestoreItems: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'POST only' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: 'Server misconfigured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body must be JSON' }, 400);
  }

  const parsed = BodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonResponse(
      { success: false, error: JSON.stringify(parsed.error.flatten().fieldErrors) },
      400
    );
  }

  const { orderId, reason, staffId } = parsed.data;

  // Capture the before-state for the audit record.
  const { data: beforeRow, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, tab_id')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchError) {
    return jsonResponse({ success: false, error: 'Void failed' }, 500);
  }

  if (!beforeRow) {
    return jsonResponse({ success: false, error: 'Order not found' }, 400);
  }

  const voidedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'voided' })
    .eq('id', orderId);

  if (updateError) {
    return jsonResponse({ success: false, error: 'Void failed' }, 500);
  }

  // Fire-and-forget: audit failure must never fail the void.
  await recordAudit(supabase, {
    action: 'order.void',
    entityType: 'order',
    entityId: orderId,
    before: beforeRow,
    after: { reason, voidedAt },
    source: 'edge',
    actorId: staffId,
  });

  return jsonResponse({ success: true, voidedAt });
});
