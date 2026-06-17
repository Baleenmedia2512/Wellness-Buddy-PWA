-- ============================================================================
-- Migration: 0014_add_capture_share_code.sql
-- Purpose:   Add short opaque share codes for capture links so public URLs do
--            not expose UUIDs or usernames.
--
--            New behavior:
--              • captures_table."ShareCode" stores 6-10 char code
--              • /share/<ShareCode> resolves to the same capture as UUID links
--              • UUID links remain supported for backward compatibility
-- ============================================================================
-- Forward-only. To revert, write a new migration.

BEGIN;

ALTER TABLE captures_table
  ADD COLUMN IF NOT EXISTS "ShareCode" varchar(10);

-- Backfill existing rows so old captures can be shared via short code too.
-- 8 chars from UUID hex keeps generation deterministic and alphanumeric.
UPDATE captures_table
SET "ShareCode" = substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)
WHERE "ShareCode" IS NULL;

ALTER TABLE captures_table
  ALTER COLUMN "ShareCode" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_captures_share_code_format'
  ) THEN
    ALTER TABLE captures_table
      ADD CONSTRAINT chk_captures_share_code_format
      CHECK ("ShareCode" ~ '^[A-Za-z0-9]{6,10}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_captures_share_code_unique
  ON captures_table ("ShareCode");

COMMIT;
