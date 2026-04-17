import { describe, expect, it } from 'vitest';
import type { ReceiptData } from './edge-function-contracts';
import { buildThermalReceiptText } from './receipt-format';

function baseReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    receiptNumber: 'R1',
    tabId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    customerName: 'Ana',
    cashierName: 'Luis',
    barName: 'Bola 8',
    barAddress: 'Av. Revolución 123, CDMX',
    items: [{ name: 'Cerveza', quantity: 2, unitPrice: 45, lineTotal: 90 }],
    subtotal: 90,
    tipAmount: 13.5,
    total: 103.5,
    paymentMethod: 'cash',
    processedAt: new Date('2026-04-17T18:00:00.000Z'),
    squareReceiptUrl: null,
    tenderedAmount: 200,
    changeAmount: 96.5,
    ...overrides,
  };
}

describe('buildThermalReceiptText', () => {
  it('centers bar name and uses Bar fallback when barName empty', () => {
    const firstLine = buildThermalReceiptText(baseReceipt({ barName: '' })).split('\n')[0];
    expect(firstLine?.trim()).toBe('Bar');
    expect(firstLine?.length).toBe(32);
  });

  it('wraps long barAddress in 32-char chunks', () => {
    const addr = 'A'.repeat(70);
    const text = buildThermalReceiptText(baseReceipt({ barAddress: addr }));
    expect(text).toContain('A'.repeat(32));
    expect(text).toContain('A'.repeat(6));
  });

  it('labels card as BBVA terminal', () => {
    const text = buildThermalReceiptText(
      baseReceipt({
        paymentMethod: 'card',
        tenderedAmount: null,
        changeAmount: null,
      })
    );
    expect(text).toContain('Card (BBVA Terminal)');
  });

  it('labels Rappi payment', () => {
    const text = buildThermalReceiptText(
      baseReceipt({
        paymentMethod: 'rappi',
        tipAmount: 0,
        total: 90,
        tenderedAmount: null,
        changeAmount: null,
      })
    );
    expect(text).toContain('Rappi');
  });

  it('shows tendered and change for cash when tenderedAmount set', () => {
    const text = buildThermalReceiptText(baseReceipt());
    expect(text).toContain('Tendered');
    expect(text).toContain('Change');
    expect(text).toContain('$200.00');
    expect(text).toContain('$96.50');
  });

  it('shows terminal reference when set', () => {
    const text = buildThermalReceiptText(
      baseReceipt({
        paymentMethod: 'card',
        tenderedAmount: null,
        changeAmount: null,
        terminalReference: 'BBVA-99',
      })
    );
    expect(text).toContain('Ref');
    expect(text).toContain('BBVA-99');
  });

  it('accepts processedAt as ISO string', () => {
    const text = buildThermalReceiptText(
      baseReceipt({
        processedAt: '2026-01-15T12:30:00.000Z' as unknown as Date,
      })
    );
    expect(text).toContain('Date');
  });

  it('truncates long item name with tilde on left column', () => {
    const longName = 'X'.repeat(40);
    const text = buildThermalReceiptText(
      baseReceipt({
        items: [{ name: longName, quantity: 1, unitPrice: 1, lineTotal: 1 }],
        subtotal: 1,
        tipAmount: 0,
        total: 1,
        tenderedAmount: 5,
        changeAmount: 4,
      })
    );
    expect(text).toContain('~');
  });

  it('includes receipt number footer', () => {
    const text = buildThermalReceiptText(baseReceipt({ receiptNumber: 'ABCD12' }));
    expect(text).toContain('#ABCD12');
  });
});
