import { describe, expect, it } from 'vitest';

import { RAPPI_DEFAULT_TENANT_ID } from './rappi-constants';
import {
  mapWebhookToInsertRow,
  parseRappiWebhookBody,
  sumLineTotals,
} from './rappi-webhook-payload';

describe('rappi-webhook-payload', () => {
  it('parses payload and maps to insert row with computed totals', () => {
    const body = {
      order_id: 'RAPPI-778899',
      customer_name: 'María G.',
      delivery_address: 'Calle 5 #102, CDMX',
      items: [
        { name: 'Burger', quantity: 2, unit_price: 8.5 },
        { name: 'Coke', quantity: 1, unit_price: 2 },
      ],
    };

    const parsed = parseRappiWebhookBody(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const row = mapWebhookToInsertRow(parsed.data);
    expect(row.rappi_order_id).toBe('RAPPI-778899');
    expect(row.status).toBe('pending_acceptance');
    expect(row.tab_id).toBeNull();
    expect(row.customer_name).toBe('María G.');
    expect(row.delivery_address).toBe('Calle 5 #102, CDMX');
    expect(row.tenant_id).toBe(RAPPI_DEFAULT_TENANT_ID);
    expect(row.items).toEqual([
      { name: 'Burger', quantity: 2, unitPrice: 8.5 },
      { name: 'Coke', quantity: 1, unitPrice: 2 },
    ]);
    expect(row.subtotal).toBe(19);
    expect(row.rappi_total).toBe(19);
    expect(sumLineTotals(row.items)).toBe(19);
  });

  it('uses explicit subtotal and total when provided', () => {
    const body = {
      order_id: 'ORD-1',
      customer_name: '',
      delivery_address: '',
      items: [{ name: 'A', quantity: 1, unit_price: 10 }],
      subtotal: 9.99,
      total: 11.5,
    };
    const parsed = parseRappiWebhookBody(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const row = mapWebhookToInsertRow(parsed.data, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(row.customer_name).toBe('Rappi customer');
    expect(row.subtotal).toBe(9.99);
    expect(row.rappi_total).toBe(11.5);
    expect(row.tenant_id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('rejects invalid body', () => {
    const r = parseRappiWebhookBody({ order_id: '' });
    expect(r.ok).toBe(false);
  });
});
