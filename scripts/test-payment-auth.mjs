/**
 * Standalone auth → edge-function integration test.
 * Run: node scripts/test-payment-auth.mjs
 *
 * Validates three things independently of the React app:
 *   1. Can we sign in with E2E credentials?
 *   2. Is the resulting JWT accepted by Supabase Auth?
 *   3. Does the process-payment edge function accept the JWT?
 *      (We send a deliberately bad payload so it fails at schema validation,
 *       not at auth — a 400/409 means auth passed, a 401 means it didn't.)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env.local');

// ── Parse .env.local ──────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY     = env.VITE_SUPABASE_ANON_KEY;
const NAME         = env.E2E_BARTENDER_NAME;   // e.g. "Alex Martinez"
const PIN          = env.E2E_BARTENDER_PIN;    // e.g. "123456"

if (!SUPABASE_URL || !ANON_KEY || !NAME || !PIN) {
  console.error('❌  Missing env vars — check .env.local');
  process.exit(1);
}

console.log('─'.repeat(60));
console.log('Supabase URL :', SUPABASE_URL);
console.log('Testing as   :', NAME);
console.log('─'.repeat(60));

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

// ── Step 1: find profile → email ──────────────────────────────────────────────
console.log('\n[1] Looking up profile for', NAME, '...');
const { data: profiles, error: profileErr } = await supabase
  .from('profiles')
  .select('id, name, email')
  .eq('name', NAME)
  .limit(1);

if (profileErr || !profiles?.length) {
  console.error('❌  Profile lookup failed:', profileErr?.message ?? 'no rows');
  process.exit(1);
}
const profile = profiles[0];
console.log('    email:', profile.email);
console.log('    id   :', profile.id);

// ── Step 2: signInWithPassword ────────────────────────────────────────────────
console.log('\n[2] Signing in ...');
const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({
  email: profile.email,
  password: PIN,
});

if (signInErr || !session?.access_token) {
  console.error('❌  Sign-in failed:', signInErr?.message ?? 'no session returned');
  process.exit(1);
}
console.log('    ✅  Signed in');
console.log('    token prefix :', session.access_token.slice(0, 40) + '...');
console.log('    expires_at   :', new Date(session.expires_at * 1000).toISOString());

// ── Step 3: validate JWT via /auth/v1/user ────────────────────────────────────
console.log('\n[3] Validating JWT against /auth/v1/user ...');
const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': ANON_KEY,
  },
});
const userData = await userResp.json().catch(() => ({}));

if (!userResp.ok) {
  console.error('❌  Token rejected by auth:', userResp.status, JSON.stringify(userData));
  process.exit(1);
}
console.log('    ✅  JWT valid for user:', userData.email);

// ── Step 4: call process-payment with bad payload (expect 400, not 401) ────────
console.log('\n[4] Calling process-payment edge function ...');
const edgeResp = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': ANON_KEY,
  },
  body: JSON.stringify({ intentionally: 'bad payload' }),
});
const edgeData = await edgeResp.json().catch(() => null);

console.log('    HTTP status  :', edgeResp.status);
console.log('    Body         :', JSON.stringify(edgeData));

if (edgeResp.status === 401) {
  console.error('\n❌  EDGE FUNCTION RETURNED 401 — JWT verification failed server-side.');
  console.error('    This means the token is not valid for this Supabase project.');
  console.error('    Check: is the local Supabase studio running? Is the token from a different project?');
  process.exit(1);
} else if (edgeResp.status === 400 || edgeResp.status === 409 || edgeResp.status === 404) {
  console.log('\n✅  Auth passed! Edge function rejected the bad payload with', edgeResp.status, '(expected).');
  console.log('    The JWT → edge function chain works correctly.');
} else {
  console.log('\nℹ️   Unexpected status', edgeResp.status, '— investigate the body above.');
}
