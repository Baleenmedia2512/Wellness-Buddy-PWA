-- Migration: alter_coach_portfolio_submissions_add_public_slug
-- Phase 3 Coach Website public page. Safe to re-run if columns already exist
-- (ensureSchema in submission.repo.js also adds these on first API use).

ALTER TABLE coach_portfolio_submissions_table
  ADD COLUMN PublicSlug VARCHAR(160) NULL;

ALTER TABLE coach_portfolio_submissions_table
  ADD COLUMN IsPublished TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE coach_portfolio_submissions_table
  ADD UNIQUE KEY uq_coach_portfolio_slug (PublicSlug);
