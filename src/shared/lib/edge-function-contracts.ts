/**
 * EDGE FUNCTION CONTRACTS
 *
 * Defines request and response schemas for every Supabase Edge Function.
 * These schemas are validated with Zod on BOTH the client (before sending)
 * and server (after receiving).
 */

import { z } from 'zod';
import {
  MoneySchema,
  UuidSchema,
  TimestampSchema,
  PaymentMethodSchema,
  DiscountScopeSchema,
  DiscountTypeSchema,
} from './domain';
import { ok, err, type Result } from './result';
import { supabase, getCachedAccessToken } from './supabase';
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
  cashierName: z.string(),
  barName: z.string(),
  barAddress: z.string(),
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
  tenderedAmount: MoneySchema.nullable().optional(),
  changeAmount: MoneySchema.nullable().optional(),
  /** Terminal / BBVA receipt reference — never log raw value */
  terminalReference: z.string().max(64).nullable().optional(),
  discountAmount: MoneySchema.nullable().optional(),
  discountScope: DiscountScopeSchema.nullable().optional(),
  discountType: DiscountTypeSchema.nullable().optional(),
  discountValue: z.number().nonnegative().nullable().optional(),
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
 */
export const ProcessPaymentRequestSchema = z
  .object({
    tabId: UuidSchema,
    amount: MoneySchema,
    tipAmount: MoneySchema,
    method: PaymentMethodSchema,
    idempotencyKey: z.string().min(1).max(255),
    tenderedAmount: MoneySchema.nullable().optional(),
    referenceNumber: z.string().max(64).nullable().optional(),
    rappiOrderId: z.string().max(128).nullable().optional(),
    discountScope: DiscountScopeSchema.optional(),
    discountType: DiscountTypeSchema.optional(),
    discountValue: z.number().nonnegative().optional(),
    discountAmount: MoneySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'cash' && data.tenderedAmount == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'tenderedAmount is required for cash',
        path: ['tenderedAmount'],
      });
    }
    if (data.method !== 'cash' && data.tenderedAmount != null) {
      ctx.addIssue({
        code: 'custom',
        message: 'tenderedAmount is only valid for cash',
        path: ['tenderedAmount'],
      });
    }
    if (data.method === 'rappi' && (data.rappiOrderId == null || data.rappiOrderId.trim() === '')) {
      ctx.addIssue({
        code: 'custom',
        message: 'rappiOrderId is required for rappi',
        path: ['rappiOrderId'],
      });
    }
  });

export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentRequestSchema>;

const ProcessPaymentErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
});

/** Successful payload after {@link callProcessPayment} unwraps the edge envelope. */
export const ProcessPaymentSuccessSchema = z.object({
  paymentId: UuidSchema,
  receiptData: ReceiptDataSchema,
  idempotent: z.boolean().optional(),
});

export type ProcessPaymentSuccess = z.infer<typeof ProcessPaymentSuccessSchema>;

export const ProcessPaymentEnvelopeSchema = z.object({
  success: z.boolean(),
  paymentId: UuidSchema.optional(),
  receiptData: ReceiptDataSchema.optional(),
  idempotent: z.boolean().optional(),
  error: ProcessPaymentErrorBodySchema.optional(),
});

export type ProcessPaymentEnvelope = z.infer<typeof ProcessPaymentEnvelopeSchema>;

function mapProcessPaymentEdgeError(code: string | undefined, message: string): AppError {
  switch (code) {
    case 'POOL_SESSION_ACTIVE':
      return { code: 'SESSION_STILL_RUNNING', message };
    case 'TAB_NOT_OPEN':
    case 'TAB_NOT_FOUND':
      return { code: 'TAB_ALREADY_CLOSED', message };
    case 'AMOUNT_MISMATCH':
    case 'TENDERED_REQUIRED':
    case 'INSUFFICIENT_TENDER':
    case 'TENDERED_NOT_ALLOWED':
    case 'RAPPI_ORDER_MISMATCH':
    case 'INVALID_METHOD':
    case 'VALIDATION_ERROR':
    case 'IDEMPOTENCY_MISMATCH':
      return { code: 'VALIDATION_ERROR', message };
    case 'FORBIDDEN':
      return { code: 'AUTH_FORBIDDEN', message };
    case 'UNAUTHORIZED':
      return { code: 'AUTH_REQUIRED', message };
    default:
      return { code: 'SUPABASE_ERROR', message, details: code ?? '' };
  }
}

/**
 * Calls the process-payment edge function.
 *
 * @returns Unwrapped success payload or structured {@link AppError}.
 */
export async function callProcessPayment(
  request: ProcessPaymentRequest
): Promise<Result<ProcessPaymentSuccess, AppError>> {
  try {
    const validatedRequest = ProcessPaymentRequestSchema.parse(request);

    // supabase.functions getter creates a new FunctionsClient with static anon-key headers on
    // every access — the user JWT is never injected. Use fetch() directly with the cached token.
    // getCachedAccessToken() is populated by onAuthStateChange (set at signIn, cleared at signOut)
    // and is reliable in all environments including Playwright where getSession() can return null.
    const accessToken = getCachedAccessToken();
    if (!accessToken) {
      return err({ code: 'AUTH_REQUIRED', message: 'Not authenticated' });
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/process-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(validatedRequest),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      // Edge function envelope: { success: false, error: { code, message } }
      const edgeErr =
        data !== null && typeof data === 'object' && 'error' in data
          ? (data as { error: { code?: unknown; message?: unknown } }).error
          : null;
      const edgeCode = typeof edgeErr?.code === 'string' ? edgeErr.code : undefined;
      const edgeMsg =
        typeof edgeErr?.message === 'string'
          ? edgeErr.message
          : `Payment service error (${String(response.status)})`;
      return err(mapProcessPaymentEdgeError(edgeCode, edgeMsg));
    }

    const envelope = ProcessPaymentEnvelopeSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected response from payment service',
        details: envelope.error.message,
      });
    }

    const body = envelope.data;
    if (!body.success || body.paymentId == null || body.receiptData == null) {
      const e = body.error;
      return err(
        mapProcessPaymentEdgeError(e?.code, e?.message ?? 'Payment could not be completed.')
      );
    }

    const success = ProcessPaymentSuccessSchema.safeParse({
      paymentId: body.paymentId,
      receiptData: body.receiptData,
      idempotent: body.idempotent,
    });
    if (!success.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid receipt payload',
        details: success.error.message,
      });
    }

    return ok(success.data);
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
// SEND RECEIPT EMAIL
// ============================================================================

export const SendReceiptEmailRequestSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  receiptPlainText: z.string().min(1).max(50_000),
});

export type SendReceiptEmailRequest = z.infer<typeof SendReceiptEmailRequestSchema>;

const SendReceiptEmailErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const SendReceiptEmailEnvelopeSchema = z.object({
  success: z.boolean(),
  error: SendReceiptEmailErrorBodySchema.optional(),
});

export type SendReceiptEmailEnvelope = z.infer<typeof SendReceiptEmailEnvelopeSchema>;

/**
 * Calls the send-receipt-email edge function (Resend).
 */
export async function callSendReceiptEmail(
  request: SendReceiptEmailRequest
): Promise<Result<void, AppError>> {
  try {
    const validatedRequest = SendReceiptEmailRequestSchema.parse(request);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('send-receipt-email', {
      body: validatedRequest,
    });

    if (error) {
      const msg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Could not send receipt email';
      return err({
        code: 'SUPABASE_ERROR',
        message: msg,
        details: JSON.stringify(error),
      });
    }

    const envelope = SendReceiptEmailEnvelopeSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected response from email service',
        details: envelope.error.message,
      });
    }

    const body = envelope.data;
    if (!body.success) {
      const e = body.error;
      return err({
        code: 'SUPABASE_ERROR',
        message: e?.message ?? 'Failed to send receipt email',
        ...(e?.code != null && e.code.length > 0 ? { details: e.code } : {}),
      });
    }

    return ok(undefined);
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
// SETTINGS: RAPPI MENU SYNC
// ============================================================================

export const RappiMenuSyncResponseSchema = z.object({
  ok: z.boolean(),
  syncedAt: z.iso.datetime().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type RappiMenuSyncResponse = z.infer<typeof RappiMenuSyncResponseSchema>;

function getInvokeErrorMessage(error: unknown, fallback: string): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
    ? (error as { message: string }).message
    : fallback;
}

export async function callRappiMenuSync(): Promise<Result<{ syncedAt: string }, AppError>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('rappi-sync-menu', {
      body: {},
    });

    if (error) {
      return err({
        code: 'SUPABASE_ERROR',
        message: getInvokeErrorMessage(error, 'Could not sync Rappi menu'),
      });
    }

    const envelope = RappiMenuSyncResponseSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected response from Rappi sync function',
        details: envelope.error.message,
      });
    }

    if (!envelope.data.ok || !envelope.data.syncedAt) {
      return err({
        code: 'SUPABASE_ERROR',
        message: envelope.data.error?.message ?? 'Rappi menu sync failed',
      });
    }

    return ok({ syncedAt: envelope.data.syncedAt });
  } catch (error) {
    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

// ============================================================================
// SETTINGS: BACKUP + RESTORE
// ============================================================================

export const CreateSettingsBackupRequestSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export type CreateSettingsBackupRequest = z.infer<typeof CreateSettingsBackupRequestSchema>;

export const CreateSettingsBackupResponseSchema = z.object({
  ok: z.boolean(),
  backupId: UuidSchema.optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export async function callCreateSettingsBackup(
  request: CreateSettingsBackupRequest
): Promise<Result<{ backupId: string }, AppError>> {
  try {
    const validated = CreateSettingsBackupRequestSchema.parse(request);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('settings-backup', {
      body: validated,
    });

    if (error) {
      return err({
        code: 'SUPABASE_ERROR',
        message: getInvokeErrorMessage(error, 'Could not create backup'),
      });
    }

    const envelope = CreateSettingsBackupResponseSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected backup response',
        details: envelope.error.message,
      });
    }
    if (!envelope.data.ok || !envelope.data.backupId) {
      return err({
        code: 'SUPABASE_ERROR',
        message: envelope.data.error?.message ?? 'Backup failed',
      });
    }
    return ok({ backupId: envelope.data.backupId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid backup request',
        details: error.message,
      });
    }
    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

export const RestoreSettingsBackupRequestSchema = z.object({
  backupId: UuidSchema,
});

export type RestoreSettingsBackupRequest = z.infer<typeof RestoreSettingsBackupRequestSchema>;

export const RestoreSettingsBackupResponseSchema = z.object({
  ok: z.boolean(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export async function callRestoreSettingsBackup(
  request: RestoreSettingsBackupRequest
): Promise<Result<void, AppError>> {
  try {
    const validated = RestoreSettingsBackupRequestSchema.parse(request);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('settings-restore', {
      body: validated,
    });

    if (error) {
      return err({
        code: 'SUPABASE_ERROR',
        message: getInvokeErrorMessage(error, 'Could not restore backup'),
      });
    }

    const envelope = RestoreSettingsBackupResponseSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected restore response',
        details: envelope.error.message,
      });
    }
    if (!envelope.data.ok) {
      return err({
        code: 'SUPABASE_ERROR',
        message: envelope.data.error?.message ?? 'Restore failed',
      });
    }
    return ok(undefined);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid restore request',
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
// SETTINGS: EMAIL STATUS + TEST
// ============================================================================

export const SettingsEmailStatusResponseSchema = z.object({
  ok: z.boolean(),
  resendConfigured: z.boolean().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export async function callSettingsEmailStatus(): Promise<
  Result<{ resendConfigured: boolean }, AppError>
> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('settings-email-status', {
      body: {},
    });
    if (error) {
      return err({
        code: 'SUPABASE_ERROR',
        message: getInvokeErrorMessage(error, 'Could not check email status'),
      });
    }
    const envelope = SettingsEmailStatusResponseSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected response from email status function',
        details: envelope.error.message,
      });
    }
    if (!envelope.data.ok || envelope.data.resendConfigured == null) {
      return err({
        code: 'SUPABASE_ERROR',
        message: envelope.data.error?.message ?? 'Could not check email status',
      });
    }
    return ok({ resendConfigured: envelope.data.resendConfigured });
  } catch (error) {
    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

export const SettingsTestEmailRequestSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
});

export type SettingsTestEmailRequest = z.infer<typeof SettingsTestEmailRequestSchema>;

export const SettingsTestEmailResponseSchema = z.object({
  ok: z.boolean(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export async function callSendSettingsTestEmail(
  request: SettingsTestEmailRequest
): Promise<Result<void, AppError>> {
  try {
    const validated = SettingsTestEmailRequestSchema.parse(request);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('settings-test-email', {
      body: validated,
    });

    if (error) {
      return err({
        code: 'SUPABASE_ERROR',
        message: getInvokeErrorMessage(error, 'Could not send test email'),
      });
    }

    const envelope = SettingsTestEmailResponseSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected test email response',
        details: envelope.error.message,
      });
    }
    if (!envelope.data.ok) {
      return err({
        code: 'SUPABASE_ERROR',
        message: envelope.data.error?.message ?? 'Could not send test email',
      });
    }
    return ok(undefined);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Invalid test email request',
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
// GET SERVER TIME
// ============================================================================

/**
 * Response schema for get-server-time edge function.
 */
export const GetServerTimeResponseSchema = z.object({
  serverTime: z.string(),
});

export type GetServerTimeResponse = z.infer<typeof GetServerTimeResponseSchema>;

/**
 * Calls the get-server-time edge function.
 *
 * @returns Result with server ISO 8601 timestamp or error.
 */
export async function callGetServerTime(): Promise<Result<GetServerTimeResponse, AppError>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase.functions.invoke payload
    const { data, error } = await supabase.functions.invoke<unknown>('get-server-time', {
      body: {},
    });

    if (error) {
      return err({
        code: 'SUPABASE_ERROR',
        message: getInvokeErrorMessage(error, 'Could not fetch server time'),
      });
    }

    const envelope = GetServerTimeResponseSchema.safeParse(data);
    if (!envelope.success) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Unexpected response from get-server-time function',
        details: envelope.error.message,
      });
    }

    return ok(envelope.data);
  } catch (error) {
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
    responseSchema: ProcessPaymentEnvelopeSchema,
    caller: callProcessPayment,
  },
  'send-receipt-email': {
    requestSchema: SendReceiptEmailRequestSchema,
    responseSchema: SendReceiptEmailEnvelopeSchema,
    caller: callSendReceiptEmail,
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
  'rappi-sync-menu': {
    requestSchema: z.object({}),
    responseSchema: RappiMenuSyncResponseSchema,
    caller: callRappiMenuSync,
  },
  'settings-backup': {
    requestSchema: CreateSettingsBackupRequestSchema,
    responseSchema: CreateSettingsBackupResponseSchema,
    caller: callCreateSettingsBackup,
  },
  'settings-restore': {
    requestSchema: RestoreSettingsBackupRequestSchema,
    responseSchema: RestoreSettingsBackupResponseSchema,
    caller: callRestoreSettingsBackup,
  },
  'settings-email-status': {
    requestSchema: z.object({}),
    responseSchema: SettingsEmailStatusResponseSchema,
    caller: callSettingsEmailStatus,
  },
  'settings-test-email': {
    requestSchema: SettingsTestEmailRequestSchema,
    responseSchema: SettingsTestEmailResponseSchema,
    caller: callSendSettingsTestEmail,
  },
  'get-server-time': {
    requestSchema: z.object({}),
    responseSchema: GetServerTimeResponseSchema,
    caller: callGetServerTime,
  },
} as const;

/**
 * Type-safe edge function names.
 */
export type EdgeFunctionName = keyof typeof EDGE_FUNCTIONS;
