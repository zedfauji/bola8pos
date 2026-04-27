# Result Type — Core Error Handling Infrastructure

**File**: `src/shared/lib/result.ts`

This is the **MOST IMPORTANT** foundation file. Every async operation in the app returns `Result<T, E>`. This prevents inconsistent error handling patterns and makes errors explicit and type-safe.

## Why Result Type?

Traditional error handling with try/catch has several problems:

1. **Errors are invisible in type signatures** - You can't tell if a function throws just by looking at its type
2. **Easy to forget error handling** - Nothing forces you to handle errors
3. **Inconsistent patterns** - Some code uses try/catch, some uses callbacks, some uses promises

The Result type solves all of these:

1. **Errors are explicit** - `Result<User, AppError>` tells you exactly what can go wrong
2. **Forced error handling** - You must check `result.ok` before accessing data
3. **Consistent pattern** - Every async operation uses the same pattern

## Core Concept

A `Result` is either:

- **Success**: `{ ok: true, data: T }` - Contains the successful value
- **Failure**: `{ ok: false, error: E }` - Contains the error

```typescript
type Result<T, E = AppError> = { ok: true; data: T } | { ok: false; error: E };
```

## Basic Usage

### Creating Results

```typescript
import { ok, err } from '@shared/lib/result';

// Success
const success = ok({ id: '123', name: 'John' });
// success = { ok: true, data: { id: '123', name: 'John' } }

// Failure
const failure = err({ code: 'NOT_FOUND', message: 'User not found' });
// failure = { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }
```

### Checking Results

```typescript
const result = await fetchUser(userId);

if (!result.ok) {
  // Handle error
  console.error(result.error.message);
  toast.error(result.error.message);
  return;
}

// TypeScript knows result.data exists here
const user = result.data;
console.log(user.name);
```

### NEVER Do This

```typescript
// ❌ BAD - Accessing data without checking ok
const user = result.data; // TypeScript error!

// ❌ BAD - Using try/catch for Result
try {
  const user = result.data;
} catch (e) {
  // This won't catch Result errors
}

// ✅ GOOD - Always check ok first
if (result.ok) {
  const user = result.data;
}
```

## Result Utilities

### mapResult - Transform Data Without Unwrapping

```typescript
import { mapResult } from '@shared/lib/result';

const result = ok(5);
const doubled = mapResult(result, x => x * 2);
// doubled = ok(10)

const error = err({ code: 'NOT_FOUND', message: 'Not found' });
const mapped = mapResult(error, x => x * 2);
// mapped = err({ code: 'NOT_FOUND', message: 'Not found' })
```

### unwrapResult - Extract Data (Use Sparingly)

```typescript
import { unwrapResult } from '@shared/lib/result';

const result = ok(42);
const value = unwrapResult(result); // 42

const error = err({ code: 'NOT_FOUND', message: 'Not found' });
unwrapResult(error); // throws Error
```

**WARNING**: Only use `unwrapResult` when you're 100% certain the Result is ok. Prefer explicit checking in most cases.

### isOk / isErr - Type Guards

```typescript
import { isOk, isErr } from '@shared/lib/result';

if (isOk(result)) {
  // TypeScript knows result.data exists
  console.log(result.data);
}

if (isErr(result)) {
  // TypeScript knows result.error exists
  console.log(result.error.code);
}
```

## AppError Type

All errors in the application use the `AppError` type:

```typescript
type AppError = {
  code: AppErrorCode; // Machine-readable error code
  message: string; // Human-readable message (safe to show to user)
  detail?: string; // Technical detail (log only, never show to user)
  originalError?: unknown; // Underlying error (for logging, never expose to UI)
};
```

### Error Codes

```typescript
type AppErrorCode =
  | 'NETWORK_OFFLINE'
  | 'AUTH_REQUIRED'
  | 'AUTH_FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_ENTRY'
  | 'TAB_ALREADY_CLOSED'
  | 'SESSION_STILL_RUNNING'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_ALREADY_PROCESSED'
  | 'INVENTORY_NEGATIVE'
  | 'SUPABASE_ERROR'
  | 'TAURI_ERROR'
  | 'UNKNOWN_ERROR';
```

## Error Factory Functions

Instead of manually creating errors, use factory functions:

```typescript
import {
  networkOfflineError,
  authRequiredError,
  authForbiddenError,
  notFoundError,
  validationError,
  duplicateEntryError,
  tabAlreadyClosedError,
  sessionStillRunningError,
  paymentDeclinedError,
  paymentAlreadyProcessedError,
  inventoryNegativeError,
  supabaseError,
  tauriError,
  unknownError,
} from '@shared/lib/result';

// Network offline
return err(networkOfflineError());

// Auth required
return err(authRequiredError());

// Auth forbidden
return err(authForbiddenError('manager'));

// Not found
return err(notFoundError('User'));

// Validation error
return err(
  validationError({
    email: 'Invalid email format',
    password: 'Password too short',
  })
);

// Duplicate entry
return err(duplicateEntryError('email'));

// Tab already closed
return err(tabAlreadyClosedError());

// Session still running
return err(sessionStillRunningError(5)); // Table #5

// Payment declined
return err(paymentDeclinedError('Insufficient funds'));

// Payment already processed
return err(paymentAlreadyProcessedError());

// Inventory negative
return err(inventoryNegativeError('Beer'));

// Supabase error
return err(supabaseError('Database error', 'Connection timeout', originalError));

// Tauri error
return err(tauriError('IPC failed', originalError));

// Unknown error
return err(unknownError(originalError));
```

## Supabase Integration

### supabaseQuery - Wrap Supabase Queries

```typescript
import { supabaseQuery } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

async function fetchTab(tabId: string): Promise<Result<Tab>> {
  return supabaseQuery(() => supabase.from('tabs').select('*').eq('id', tabId).single());
}

// Usage
const result = await fetchTab('123');

if (!result.ok) {
  // Automatically handles:
  // - Network offline
  // - Supabase errors (parsed to AppError)
  // - Null data (returns NOT_FOUND)
  console.error(result.error.message);
  return;
}

const tab = result.data; // typed as Tab
```

### supabaseMutation - Wrap Supabase Mutations

```typescript
import { supabaseMutation } from '@shared/lib/result';

async function closeTab(tabId: string): Promise<Result<null>> {
  return supabaseMutation(() => supabase.from('tabs').update({ status: 'closed' }).eq('id', tabId));
}

// Usage
const result = await closeTab('123');

if (!result.ok) {
  console.error(result.error.message);
  return;
}

console.log('Tab closed successfully');
```

### parseSupabaseError - Parse Supabase Errors

```typescript
import { parseSupabaseError } from '@shared/lib/result';

const { data, error } = await supabase.from('tabs').insert(newTab);

if (error) {
  const appError = parseSupabaseError(error);
  // Automatically maps:
  // - 23505 (unique violation) → DUPLICATE_ENTRY
  // - 23503 (foreign key violation) → SUPABASE_ERROR
  // - 23502 (not null violation) → SUPABASE_ERROR
  // - PGRST116 (row not found) → NOT_FOUND
  // - 42501 (RLS violation) → AUTH_FORBIDDEN
  // - 23514 (check violation) → VALIDATION_ERROR
  console.error(appError.message);
}
```

## Complete Example

```typescript
import { supabaseQuery, ok, err, sessionStillRunningError } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Result } from '@shared/lib/result';
import type { Tab } from '@shared/lib/domain';

async function closeTab(tabId: string): Promise<Result<Tab>> {
  // 1. Fetch the tab
  const tabResult = await supabaseQuery(() =>
    supabase
      .from('tabs')
      .select(
        `
        *,
        pool_sessions!inner (
          id,
          stopped_at
        )
      `
      )
      .eq('id', tabId)
      .single()
  );

  if (!tabResult.ok) {
    return tabResult; // Pass through error
  }

  const tab = tabResult.data;

  // 2. Check if any pool sessions are still running
  const runningSessions = tab.pool_sessions.filter(s => s.stopped_at === null);
  if (runningSessions.length > 0) {
    return err(sessionStillRunningError(runningSessions[0].table_number));
  }

  // 3. Close the tab
  const closeResult = await supabaseQuery(() =>
    supabase
      .from('tabs')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', tabId)
      .select()
      .single()
  );

  if (!closeResult.ok) {
    return closeResult; // Pass through error
  }

  return ok(closeResult.data);
}

// Usage in component
async function handleCloseTab() {
  const result = await closeTab(selectedTabId);

  if (!result.ok) {
    // Show error to user
    toast.error(result.error.message);

    // Log technical details
    logger.error('tab.close.failed', {
      code: result.error.code,
      detail: result.error.detail,
      tabId: selectedTabId,
    });

    return;
  }

  // Success
  toast.success('Tab closed successfully');
  navigate('/tabs');
}
```

## Best Practices

### 1. Always Check `result.ok` Before Using Data

```typescript
// ✅ GOOD
if (result.ok) {
  console.log(result.data);
}

// ❌ BAD
console.log(result.data); // TypeScript error
```

### 2. Show `error.message` to Users, Log `error.detail`

```typescript
if (!result.ok) {
  // Show to user (safe, human-readable)
  toast.error(result.error.message);

  // Log for debugging (technical details)
  logger.error('operation.failed', {
    code: result.error.code,
    detail: result.error.detail,
    originalError: result.error.originalError,
  });
}
```

### 3. Use Error Factory Functions

```typescript
// ✅ GOOD
return err(notFoundError('User'));

// ❌ BAD
return err({ code: 'NOT_FOUND', message: 'User not found' });
```

### 4. Pass Through Errors

```typescript
async function complexOperation(): Promise<Result<Data>> {
  const result1 = await step1();
  if (!result1.ok) return result1; // Pass through error

  const result2 = await step2(result1.data);
  if (!result2.ok) return result2; // Pass through error

  return ok(result2.data);
}
```

### 5. Use `supabaseQuery` and `supabaseMutation`

```typescript
// ✅ GOOD
return supabaseQuery(() => supabase.from('tabs').select('*').eq('id', tabId).single());

// ❌ BAD
const { data, error } = await supabase.from('tabs').select('*').eq('id', tabId).single();
if (error) return err(parseSupabaseError(error));
if (!data) return err(notFoundError());
return ok(data);
```

## Testing

All Result utilities have comprehensive tests in `src/shared/lib/result.test.ts`:

- 113 tests covering all functions
- Edge cases tested (null data, network offline, etc.)
- Type narrowing verified
- Error factory functions tested

Run tests:

```bash
npm test
```

## Type Safety

The Result type provides complete type safety:

```typescript
const result: Result<User, AppError> = await fetchUser('123');

if (result.ok) {
  // TypeScript knows result.data is User
  const name: string = result.data.name;
} else {
  // TypeScript knows result.error is AppError
  const code: AppErrorCode = result.error.code;
}
```

## Summary

- **Every async operation returns `Result<T, E>`**
- **Always check `result.ok` before using data**
- **Use error factory functions for consistency**
- **Show `error.message` to users, log `error.detail`**
- **Use `supabaseQuery` and `supabaseMutation` for Supabase operations**
- **Pass through errors instead of re-wrapping**
- **Never use `unwrapResult` unless you're 100% certain**

This pattern ensures consistent, type-safe error handling across the entire application.
