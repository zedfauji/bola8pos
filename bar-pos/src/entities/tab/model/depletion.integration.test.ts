import { describe, it } from 'vitest';

/**
 * Integration tests for Phase 4 depletion flow.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 * Filled in Plan 04-06 after full stack is implemented.
 *
 * Tests: S3b-03, S3b-04, S3b-07, S3b-10
 */
describe('Depletion integration tests (Plan 04-06)', () => {
  it.todo('add order item for product with no recipe → 0 stock_movements rows');
  it.todo('add Alitas order item → 2 stock_movements rows with correct negative deltas');
  it.todo('void Alitas order item → 2 reversal rows with reason=refund');
  it.todo('save recipe → recipe + recipe_items rows exist in DB');
  it.todo('INVENTORY_NEGATIVE raised when ingredient is out of stock');
  it.todo('manager override → order placed + audit_log row created with entity_type=tab');
});
