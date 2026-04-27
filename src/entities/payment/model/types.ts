import { z } from 'zod';

// =====================================================
// PAYMENT SCHEMA
// =====================================================

export const PaymentSchema = z.object({
  id: z.uuid(),
  tabId: z.uuid(),
  amount: z.number().min(0),
  tipAmount: z.number().min(0),
  method: z.enum(['cash', 'card', 'rappi']),
  squarePaymentId: z.string().nullable(),
  squareReceiptUrl: z.url().nullable(),
  tenderedAmount: z.number().min(0).nullable().optional(),
  referenceNumber: z.string().max(64).nullable().optional(),
  idempotencyKey: z.string().min(1).max(255).nullable().optional(),
  processedAt: z.date(),
  processedBy: z.uuid(),
  isRefund: z.boolean().optional(),
  refundId: z.uuid().nullable().optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentSchema = PaymentSchema.omit({
  id: true,
  processedAt: true,
});

export type CreatePayment = z.infer<typeof CreatePaymentSchema>;

export const UpdatePaymentSchema = PaymentSchema.partial().required({ id: true });

export type UpdatePayment = z.infer<typeof UpdatePaymentSchema>;

// =====================================================
// MOCK DATA
// =====================================================

const mockTabId1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const mockTabId2 = '88888888-8888-8888-8888-888888888888';
const mockTabId3 = '99999999-9999-9999-9999-999999999999';
const mockStaffId = '11111111-1111-1111-1111-111111111111';

export const mockPayments: Payment[] = [
  {
    id: 'cccccccc-3333-4444-5555-666666666666',
    tabId: mockTabId1,
    amount: 45.5,
    tipAmount: 9.0,
    method: 'card',
    squarePaymentId: 'sq_pay_abc123xyz789',
    squareReceiptUrl: 'https://squareup.com/receipt/preview/abc123xyz789',
    idempotencyKey: 'legacy_cccccccc',
    processedAt: new Date('2025-01-15T21:00:00Z'),
    processedBy: mockStaffId,
  },
  {
    id: 'dddddddd-4444-5555-6666-777777777777',
    tabId: mockTabId2,
    amount: 32.0,
    tipAmount: 5.0,
    method: 'cash',
    squarePaymentId: null,
    squareReceiptUrl: null,
    tenderedAmount: 40,
    idempotencyKey: 'legacy_dddddddd',
    processedAt: new Date('2025-01-15T19:45:00Z'),
    processedBy: mockStaffId,
  },
  {
    id: 'eeeeeeee-5555-6666-7777-888888888888',
    tabId: mockTabId3,
    amount: 67.25,
    tipAmount: 12.75,
    method: 'card',
    squarePaymentId: 'sq_pay_def456uvw012',
    squareReceiptUrl: 'https://squareup.com/receipt/preview/def456uvw012',
    idempotencyKey: 'legacy_eeeeeeee',
    processedAt: new Date('2025-01-15T22:30:00Z'),
    processedBy: mockStaffId,
  },
];
