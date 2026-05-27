-- ============================================================================
-- Migration: link_features_to_captures.sql
-- Purpose:   Add a nullable CaptureID foreign key on every feature table that
--            persists data derived from a photo capture. Lets each feature
--            row point back to its source capture (and via the capture, to
--            its share token / image bytes).
-- Author:    [ai-assisted] tool=copilot, scope=captures
-- ============================================================================
-- Forward-only. Depends on create_captures_table.sql. Must run AFTER it.
--
-- Behavior-preserving: column is nullable, no code reads or writes it yet.
-- PR 2 (backend) starts populating CaptureID on every new save. Existing
-- rows stay NULL (intentional — they pre-date the capture model and have
-- their own legacy share columns on food_nutrition_data_table).
--
-- ON DELETE SET NULL keeps the feature row alive even if its capture is
-- purged (e.g. the daily unknown-capture cleanup). A feature row without a
-- capture is still a valid log entry; it just loses the share-link affordance.
-- ============================================================================

-- ── food (nutrition) ────────────────────────────────────────────────────────
ALTER TABLE food_nutrition_data_table
  ADD COLUMN IF NOT EXISTS "CaptureID" bigint
    REFERENCES captures_table ("ID") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_food_nutrition_capture_id
  ON food_nutrition_data_table ("CaptureID")
  WHERE "CaptureID" IS NOT NULL;

-- ── weight ─────────────────────────────────────────────────────────────────
ALTER TABLE weight_records_table
  ADD COLUMN IF NOT EXISTS "CaptureID" bigint
    REFERENCES captures_table ("ID") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weight_records_capture_id
  ON weight_records_table ("CaptureID")
  WHERE "CaptureID" IS NOT NULL;

-- ── education ──────────────────────────────────────────────────────────────
ALTER TABLE education_logs_table
  ADD COLUMN IF NOT EXISTS "CaptureID" bigint
    REFERENCES captures_table ("ID") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_education_logs_capture_id
  ON education_logs_table ("CaptureID")
  WHERE "CaptureID" IS NOT NULL;

-- ── activity / smartwatch ──────────────────────────────────────────────────
-- daily_step_activity holds aggregated step counts. A smartwatch SCREENSHOT
-- capture optionally seeds a day's row, so the FK is genuinely optional here.
ALTER TABLE daily_step_activity
  ADD COLUMN IF NOT EXISTS "CaptureID" bigint
    REFERENCES captures_table ("ID") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_step_activity_capture_id
  ON daily_step_activity ("CaptureID")
  WHERE "CaptureID" IS NOT NULL;
