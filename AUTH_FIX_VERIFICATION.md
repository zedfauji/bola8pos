# Authentication Fix Verification

## Root Cause

The login was failing with 400 Bad Request because:

1. Auth users in `auth.users` were being created with bcrypt 6-round hashes (`$2a$06$`)
2. Supabase's auth system expects 10-round hashes (`$2a$10$`)
3. The seed.sql was running AFTER migrations and overwriting the correct hashes

## Changes Applied

### 1. Created Migration `20260415000001_seed_auth_users.sql`

- Creates auth users with proper 10-round bcrypt hashes
- Creates corresponding identities in `auth.identities` table
- Uses correct email format: `{staff_id}@barpos.local`
- Passwords are the PIN values (123456, 567890, 901234, 345678)

### 2. Fixed `supabase/seed.sql`

- Removed auth user creation (now handled by migration)
- Kept profile creation with `ON CONFLICT DO NOTHING`
- Added comment explaining auth users are in migration

### 3. Fixed `src/pages/login/index.tsx`

- Added `opening_cash: 0` to shift insert (required field)
- Added error handling for shift creation
- Added null check for `newShift` before setting context

### 4. Created `supabase/functions/create-staff/index.ts`

- Edge Function for creating new staff members (Day 6 feature)
- Creates both auth user AND profile in a transaction
- Includes rollback logic if profile creation fails
- Uses correct email format: `{staff_id}@barpos.local`

## Verification

✅ Database reset completed successfully
✅ Auth users created with 10-round bcrypt hashes
✅ Profiles created with matching IDs
✅ Login test successful - received access token

## Test Staff Credentials

| Name          | PIN    | Role      |
| ------------- | ------ | --------- |
| Alex Martinez | 123456 | bartender |
| Jamie Chen    | 567890 | manager   |
| Taylor Brooks | 901234 | admin     |
| Sam Rivera    | 345678 | bartender |

## Test Results

```bash
curl test returned:
- access_token: ✅ Valid JWT
- user.id: 11111111-1111-1111-1111-111111111111
- user.email: 11111111-1111-1111-1111-111111111111@barpos.local
- user_metadata: {"name":"Alex Martinez","role":"bartender"}
```

## Next Steps

To test in the app:

1. Run `npm run dev` in the bar-pos directory
2. Navigate to http://localhost:1420
3. Click "Alex Martinez"
4. Enter PIN: 123456
5. Should redirect to /pos with no errors

## What Was NOT Changed (as per requirements)

- AuthContext.tsx (unchanged)
- ProtectedRoute.tsx (unchanged)
- Login UI/OTP component (unchanged)
- No localStorage for auth state
- No new npm packages
- supabase.types.ts (unchanged)
