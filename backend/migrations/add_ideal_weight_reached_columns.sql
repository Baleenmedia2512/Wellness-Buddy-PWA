-- Migration: add_ideal_weight_reached_columns
-- First-time ideal BMI (19–23) milestone for Ideal Weight Report + coach email.
-- Run in Supabase SQL editor before relying on firstReachedAt / coach notify.
-- Backfill historical dates with: node --env-file=.env scripts/backfill-ideal-weight-reached.js --write
-- Removal condition: after product retires milestone tracking (unlikely); columns are additive.

ALTER TABLE team_table
  ADD COLUMN IF NOT EXISTS "IdealWeightReachedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "IdealWeightReachedNotifiedAt" timestamptz NULL;

COMMENT ON COLUMN team_table."IdealWeightReachedAt" IS
  'UTC timestamp of the member''s first weight log inside BMI 19–23 (using profile height at detection). NULL = never reached. First-reach only; not cleared on bounce-out.';
COMMENT ON COLUMN team_table."IdealWeightReachedNotifiedAt" IS
  'UTC timestamp when the sponsor (CoachId) was emailed about first ideal reach. NULL = not notified. Claim-first dedupe; backfill sets this equal to IdealWeightReachedAt to suppress historical spam.';
