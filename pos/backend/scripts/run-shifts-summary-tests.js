/*
  Phase 7 Shift Summary/History Smoke Test
  - Ensures /api/shifts/:id/summary and /api/shifts/history respond with expected shapes
*/

const axios = require('axios');
axios.defaults.timeout = 20000;

const BASE = process.env.API_BASE || 'http://127.0.0.1:3001';

function pad(n){return String(n).padStart(2,'0');}
function nowSql(d = new Date()){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function assert(cond, msg){ if(!cond) { throw new Error('ASSERTION FAILED: ' + msg); } }

async function maybeCloseActive() {
  try {
    const { data } = await axios.get(`${BASE}/api/shifts/active`);
    if (data && data.id) {
      await axios.post(`${BASE}/api/shifts/${data.id}/close`, { end_cash_counted: Number(data.start_cash || 0) });
    }
  } catch(_){}
}

async function main(){
  console.log('--- Phase 7 Shift Summary/History Smoke Tests ---');
  await maybeCloseActive();

  // 1) Open shift
  const open = await axios.post(`${BASE}/api/shifts/open`, { start_cash: 100, notes: 'Summary test', user_id: 'tester' });
  const shift = open.data;
  assert(shift && shift.id, 'Shift did not open');
  console.log('Opened shift', shift.id);
  // slight delay to ensure DB timestamps persisted
  await new Promise(r => setTimeout(r, 200));

  // 2) Create a simple cash bill inside the window
  const bill = {
    table_id: 'T_SUMMARY',
    subtotal: 50,
    tax: 0,
    total: 50,
    tip: 0,
    discount_total: 0,
    payment_method: 'cash',
    tender_cash: 50,
    tender_card: 0,
    created_at: nowSql(new Date()),
  };
  await axios.post(`${BASE}/api/bills`, bill);

  // 3) Add a movement
  await axios.post(`${BASE}/api/shifts/${shift.id}/movement`, { type: 'drop', amount: 20, reason: 'Bank', user_id: 'tester' });

  // 4) Query summary
  const { data: summary } = await axios.get(`${BASE}/api/shifts/${shift.id}/summary`);
  console.log('Summary:', summary);
  assert(summary && typeof summary === 'object', 'Summary object missing');
  assert('expected_cash' in summary, 'expected_cash missing');
  assert('cash_sales' in summary, 'cash_sales missing');

  // 5) Query history (should include at least the opened shift if closed or active history includes it)
  const { data: history } = await axios.get(`${BASE}/api/shifts/history?limit=10`);
  console.log('History length:', Array.isArray(history) ? history.length : 'n/a');
  assert(Array.isArray(history), 'History is not array');

  // 6) Close shift and re-check summary integrity
  await axios.post(`${BASE}/api/shifts/${shift.id}/close`, { end_cash_counted: 120, notes: 'End summary test', user_id: 'tester' });
  const { data: summary2 } = await axios.get(`${BASE}/api/shifts/${shift.id}/summary`);
  console.log('Closed summary:', summary2);
  assert(summary2 && summary2.shift && summary2.shift.closed_at, 'Closed summary missing closed_at');

  console.log('✅ Shift summary/history smoke tests PASSED');
}

main().catch(err => {
  if (err.response) {
    console.error('❌ Shift summary/history tests FAILED:', err.message, 'status=', err.response.status);
    try { console.error('Body:', JSON.stringify(err.response.data)); } catch {}
  } else if (err.request) {
    console.error('❌ Shift summary/history tests FAILED: no response from server');
  } else {
    console.error('❌ Shift summary/history tests FAILED:', err.message);
  }
  process.exit(1);
});
