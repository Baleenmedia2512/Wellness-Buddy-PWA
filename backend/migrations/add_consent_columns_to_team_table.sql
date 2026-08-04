-- Migration: add_consent_columns_to_team_table
-- Run in Supabase SQL editor before enabling ff.consent-gate in production.
-- Stores binding acceptance of the Wellness Valley User Consent Form + audit meta.

ALTER TABLE team_table
  ADD COLUMN IF NOT EXISTS "ConsentAcceptedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "ConsentVersion" text NULL,
  ADD COLUMN IF NOT EXISTS "ConsentIpAddress" text NULL,
  ADD COLUMN IF NOT EXISTS "ConsentDeviceInfo" text NULL;

COMMENT ON COLUMN team_table."ConsentAcceptedAt" IS
  'UTC timestamp when the user accepted the User Consent Form; NULL = not accepted.';
COMMENT ON COLUMN team_table."ConsentVersion" IS
  'Version string of the consent form accepted (e.g. 2026-07-31).';
COMMENT ON COLUMN team_table."ConsentIpAddress" IS
  'Client IP at consent acceptance (from proxy headers / socket; audit only).';
COMMENT ON COLUMN team_table."ConsentDeviceInfo" IS
  'Device / platform / User-Agent snapshot at consent acceptance (audit only).';
