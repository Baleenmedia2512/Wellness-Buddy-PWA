-- Migration: Add lead fields to wellness_counselling_assessments
-- Purpose: Support counselling assessments for prospective members (leads)
--          who do not yet have an app account.
--          Only name + phone are stored here — all health/diet data is
--          already captured by the counselling form's existing sections.
-- Author:   AI-assisted (Copilot) — requires @principal-eng review
-- Date:     2026-07-10

ALTER TABLE wellness_counselling_assessments
  ADD COLUMN IF NOT EXISTS lead_name  TEXT,
  ADD COLUMN IF NOT EXISTS lead_phone TEXT;

-- Index for fast look-up by phone (used by /api/counselling/lead-by-phone)
CREATE INDEX IF NOT EXISTS idx_counselling_lead_phone
  ON wellness_counselling_assessments (lead_phone)
  WHERE lead_phone IS NOT NULL AND is_deleted = false;

-- Relax the NOT NULL constraint on user_id so leads can be saved.
ALTER TABLE wellness_counselling_assessments
  ALTER COLUMN user_id DROP NOT NULL;

-- Either user_id (existing member) or lead_phone (new lead) must be present.
ALTER TABLE wellness_counselling_assessments
  ADD CONSTRAINT chk_counselling_member_or_lead
    CHECK (user_id IS NOT NULL OR lead_phone IS NOT NULL);
