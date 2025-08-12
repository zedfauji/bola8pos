/*
 Simple inventory API smoke tests against a running dev server.
 Targets http://localhost:3002
*/
const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:3002';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + (url.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? data.length : 0,
      },
    };
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        let parsed = buf;
        try { parsed = JSON.parse(buf); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function expect(cond, message, extra) {
  if (!cond) {
    if (extra) {
      console.error('Context:', typeof extra === 'object' ? JSON.stringify(extra) : String(extra));
    }
    throw new Error(message);
  }
}

(async () => {
  const results = [];
  try {
    // 1) Base inventory route
    let r = await request('GET', '/api/inventory');
    results.push(['GET /api/inventory', r.status]);
    expect(r.status === 200, 'Inventory base should return 200');

    // 2) Mapping list (empty ok)
    r = await request('GET', '/api/inventory/map');
    results.push(['GET /api/inventory/map', r.status]);
    expect(r.status === 200 && Array.isArray(r.body), 'Map list should return array');

    // 3) Create a product to satisfy FK for mapping
    let productId = 'prod_smoke_' + Date.now();
    const prodPayload = {
      id: productId,
      name: 'Smoke Test Product',
      category_id: 'beer',
      unit_id: 'ea',
      selling_price: 5.0,
      cost_price: 3.25,
      is_active: true
    };
    r = await request('POST', '/api/inventory/products', prodPayload);
    results.push(['POST /api/inventory/products', r.status]);
    expect(r.status === 201 || r.status === 200, 'Create product should return 201/200', r.body);
    expect(r.body && r.body.id, 'Product response should have id', r.body);
    productId = r.body.id; // use server-assigned id

    // Verify product fetch
    r = await request('GET', `/api/inventory/products/${encodeURIComponent(productId)}`);
    results.push(['GET /api/inventory/products/:id', r.status]);
    expect(r.status === 200 && r.body && r.body.id === productId, 'Product should be retrievable by id', r.body);

    // Small delay to ensure commit visibility
    await new Promise(res => setTimeout(res, 50));

    // 4) Create mapping
    const menu_item_id = 'test_item_' + Date.now();
    const payload = {
      menu_item_id,
      product_id: productId,
      qty_per_item: 1,
      unit_id: 'ea',
      notes: 'smoke'
    };
    r = await request('POST', '/api/inventory/map', payload);
    results.push(['POST /api/inventory/map', r.status]);
    expect(r.status === 201 || r.status === 200, 'Create mapping should return 201/200', r.body);
    const created = r.body;
    expect(created && created.id, 'Created mapping should have id');

    // 5) Filter list by menu_item_id
    r = await request('GET', `/api/inventory/map?menu_item_id=${encodeURIComponent(menu_item_id)}`);
    results.push(['GET /api/inventory/map?menu_item_id', r.status]);
    expect(r.status === 200 && Array.isArray(r.body) && r.body.length >= 1, 'Filtered map list should return at least one row', r.body);

    // 6) Delete mapping
    r = await request('DELETE', `/api/inventory/map/${created.id}`);
    results.push(['DELETE /api/inventory/map/:id', r.status]);
    expect(r.status === 200 && r.body && r.body.ok, 'Delete mapping should return ok:true', r.body);

    // 7) Low stock endpoint
    r = await request('GET', '/api/inventory/inventory/low-stock?threshold=5');
    results.push(['GET /api/inventory/low-stock', r.status]);
    expect(r.status === 200, 'Low stock should return 200', r.body);

    // Cleanup product
    r = await request('DELETE', `/api/inventory/products/${productId}`);
    results.push(['DELETE /api/inventory/products/:id', r.status]);
    expect(r.status === 204 || r.status === 200, 'Delete product should return 204/200', r.body);

    console.log('SMOKE TESTS PASSED');
    for (const [name, status] of results) console.log(`${name} -> ${status}`);
    process.exit(0);
  } catch (err) {
    console.error('SMOKE TESTS FAILED');
    for (const [name, status] of results) console.log(`${name} -> ${status}`);
    console.error(err.message || err);
    process.exit(1);
  }
})();
