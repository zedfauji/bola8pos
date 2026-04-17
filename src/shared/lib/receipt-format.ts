import { formatMoney } from '@shared/lib/domain-helpers';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';

const LINE = 32;

function padRight(s: string, width: number): string {
  const t = s.length > width ? s.slice(0, width) : s;
  return t + ' '.repeat(Math.max(0, width - t.length));
}

function lineLeftRight(left: string, right: string): string {
  const r = right.length >= LINE ? right.slice(-LINE) : right;
  const maxLeft = LINE - r.length;
  const l = left.length > maxLeft ? `${left.slice(0, Math.max(0, maxLeft - 1))}~` : left;
  return padRight(l, LINE - r.length) + r;
}

function centerLine(text: string): string {
  if (text.length >= LINE) return text.slice(0, LINE);
  const pad = Math.floor((LINE - text.length) / 2);
  return ' '.repeat(pad) + text + ' '.repeat(LINE - pad - text.length);
}

function divider(): string {
  return '-'.repeat(LINE);
}

function paymentMethodLabel(method: ReceiptData['paymentMethod']): string {
  if (method === 'cash') return 'Cash';
  if (method === 'card') return 'Card (BBVA Terminal)';
  return 'Rappi';
}

/** Plain text for 58mm thermal printer (32 columns). Keep aligned with Rust `commands/printer.rs`. */
export function buildThermalReceiptText(receipt: ReceiptData): string {
  const lines: string[] = [];
  const dt =
    receipt.processedAt instanceof Date
      ? receipt.processedAt
      : new Date(receipt.processedAt as unknown as string);

  lines.push(centerLine(receipt.barName || 'Bar'));
  if (receipt.barAddress) {
    const addr = receipt.barAddress;
    for (let i = 0; i < addr.length; i += LINE) {
      lines.push(padRight(addr.slice(i, i + LINE), LINE));
    }
  }
  lines.push(divider());
  lines.push(lineLeftRight('Date', dt.toLocaleString()));
  lines.push(lineLeftRight('Cashier', receipt.cashierName));
  lines.push(lineLeftRight('Customer', receipt.customerName));
  lines.push(divider());

  for (const item of receipt.items) {
    const left = `${String(item.quantity)}× ${item.name}`;
    const price = formatMoney(item.lineTotal);
    lines.push(lineLeftRight(left, price));
  }

  lines.push(divider());
  lines.push(lineLeftRight('Subtotal', formatMoney(receipt.subtotal)));
  lines.push(lineLeftRight('Tip', formatMoney(receipt.tipAmount)));
  lines.push(lineLeftRight('Total', formatMoney(receipt.total)));
  lines.push(lineLeftRight('Payment', paymentMethodLabel(receipt.paymentMethod)));

  if (receipt.paymentMethod === 'cash' && receipt.tenderedAmount != null) {
    lines.push(lineLeftRight('Tendered', formatMoney(receipt.tenderedAmount)));
    lines.push(lineLeftRight('Change', formatMoney(receipt.changeAmount ?? 0)));
  }

  if (receipt.terminalReference) {
    lines.push(lineLeftRight('Ref', receipt.terminalReference));
  }

  lines.push(divider());
  lines.push(centerLine(`#${receipt.receiptNumber}`));
  lines.push('');
  return lines.join('\n');
}
