// Supabase Edge Function — rappi-webhook (Deno)
// Keep body parsing aligned with `src/shared/lib/rappi-webhook-payload.ts`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

const WebhookItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  unit_price: z.coerce.number().nonnegative(),
});

const RappiWebhookBodySchema = z.object({
  order_id: z.string().min(1).max(128),
  customer_name: z.string().default(''),
  delivery_address: z.string().default(''),
  items: z.array(WebhookItemSchema).default([]),
  subtotal: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional(),
});

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumLineTotals(items: { name: string; quantity: number; unitPrice: number }[]): number {
  const raw = items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  return roundMoney(raw);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }

  const secret = Deno.env.get('RAPPI_WEBHOOK_SECRET');
  const headerSecret = req.headers.get('x-rappi-webhook-secret');
  if (!secret || headerSecret !== secret) {
    return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid webhook secret' } }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: { code: 'CONFIG', message: 'Server misconfigured' } }, 500);
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, 400);
  }

  const parsed = RappiWebhookBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.issues },
      },
      400
    );
  }

  const body = parsed.data;
  const items = body.items.map(i => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: roundMoney(i.unit_price),
  }));
  const computedSubtotal = sumLineTotals(items);
  const subtotal =
    body.subtotal != null && !Number.isNaN(body.subtotal) ? roundMoney(body.subtotal) : computedSubtotal;
  const rappiTotal =
    body.total != null && !Number.isNaN(body.total) ? roundMoney(body.total) : subtotal;

  const tenantId = (Deno.env.get('RAPPI_TENANT_ID') ?? DEFAULT_TENANT).trim();

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const insertPayload = {
    rappi_order_id: body.order_id.trim(),
    tab_id: null,
    status: 'pending_acceptance' as const,
    customer_name: body.customer_name.trim() || 'Rappi customer',
    delivery_address: body.delivery_address.trim(),
    items,
    subtotal,
    rappi_total: rappiTotal,
    tenant_id: tenantId,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('rappi_orders')
    .insert(insertPayload)
    .select('id, rappi_order_id, status, customer_name, received_at')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return jsonResponse({ ok: true, duplicate: true, message: 'Order already recorded' }, 200);
    }
    return jsonResponse(
      { ok: false, error: { code: 'INSERT_FAILED', message: insertError.message } },
      500
    );
  }

  const channel = supabase.channel('rappi:new_order');
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      void supabase.removeChannel(channel);
      reject(new Error('Realtime subscribe timeout'));
    }, 8000);
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        void channel
          .send({
            type: 'broadcast',
            event: 'new_order',
            payload: inserted,
          })
          .then(() => {
            void supabase.removeChannel(channel);
            resolve();
          })
          .catch(e => {
            void supabase.removeChannel(channel);
            reject(e);
          });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t);
        void supabase.removeChannel(channel);
        reject(new Error(`Realtime status: ${status}`));
      }
    });
  }).catch(() => {
    /* broadcast is best-effort */
  });

  return jsonResponse({ ok: true, id: inserted.id }, 200);
});
