-- ============================================================================
-- Migration: add_quick_share_public_token.sql
-- Purpose:   Add public-share token + expiry columns to the existing
--            food_nutrition_data_table so quick-share can produce a
--            recipient-viewable URL without a new table.
-- Author:    [ai-assisted] tool=copilot, scope=quick-share
-- ============================================================================
-- Forward-only. To revert, write a new migration that drops these columns.
-- Backward-compatible: both columns are nullable and ignored by every existing
-- code path. Existing rows have NULL token => not shareable (intended).
-- ============================================================================

ALTER TABLE food_nutrition_data_table
  ADD COLUMN IF NOT EXISTS "PublicShareToken" uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS "ShareExpiresAt"   timestamptz;

-- Index for the public lookup path (GET /api/quick-share/public/[token]).
CREATE INDEX IF NOT EXISTS idx_food_nutrition_public_share_token
  ON food_nutrition_data_table ("PublicShareToken")
  WHERE "PublicShareToken" IS NOT NULL;
