import { callSendReceiptEmail, type ReceiptData } from '@shared/lib/edge-function-contracts';
import { ReceiptEmailSchema } from '@shared/lib/email-schema';
import { buildThermalReceiptText } from '@shared/lib/receipt-format';
import type { Result } from '@shared/lib/result';
import { err } from '@shared/lib/result';
import type { AppError } from '@shared/lib/supabase-contracts';

/**
 * Sends the plain-text receipt (same layout as print preview) via Resend (edge function).
 */
export async function sendReceiptByEmail(
  data: ReceiptData,
  email: string
): Promise<Result<void, AppError>> {
  const parsed = ReceiptEmailSchema.safeParse(email);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Enter a valid email address';
    return err({ code: 'VALIDATION_ERROR', message: msg });
  }

  return callSendReceiptEmail({
    email: parsed.data,
    receiptPlainText: buildThermalReceiptText(data),
  });
}
