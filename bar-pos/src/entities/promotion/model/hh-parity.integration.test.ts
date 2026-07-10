/**
 * Integration test: D-07 parity gate — legacy resolveProductPrice() output
 * must equal the server promotions engine's evaluated price for every
 * migrated happy-hour row, BEFORE the legacy happy_hour_* columns are
 * dropped (Phase 20, Plan 09 — SC-1..SC-4, Pitfall 4's verification window).
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Skips gracefully (does not
 * fail) when live creds are absent, mirroring every other Phase 20
 * integration test (evaluate-promotions-rpc, promotions-schema,
 * applied-promotions-rls, pool-promotions-rpc).
 *
 * Two independent checks:
 *
 * 1. STRUCTURAL PARITY (live data): every product currently configured with
 *    happy_hour_price whose category has an HH window must have exactly one
 *    active fixed_price/item promotion whose discount_value equals the
 *    legacy happy_hour_price and whose single availability window equals
 *    the category's happy_hour_start/happy_hour_end. This directly checks
 *    the output of supabase/migrations/20260710000007_migrate_happy_hour_data.sql
 *    against whatever HH data is live right now. If zero such products
 *    exist, this loop has nothing to iterate and the test reports that
 *    explicitly via console.warn rather than silently exiting green with no
 *    coverage — see 20-09-SUMMARY.md for whether that occurred on this run.
 *
 * 2. BEHAVIORAL PARITY (self-contained fixture): creates its own
 *    category+product pair carrying happy_hour_start/happy_hour_end/
 *    happy_hour_price (the exact shape the D-07 migration reads) plus the
 *    equivalent fixed_price promotion + promotion_availability row (the
 *    exact shape the D-07 migration writes), then places a real order via
 *    create_order_with_items and asserts the server-evaluated unit_price
 *    equals resolveProductPrice()'s legacy output for the same product/
 *    category/time. This proves the *mechanism* end-to-end even when no
 *    live migrated row exists to exercise check 1 against.
 *
 *    The fixture's availability window is deliberately all-day
 *    (00:00:00-23:59:59, every day) rather than a narrow window like
 *    "14:00-15:00" — isHappyHourActive() (client, src/shared/lib/
 *    domain-helpers.ts) evaluates against the test runner's local
 *    wall-clock time, while is_promotion_available() (server) hardcodes
 *    'America/Mexico_City'. A narrow window would make this test flaky
 *    depending on which timezone CI runs in; an all-day window sidesteps
 *    that entirely while still exercising the full compare-legacy-to-server
 *    price path.
 *
 * `promotions`/`promotion_availability`/`applied_promotions` are covered by
 * supabase.types.ts as of Plan 20-06; a `db = createClient(...) as any` cast
 * is still used file-wide, matching every sibling Phase 20 integration test
 * (they predate/parallel the types regen and this keeps the pattern
 * consistent across the wave).
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Category, Product } from '../../../shared/lib/domain';
import { resolveProductPrice } from '../../../shared/lib/domain-helpers';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const hasE2eEnv = !url || !serviceKey || !anonKey;

describe.skipIf(hasE2eEnv)('D-07 HH -> promotions parity gate (Pitfall 4)', () => {
  const db = createClient(url!, serviceKey!) as any;

  describe('1. structural parity — every LIVE migrated HH row', () => {
    it('every product with happy_hour_price + a category HH window has exactly one matching fixed_price item promotion', async () => {
      const { data: productsWithHH, error: prodErr } = await db
        .from('products')
        .select('id, name, happy_hour_price, category_id')
        .not('happy_hour_price', 'is', null);
      expect(prodErr).toBeNull();

      const { data: categoriesWithWindow, error: catErr } = await db
        .from('categories')
        .select('id, happy_hour_start, happy_hour_end')
        .not('happy_hour_start', 'is', null)
        .not('happy_hour_end', 'is', null);
      expect(catErr).toBeNull();

      const catMap = new Map<string, { happy_hour_start: string; happy_hour_end: string }>(
        (categoriesWithWindow as { id: string; happy_hour_start: string; happy_hour_end: string }[]).map(
          c => [c.id, c]
        )
      );

      const migratedRows = (
        productsWithHH as { id: string; name: string; happy_hour_price: number; category_id: string }[]
      ).filter(p => catMap.has(p.category_id));

      if (migratedRows.length === 0) {
        // This is a report, not a false pass: zero products/categories are
        // currently configured with legacy HH data on this database, so
        // structural parity has no rows to compare. See 20-09-SUMMARY.md.
        console.warn(
          'D-07 PARITY REPORT: 0 products currently have both happy_hour_price ' +
            'set AND a category with an HH window — structural parity has ' +
            'nothing to verify against on this database. This is NOT proof ' +
            'the migration is broken, but it is also NOT proof it is correct ' +
            'for real data; only the self-contained behavioral fixture below ' +
            'was exercised. Re-run this test after configuring at least one ' +
            'live HH product/category before treating this as full coverage.'
        );
      }

      for (const row of migratedRows) {
        const category = catMap.get(row.category_id)!;

        const { data: promos, error: promoErr } = await db
          .from('promotions')
          .select('id, discount_value')
          .eq('target_product_id', row.id)
          .eq('target_type', 'item')
          .eq('discount_type', 'fixed_price')
          .eq('is_active', true);
        expect(promoErr).toBeNull();
        expect(promos).toHaveLength(1);
        const promo = (promos as { id: string; discount_value: number }[])[0]!;
        expect(promo.discount_value).toBe(row.happy_hour_price);

        const { data: windows, error: winErr } = await db
          .from('promotion_availability')
          .select('start_time, end_time')
          .eq('promotion_id', promo.id);
        expect(winErr).toBeNull();
        expect(windows).toHaveLength(1);
        const window = (windows as { start_time: string; end_time: string }[])[0]!;
        expect(window.start_time).toBe(category.happy_hour_start);
        expect(window.end_time).toBe(category.happy_hour_end);
      }
    });
  });

  describe('2. behavioral parity — representative row (self-contained fixture)', () => {
    const anonClient = createClient(url!, anonKey!) as any;

    let testUserId: string;
    let categoryId: string;
    let productId: string;
    let promotionId: string;
    let shiftId: string;
    let tabId: string;
    let orderId: string | undefined;
    let orderItemId: string | undefined;

    const BASE_PRICE = 90;
    const HAPPY_HOUR_PRICE = 45;

    beforeAll(async () => {
      const testEmail = `__hh_parity_test_${String(Date.now())}@test.local`;
      const testPassword = 'TestHhParity123!';

      const { data: authUser, error: createErr } = await db.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
      if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
      testUserId = authUser.user.id as string;

      const { error: profileErr } = await db.from('profiles').upsert({
        id: testUserId,
        name: '__hh_parity_test__',
        email: testEmail,
        role: 'manager',
        pin: '999993',
        is_active: true,
      });
      if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

      const { error: signInErr } = await anonClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      if (signInErr) throw new Error(`sign in: ${signInErr.message}`);

      // Category carrying legacy HH window fields (columns still present —
      // this plan runs BEFORE Plan 20-10's column drop).
      const { data: cat, error: catErr } = await db
        .from('categories')
        .insert({
          name: '__hh_parity_category__',
          color: '#FFAA00',
          sort_order: 0,
          happy_hour_start: '00:00:00',
          happy_hour_end: '23:59:59',
        })
        .select('id')
        .single();
      if (catErr || !cat) throw new Error(`category insert: ${catErr?.message}`);
      categoryId = (cat as { id: string }).id;

      // Product carrying the legacy happy_hour_price field.
      const { data: prod, error: prodErr } = await db
        .from('products')
        .insert({
          name: '__hh_parity_product__',
          base_price: BASE_PRICE,
          happy_hour_price: HAPPY_HOUR_PRICE,
          category_id: categoryId,
          is_active: true,
        })
        .select('id')
        .single();
      if (prodErr || !prod) throw new Error(`product insert: ${prodErr?.message}`);
      productId = (prod as { id: string }).id;

      // The equivalent fixed_price promotion, exactly matching the shape
      // supabase/migrations/20260710000007_migrate_happy_hour_data.sql
      // produces for this category/product pair.
      const { data: promo, error: promoErr } = await db
        .from('promotions')
        .insert({
          name: `Happy Hour: __hh_parity_product__`,
          discount_type: 'fixed_price',
          discount_value: HAPPY_HOUR_PRICE,
          target_type: 'item',
          target_product_id: productId,
          priority: 0,
          is_active: true,
        })
        .select('id')
        .single();
      if (promoErr || !promo) throw new Error(`promotion insert: ${promoErr?.message}`);
      promotionId = (promo as { id: string }).id;

      const { error: availErr } = await db.from('promotion_availability').insert({
        promotion_id: promotionId,
        days_of_week: [1, 2, 3, 4, 5, 6, 7],
        start_time: '00:00:00',
        end_time: '23:59:59',
      });
      if (availErr) throw new Error(`promotion_availability insert: ${availErr.message}`);

      const { data: newShift, error: shiftErr } = await db
        .from('shifts')
        .insert({ staff_id: testUserId, opening_cash: 0 })
        .select('id')
        .single();
      if (shiftErr || !newShift) throw new Error(`shift insert: ${shiftErr?.message}`);
      shiftId = (newShift as { id: string }).id;

      const { data: tab, error: tabErr } = await db
        .from('tabs')
        .insert({
          customer_name: '__hh_parity_tab__',
          status: 'open',
          is_deleted: false,
          staff_id: testUserId,
          shift_id: shiftId,
        })
        .select('id')
        .single();
      if (tabErr || !tab) throw new Error(`tab insert: ${tabErr?.message}`);
      tabId = (tab as { id: string }).id;
    });

    afterAll(async () => {
      await anonClient.auth.signOut();

      if (orderItemId) {
        await db.from('applied_promotions').delete().eq('order_item_id', orderItemId);
        await db.from('audit_logs').delete().eq('entity_id', orderItemId);
      }
      if (orderId) await db.from('orders').delete().eq('id', orderId);
      if (tabId) await db.from('tabs').delete().eq('id', tabId);
      if (promotionId) await db.from('promotions').delete().eq('id', promotionId);
      if (productId) await db.from('products').delete().eq('id', productId);
      if (categoryId) await db.from('categories').delete().eq('id', categoryId);

      if (testUserId) {
        await db.from('shifts').delete().eq('staff_id', testUserId);
        await db.from('profiles').delete().eq('id', testUserId);
        await db.auth.admin.deleteUser(testUserId);
      }
    });

    it('server-evaluated unit_price equals resolveProductPrice()s legacy output for a representative migrated HH row', async () => {
      const now = new Date();

      const category: Category = {
        id: categoryId,
        name: '__hh_parity_category__',
        color: '#FFAA00',
        sortOrder: 0,
        happyHourStart: '00:00:00',
        happyHourEnd: '23:59:59',
        routing: 'NONE',
        parentId: null,
        createdAt: now,
      };

      const product: Product = {
        id: productId,
        name: '__hh_parity_product__',
        categoryId,
        basePrice: BASE_PRICE,
        happyHourPrice: HAPPY_HOUR_PRICE,
        sku: null,
        isActive: true,
        imageUrl: null,
        stock_threshold: null,
        barcode: null,
        comboEligible: true,
        isCombo: false,
        comboPriceOverride: null,
        modifiers: [],
      };

      // The legacy authority (still callable — columns are not yet dropped).
      const legacyExpectedPrice = resolveProductPrice(product, category, now);
      expect(legacyExpectedPrice).toBe(HAPPY_HOUR_PRICE);

      // Client sends the UNDISCOUNTED base price, per Pitfall 1 (Plan 20-07
      // rewired ProductGrid to do exactly this) — the server is the sole
      // authority for the final charged price.
      //
      // p_skip_depletion is deliberately FALSE here (unlike the sibling
      // evaluate-promotions-rpc.integration.test.ts's p_skip_depletion:true)
      // — this test discovered that create_order_with_items v3's
      // `PERFORM evaluate_promotions_for_item(...)` call sits inside the
      // SAME `IF NOT p_skip_depletion THEN` block as `deplete_for_order_item`
      // (supabase/migrations/20260710000004_evaluate_promotions_rpc.sql),
      // so passing p_skip_depletion:true silently skips promotion evaluation
      // too. That is a real, pre-existing bug from Plan 20-03 (out of scope
      // to fix here — see deferred-items.md and 20-09-SUMMARY.md "Bug Found
      // During Parity Verification"). p_skip_depletion:false is what every
      // real order-taking call site actually sends
      // (src/entities/tab/model/queries.ts, ProductGrid's real flow), so
      // this is also the more representative parity check. This fixture
      // product has no recipe and no modifiers, so deplete_for_order_item
      // is a documented no-op for it (no recipe row found -> recipe loop
      // skipped; empty modifier_ids -> modifier loop skipped).
      const { data, error } = await anonClient.rpc('create_order_with_items', {
        p_tab_id: tabId,
        p_staff_id: testUserId,
        p_status: 'pending',
        p_notes: null,
        p_items: [
          {
            product_id: productId,
            quantity: 1,
            unit_price: BASE_PRICE,
          },
        ],
        p_skip_depletion: false,
      });
      expect(error).toBeNull();

      const payload = data as { order: { id: string }; items: { id: string; unit_price: unknown }[] };
      orderId = payload.order.id;
      expect(payload.items).toHaveLength(1);
      const item = payload.items[0]!;
      orderItemId = item.id;

      // D-07 parity: the server-evaluated price for a migrated-shape row
      // equals what the legacy client-side calculation would have charged.
      expect(Number(item.unit_price)).toBe(legacyExpectedPrice);

      const { data: dbItem, error: dbItemErr } = await db
        .from('order_items')
        .select('unit_price')
        .eq('id', orderItemId)
        .single();
      expect(dbItemErr).toBeNull();
      expect(Number((dbItem as { unit_price: unknown }).unit_price)).toBe(legacyExpectedPrice);
    });
  });
});
