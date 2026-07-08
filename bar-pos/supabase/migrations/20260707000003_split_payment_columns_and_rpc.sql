-- =============================================================================
-- Phase 18 Plan 02: Split payment columns + atomic multi-leg RPC (D-08/D-10)
--
-- Adds the backend heart of split payment (multi-method checkout, up to 4
-- legs per tab close):
--
--   1. payments.payment_group_id (UUID) + payments.split_index (SMALLINT,
--      CHECK 0-3) — tags which rows belong to one atomic split checkout.
--      Both nullable, no backfill (D-11: single-method rows keep working
--      with NULL group/index — 18-RESEARCH.md discretion resolution).
--
--   2. process_split_payment_atomic(...) — a new PL/pgSQL RPC (added by
--      Task 2 below) that inserts 1-4 payment rows in ONE transaction,
--      validates the leg sum against the client-computed total (D-05,
--      ±0.01), and closes the tab all-or-nothing (D-08).
--
-- D-10 note: CONTEXT.md's instruction to "drop the UNIQUE(tab_id) constraint"
-- is STALE — that constraint (payments_tab_id_key) was already dropped by
-- 20260424000005_payments_constraint.sql (S1-05). This migration does NOT
-- touch it.
--
-- The migration is NOT pushed by this plan — the BLOCKING push happens in
-- Plan 18-03.
-- =============================================================================

-- UP:
BEGIN;

-- -----------------------------------------------------------------------
-- 1. payments.payment_group_id + payments.split_index (SC-1)
-- -----------------------------------------------------------------------
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_group_id UUID,
  ADD COLUMN IF NOT EXISTS split_index SMALLINT CHECK (split_index >= 0 AND split_index <= 3);

CREATE INDEX IF NOT EXISTS idx_payments_payment_group_id
  ON payments(payment_group_id) WHERE payment_group_id IS NOT NULL;

-- Prevents duplicate split_index within one group (defense in depth —
-- process_split_payment_atomic already assigns indices 0..N-1 deterministically).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_group_split_unique
  ON payments(payment_group_id, split_index) WHERE payment_group_id IS NOT NULL;

COMMIT;

-- =============================================================================
-- DOWN:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_payments_group_split_unique;
-- DROP INDEX IF EXISTS idx_payments_payment_group_id;
-- ALTER TABLE payments DROP COLUMN IF EXISTS split_index;
-- ALTER TABLE payments DROP COLUMN IF EXISTS payment_group_id;
-- COMMIT;
-- =============================================================================
