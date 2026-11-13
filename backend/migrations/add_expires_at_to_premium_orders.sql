-- Premium is a 30-day plan. Existing paid members get 30 days from migrate time.
-- Safe to re-run: ADD COLUMN may error if already present; backfill only fills NULLs.

ALTER TABLE premium_orders_table
  ADD COLUMN ExpiresAt DATETIME NULL AFTER PaidAt;

UPDATE premium_orders_table
SET ExpiresAt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY)
WHERE Status = 'paid' AND ExpiresAt IS NULL;
