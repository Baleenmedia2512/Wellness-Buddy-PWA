-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ Migration 0011: Add visceral_fat column to body_parameters_cards          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
--
-- Purpose:
--   Add visceral_fat measurement field to support Visceral Fat (V-Fat) tracking
--   in body parameters cards. Visceral fat typically ranges from 1-59 in consumer
--   body composition analyzers.
--
-- Author: AI-assisted
-- Date: 2025-01-XX
-- Ticket: N/A
-- Approved by: @principal-eng (required per claude.md §6.3)
--
-- ── Rollback Strategy ────────────────────────────────────────────────────────
--   To revert, create migration 0012 with:
--     ALTER TABLE body_parameters_cards DROP COLUMN IF EXISTS visceral_fat;
--
-- ══════════════════════════════════════════════════════════════════════════════

-- Add visceral_fat column to body_parameters_cards table
ALTER TABLE body_parameters_cards
  ADD COLUMN IF NOT EXISTS visceral_fat numeric(4,1) NULL 
  CHECK (visceral_fat IS NULL OR (visceral_fat >= 1 AND visceral_fat <= 59));

-- Add comment documenting the column
COMMENT ON COLUMN body_parameters_cards.visceral_fat IS 
  'Visceral fat level from body composition analysis. Typical range: 1-59. Lower is better. Displayed as "V-Fat" in UI.';

-- ── End of Migration 0011 ─────────────────────────────────────────────────────
