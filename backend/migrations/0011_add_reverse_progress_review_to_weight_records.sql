-- ============================================================================
-- Migration: 0011_add_reverse_progress_review_to_weight_records.sql
-- Purpose:   Store reverse-progress accountability review on the weight row
--            that triggered the alert (no new table).
-- Author:    [ai-assisted] tool=cursor, scope=weight-progress-tips
-- Date:      2026-06-12
-- ============================================================================
-- Extends existing weight_records_table only.
-- Forward-only. To revert: write 0012_drop_reverse_progress_review_column.sql.
-- ============================================================================

ALTER TABLE weight_records_table
  ADD COLUMN IF NOT EXISTS "ReverseProgressReview" jsonb NULL;

COMMENT ON COLUMN weight_records_table."ReverseProgressReview" IS
  'JSON accountability review when reverse progress was detected for this entry. '
  'Includes followedPlan, proof/reason, goalMode, weightChangeKg, nutritionSnapshot, reviewedAt.';
