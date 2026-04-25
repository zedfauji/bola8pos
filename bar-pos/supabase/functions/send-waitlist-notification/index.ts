// supabase/functions/send-waitlist-notification/index.ts
// Deno edge function — called by pg_net trigger on waitlist_entries status→notified
// Auth: JWT via Authorization header (ES256-safe pattern from process-payment)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const BodySchema = z.object({ entryId: z.string().uuid() });

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const wasenderApiKey = Deno.env.get('WASENDER_API_KEY'); // set via: supabase secrets set WASENDER_API_KEY=...

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, error: { code: 'CONFIG' } }, 500);
  }

  // ES256-safe auth verification — admin.auth.getUser() fails with ES256 tokens
  const token = authHeader.slice(7);
  const authVerifyResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
  });
  if (!authVerifyResp.ok) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse({ success: false, error: { code: 'INVALID_JSON' } }, 400);
  }

  const parsed = BodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return jsonResponse(
      { success: false, error: { code: 'VALIDATION_ERROR', message: JSON.stringify(parsed.error.flatten().fieldErrors) } },
      400,
    );
  }

  const { entryId } = parsed.data;

  // Fetch entry
  const { data: entry, error: entryErr } = await admin
    .from('waitlist_entries')
    .select('id, name, phone_e164, status')
    .eq('id', entryId)
    .single();

  if (entryErr || !entry) {
    return jsonResponse({ success: false, error: { code: 'NOT_FOUND' } }, 404);
  }

  const phone = (entry as { phone_e164: string | null }).phone_e164;
  const entryName = (entry as { name: string }).name;

  // Rate-limit guard: 1 notification per entry per 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentNotif } = await admin
    .from('waitlist_notifications')
    .select('id')
    .eq('waitlist_entry_id', entryId)
    .eq('status', 'sent')
    .gte('created_at', fiveMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recentNotif) {
    await admin.from('waitlist_notifications').insert({
      waitlist_entry_id: entryId,
      channel: phone && wasenderApiKey ? 'whatsapp' : 'manager',
      status: 'failed',
      provider_message_id: null,
      error: 'rate_limited: notification sent within last 5 minutes',
    });
    return jsonResponse({ success: false, error: { code: 'RATE_LIMITED' } }, 429);
  }

  const channel: 'whatsapp' | 'manager' = phone && wasenderApiKey ? 'whatsapp' : 'manager';
  let notifStatus: 'sent' | 'failed' = 'failed';
  let providerMessageId: string | null = null;
  let errorText: string | null = null;

  if (channel === 'whatsapp' && wasenderApiKey && phone) {
    const message = `Hola ${entryName}, tu mesa está lista! Acércate a la barra. — Bola 8`;
    const wasenderResp = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${wasenderApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: phone, text: message }),
    });

    if (wasenderResp.ok) {
      const respBody = await wasenderResp.json() as { data?: { msgId?: number } };
      notifStatus = 'sent';
      providerMessageId = respBody.data?.msgId != null ? String(respBody.data.msgId) : null;
    } else {
      errorText = (await wasenderResp.text()).slice(0, 500);
      // 429 = rate limited; 4xx = invalid number; both → status='failed', logged for ops
    }
  } else {
    // Manager channel: no external API call needed; notification delivered via Realtime broadcast below
    notifStatus = 'sent'; // 'sent' for manager channel means broadcast was successful
  }

  // Always insert notification audit row
  await admin.from('waitlist_notifications').insert({
    waitlist_entry_id: entryId,
    channel,
    status: notifStatus,
    provider_message_id: providerMessageId,
    error: errorText,
  });

  // Broadcast for manager pane (always — drives WaitlistRealtimeListener invalidation)
  await admin.channel('waitlist').send({
    type: 'broadcast',
    event: 'notified',
    payload: { entryId, channel, status: notifStatus },
  });

  return jsonResponse({ success: true, channel, status: notifStatus });
});
