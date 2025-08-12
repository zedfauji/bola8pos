/*
Roundtrip test for payout approval threshold in settings
- PUT /api/settings/access with new approvalThresholds.cashPayoutAmount
- GET /api/settings/access and verify value persisted
*/
const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3001';

async function main() {
  console.log('--- Payout Threshold Settings Tests ---');
  const desired = Number(process.env.TEST_PAYOUT_THRESHOLD || 75);

  // Fetch current
  const before = await axios.get(`${API}/api/settings/access`).then(r=>r.data).catch(()=>({ value: {} }));
  console.log('Before access settings:', before);

  const next = { ...(before.value || {}), approvalThresholds: { ...(before.value?.approvalThresholds || {}), cashPayoutAmount: desired } };

  // Update
  const put = await axios.put(`${API}/api/settings/access`, { value: next, accessCode: '1234' }).then(r=>r.data);
  if (!put || put.ok === false) {
    throw new Error('Failed to update access settings');
  }

  // Read back
  const after = await axios.get(`${API}/api/settings/access`).then(r=>r.data);
  const got = Number(after?.value?.approvalThresholds?.cashPayoutAmount);
  if (got !== desired) {
    throw new Error(`Threshold mismatch. expected=${desired} got=${got}`);
  }
  console.log('✅ Payout threshold settings tests PASSED');
}

main().catch((e) => {
  console.error('❌ Payout threshold settings tests FAILED:', e.response?.data || e.message || e);
  process.exit(1);
});
