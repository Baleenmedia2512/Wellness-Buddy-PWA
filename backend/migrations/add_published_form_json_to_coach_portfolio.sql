-- Migration: add_published_form_json_to_coach_portfolio
-- Draft FormJson can change via Save; live /coach pages read PublishedFormJson.
-- Publish + coach OTP copies FormJson → PublishedFormJson.
--
-- Run ONCE. Forward-only.

ALTER TABLE coach_portfolio_submissions_table
  ADD COLUMN IF NOT EXISTS PublishedFormJson LONGTEXT NULL AFTER FormJson;

-- Existing live sites: snapshot current FormJson as the published copy.
UPDATE coach_portfolio_submissions_table
SET PublishedFormJson = FormJson
WHERE IsPublished = 1
  AND (PublishedFormJson IS NULL OR PublishedFormJson = '');
