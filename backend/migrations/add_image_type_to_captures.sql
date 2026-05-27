-- ============================================================================
-- Migration: add_image_type_to_captures.sql
-- Purpose:   Add ImageType column to food_nutrition_data_table so that the
--            deep-link resolve endpoint can route share links to the correct
--            dashboard tab (nutrition / weight / education).
-- Author:    [ai-assisted] tool=copilot, scope=background-analysis
-- ============================================================================
-- Forward-only. To revert, write a new migration that drops the column.
--
-- Valid runtime values:
--   'food'       — confirmed food capture (nutrition analysis saved)
--   'weight'     — weight-scale capture (data saved to weight table)
--   'education'  — meeting/education screenshot (data saved to education table)
--   'smartwatch' — fitness tracker screenshot (data saved to activity table)
--   'pending'    — transient state: AI analysis not yet complete.
--                  New rows always start as 'pending' (set in insertPendingCapture).
--                  Promoted to the correct type once analysis resolves.
--                  The listAnalyses query filters ImageType='food', so
--                  'pending' rows never appear in the nutrition dashboard.
--
-- DEFAULT 'food' is for backward compat only — it applies to rows that already
-- existed before this column was added (genuine food captures created before
-- the instant-share feature). All new rows are explicitly set to 'pending'.
-- ============================================================================

ALTER TABLE food_nutrition_data_table
  ADD COLUMN IF NOT EXISTS "ImageType" varchar(20) NOT NULL DEFAULT 'food';

-- Optional index — only needed if you query / filter by ImageType at scale.
-- CREATE INDEX IF NOT EXISTS idx_food_nutrition_image_type
--   ON food_nutrition_data_table ("ImageType");

