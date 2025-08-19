# POS Backend Login Issue Investigation

Last updated: 2025-08-15 21:31 -06:00

## DB Credentials
Username: bola8pos
password: changeme

## UI Login Temp Admin credentials
username: admin@billiardpos.com
password: Admin@123

## Summary
- __Goal__: Obtain a JWT via `POST /api/access/auth/login` using the admin account, then call `GET /api/table-layouts`, `GET /api/table-layouts/active`, and `GET /api/tables` with `Authorization: Bearer <token>`.
- __Current status__: Login returns 401 Unauthorized ("Invalid email or password"). HTTPS/self-signed certificate hurdles are handled in our scripts.
- __Likely blocker__: Seeded/updated admin password in DB does not match the password we attempted (`password`).

## Environment and Relevant Code
- __Server__: `pos/backend/src/server.js` (Express, HTTPS on `https://localhost:3001`).
- __Auth middleware__: `pos/backend/src/middleware/auth.middleware.js` expects `Authorization` header starting with `Bearer ` and verifies JWT with `JWT_SECRET`.
- __Auth routes__: `pos/backend/src/routes/access/auth.routes.js`
  - `POST /api/access/auth/login` expects JSON `{ email, password }` and returns `{ user, accessToken, expiresIn }`.
  - `POST /api/access/auth/refresh-token`
  - `POST /api/access/auth/logout`
- __Tables & Layouts routes__: `pos/backend/src/routes/tables.routes.js` mounted under `/api` in `server.js`, behind `authenticate`.
  - `GET /api/table-layouts`
  - `GET /api/table-layouts/active`
  - `GET /api/tables`

## What We Did
1. __Verified endpoints and auth flow__
   - Confirmed route mounting and middleware in `server.js` and `tables.routes.js`.
   - Confirmed login payload and response shape in `auth.routes.js`.
2. __Handled HTTPS with self-signed cert__
   - PowerShell 5 threw `UntrustedRoot` on `Invoke-RestMethod`.
   - Implemented curl fallback with `-k` and a PS7 path using `-SkipCertificateCheck`.
3. __Wrote a reusable test script__: `pos/scripts/test_tables.ps1`
   - Logs in, captures JWT, calls the three endpoints.
   - Works across PS5 (curl.exe -k) and PS7 (Invoke-RestMethod -SkipCertificateCheck).
4. __Executed the script__
   - Result: Login fails with 401 and message `Invalid email or password`.

## Key Findings
- __Admin seed migration__: `pos/backend/src/migrations/20240815_seed_default_roles_and_permissions.sql`
  - Seeds `admin@billiardpos.com` with bcrypt hash of `Admin@123` (commented and hash present).
- __Admin password update migration__: `pos/backend/src/migrations/20250815_update_admin_password.sql`
  - Updates the admin password again to a different bcrypt hash: `$2a$10$QqGufV3P4RxQ6JwKrJI34.17c5pbSFj0RSNlc.MoEsnlza7oy6R/2` (plaintext unknown in repo).
- __Check script__: `pos/backend/scripts/check-admin.js` confirms whether admin row exists but does not reveal the password.
- __Conclusion__: The database likely holds the updated bcrypt from 2025-08-15 migration, which does not match the attempted plaintext `password`. Hence 401.

### DB Verification Result (2025-08-15 21:30 -06:00)
- __Users row__: email `admin@billiardpos.com`, password hash `$2b$10$ddC8DTW38MTRRweFToe5Y.RXj.uSQFnJMBOI4tv7GFPjyXpi/ofJa`, `is_active=1`, created_at `2025-08-15 13:25:12`.
- __Roles row__: `role_admin` → name `Administrator`, description `Full system access`, created/updated `2025-08-15 13:25:12`.

## Reproduction Steps
- With backend running on `https://localhost:3001`:
  - Run `pwsh -NoProfile -File .\pos\scripts\test_tables.ps1`
  - Observe: `Invalid email or password` during login.

## Expected Outcome
- Successful login returning a JSON payload with `accessToken`.
- Subsequent authorized `GET` calls to `/api/table-layouts`, `/api/table-layouts/active`, and `/api/tables` should return 200 with data.

## Blocker
- __Credentials mismatch__: The actual admin password hash in DB doesn’t match the plaintext we’re using. Without the correct plaintext or a reset, login will continue to fail.

## Resolution Plan
1. __Verify current admin password hash in DB__
   - Query the DB for current hash:
     - Using MySQL client:
       ```sql
       SELECT email, password, is_active FROM users WHERE email = 'admin@billiardpos.com';
       ```
   - Confirm whether it matches the seed (`Admin@123`) or the later update (`$2a$10$QqG...`).
2. __Option A: Reset admin password to a known value__ (recommended for local dev)
   - Generate bcrypt hash (inside repo, Node has bcryptjs dependency under backend):
     ```powershell
     pwsh -NoProfile -Command "node -e \"console.log(require('bcryptjs').hashSync('password', 10))\""
     ```
   - Update DB:
     ```sql
     UPDATE users SET password = '<PASTE_HASH>', is_active = TRUE WHERE email = 'admin@billiardpos.com';
     ```
   - Alternative: write a small Node script to perform the update safely via the app’s DB pool.
3. __Option B: Attempt known candidates__
   - Try `Admin@123` (per seed comment) via the test script.
   - If fails, proceed with Option A to definitively set password.
4. __Re-run API tests__
   - Run `pos/scripts/test_tables.ps1` again to:
     - Login and capture JWT
     - GET `/api/table-layouts`, `/api/table-layouts/active`, `/api/tables`
5. __Log results__
   - Record successful login and endpoint responses in `FEATURE_LOG.md` as per project practice.

## Notes on HTTPS / Tools
- PowerShell 5: prefer `curl.exe -k` to bypass self-signed cert, which `Invoke-RestMethod` rejects.
- PowerShell 7: `Invoke-RestMethod ... -SkipCertificateCheck` works.
- Postman: disable SSL Verification or import the local cert for `https://localhost:3001`.

## Related Files and Paths
- `pos/backend/src/server.js`
- `pos/backend/src/middleware/auth.middleware.js`
- `pos/backend/src/routes/access/auth.routes.js`
- `pos/backend/src/routes/tables.routes.js`
- `pos/backend/src/migrations/20240815_seed_default_roles_and_permissions.sql`
- `pos/backend/src/migrations/20250815_update_admin_password.sql`
- `pos/backend/scripts/check-admin.js`
- `pos/scripts/test_tables.ps1`

## Auth Refresh 401 Infinite Loop — Root Cause and Fix

Last updated: 2025-08-15 21:31 -06:00

### Summary
- __Issue__: After successful login, periodic or on-demand refresh calls to `POST /api/access/auth/refresh-token` resulted in repeated 401 responses and an infinite retry loop.
- __Impact__: Users got bounced back to login or saw failing API calls; Network tab showed recursive refresh attempts.

### Affected Components
- __Frontend__: `pos/frontend/src/services/authService.js` (Axios instance and interceptors)
- __Backend__: `pos/backend/src/routes/access/auth.routes.js` (refresh-token cookie attributes), `pos/backend/src/server.js` (route mount paths, CORS/trust proxy)

### Symptoms
- 401 on `POST /api/access/auth/refresh-token` despite valid session.
- Axios retried the original request and recursively retried the refresh call itself, causing a loop.

### Root Causes
- __Cookie policy mismatch__: Frontend at `http://localhost:5173` calling backend at `https://localhost:3001` is schemeful cross-site. The refresh cookie must be `Secure` and `SameSite=None` to be sent; development defaults previously used `SameSite=Lax` and `Secure=false`, so the cookie was not sent → backend returned 401.
- __Interceptor recursion__: The Axios response interceptor attempted refresh even when the failed request was the refresh call or login call, spiraling into retries.
- __Token key inconsistency (secondary)__: Some services (e.g., `pos/frontend/src/services/inventoryService.js`) read `localStorage.getItem('token')` while auth stores `accessToken`. This can produce 401s on protected APIs even after a good refresh.

### Fixes Applied
- __Backend cookie config__ in `pos/backend/src/routes/access/auth.routes.js`:
  - Set refresh token cookie with `httpOnly: true`, `secure: true`, `sameSite: 'none'`, and proper `path` under `/api/access/auth` in all environments.
  - Updated `clearCookie` on logout to use the exact same attributes so the cookie actually clears.
  - Ensured server trusts proxy/HTTPS via `app.set('trust proxy', 1)` and CORS allows credentials.

- __Frontend Axios interceptor__ in `pos/frontend/src/services/authService.js`:
  - Do not attempt refresh for the refresh endpoint itself or for `/login`.
  - Attempt refresh only once per failing request using `_retry` flag.
  - On successful refresh, update `localStorage.accessToken` and retry the original request with `Authorization: Bearer <new token>`.
  - On refresh failure, clear auth state and redirect to `/login`.

- __Consistency note__:
  - Standardize on `localStorage['accessToken']` for Authorization headers across services. Example: update `inventoryService.js` to use `accessToken` instead of `token`.

### Environment & Testing Notes
- __Frontend__: `http://localhost:5173`
- __Backend__: `https://localhost:3001` (self-signed cert). Trust/import the cert in the browser so `Secure` cookies are sent.
- __CORS__: Credentials enabled; cookies require `withCredentials: true` on Axios instance (already set in `authService.js`).
- __Verify cookie__: In DevTools → Application → Cookies for `https://localhost:3001`, confirm `refreshToken` is present, `HttpOnly`, `Secure`, and `SameSite=None`.

### Verification Steps
1. __Login__ via UI; observe `Set-Cookie: refreshToken=...; Secure; HttpOnly; SameSite=None` on `POST /api/access/auth/login`.
2. __Trigger refresh__ (wait for the interval in `AuthContext.jsx` or manually force an API call that returns 401 once).
3. __Observe__ `POST /api/access/auth/refresh-token` succeeds (200) and the retried original request succeeds.
4. __Ensure no loop__: The interceptor should not call refresh again for refresh/login endpoints.
5. __Spot-check protected APIs__: Calls under `/api/...` include `Authorization: Bearer <accessToken>` from localStorage.

### References (implementation locations)
- `pos/frontend/src/services/authService.js` (interceptor logic)
- `pos/frontend/src/contexts/AuthContext.jsx` (refresh cadence and failure handling)
- `pos/backend/src/routes/access/auth.routes.js` (cookie attributes, logout clearing)
- `pos/backend/src/server.js` (mounted `'/api/access'` and rate limit on `'/api/access/auth'`)

### Status
- __Resolved__: Refresh loop eliminated; cookie now sent cross-site and interceptor is guarded against recursion.

## Next Actions
- Verify the admin password hash in DB.
- Reset password to a known value (e.g., `password`) and re-run tests.
- If login succeeds, proceed to test and document tables/table-layout endpoints.