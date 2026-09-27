-- Migration: add_ideal_weight_reached_columns_to_team_table
-- First time a member's weight entered BMI 19–23 (ideal band), plus coach notify dedupe.
-- Run in Supabase SQL editor before relying on Ideal Weight "reached date" / coach email.
-- After migrate, run: node --env-file=.env scripts/backfill-ideal-weight-reached.js --write
-- (backfill stamps dates without emailing coaches for historical reaches).

ALTER TABLE team_table
  ADD COLUMN IF NOT EXISTS "IdealWeightReachedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "IdealWeightReachedNotifiedAt" timestamptz NULL;

COMMENT ON COLUMN team_table."IdealWeightReachedAt" IS
  'UTC timestamp of the first non-deleted weight log that fell within BMI 19–23 for current Height; NULL = never reached (or not yet backfilled). Immutable once set.';
COMMENT ON COLUMN team_table."IdealWeightReachedNotifiedAt" IS
  'UTC timestamp when the direct sponsor (CoachId) was emailed about first ideal reach; NULL = not notified. Claim-first dedupe for concurrent saves.';

CREATE INDEX IF NOT EXISTS idx_team_ideal_weight_reached_at
  ON team_table ("IdealWeightReachedAt")
  WHERE "IdealWeightReachedAt" IS NOT NULL;
