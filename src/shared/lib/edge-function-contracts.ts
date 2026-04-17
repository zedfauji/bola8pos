/**
 * EDGE FUNCTION CONTRACTS
 *
 * Defines request and response schemas for every Supabase Edge Function.
 * These schemas are validated with Zod on BOTH the client (before sending)
 * and server (after receiving).
 */

import { z } from 'zod';
import { MoneySchema, UuidSchema, TimestampSchema, PaymentMethodSchema } from './domain';
import { ok, err, type Result } from './result';
import type { AppError } from './supabase-contracts';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

/**
 * Receipt data returned after successful payment processing.
 */
export const ReceiptDataSchema = z.object({
  receiptNumber: z.string(),
  tabId: UuidSchema,
  customerName: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: MoneySchema,
      lineTotal: MoneySchema,
    })
  ),
  subtotal: MoneySchema,
  tipAmount: MoneySchema,
  total: MoneySchema,
  paymentMethod: PaymentMethodSchema,
  processedAt: TimestampSchema,
  squareReceiptUrl: z.string().nullable(),
});

export type ReceiptData = z.infer<typeof ReceiptDataSchema>;

/**
 * Shift summary data returned after closing a shift.
 */
export const ShiftSummarySchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  totalRevenue: MoneySchema,
  totalTips: MoneySchema,
  cashTransactions: z.number().int().nonnegative(),
  cardTransactions: z.number().int().nonnegative(),
  openingCash: MoneySchema,
  closingCash: MoneySchema,
  expectedCash: MoneySchema,
  cashVariance: MoneySchema,
});

export type ShiftSummary = z.infer<typeof ShiftSummarySchema>;

/**
 * Report data schema (flexible structure for different report types).
 */
export const ReportDataSchema = z.object({
  reportType: z.enum(['daily', 'weekly']),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  summary: z.object({
    totalRevenue: MoneySchema,
    totalOrders: z.number().int().nonnegative(),
    totalTips: MoneySchema,
    averageOrderValue: MoneySchema,
  }),
  breakdown: z.object({
    byCategory: z.array(
      z.object({
        categoryName: z.string(),
        revenue: MoneySchema,
        itemsSold: z.number().int().nonnegative(),
      })
    ),
    byPaymentMethod: z.array(
      z.object({
        method: PaymentMethodSchema,
        count: z.number().int().nonnegative(),
        total: MoneySchema,
      })
    ),
    byStaff: z
      .array(
        z.object({
          staffName: z.string(),
          ordersProcessed: z.number().int().nonnegative(),
          revenue: MoneySchema,
        })
      )
      .optional(),
  }),
  poolTables: z.object({
    totalSessions: z.number().int().nonnegative(),
    totalRevenue: MoneySchema,
    averageSessionDuration: z.number().nonnegative(),
  }),
});

export type ReportData = z.infer<typeof ReportDataSchema>;

// ============================================================================
// PROCESS PAYMENT
// ============================================================================

/**
 * Request schema for process-payment edge function.
 *
 * Processes a payment for a tab, integrating with Square if card payment.
 */
export const ProcessPaymentRequestSchema = z.object({
  tabId: UuidSchema,
  amount: MoneySchema,
  tipAmount: MoneySchema,
  method: PaymentMethodSchema,
  squarePaymentId: z.string().nullable(),
  idempotencyKey: z.string().min(1),
});

export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentRequestSchema>;

/**
 * Response schema for process-payment edge function.
 */
export const ProcessPaymentResponseSchema = z.object({
  success: z.boolean(),
  paymentId: UuidSchema.optional(),
  receiptData: ReceiptDataSchema.optional(),
  error: z.string().optional(),
});

export type ProcessPaymentResponse = z.infer<typeof ProcessPaymentResponseSchema>;

/**
 * Calls the process-payment edge function.
 *
 * @param request - Payment request data
 * @returns Result with payment response or error
 *
 * @example
 * ```typescript
 * const result = await callProcessPayment({
 *   tabId: '123',
 *   amount: 50.00,
 *   tipAmount: 10.00,
 *   method: 'card',
 *   squarePaymentId: 'sq_123',
 *   idempotencyKey: 'payment_123_abc'
 * })
 *
 * if (result.ok) {
 *   console.log('Payment processed:', result.data.paymentId)
 * } else {
 *   console.error('Payment failed:', result.error.message)
 * }
 * ```
 */
export async function callProcessPayment(
  request: ProcessPaymentRequest
): Promise<Result<ProcessPaymentResponse, AppError>> {
  try {
    // Validate request
    const validatedRequest = ProcessPaymentRequestSchema.parse(request);

    // Call edge function (placeholder - will be implemented with actual Supabase client)
    const response = await fetch('/functions/v1/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      return err({
        code: 'EDGE_FUNCTION_ERROR',
        message: 'Failed to process payment',
        details: await response.text(),
      });
    }

    const data: unknown = await response.json();
    const validatedResponse = ProcessPaymentResponseSchema.parse(data);

    if (!validatedResponse.success) {
      return err({
        code: 'PAYMENT_FAILED',
        message: validatedResponse.error || 'Payment processing failed',
      });
    }

    return ok(validatedResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.message,
      });
    }

    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

// ============================================================================
// CLOSE SHIFT
// ============================================================================

/**
 * Request schema for close-shift edge function.
 *
 * Closes a staff shift and generates summary report.
 */
export const CloseShiftRequestSchema = z.object({
  shiftId: UuidSchema,
  closingCash: MoneySchema,
});

export type CloseShiftRequest = z.infer<typeof CloseShiftRequestSchema>;

/**
 * Response schema for close-shift edge function.
 */
export const CloseShiftResponseSchema = z.object({
  success: z.boolean(),
  summary: ShiftSummarySchema.optional(),
  error: z.string().optional(),
});

export type CloseShiftResponse = z.infer<typeof CloseShiftResponseSchema>;

/**
 * Calls the close-shift edge function.
 *
 * @param request - Close shift request data
 * @returns Result with shift summary or error
 *
 * @example
 * ```typescript
 * const result = await callCloseShift({
 *   shiftId: '123',
 *   closingCash: 500.00
 * })
 *
 * if (result.ok && result.data.summary) {
 *   console.log('Total revenue:', result.data.summary.totalRevenue)
 * }
 * ```
 */
export async function callCloseShift(
  request: CloseShiftRequest
): Promise<Result<CloseShiftResponse, AppError>> {
  try {
    // Validate request
    const validatedRequest = CloseShiftRequestSchema.parse(request);

    // Call edge function
    const response = await fetch('/functions/v1/close-shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      return err({
        code: 'EDGE_FUNCTION_ERROR',
        message: 'Failed to close shift',
        details: await response.text(),
      });
    }

    const data: unknown = await response.json();
    const validatedResponse = CloseShiftResponseSchema.parse(data);

    if (!validatedResponse.success) {
      return err({
        code: 'SHIFT_CLOSE_FAILED',
        message: validatedResponse.error || 'Failed to close shift',
      });
    }

    return ok(validatedResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.message,
      });
    }

    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

// ============================================================================
// GENERATE REPORT
// ============================================================================

/**
 * Request schema for generate-report edge function.
 *
 * Generates a daily or weekly report for the specified date range.
 */
export const GenerateReportRequestSchema = z.object({
  type: z.enum(['daily', 'weekly']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  staffId: UuidSchema.optional(),
});

export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;

/**
 * Response schema for generate-report edge function.
 */
export const GenerateReportResponseSchema = z.object({
  success: z.boolean(),
  data: ReportDataSchema.optional(),
  generatedAt: TimestampSchema.optional(),
  error: z.string().optional(),
});

export type GenerateReportResponse = z.infer<typeof GenerateReportResponseSchema>;

/**
 * Calls the generate-report edge function.
 *
 * @param request - Report generation request data
 * @returns Result with report data or error
 *
 * @example
 * ```typescript
 * const result = await callGenerateReport({
 *   type: 'daily',
 *   date: '2024-01-15'
 * })
 *
 * if (result.ok && result.data.data) {
 *   console.log('Total revenue:', result.data.data.summary.totalRevenue)
 * }
 * ```
 */
export async function callGenerateReport(
  request: GenerateReportRequest
): Promise<Result<GenerateReportResponse, AppError>> {
  try {
    // Validate request
    const validatedRequest = GenerateReportRequestSchema.parse(request);

    // Call edge function
    const response = await fetch('/functions/v1/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      return err({
        code: 'EDGE_FUNCTION_ERROR',
        message: 'Failed to generate report',
        details: await response.text(),
      });
    }

    const data: unknown = await response.json();
    const validatedResponse = GenerateReportResponseSchema.parse(data);

    if (!validatedResponse.success) {
      return err({
        code: 'REPORT_GENERATION_FAILED',
        message: validatedResponse.error || 'Failed to generate report',
      });
    }

    return ok(validatedResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.message,
      });
    }

    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

// ============================================================================
// VOID ORDER
// ============================================================================

/**
 * Request schema for void-order edge function.
 *
 * Voids an order and updates inventory accordingly.
 */
export const VoidOrderRequestSchema = z.object({
  orderId: UuidSchema,
  reason: z.string().min(1).max(500),
  staffId: UuidSchema,
  amount: MoneySchema.optional(),
  inventoryRestoreItems: z
    .array(
      z.object({
        orderItemId: UuidSchema,
        productId: UuidSchema,
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});

export type VoidOrderRequest = z.infer<typeof VoidOrderRequestSchema>;

/**
 * Response schema for void-order edge function.
 */
export const VoidOrderResponseSchema = z.object({
  success: z.boolean(),
  voidedAt: TimestampSchema.optional(),
  error: z.string().optional(),
});

export type VoidOrderResponse = z.infer<typeof VoidOrderResponseSchema>;

/**
 * Calls the void-order edge function.
 *
 * @param request - Void order request data
 * @returns Result with void confirmation or error
 *
 * @example
 * ```typescript
 * const result = await callVoidOrder({
 *   orderId: '123',
 *   reason: 'Customer changed mind',
 *   staffId: 'staff-456'
 * })
 *
 * if (result.ok) {
 *   console.log('Order voided successfully')
 * }
 * ```
 */
export async function callVoidOrder(
  request: VoidOrderRequest
): Promise<Result<VoidOrderResponse, AppError>> {
  try {
    // Validate request
    const validatedRequest = VoidOrderRequestSchema.parse(request);

    // Call edge function
    const response = await fetch('/functions/v1/void-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      return err({
        code: 'EDGE_FUNCTION_ERROR',
        message: 'Failed to void order',
        details: await response.text(),
      });
    }

    const data: unknown = await response.json();
    const validatedResponse = VoidOrderResponseSchema.parse(data);

    if (!validatedResponse.success) {
      return err({
        code: 'VOID_ORDER_FAILED',
        message: validatedResponse.error || 'Failed to void order',
      });
    }

    return ok(validatedResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.message,
      });
    }

    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

// ============================================================================
// EDGE FUNCTION REGISTRY
// ============================================================================

/**
 * Registry of all edge functions with their schemas.
 * Useful for documentation and validation.
 */
export const EDGE_FUNCTIONS = {
  'process-payment': {
    requestSchema: ProcessPaymentRequestSchema,
    responseSchema: ProcessPaymentResponseSchema,
    caller: callProcessPayment,
  },
  'close-shift': {
    requestSchema: CloseShiftRequestSchema,
    responseSchema: CloseShiftResponseSchema,
    caller: callCloseShift,
  },
  'generate-report': {
    requestSchema: GenerateReportRequestSchema,
    responseSchema: GenerateReportResponseSchema,
    caller: callGenerateReport,
  },
  'void-order': {
    requestSchema: VoidOrderRequestSchema,
    responseSchema: VoidOrderResponseSchema,
    caller: callVoidOrder,
  },
} as const;

/**
 * Type-safe edge function names.
 */
export type EdgeFunctionName = keyof typeof EDGE_FUNCTIONS;
