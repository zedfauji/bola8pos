/** Migration `20260417100000_rappi_orders.sql` — product used as anchor for each Rappi line in `create_order_with_items`. */
export const RAPPI_LINE_ITEM_PRODUCT_ID = 'a0000002-0000-4000-8000-000000000002';

/** Default single-venue tenant in DB; override via `RAPPI_TENANT_ID` in Edge. */
export const RAPPI_DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
