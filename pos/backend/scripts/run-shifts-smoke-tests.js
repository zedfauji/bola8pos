/*
 Phase 7: Shifts & Cash Movements Smoke Tests
 - Opens a shift
 - Inserts some cash bills directly into DB (to simulate sales)
 - Adds movements (drop, payout, adjustment)
 - Verifies active summary numbers
 - Closes shift and checks over/short math
*/

const axios = require('axios');
const mysql = require('mysql2/promise');

const API = process.env.API_URL || 'http://localhost:3001';

async function getPool() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bola8pos',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_NAME || 'bola8pos',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    dateStrings: true,
  });
  return pool;
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error('ASSERTION FAILED: ' + msg);
  }
}

function nowSql(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  const pool = await getPool();
  try {
    console.log('--- Phase 7 Shifts Smoke Tests ---');

    // Ensure no active shift open
    const activeResp = await axios.get(API + '/api/shifts/active').catch(e => ({ data: null }));
    if (activeResp && activeResp.data && activeResp.data.id) {
      console.log('Found active shift, closing it for clean slate...');
      await axios.post(`${API}/api/shifts/${activeResp.data.id}/close`, { end_cash_counted: activeResp.data.expected || 0, notes: '[auto-close pre-test]' });
    }

    // Open a new shift with start cash
    const openResp = await axios.post(API + '/api/shifts/open', {
      start_cash: 200,
      notes: 'Test shift',
      user_id: 'tester'
    });
    const shift = openResp.data;
    assert(shift && shift.id, 'Shift not opened');
    console.log('Opened shift', shift.id);

    // Insert 3 bills: 120 cash, 80 cash (tender split), 50 card only
    const from = nowSql(new Date(Date.now() - 5 * 60 * 1000));
    const to = nowSql(new Date(Date.now() + 5 * 60 * 1000));

    // Use current time for created_at in window
    const createdAt = nowSql();
    await pool.query(`INSERT INTO bills (id, table_id, subtotal, tax, tip, total, payment_method, payment_status, tender_cash, tender_card, created_at)
      VALUES (?, 'B1', 100.00, 10.00, 10.00, 120.00, 'cash', 'paid', 120.00, 0.00, ?)` , ['bill_' + Date.now(), createdAt]);
    await new Promise(r => setTimeout(r, 50));
    await pool.query(`INSERT INTO bills (id, table_id, subtotal, tax, tip, total, payment_method, payment_status, tender_cash, tender_card, created_at)
      VALUES (?, 'B2', 60.00, 12.00, 8.00, 80.00, 'card', 'paid', 40.00, 40.00, ?)` , ['bill_' + (Date.now()+1), createdAt]);
    await new Promise(r => setTimeout(r, 50));
    await pool.query(`INSERT INTO bills (id, table_id, subtotal, tax, tip, total, payment_method, payment_status, tender_cash, tender_card, created_at)
      VALUES (?, 'B3', 50.00, 0.00, 0.00, 50.00, 'card', 'paid', 0.00, 50.00, ?)` , ['bill_' + (Date.now()+2), createdAt]);

    // Add movements: drop 50, payout 20, adjustment +5
    await axios.post(`${API}/api/shifts/${shift.id}/movement`, { type: 'drop', amount: 50, reason: 'Safe drop', user_id: 'tester' });
    await axios.post(`${API}/api/shifts/${shift.id}/movement`, { type: 'payout', amount: 20, reason: 'Supplier', user_id: 'tester' });
    await axios.post(`${API}/api/shifts/${shift.id}/movement`, { type: 'adjustment', amount: 5, reason: 'Till adjust', user_id: 'tester' });

    // Check active summary
    const active2 = (await axios.get(API + '/api/shifts/active')).data;
    console.log('Active summary:', active2);

    // Expected cash calc: start 200 + cashSales(120 + 40) - drop50 - payout20 + adj5 = 295
    assert(Math.abs(active2.expected - 295) < 0.001, 'Expected cash mismatch');

    // Close with counted 300 => over_short = 5
    const closeResp = await axios.post(`${API}/api/shifts/${shift.id}/close`, { end_cash_counted: 300, notes: 'End test', user_id: 'tester' });
    const closed = closeResp.data;
    console.log('Closed shift:', closed.id, 'over_short:', closed.over_short);
    assert(Math.abs(Number(closed.over_short) - 5) < 0.001, 'Over/short mismatch');

    // Fetch summary
    const summary = (await axios.get(`${API}/api/shifts/${shift.id}/summary`)).data;
    console.log('Summary:', summary);
    assert(Math.abs(summary.expected_cash - 295) < 0.001, 'Summary expected cash mismatch');

    console.log('✅ Shifts smoke tests PASSED');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Shifts smoke tests FAILED:', err && err.response ? err.response.data || err.response.statusText : err);
  process.exit(1);
});
