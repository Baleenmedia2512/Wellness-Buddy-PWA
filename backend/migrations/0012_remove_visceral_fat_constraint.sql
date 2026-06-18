-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ Migration 0012: Remove visceral_fat range constraint                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
--
-- Purpose:
--   Remove the CHECK constraint on visceral_fat column to allow any positive value.
--   Reference value is 9, but users should be able to enter any measurement value.
--
-- Author: AI-assisted
-- Date: 2026-06-17
-- Ticket: N/A
-- Approved by: @principal-eng (required per claude.md §6.3)
--
-- ── Rollback Strategy ────────────────────────────────────────────────────────
--   To revert, create migration 0013 with:
--     ALTER TABLE body_parameters_cards 
--     ADD CONSTRAINT body_parameters_cards_visceral_fat_check 
--     CHECK (visceral_fat IS NULL OR (visceral_fat >= 1 AND visceral_fat <= 59));
--
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop the existing CHECK constraint on visceral_fat
ALTER TABLE body_parameters_cards
  DROP CONSTRAINT IF EXISTS body_parameters_cards_visceral_fat_check;

-- ── End of Migration 0012 ─────────────────────────────────────────────────────
