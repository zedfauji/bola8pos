import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as contracts from './edge-function-contracts';
import { sendReceiptByEmail } from './email-receipt';
import * as receiptFormat from './receipt-format';
import { ok } from './result';

describe('sendReceiptByEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const receipt = {
    receiptNumber: 'R1',
    tabId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    customerName: 'Guest',
    cashierName: 'Staff',
    barName: 'Bar',
    barAddress: '',
    items: [],
    subtotal: 1,
    tipAmount: 0,
    total: 1,
    paymentMethod: 'cash' as const,
    processedAt: new Date(),
    squareReceiptUrl: null,
    tenderedAmount: 5,
    changeAmount: 4,
  };

  it('returns validation error for bad email without calling edge', async () => {
    const spy = vi.spyOn(contracts, 'callSendReceiptEmail');

    const result = await sendReceiptByEmail(receipt, 'not-email');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls edge with trimmed email and thermal plain text', async () => {
    const spy = vi.spyOn(contracts, 'callSendReceiptEmail').mockResolvedValue(ok(undefined));
    const buildSpy = vi.spyOn(receiptFormat, 'buildThermalReceiptText').mockReturnValue('PLAIN\n');

    const result = await sendReceiptByEmail(receipt, '  a@b.co  ');
    expect(result.ok).toBe(true);
    expect(buildSpy).toHaveBeenCalledWith(receipt);
    expect(spy).toHaveBeenCalledWith({
      email: 'a@b.co',
      receiptPlainText: 'PLAIN\n',
    });
  });
});
