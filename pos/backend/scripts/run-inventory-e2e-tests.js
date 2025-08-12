#!/usr/bin/env node
/*
 End-to-end Inventory Tests
 - Finalize bill should decrement inventory and log 'sale' transaction
 - PO receive should increment inventory and log 'purchase' transaction
*/
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function request(method, path, body) {
  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  const url = new URL(path, BASE_URL);
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload ? payload.length : 0,
    },
  };
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch {}
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function expect(cond, msg, extra) {
  if (!cond) {
    const detail = extra ? `\nDetails: ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : '';
    throw new Error(`${msg}${detail}`);
  }
}

(async () => {
  const results = [];
  try {
    const toMysql = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const HH = pad(d.getHours());
      const MM = pad(d.getMinutes());
      const SS = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    };
    // Constants
    const menuItemId = 'inv_test_item_' + Date.now();
    const tableId = 'TINV_' + Date.now();
    let productId = 'prod_inv_' + Date.now();

    // 1) Create product
    const prodPayload = {
      id: productId,
      name: 'E2E Inventory Product',
      category_id: 'beer',
      unit_id: 'ea',
      selling_price: 9.99,
      cost_price: 5.25,
    };
    let r = await request('POST', '/api/inventory/products', prodPayload);
    results.push(['POST /api/inventory/products', r.status]);
    expect(r.status === 201 || r.status === 200, 'Product create failed', r.body || r.raw);
    productId = (r.body && r.body.id) || productId;

    // 2) Map menu item -> product (qty_per_item = 1)
    r = await request('POST', '/api/inventory/map', {
      menu_item_id: menuItemId,
      product_id: productId,
      qty_per_item: 1,
      unit_id: 'ea',
      notes: 'E2E mapping',
    });
    results.push(['POST /api/inventory/map', r.status]);
    expect(r.status === 201 || r.status === 200, 'Mapping create failed', r.body || r.raw);
    const mapId = r.body && r.body.id;

    // 3) Read current inventory for product at main_bar (before)
    r = await request('GET', `/api/inventory/inventory/product/${encodeURIComponent(productId)}?locationId=main_bar`);
    results.push(['GET /api/inventory/inventory/product/:id (before)', r.status]);
    expect(r.status === 200, 'Fetch inventory before failed', r.body || r.raw);
    const beforeQty = Array.isArray(r.body) && r.body.length > 0 ? Number(r.body[0].quantity || 0) : 0;

    // 4) Create table
    r = await request('POST', '/api/tables', { id: tableId, name: 'Inv Test Table', type: 'bar', capacity: 2, hourly_rate: 0 });
    results.push(['POST /api/tables', r.status]);
    expect(r.status === 201 || r.status === 200, 'Create table failed', r.body || r.raw);

    // 5) Create order with 2 qty of mapped menu item
    r = await request('POST', '/api/orders', {
      table_id: tableId,
      items: [ { id: menuItemId, quantity: 2, price: 10.0 } ],
      notes: 'E2E order',
    });
    results.push(['POST /api/orders', r.status]);
    expect(r.status === 200, 'Create order failed', r.body || r.raw);

    // 6) Pay by table (should decrement inventory)
    r = await request('POST', '/api/bills/pay-by-table', { table_id: tableId, payment_method: 'cash' });
    results.push(['POST /api/bills/pay-by-table', r.status]);
    expect(r.status === 200 && r.body && r.body.ok, 'Pay-by-table failed', r.body || r.raw);

    // 7) Read inventory after (expect before - 2)
    r = await request('GET', `/api/inventory/inventory/product/${encodeURIComponent(productId)}?locationId=main_bar`);
    results.push(['GET /api/inventory/inventory/product/:id (after sale)', r.status]);
    expect(r.status === 200, 'Fetch inventory after sale failed', r.body || r.raw);
    const afterSaleQty = Array.isArray(r.body) && r.body.length > 0 ? Number(r.body[0].quantity || 0) : 0;
    expect(afterSaleQty === beforeQty - 2 || (beforeQty === 0 && afterSaleQty === -2), 'Inventory did not decrement by 2', { beforeQty, afterSaleQty });

    // 8) Verify history includes a sale transaction
    r = await request('GET', `/api/inventory/inventory/history/product/${encodeURIComponent(productId)}?locationId=main_bar&limit=50`);
    results.push(['GET /api/inventory/inventory/history/product/:id', r.status]);
    expect(r.status === 200, 'Fetch history failed', r.body || r.raw);
    const hasSale = Array.isArray(r.body) && r.body.some(tx => (tx.transaction_type || '').toLowerCase() === 'sale');
    expect(hasSale, "Inventory history doesn't include a sale transaction", r.body && r.body.slice ? r.body.slice(0,5) : r.body);

    // 9) Create supplier (for PO)
    const supplierName = 'E2E Supplier ' + Date.now();
    r = await request('POST', '/api/inventory/suppliers', { name: supplierName, is_active: true });
    results.push(['POST /api/inventory/suppliers', r.status]);
    expect(r.status === 201 || r.status === 200, 'Create supplier failed', r.body || r.raw);
    const supplierId = r.body && (r.body.id || r.body.insertId || r.body.supplier_id);

    // 10) Create purchase order for 3 qty
    const poNumber = 'PO' + Date.now();
    r = await request('POST', '/api/inventory/purchase-orders', {
      po_number: poNumber,
      supplier_id: supplierId || 'sup_demo',
      order_date: toMysql(new Date()),
      status: 'pending',
      items: [
        { product_id: productId, quantity_ordered: 3, unit_cost: 4.75 }
      ]
    });
    results.push(['POST /api/inventory/purchase-orders', r.status]);
    if (r.status !== 201 && r.status !== 200) {
      console.error('PO create response:', r.status, r.body || r.raw);
    }
    expect(r.status === 201 || r.status === 200, 'Create PO failed', r.body || r.raw);
    const poId = r.body && (r.body.id || r.body.po_id || r.body.poNumber || r.body.po_number);
    const poItemId = r.body && r.body.items && r.body.items[0] && (r.body.items[0].id || r.body.items[0].po_item_id);

    // 11) Receive PO items (3 qty) into main_bar
    r = await request('POST', `/api/inventory/purchase-orders/${encodeURIComponent(poId)}/receive`, {
      location_id: 'main_bar',
      items: [ { po_item_id: poItemId, quantity_received: 3 } ],
      notes: 'E2E receive'
    });
    results.push(['POST /api/inventory/purchase-orders/:id/receive', r.status]);
    expect(r.status === 200, 'Receive PO failed', r.body || r.raw);

    // 12) Verify inventory increased by 3 from afterSaleQty
    r = await request('GET', `/api/inventory/inventory/product/${encodeURIComponent(productId)}?locationId=main_bar`);
    results.push(['GET /api/inventory/inventory/product/:id (after PO)', r.status]);
    expect(r.status === 200, 'Fetch inventory after PO failed', r.body || r.raw);
    const afterPOQty = Array.isArray(r.body) && r.body.length > 0 ? Number(r.body[0].quantity || 0) : 0;
    expect(afterPOQty === afterSaleQty + 3, 'Inventory did not increment by 3 after PO receive', { afterSaleQty, afterPOQty });

    // 13) Verify history includes a purchase transaction
    r = await request('GET', `/api/inventory/inventory/history/product/${encodeURIComponent(productId)}?locationId=main_bar&limit=50`);
    results.push(['GET /api/inventory/inventory/history/product/:id (after PO)', r.status]);
    expect(r.status === 200, 'Fetch history after PO failed', r.body || r.raw);
    const hasPurchase = Array.isArray(r.body) && r.body.some(tx => (tx.transaction_type || '').toLowerCase() === 'purchase');
    expect(hasPurchase, "Inventory history doesn't include a purchase transaction", r.body && r.body.slice ? r.body.slice(0,5) : r.body);

    console.log('E2E INVENTORY TESTS PASSED');
    for (const [name, status] of results) console.log(`${name} -> ${status}`);
    process.exit(0);
  } catch (err) {
    console.error('E2E INVENTORY TESTS FAILED');
    for (const [name, status] of results) console.log(`${name} -> ${status}`);
    console.error(err.message || err);
    process.exit(1);
  }
})();
