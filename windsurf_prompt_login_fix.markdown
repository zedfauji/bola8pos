# Windsurf Prompt for Resolving POS Backend Login Issue

**Objective**: Resolve a 401 "Invalid email or password" error when logging into the POS backend with admin@billiardpos.com. The issue is due to a password hash mismatch in the MySQL database, as detailed in `LoginIssue.md`. Generate a Node.js script to reset the admin password to 'password' using bcryptjs and update the test script to use the new password. Do not modify auth routes or middleware.

**Context from `LoginIssue.md`**:
- **Environment**: Backend runs on Express at `https://localhost:3001` (self-signed cert handled in scripts).
- **Database**: MySQL, credentials `bola8pos:changeme`. Admin user: email `admin@billiardpos.com`, current password hash `$2b$10$ddC8DTW38MTRRweFToe5Y.RXj.uSQFnJMBOI4tv7GFPjyXpi/ofJa`.
- **Migration Issue**: Admin password updated in `20250815_update_admin_password.sql` to an unknown plaintext, not matching seed `Admin@123`.
- **Test Script**: `pos/scripts/test_tables.ps1` attempts login with `admin@billiardpos.com:Admin@123`, fails with 401.
- **Dependencies**: Backend includes `bcryptjs` for hashing.
- **Goal**: Reset password to 'password', update DB, and modify test script to use new credentials.

**Task Instructions for SWE-1**:
1. **Generate a Node.js Script**:
   - Create `pos/backend/scripts/reset_admin_password.js`.
   - Use `bcryptjs` to hash 'password' with salt rounds 10.
   - Connect to MySQL DB (host: localhost, user: bola8pos, password: changeme, database: pos).
   - Update the `users` table to set the new hash for `email = 'admin@billiardpos.com'`.
   - Include error handling (e.g., DB connection failure, no rows updated).
   - Log success or failure with the new hash.
2. **Update Test Script**:
   - Modify `pos/scripts/test_tables.ps1` to use `password` instead of `Admin@123` in the login payload.
   - Ensure compatibility with PowerShell 5 (curl.exe -k) and PowerShell 7 (Invoke-RestMethod -SkipCertificateCheck).
   - Preserve existing logic for capturing JWT and calling GET `/api/table-layouts`, `/api/table-layouts/active`, `/api/tables`.
3. **Constraints**:
   - Do NOT modify `auth.routes.js`, `auth.middleware.js`, or `server.js`—issue is DB-related.
   - Do NOT attempt to diagnose refresh token issues (already resolved).
   - Use `mysql2/promise` for DB connection (available in backend).
   - Ensure script is executable in the existing backend environment (Node.js, bcryptjs installed).
4. **Output Format**:
   - Provide two files in markdown code blocks:
     - `reset_admin_password.js` (Node.js script).
     - `test_tables.ps1` (updated PowerShell script).
   - Include brief instructions for running each script.
5. **Verification Steps**:
   - After running `reset_admin_password.js`, query DB to confirm new hash: `SELECT password FROM users WHERE email = 'admin@billiardpos.com';`.
   - Run `test_tables.ps1` to verify login returns 200 with JWT and GET calls succeed.
6. **Edge Cases**:
   - Handle DB connection errors with clear messages.
   - If admin email not found, log warning but don’t fail script.
   - Ensure curl/Invoke-RestMethod handles self-signed cert in test script.

**Reference from `LoginIssue.md`**:
- Current hash: `$2b$10$ddC8DTW38MTRRweFToe5Y.RXj.uSQFnJMBOI4tv7GFPjyXpi/ofJa`.
- Seed hash for `Admin@123`: Not matching current DB.
- Relevant paths: `pos/backend/src/migrations/20250815_update_admin_password.sql`, `pos/scripts/test_tables.ps1`.

**Expected Output**:
- `reset_admin_password.js`: Node.js script that hashes 'password' and updates DB.
- `test_tables.ps1`: Updated PowerShell script with new password, maintaining all other functionality.
- Instructions: Steps to run both scripts and verify login success.