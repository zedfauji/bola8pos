import { describe, expect, it } from 'vitest';
import type { ReceiptData } from './edge-function-contracts';
import type { PreChequeData } from './receipt-format';
import { buildPreChequeText, buildThermalReceiptText } from './receipt-format';

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

// ============================================================================
// buildPreChequeText
// ============================================================================

function basePreCheque(overrides: Partial<PreChequeData> = {}): PreChequeData {
  return {
    barName: 'Bola 8',
    tableLabel: 'Mesa 5',
    customerName: 'Juan',
    cashierName: 'Maria',
    happyHourActive: false,
    items: [
      {
        name: 'Cerveza',
        quantity: 2,
        lineTotal: 90,
        orderedAt: new Date('2026-04-17T18:00:00Z'),
        modifierNames: [],
        notes: null,
      },
    ],
    poolCharge: null,
    subtotal: 90,
    generatedAt: new Date('2026-04-17T20:00:00Z'),
    ...overrides,
  };
}

describe('buildPreChequeText', () => {
  it('header contains PRE-CHEQUE', () => {
    const text = buildPreChequeText(basePreCheque());
    expect(text).toContain('PRE-CHEQUE');
  });

  it('footer contains PENDIENTE DE PAGO', () => {
    const text = buildPreChequeText(basePreCheque());
    expect(text).toContain('PENDIENTE DE PAGO');
  });

  it('does not include Billar line when poolCharge is null', () => {
    const text = buildPreChequeText(basePreCheque({ poolCharge: null }));
    expect(text).not.toContain('Billar');
  });

  it('includes Billar line when poolCharge is set', () => {
    const text = buildPreChequeText(
      basePreCheque({
        poolCharge: {
          tableLabel: 'Mesa 5',
          billedMinutes: 30,
          ratePerHour: 60,
          amount: 30,
        },
        subtotal: 120,
      })
    );
    expect(text).toContain('Billar');
    expect(text).toContain('30m');
  });

  it('subtotal includes pool amount when poolCharge present', () => {
    const text = buildPreChequeText(
      basePreCheque({
        poolCharge: {
          tableLabel: 'Mesa 5',
          billedMinutes: 30,
          ratePerHour: 60,
          amount: 30,
        },
        subtotal: 120,
      })
    );
    // subtotal line should show 120.00
    expect(text).toContain('$120.00');
  });

  it('handles empty items array without crashing and still renders header/footer', () => {
    const text = buildPreChequeText(basePreCheque({ items: [], subtotal: 0 }));
    expect(text).toContain('PRE-CHEQUE');
    expect(text).toContain('PENDIENTE DE PAGO');
  });

  it('all output lines are at most 32 characters', () => {
    const text = buildPreChequeText(
      basePreCheque({
        barName: 'A very long bar name that might overflow the line',
        cashierName: 'A very long cashier name',
        customerName: 'A very long customer name',
        items: [
          {
            name: 'X'.repeat(40),
            quantity: 10,
            lineTotal: 999.99,
            orderedAt: new Date(),
            modifierNames: [],
            notes: null,
          },
        ],
      })
    );
    const lines = text.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('happyHourActive true → output contains HORA FELIZ', () => {
    const text = buildPreChequeText(basePreCheque({ happyHourActive: true }));
    expect(text).toContain('HORA FELIZ');
  });

  it('happyHourActive false → output does NOT contain HORA FELIZ', () => {
    const text = buildPreChequeText(basePreCheque({ happyHourActive: false }));
    expect(text).not.toContain('HORA FELIZ');
  });

  it('uses Bar fallback when barName is empty', () => {
    const text = buildPreChequeText(basePreCheque({ barName: '' }));
    expect(text).toContain('Bar');
  });

  it('renders item name and quantity in output', () => {
    const text = buildPreChequeText(
      basePreCheque({
        items: [
          {
            name: 'Tequila',
            quantity: 3,
            lineTotal: 150,
            orderedAt: new Date(),
            modifierNames: [],
            notes: null,
          },
        ],
      })
    );
    expect(text).toContain('Tequila');
    expect(text).toContain('3');
  });
});
