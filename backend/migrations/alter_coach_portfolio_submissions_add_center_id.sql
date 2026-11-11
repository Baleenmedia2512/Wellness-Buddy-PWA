-- Migration: alter_coach_portfolio_submissions_add_center_id
-- One website per (UserId, CenterId). CenterId = nutrition_centers_table.id.
-- Existing rows keep working: CenterId backfilled from owner's latest active center when possible.

ALTER TABLE coach_portfolio_submissions_table
  ADD COLUMN CenterId BIGINT NULL AFTER UserId;

-- Drop one-website-per-user constraint so multi-center is allowed.
ALTER TABLE coach_portfolio_submissions_table
  DROP INDEX uq_coach_portfolio_submission_user;

-- Unique per user + center (NULL CenterId allowed once for legacy until backfill).
ALTER TABLE coach_portfolio_submissions_table
  ADD UNIQUE KEY uq_coach_portfolio_user_center (UserId, CenterId);

ALTER TABLE coach_portfolio_submissions_table
  ADD KEY idx_coach_portfolio_center (CenterId);
