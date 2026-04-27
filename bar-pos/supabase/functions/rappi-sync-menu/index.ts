import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const syncUrl = Deno.env.get('RAPPI_MENU_SYNC_URL');
  const syncToken = Deno.env.get('RAPPI_MENU_SYNC_TOKEN');

  if (!supabaseUrl || !anonKey || !serviceKey || !syncUrl || !syncToken) {
    return json({ ok: false, error: { code: 'CONFIG', message: 'Missing RAPPI menu sync config' } }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }, 401);
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || profile?.role !== 'admin') {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
  }

  const { data: rappiSetting } = await serviceClient
    .from('settings')
    .select('value')
    .eq('key', 'rappi')
    .maybeSingle();
  const rappiValue = (rappiSetting?.value ?? {}) as { storeId?: unknown; lastSyncAt?: unknown };
  const storeId = typeof rappiValue.storeId === 'string' ? rappiValue.storeId.trim() : '';
  if (storeId.length === 0) {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Rappi Store ID is not configured' } }, 400);
  }

  const [categoriesRes, productsRes, modifiersRes, productModifiersRes] = await Promise.all([
    serviceClient.from('categories').select('id,name,sort_order').order('sort_order'),
    serviceClient
      .from('products')
      .select('id,name,category_id,base_price,is_active')
      .eq('is_active', true)
      .order('name'),
    serviceClient.from('modifiers').select('id,name,price_delta').order('sort_order'),
    serviceClient.from('product_modifiers').select('product_id,modifier_id'),
  ]);

  if (categoriesRes.error || productsRes.error || modifiersRes.error || productModifiersRes.error) {
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Could not load menu catalog for sync' } }, 500);
  }

  const modifierById = new Map(modifiersRes.data.map(m => [m.id, m] as const));
  const modifierLinksByProduct = new Map<string, string[]>();
  for (const link of productModifiersRes.data) {
    const existing = modifierLinksByProduct.get(link.product_id) ?? [];
    existing.push(link.modifier_id);
    modifierLinksByProduct.set(link.product_id, existing);
  }

  const payload = {
    storeId,
    categories: categoriesRes.data.map(category => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
      products: productsRes.data
        .filter(product => product.category_id === category.id)
        .map(product => ({
          id: product.id,
          name: product.name,
          price: product.base_price,
          modifiers: (modifierLinksByProduct.get(product.id) ?? [])
            .map(modifierId => modifierById.get(modifierId))
            .filter((m): m is (typeof modifiersRes.data)[number] => Boolean(m))
            .map(modifier => ({
              id: modifier.id,
              name: modifier.name,
              priceDelta: modifier.price_delta,
            })),
        })),
    })),
  };

  const upstream = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${syncToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return json(
      {
        ok: false,
        error: {
          code: 'RAPPI_SYNC_ERROR',
          message: detail.slice(0, 500) || `Rappi sync failed (${String(upstream.status)})`,
        },
      },
      502
    );
  }

  const syncedAt = new Date().toISOString();
  const { error: saveError } = await serviceClient.from('settings').upsert(
    {
      key: 'rappi',
      value: {
        ...rappiValue,
        storeId,
        lastSyncAt: syncedAt,
      },
      updated_by: user.id,
    },
    { onConflict: 'key' }
  );

  if (saveError) {
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Menu synced but status save failed' } }, 500);
  }

  return json({ ok: true, syncedAt });
});
