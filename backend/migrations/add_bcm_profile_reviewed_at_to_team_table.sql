-- Migration: add_bcm_profile_reviewed_at_to_team_table
-- Persists BCM/BPC "Complete Profile reviewed" so APK reinstall does not re-show
-- the review gate when localStorage bcmProfileReviewed_* was wiped.
-- Run in Supabase SQL editor before relying on bcmProfileReviewed in GET /api/user/profile.

ALTER TABLE team_table
  ADD COLUMN IF NOT EXISTS "BcmProfileReviewedAt" timestamptz NULL;

COMMENT ON COLUMN team_table."BcmProfileReviewedAt" IS
  'UTC timestamp when the member confirmed Complete Profile (BCM/BPC review). NULL = not yet reviewed on this account. Survives app reinstall; localStorage is only a cache.';

-- Existing accounts that already saved core profile fields have effectively reviewed.
-- Fresh Body Parameters Card leads with only card prefills (placeholder name and/or
-- missing diet/gender/height) stay NULL until they save Complete Profile once.
UPDATE team_table
SET "BcmProfileReviewedAt" = COALESCE("LastActiveAt", NOW())
WHERE "BcmProfileReviewedAt" IS NULL
  AND "UserName" IS NOT NULL
  AND TRIM("UserName") <> ''
  AND "UserName" !~* '^user_[0-9]+$'
  AND "Height" IS NOT NULL
  AND "Height"::numeric BETWEEN 50 AND 250
  AND "DietType" IS NOT NULL
  AND TRIM("DietType") <> ''
  AND "Gender" IN ('Male', 'Female');
