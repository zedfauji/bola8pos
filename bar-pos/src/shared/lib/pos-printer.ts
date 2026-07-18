/**
 * Thermal receipt printing — Tauri ESC/POS on Windows, browser fallback elsewhere.
 */

import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { getCurrentLocale } from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { buildThermalReceiptText } from '@shared/lib/receipt-format';
import type { Result } from '@shared/lib/result';
import { ok, err, tauriError } from '@shared/lib/result';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Builds fully-translated (acting staff's locale) receipt lines for Rust
 * `print_receipt`, which only ESC/POS-encodes them (no label strings in Rust).
 */
export function receiptDataToPrinterLines(data: ReceiptData): string[] {
  const locale = getCurrentLocale();
  return buildThermalReceiptText(data, locale).split('\n');
}

function printReceiptWebFallback(data: ReceiptData): void {
  const text = buildThermalReceiptText(data, getCurrentLocale());
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
      await invoke('print_receipt', { lines: receiptDataToPrinterLines(data) });
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

/** Options for {@link printRawText}. */
export type PrintRawTextOptions = {
  /** When true, appends ESC/POS full-cut sequence (GS V A NUL) after the text. */
  autoCut: boolean | undefined;
};

/** ESC/POS full-cut command bytes: GS V A NUL */
const ESC_POS_FULL_CUT = '\x1d\x56\x41\x00';

/**
 * Prints arbitrary pre-formatted plain text on the thermal printer.
 * Used for pre-cheques, shift summaries, etc. where no ReceiptData is built.
 * In Tauri: invokes `print_raw_text` Rust command.
 * Browser fallback: opens a popup with the text for window.print().
 *
 * @param options.autoCut - When true, appends ESC/POS full-cut bytes after the text.
 */
export async function printRawText(
  text: string,
  options?: PrintRawTextOptions
): Promise<Result<void>> {
  const payload = options?.autoCut === true ? text + ESC_POS_FULL_CUT : text;

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('print_raw_text', { text: payload });
      return ok(undefined);
    } catch (e) {
      logger.warn('printer.raw_text.failed', { raw: String(e) });
      return err(tauriError(e instanceof Error ? e.message : 'Print failed', e));
    }
  }
  // Browser fallback: open popup with pre-formatted text
  const w = window.open('', '_blank', 'noopener,noreferrer,width=400,height=600');
  if (!w) {
    logger.warn('printer.raw_text.popup_blocked');
    return ok(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- minimal print fallback when not in Tauri
  w.document.write(
    `<!DOCTYPE html><html><head><title>Pre-cheque</title></head><body><pre style="font-family:monospace;font-size:11px;">${escapeHtml(
      text
    )}</pre><script>window.onload=function(){window.print();}</` + `script></body></html>`
  );
  w.document.close();
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
