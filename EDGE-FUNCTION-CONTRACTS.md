# Edge Function Contracts

## 📋 Overview

`src/shared/lib/edge-function-contracts.ts` defines request and response schemas for every Supabase Edge Function. These schemas are validated with Zod on **BOTH** the client (before sending) and server (after receiving).

## 🎯 Purpose

1. **Type Safety** - Ensures all edge function calls are properly typed
2. **Validation** - Validates requests before sending and responses after receiving
3. **Error Handling** - Provides consistent error handling with Result type
4. **Documentation** - Documents the exact shape of all edge function contracts

## 📦 What's Included

### 1. Result Type (`src/shared/lib/result.ts`)

Type-safe way to handle success and error cases without throwing exceptions.

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

// Helper functions
Ok<T>(value: T): Result<T, never>
Err<E>(error: E): Result<never, E>
isOk<T, E>(result: Result<T, E>): boolean
isErr<T, E>(result: Result<T, E>): boolean
```

### 2. Edge Functions (4 total)

#### `process-payment`

Processes a payment for a tab, integrating with Square if card payment.

**Request:**

```typescript
{
  tabId: string (UUID)
  amount: number (money)
  tipAmount: number (money)
  method: 'cash' | 'card' | 'tab_transfer'
  squarePaymentId: string | null
  idempotencyKey: string (min 1 char)
}
```

**Response:**

```typescript
{
  success: boolean
  paymentId?: string (UUID)
  receiptData?: ReceiptData
  error?: string
}
```

**Usage:**

```typescript
import { callProcessPayment } from '@shared/lib/edge-function-contracts';

const result = await callProcessPayment({
  tabId: '123',
  amount: 50.0,
  tipAmount: 10.0,
  method: 'card',
  squarePaymentId: 'sq_123',
  idempotencyKey: 'payment_123_abc',
});

if (result.ok) {
  console.log('Payment ID:', result.value.paymentId);
  console.log('Receipt:', result.value.receiptData);
} else {
  console.error('Error:', result.error.message);
}
```

---

#### `close-shift`

Closes a staff shift and generates summary report.

**Request:**

```typescript
{
  shiftId: string(UUID);
  closingCash: number(money);
}
```

**Response:**

```typescript
{
  success: boolean
  summary?: ShiftSummary
  error?: string
}
```

**ShiftSummary:**

```typescript
{
  totalOrders: number;
  totalRevenue: number;
  totalTips: number;
  cashTransactions: number;
  cardTransactions: number;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  cashVariance: number;
}
```

**Usage:**

```typescript
import { callCloseShift } from '@shared/lib/edge-function-contracts';

const result = await callCloseShift({
  shiftId: '123',
  closingCash: 500.0,
});

if (result.ok && result.value.summary) {
  const { summary } = result.value;
  console.log('Total revenue:', summary.totalRevenue);
  console.log('Cash variance:', summary.cashVariance);
}
```

---

#### `generate-report`

Generates a daily or weekly report for the specified date range.

**Request:**

```typescript
{
  type: 'daily' | 'weekly'
  date: string (YYYY-MM-DD format)
  staffId?: string (UUID, optional)
}
```

**Response:**

```typescript
{
  success: boolean
  data?: ReportData
  generatedAt?: Date
  error?: string
}
```

**ReportData:**

```typescript
{
  reportType: 'daily' | 'weekly'
  period: { start: string, end: string }
  summary: {
    totalRevenue: number
    totalOrders: number
    totalTips: number
    averageOrderValue: number
  }
  breakdown: {
    byCategory: Array<{ categoryName, revenue, itemsSold }>
    byPaymentMethod: Array<{ method, count, total }>
    byStaff?: Array<{ staffName, ordersProcessed, revenue }>
  }
  poolTables: {
    totalSessions: number
    totalRevenue: number
    averageSessionDuration: number
  }
}
```

**Usage:**

```typescript
import { callGenerateReport } from '@shared/lib/edge-function-contracts';

const result = await callGenerateReport({
  type: 'daily',
  date: '2024-01-15',
});

if (result.ok && result.value.data) {
  const { data } = result.value;
  console.log('Total revenue:', data.summary.totalRevenue);
  console.log('Total orders:', data.summary.totalOrders);

  data.breakdown.byCategory.forEach(cat => {
    console.log(`${cat.categoryName}: $${cat.revenue}`);
  });
}
```

---

#### `void-order`

Voids an order and updates inventory accordingly.

**Request:**

```typescript
{
  orderId: string (UUID)
  reason: string (1-500 chars)
  staffId: string (UUID)
}
```

**Response:**

```typescript
{
  success: boolean
  voidedAt?: Date
  error?: string
}
```

**Usage:**

```typescript
import { callVoidOrder } from '@shared/lib/edge-function-contracts';

const result = await callVoidOrder({
  orderId: '123',
  reason: 'Customer changed mind',
  staffId: 'staff-456',
});

if (result.ok) {
  console.log('Order voided at:', result.value.voidedAt);
} else {
  console.error('Failed to void:', result.error.message);
}
```

## 🎨 Usage Patterns

### Pattern 1: Basic Edge Function Call

```typescript
import { callProcessPayment } from '@shared/lib/edge-function-contracts';

async function processPayment(tabId: string, amount: number) {
  const result = await callProcessPayment({
    tabId,
    amount,
    tipAmount: 0,
    method: 'cash',
    squarePaymentId: null,
    idempotencyKey: `payment_${Date.now()}`,
  });

  if (result.ok) {
    return result.value;
  }

  throw new Error(result.error.message);
}
```

### Pattern 2: Error Handling with Result Type

```typescript
import { callCloseShift, isOk, isErr } from '@shared/lib/edge-function-contracts';

async function handleCloseShift(shiftId: string, closingCash: number) {
  const result = await callCloseShift({ shiftId, closingCash });

  if (isOk(result)) {
    // TypeScript knows result.value exists
    return result.value.summary;
  }

  if (isErr(result)) {
    // TypeScript knows result.error exists
    console.error('Error code:', result.error.code);
    console.error('Error message:', result.error.message);
    return null;
  }
}
```

### Pattern 3: Validation Before Sending

```typescript
import { ProcessPaymentRequestSchema } from '@shared/lib/edge-function-contracts';

function validatePaymentRequest(data: unknown) {
  const result = ProcessPaymentRequestSchema.safeParse(data);

  if (!result.success) {
    console.error('Validation errors:', result.error.issues);
    return null;
  }

  return result.data;
}
```

### Pattern 4: Using with TanStack Query

```typescript
import { useMutation } from '@tanstack/react-query';
import {
  callProcessPayment,
  type ProcessPaymentRequest,
} from '@shared/lib/edge-function-contracts';

function useProcessPayment() {
  return useMutation({
    mutationFn: async (request: ProcessPaymentRequest) => {
      const result = await callProcessPayment(request);

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.value;
    },
    onSuccess: data => {
      console.log('Payment processed:', data.paymentId);
    },
    onError: error => {
      console.error('Payment failed:', error.message);
    },
  });
}
```

## 🔧 Edge Function Registry

All edge functions are registered in `EDGE_FUNCTIONS` constant:

```typescript
export const EDGE_FUNCTIONS = {
  'process-payment': {
    requestSchema: ProcessPaymentRequestSchema,
    responseSchema: ProcessPaymentResponseSchema,
    caller: callProcessPayment,
  },
  'close-shift': { ... },
  'generate-report': { ... },
  'void-order': { ... },
} as const
```

**Usage:**

```typescript
import { EDGE_FUNCTIONS } from '@shared/lib/edge-function-contracts';

// Get schema for validation
const schema = EDGE_FUNCTIONS['process-payment'].requestSchema;

// Call function
const result = await EDGE_FUNCTIONS['process-payment'].caller(request);
```

## 🚨 Error Codes

Edge function errors use the `AppError` type from `supabase-contracts.ts`:

```typescript
type AppError = {
  code: string;
  message: string;
  details?: string;
  hint?: string;
};
```

**Common Error Codes:**

- `VALIDATION_ERROR` - Invalid request data (Zod validation failed)
- `EDGE_FUNCTION_ERROR` - Edge function returned non-200 status
- `PAYMENT_FAILED` - Payment processing failed
- `SHIFT_CLOSE_FAILED` - Shift close operation failed
- `REPORT_GENERATION_FAILED` - Report generation failed
- `VOID_ORDER_FAILED` - Order void operation failed
- `UNKNOWN_ERROR` - Unexpected error occurred

## 📚 Shared Schemas

### ReceiptData

```typescript
{
  receiptNumber: string;
  tabId: string(UUID);
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  tipAmount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'tab_transfer';
  processedAt: Date;
  squareReceiptUrl: string | null;
}
```

### ShiftSummary

```typescript
{
  totalOrders: number;
  totalRevenue: number;
  totalTips: number;
  cashTransactions: number;
  cardTransactions: number;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  cashVariance: number;
}
```

### ReportData

See "generate-report" section above for complete structure.

## 🎯 Best Practices

1. **Always use the caller functions** - Don't call edge functions directly
2. **Handle Result types properly** - Check `result.ok` before accessing `value`
3. **Validate before sending** - Use `.safeParse()` for user input
4. **Use idempotency keys** - For payment operations to prevent double-charging
5. **Log errors properly** - Include error code and details for debugging

## 🔗 Related Files

- `src/shared/lib/domain.ts` - Domain entity types (Zod schemas)
- `src/shared/lib/supabase-contracts.ts` - Supabase query contracts
- `src/shared/lib/result.ts` - Result type for error handling
- `src/shared/lib/domain-helpers.ts` - Pure business logic functions

---

**These contracts define the API between our frontend and Supabase Edge Functions. All edge function calls must use these typed callers.**
