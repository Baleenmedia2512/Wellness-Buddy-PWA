-- 0013_phone_number_unique_index.sql
-- Forward-only. Apply AFTER deduplicating team_table rows that share the same PhoneNumber.
--
-- Rollback notes (manual): DROP INDEX IF EXISTS idx_team_table_phone_number_unique;
--
-- Why: mobile login must treat PhoneNumber as unique identity. Existing duplicate
-- rows (from E.164 vs 10-digit mismatch) must be merged/deleted before this index
-- can be created.

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_table_phone_number_unique
  ON team_table ("PhoneNumber")
  WHERE "PhoneNumber" IS NOT NULL AND TRIM("PhoneNumber") <> '';
