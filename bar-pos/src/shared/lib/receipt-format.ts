import type { Locale } from '@shared/lib/domain';
import { formatMoney } from '@shared/lib/domain-helpers';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { formatModifierLines, groupByCategory } from '@shared/lib/groupOrderItemsForReceipt';
import i18n from '@shared/lib/i18n';

const LINE = 32;

// WR-02: `printer.rs` sends `line.as_bytes()` — raw UTF-8 bytes — with no
// codepage transcoding, so column math here must be measured in UTF-8 bytes,
// not UTF-16 code units (`.length`), or accented/multi-byte characters (e.g.
// `★`, `á/é/í/ó/ú/ñ`) silently misalign the physical receipt.
function byteWidth(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Truncates by whole characters until `s` fits within `width` UTF-8 bytes — never splits a multi-byte character. */
function truncateToByteWidth(s: string, width: number): string {
  if (byteWidth(s) <= width) return s;
  let out = '';
  let w = 0;
  for (const ch of s) {
    const cw = byteWidth(ch);
    if (w + cw > width) break;
    out += ch;
    w += cw;
  }
  return out;
}

/** Same as {@link truncateToByteWidth} but keeps the trailing bytes (mirrors the old `.slice(-width)`). */
function truncateFromEndToByteWidth(s: string, width: number): string {
  if (byteWidth(s) <= width) return s;
  let out = '';
  let w = 0;
  for (const ch of Array.from(s).reverse()) {
    const cw = byteWidth(ch);
    if (w + cw > width) break;
    out = ch + out;
    w += cw;
  }
  return out;
}

function padRight(s: string, width: number): string {
  const t = truncateToByteWidth(s, width);
  return t + ' '.repeat(Math.max(0, width - byteWidth(t)));
}

function lineLeftRight(left: string, right: string): string {
  const r = byteWidth(right) >= LINE ? truncateFromEndToByteWidth(right, LINE) : right;
  const maxLeft = LINE - byteWidth(r);
  const l =
    byteWidth(left) > maxLeft
      ? `${truncateToByteWidth(left, Math.max(0, maxLeft - 1))}~`
      : left;
  return padRight(l, LINE - byteWidth(r)) + r;
}

function centerLine(text: string): string {
  const tw = byteWidth(text);
  if (tw >= LINE) return truncateToByteWidth(text, LINE);
  const pad = Math.floor((LINE - tw) / 2);
  return ' '.repeat(pad) + text + ' '.repeat(LINE - pad - tw);
}

function divider(): string {
  return '-'.repeat(LINE);
}

/** Resolves a locale-scoped translator for the `receipt` catalog namespace. */
function receiptT(locale: Locale) {
  return i18n.getFixedT(locale, 'receipt');
}

function paymentMethodLabel(method: ReceiptData['paymentMethod'], locale: Locale): string {
  const tr = receiptT(locale);
  if (method === 'cash') return tr('receipt.method.cash');
  if (method === 'card') return tr('receipt.method.card');
  return tr('receipt.method.rappi');
}

// ============================================================================
// PRE-CHEQUE
// ============================================================================

export type PreChequeData = {
  barName: string;
  tableLabel: string;
  customerName: string;
  cashierName: string;
  happyHourActive: boolean;
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: number;
    orderedAt: Date;
    modifierNames: string[];
    notes: string | null;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  poolCharge: {
    tableLabel: string;
    billedMinutes: number;
    ratePerHour: number;
    amount: number;
  } | null;
  subtotal: number;
  generatedAt: Date;
};

/** Pre-cheque for 58mm thermal printer (32 columns). Shows balance due before final payment. */
export function buildPreChequeText(data: PreChequeData, locale: Locale): string {
  const tr = receiptT(locale);
  const lines: string[] = [];

  lines.push(centerLine(data.barName || 'Bar'));
  lines.push(centerLine(tr('precheque.title')));
  lines.push(centerLine(tr('precheque.subtitle')));
  lines.push(divider());
  lines.push(lineLeftRight(tr('precheque.date'), data.generatedAt.toLocaleString(locale)));
  lines.push(lineLeftRight(tr('precheque.cashier'), data.cashierName));
  lines.push(lineLeftRight(tr('precheque.customer'), data.customerName));
  lines.push(lineLeftRight(tr('precheque.table'), data.tableLabel));
  if (data.happyHourActive) {
    lines.push(centerLine(tr('precheque.happyHour')));
  }
  lines.push(divider());

  const preChequeGroups = groupByCategory(data.items);
  for (const group of preChequeGroups) {
    if (preChequeGroups.length > 1) {
      lines.push(centerLine(group.categoryName ?? tr('receipt.category.other')));
    }
    for (const item of group.items) {
      const left = `${String(item.quantity)}× ${item.name}`;
      lines.push(lineLeftRight(left, formatMoney(item.lineTotal)));
      lines.push(...formatModifierLines(item.modifierNames));
      if (item.notes) {
        lines.push(`  ${tr('precheque.note')}: ${item.notes}`);
      }
    }
  }

  if (data.poolCharge !== null) {
    lines.push(divider());
    const label = `${tr('precheque.pool')} ${String(data.poolCharge.billedMinutes)}m @ $${String(data.poolCharge.ratePerHour)}/h`;
    lines.push(lineLeftRight(label, formatMoney(data.poolCharge.amount)));
  }

  lines.push(divider());
  lines.push(lineLeftRight(tr('precheque.subtotal'), formatMoney(data.subtotal)));
  lines.push('');
  lines.push(centerLine(tr('precheque.pending')));
  lines.push('');

  return lines.join('\n');
}

/** Plain text for 58mm thermal printer (32 columns). Keep aligned with Rust `commands/printer.rs` ESC/POS encoder. */
export function buildThermalReceiptText(receipt: ReceiptData, locale: Locale): string {
  const tr = receiptT(locale);
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
  lines.push(lineLeftRight(tr('receipt.date'), dt.toLocaleString(locale)));
  lines.push(lineLeftRight(tr('receipt.cashier'), receipt.cashierName));
  lines.push(lineLeftRight(tr('receipt.customer'), receipt.customerName));
  lines.push(divider());

  const groups = groupByCategory(receipt.items);
  for (const group of groups) {
    if (groups.length > 1) {
      lines.push(centerLine(group.categoryName ?? tr('receipt.category.other')));
    }
    for (const item of group.items) {
      const left = `${String(item.quantity)}× ${item.name}`;
      const price = formatMoney(item.lineTotal);
      lines.push(lineLeftRight(left, price));
      lines.push(...formatModifierLines(item.modifierNames ?? []));
    }
  }

  lines.push(divider());
  lines.push(lineLeftRight(tr('receipt.subtotal'), formatMoney(receipt.subtotal)));
  lines.push(lineLeftRight(tr('receipt.tip'), formatMoney(receipt.tipAmount)));
  lines.push(lineLeftRight(tr('receipt.total'), formatMoney(receipt.total)));
  lines.push(lineLeftRight(tr('receipt.payment'), paymentMethodLabel(receipt.paymentMethod, locale)));

  if (receipt.paymentMethod === 'cash' && receipt.tenderedAmount != null) {
    lines.push(lineLeftRight(tr('receipt.tendered'), formatMoney(receipt.tenderedAmount)));
    lines.push(lineLeftRight(tr('receipt.change'), formatMoney(receipt.changeAmount ?? 0)));
  }

  if (receipt.terminalReference) {
    lines.push(lineLeftRight(tr('receipt.ref'), receipt.terminalReference));
  }

  lines.push(divider());
  lines.push(centerLine(`#${receipt.receiptNumber}`));
  lines.push('');
  return lines.join('\n');
}
