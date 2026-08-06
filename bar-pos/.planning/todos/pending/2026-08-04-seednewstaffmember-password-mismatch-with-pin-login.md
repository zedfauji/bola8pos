---
created: 2026-08-04T00:00:00.000Z
title: seedNewStaffMember's auth password doesn't match what PIN login actually submits
area: testing
severity: minor
files:
  - e2e/helpers/supabase.ts (seedNewStaffMember)
  - src/widgets/PINLoginForm/PINLoginForm.tsx:82-88
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/22-staff-management.spec.ts` SM3
("login as E2E-TestStaff succeeds"), traced with a live run + direct DB check
(2026-08-04).

The real PIN login flow (`PINLoginForm.tsx:82-84`) authenticates via:

```ts
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: selectedStaff.email,
  password: enteredPin,  // the raw PIN digits, e.g. "111222"
});
```

— i.e. the Supabase Auth password IS the raw PIN string, nothing else.

`seedNewStaffMember` (`e2e/helpers/supabase.ts`) creates the auth user with:

```ts
password: `Test${pin}!`,  // e.g. "Test111222!"
```

This can never match what `PINLoginForm` submits, so any test that seeds a staff
member via `seedNewStaffMember` and then logs in via the real PIN keypad
(`loginAsNamed`) always gets "Sign-in failed. Please try again or contact your
manager." — confirmed via a real run (screenshot) and by directly reproducing the
mismatch: `signInWithPassword({ email, password: pin })` against a user created with
`password: Test${pin}!` fails, matching the app's own behavior exactly.

This is a test-helper bug only — `PINLoginForm`'s real production login flow (used by
every other spec via `loginAs`/`loginAsNamed` against the project's committed E2E seed
accounts) is unaffected; those accounts' Supabase Auth passwords were presumably
provisioned to equal their PINs directly. `seedNewStaffMember` is the one seeding
helper that gets this wrong, and it appears to be used only by staff-management-style
specs that need to create a *new* staff member mid-test (not one of the fixed named
E2E accounts).

## Solution

Change `seedNewStaffMember`'s `admin.auth.admin.createUser({ password: ... })` call to
use the raw `pin` as the password (matching `PINLoginForm.tsx:84`'s
`password: enteredPin`), not `Test${pin}!`.

Out of scope for Phase 39 (E2E triage) to fix directly — `e2e/helpers/supabase.ts` is a
shared helper used concurrently by every Track A E2E-triage plan in this phase; editing
it here risks colliding with sibling plans' in-flight runs against the same file.
