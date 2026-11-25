-- Migration: create_coach_portfolio_access_table
-- Run on MySQL before / with Coach Website (ff.coach-portfolio) Phase 1.
-- Tracks whether a coach may open the portfolio form. Phase 1 uses admin
-- mark-paid only; Cashfree will write the same Status later.

CREATE TABLE IF NOT EXISTS coach_portfolio_access_table (
  Id          BIGINT       NOT NULL AUTO_INCREMENT,
  UserId      BIGINT       NOT NULL,
  Status      VARCHAR(16)  NOT NULL DEFAULT 'not_paid',
  Source      VARCHAR(32)  NOT NULL DEFAULT 'admin',
  MarkedBy    BIGINT       NULL,
  MarkedAt    DATETIME     NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_coach_portfolio_access_user (UserId),
  KEY idx_coach_portfolio_access_status (Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
