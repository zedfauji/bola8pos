import { invoke } from '@tauri-apps/api/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptData } from './edge-function-contracts';
import { openCashDrawer, printReceipt, receiptDataToPrinterJson, testPrint } from './pos-printer';

function sampleReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    receiptNumber: 'R1',
    tabId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    customerName: 'Guest',
    cashierName: 'Staff',
    barName: 'Bar',
    barAddress: '1 St',
    items: [{ name: 'Item', quantity: 1, unitPrice: 5, lineTotal: 5 }],
    subtotal: 5,
    tipAmount: 0,
    total: 5,
    paymentMethod: 'cash',
    processedAt: new Date('2026-04-17T10:00:00.000Z'),
    squareReceiptUrl: null,
    tenderedAmount: 10,
    changeAmount: 5,
    ...overrides,
  };
}

describe('receiptDataToPrinterJson', () => {
  it('serializes receipt fields for Rust print_receipt', () => {
    const data = sampleReceipt();
    const json = receiptDataToPrinterJson(data);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.barName).toBe('Bar');
    expect(parsed.receiptNumber).toBe('R1');
    expect(parsed.footerText).toBeNull();
    expect(parsed.tenderedAmount).toBe(10);
    expect(parsed.changeAmount).toBe(5);
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(typeof parsed.processedAt).toBe('string');
  });

  it('coerces processedAt from ISO string to locale string', () => {
    const json = receiptDataToPrinterJson(
      sampleReceipt({
        processedAt: '2026-06-01T15:30:00.000Z' as unknown as Date,
      })
    );
    const parsed = JSON.parse(json) as { processedAt: string };
    expect(parsed.processedAt.length).toBeGreaterThan(0);
  });

  it('uses null for optional amounts when absent', () => {
    const json = receiptDataToPrinterJson(
      sampleReceipt({
        paymentMethod: 'card',
        tenderedAmount: null,
        changeAmount: null,
        terminalReference: undefined,
      })
    );
    const parsed = JSON.parse(json) as {
      tenderedAmount: null;
      changeAmount: null;
      terminalReference: null;
    };
    expect(parsed.tenderedAmount).toBeNull();
    expect(parsed.changeAmount).toBeNull();
    expect(parsed.terminalReference).toBeNull();
  });
});

describe('printReceipt', () => {
  const originalOpen = window.open;
  const originalAlert = window.alert;

  beforeEach(() => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.open = originalOpen;
    window.alert = originalAlert;
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  it('uses web fallback when not Tauri and window.open succeeds', async () => {
    const write = vi.fn();
    const close = vi.fn();
    window.open = vi.fn().mockReturnValue({
      document: { write, close },
    });

    const result = await printReceipt(sampleReceipt());
    expect(result.ok).toBe(true);
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('returns ok when popup blocked in web fallback', async () => {
    window.open = vi.fn().mockReturnValue(null);

    const result = await printReceipt(sampleReceipt());
    expect(result.ok).toBe(true);
  });

  it('invokes print_receipt in Tauri and returns ok', async () => {
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = {};

    const result = await printReceipt(sampleReceipt());
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'print_receipt',
      expect.objectContaining({ receiptJson: expect.any(String) })
    );
  });

  it('returns tauriError when invoke throws in Tauri', async () => {
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = {};
    vi.mocked(invoke).mockRejectedValue(new Error('Printer offline'));

    const result = await printReceipt(sampleReceipt());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TAURI_ERROR');
      expect(result.error.message).toContain('Printer offline');
    }
  });
});

describe('openCashDrawer', () => {
  const originalAlert = window.alert;

  beforeEach(() => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
    window.alert = vi.fn();
  });

  afterEach(() => {
    window.alert = originalAlert;
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  it('shows alert and returns ok when not Tauri', async () => {
    const result = await openCashDrawer();
    expect(result.ok).toBe(true);
    expect(window.alert).toHaveBeenCalledWith(
      'Cash drawer is only available when the POS runs in the desktop app (Tauri).'
    );
  });

  it('invokes open_cash_drawer in Tauri', async () => {
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = {};
    const result = await openCashDrawer();
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_cash_drawer');
  });

  it('returns err when invoke fails in Tauri', async () => {
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = {};
    vi.mocked(invoke).mockRejectedValue(new Error('drawer jam'));

    const result = await openCashDrawer();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TAURI_ERROR');
    }
  });
});

describe('testPrint', () => {
  const originalAlert = window.alert;

  beforeEach(() => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
    window.alert = vi.fn();
  });

  afterEach(() => {
    window.alert = originalAlert;
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  it('returns err when not in Tauri', async () => {
    const result = await testPrint();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('desktop app');
    }
    expect(window.alert).toHaveBeenCalled();
  });

  it('invokes test_print in Tauri', async () => {
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = {};
    const result = await testPrint();
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('test_print');
  });
});
