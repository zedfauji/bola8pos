import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ReceiptData,
  ProcessPaymentRequestSchema,
  callProcessPayment,
  SendReceiptEmailRequestSchema,
  callSendReceiptEmail,
} from './edge-function-contracts';

const tabId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const paymentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function baseValidRequest() {
  return {
    tabId,
    amount: 10,
    tipAmount: 1,
    method: 'cash' as const,
    idempotencyKey: 'payment_cash_abc',
    tenderedAmount: 20,
  };
}

function validReceiptData(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    receiptNumber: 'RCPT1234',
    tabId,
    customerName: 'Guest',
    cashierName: 'Staff',
    barName: 'Test Bar',
    barAddress: 'Calle 1',
    items: [{ name: 'Beer', quantity: 1, unitPrice: 10, lineTotal: 10 }],
    subtotal: 10,
    tipAmount: 1,
    total: 11,
    paymentMethod: 'cash',
    processedAt: new Date('2026-04-17T12:00:00.000Z'),
    squareReceiptUrl: null,
    tenderedAmount: 20,
    changeAmount: 9,
    ...overrides,
  };
}

describe('ProcessPaymentRequestSchema', () => {
  it('accepts valid cash with tenderedAmount', () => {
    const r = ProcessPaymentRequestSchema.safeParse(baseValidRequest());
    expect(r.success).toBe(true);
  });

  it('accepts card without tenderedAmount', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      method: 'card',
      tenderedAmount: undefined,
      referenceNumber: 'REF123',
    });
    expect(r.success).toBe(true);
  });

  it('accepts rappi with non-empty rappiOrderId', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      method: 'rappi',
      tipAmount: 0,
      tenderedAmount: undefined,
      rappiOrderId: 'R-99',
    });
    expect(r.success).toBe(true);
  });

  it('rejects cash without tenderedAmount', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      tenderedAmount: undefined,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some(i => i.path.includes('tenderedAmount'))).toBe(true);
    }
  });

  it('rejects non-cash with tenderedAmount', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      method: 'card',
      tenderedAmount: 50,
    });
    expect(r.success).toBe(false);
  });

  it('rejects rappi with missing rappiOrderId', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      method: 'rappi',
      tipAmount: 0,
      tenderedAmount: undefined,
      rappiOrderId: undefined,
    });
    expect(r.success).toBe(false);
  });

  it('rejects rappi with whitespace-only rappiOrderId', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      method: 'rappi',
      tipAmount: 0,
      tenderedAmount: undefined,
      rappiOrderId: '   ',
    });
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      amount: -1,
    });
    expect(r.success).toBe(false);
  });

  it('rejects amount not multiple of 0.01', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      amount: 10.001,
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty idempotencyKey', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      idempotencyKey: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects idempotencyKey over 255 chars', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      idempotencyKey: 'x'.repeat(256),
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid tabId', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      tabId: 'not-a-uuid',
    });
    expect(r.success).toBe(false);
  });

  it('rejects referenceNumber over 64 chars', () => {
    const r = ProcessPaymentRequestSchema.safeParse({
      ...baseValidRequest(),
      method: 'card',
      tenderedAmount: undefined,
      referenceNumber: 'r'.repeat(65),
    });
    expect(r.success).toBe(false);
  });
});

describe('callProcessPayment', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('returns SUPABASE_ERROR when invoke returns error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge unreachable' },
    });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SUPABASE_ERROR');
      expect(result.error.message).toBe('Edge unreachable');
    }
  });

  it('returns SUPABASE_ERROR when invoke error has no string message', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {},
    });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Could not reach payment service');
    }
  });

  it('returns VALIDATION_ERROR when envelope is not parseable', async () => {
    mockInvoke.mockResolvedValue({ data: { foo: 1 }, error: null });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Unexpected response from payment service');
    }
  });

  it.each([
    ['POOL_SESSION_ACTIVE', 'SESSION_STILL_RUNNING'],
    ['TAB_NOT_OPEN', 'TAB_ALREADY_CLOSED'],
    ['TAB_NOT_FOUND', 'TAB_ALREADY_CLOSED'],
    ['AMOUNT_MISMATCH', 'VALIDATION_ERROR'],
    ['TENDERED_REQUIRED', 'VALIDATION_ERROR'],
    ['INSUFFICIENT_TENDER', 'VALIDATION_ERROR'],
    ['TENDERED_NOT_ALLOWED', 'VALIDATION_ERROR'],
    ['RAPPI_ORDER_MISMATCH', 'VALIDATION_ERROR'],
    ['INVALID_METHOD', 'VALIDATION_ERROR'],
    ['VALIDATION_ERROR', 'VALIDATION_ERROR'],
    ['IDEMPOTENCY_MISMATCH', 'VALIDATION_ERROR'],
    ['FORBIDDEN', 'AUTH_FORBIDDEN'],
    ['UNAUTHORIZED', 'AUTH_REQUIRED'],
    ['UNKNOWN_RPC', 'SUPABASE_ERROR'],
  ] as const)('maps edge code %s to %s', async (edgeCode, appCode) => {
    mockInvoke.mockResolvedValue({
      data: {
        success: false,
        error: { code: edgeCode, message: 'msg' },
      },
      error: null,
    });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(appCode);
    }
  });

  it('returns success with valid envelope', async () => {
    const receipt = validReceiptData();
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        paymentId,
        receiptData: receipt,
        idempotent: true,
      },
      error: null,
    });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentId).toBe(paymentId);
      expect(result.data.receiptData.customerName).toBe('Guest');
      expect(result.data.idempotent).toBe(true);
    }
  });

  it('returns Unexpected response when receiptData fails ReceiptDataSchema at envelope parse', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        paymentId,
        receiptData: {
          ...validReceiptData(),
          items: [{ name: 'X', quantity: 0, unitPrice: 1, lineTotal: 0 }],
        },
      },
      error: null,
    });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Unexpected response from payment service');
    }
  });

  it('returns error when success true but paymentId missing', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        receiptData: validReceiptData(),
      },
      error: null,
    });

    const result = await callProcessPayment(baseValidRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SUPABASE_ERROR');
    }
  });

  it('returns VALIDATION_ERROR for invalid request before invoke', async () => {
    const result = await callProcessPayment({
      ...baseValidRequest(),
      tabId: 'bad',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid request data');
    }
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('SendReceiptEmailRequestSchema', () => {
  it('accepts valid email and plain text', () => {
    const r = SendReceiptEmailRequestSchema.safeParse({
      email: '  a@b.co  ',
      receiptPlainText: 'Receipt\nLine',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('a@b.co');
    }
  });

  it('rejects invalid email', () => {
    const r = SendReceiptEmailRequestSchema.safeParse({
      email: 'not-email',
      receiptPlainText: 'x',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty receiptPlainText', () => {
    const r = SendReceiptEmailRequestSchema.safeParse({
      email: 'a@b.co',
      receiptPlainText: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects receiptPlainText over 50_000 chars', () => {
    const r = SendReceiptEmailRequestSchema.safeParse({
      email: 'a@b.co',
      receiptPlainText: 'x'.repeat(50_001),
    });
    expect(r.success).toBe(false);
  });
});

describe('callSendReceiptEmail', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('returns VALIDATION_ERROR for invalid email without invoke', async () => {
    const result = await callSendReceiptEmail({
      email: 'bad',
      receiptPlainText: 'ok',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns SUPABASE_ERROR when invoke errors', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Network' },
    });

    const result = await callSendReceiptEmail({
      email: 'ok@example.com',
      receiptPlainText: 'body',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SUPABASE_ERROR');
    }
  });

  it('returns VALIDATION_ERROR when envelope parse fails', async () => {
    mockInvoke.mockResolvedValue({ data: 123, error: null });

    const result = await callSendReceiptEmail({
      email: 'ok@example.com',
      receiptPlainText: 'body',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Unexpected response from email service');
    }
  });

  it('returns SUPABASE_ERROR when success false', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: { code: 'RESEND_ERROR', message: 'bounce' } },
      error: null,
    });

    const result = await callSendReceiptEmail({
      email: 'ok@example.com',
      receiptPlainText: 'body',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SUPABASE_ERROR');
      expect(result.error.message).toBe('bounce');
    }
  });

  it('returns ok on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await callSendReceiptEmail({
      email: 'ok@example.com',
      receiptPlainText: 'body',
    });
    expect(result.ok).toBe(true);
  });
});
