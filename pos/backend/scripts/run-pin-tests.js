/*
Verify manager PIN endpoint
- Expects backend /api/admin/verify-pin to return { ok: true } or { valid: true } for a correct PIN
- Uses demo accessCode 1234 for auth if required by middleware
*/
const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3001';

function isOk(res) {
  return !!(res && (res.ok === true || res.valid === true));
}

async function main() {
  console.log('--- PIN Verification Tests ---');
  const goodPin = process.env.TEST_GOOD_PIN || '1234';
  const badPin = process.env.TEST_BAD_PIN || '9999';

  // Good PIN
  const goodResp = await axios.post(`${API}/api/admin/verify-pin`, { pin: goodPin, accessCode: '1234' });
  if (!isOk(goodResp.data)) {
    throw new Error('Expected good PIN to be accepted');
  }
  console.log('Good PIN accepted');

  // Bad PIN
  let badOk = false;
  try {
    const badResp = await axios.post(`${API}/api/admin/verify-pin`, { pin: badPin, accessCode: '1234' });
    badOk = isOk(badResp.data);
  } catch (e) {
    badOk = false; // non-2xx = failure (expected)
  }
  if (badOk) {
    throw new Error('Expected bad PIN to be rejected');
  }
  console.log('Bad PIN rejected');

  console.log('✅ PIN verification tests PASSED');
}

main().catch((e) => {
  console.error('❌ PIN verification tests FAILED:', e.response?.data || e.message || e);
  process.exit(1);
});
