/**
 * Thermal receipt printing — Tauri ESC/POS on Windows, browser fallback elsewhere.
 */

import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { logger } from '@shared/lib/logger-instance';
import { buildThermalReceiptText } from '@shared/lib/receipt-format';
import type { Result } from '@shared/lib/result';
import { ok, err, tauriError } from '@shared/lib/result';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/** Maps app receipt to JSON consumed by Rust `print_receipt`. */
export function receiptDataToPrinterJson(data: ReceiptData): string {
  const dt =
    data.processedAt instanceof Date
      ? data.processedAt
      : new Date(data.processedAt as unknown as string);
  const processedAt = dt.toLocaleString();
  const payload = {
    barName: data.barName,
    barAddress: data.barAddress,
    receiptNumber: data.receiptNumber,
    customerName: data.customerName,
    cashierName: data.cashierName,
    processedAt,
    items: data.items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: data.subtotal,
    tipAmount: data.tipAmount,
    total: data.total,
    paymentMethod: data.paymentMethod,
    tenderedAmount: data.tenderedAmount ?? null,
    changeAmount: data.changeAmount ?? null,
    terminalReference: data.terminalReference ?? null,
    footerText: null as string | null,
  };
  return JSON.stringify(payload);
}

function printReceiptWebFallback(data: ReceiptData): void {
  const text = buildThermalReceiptText(data);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=400,height=600');
  if (!w) {
    logger.warn('printer.web.fallback', { reason: 'popup_blocked' });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- minimal print fallback when not in Tauri
  w.document.write(
    `<!DOCTYPE html><html><head><title>Receipt</title></head><body><pre style="font-family:monospace;font-size:11px;">${escapeHtml(
      text
    )}</pre><script>window.onload=function(){window.print();}</script></body></html>`
  );
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function printReceipt(data: ReceiptData): Promise<Result<void>> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('print_receipt', { receiptJson: receiptDataToPrinterJson(data) });
      return ok(undefined);
    } catch (e) {
      logger.warn('printer.receipt.failed', { raw: String(e) });
      return err(tauriError(e instanceof Error ? e.message : 'Print failed', e));
    }
  }
  logger.info('printer.receipt.web_fallback', { receiptNumber: data.receiptNumber });
  printReceiptWebFallback(data);
  return ok(undefined);
}

export async function openCashDrawer(): Promise<Result<void>> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_cash_drawer');
      return ok(undefined);
    } catch (e) {
      return err(tauriError(e instanceof Error ? e.message : 'Could not open cash drawer', e));
    }
  }
  window.alert('Cash drawer is only available when the POS runs in the desktop app (Tauri).');
  return ok(undefined);
}

export async function testPrint(): Promise<Result<void>> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('test_print');
      return ok(undefined);
    } catch (e) {
      return err(tauriError(e instanceof Error ? e.message : 'Test print failed', e));
    }
  }
  window.alert('Test print is only available in the desktop app (Tauri).');
  return err(tauriError('Test print requires the Tauri desktop app.'));
}
