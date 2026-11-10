-- Migration: create_coach_portfolio_submissions_table
-- Phase 2 Coach Website information form. One row per coach UserId.
-- Form answers (including compressed image data URLs) live in FormJson.

CREATE TABLE IF NOT EXISTS coach_portfolio_submissions_table (
  Id            BIGINT       NOT NULL AUTO_INCREMENT,
  UserId        BIGINT       NOT NULL,
  Status        VARCHAR(32)  NOT NULL DEFAULT 'draft',
  FormJson      LONGTEXT     NOT NULL,
  AdminNote     TEXT         NULL,
  PublicSlug    VARCHAR(160) NULL,
  IsPublished   TINYINT(1)   NOT NULL DEFAULT 0,
  SubmittedAt   DATETIME     NULL,
  ReviewedAt    DATETIME     NULL,
  ReviewedBy    BIGINT       NULL,
  CreatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_coach_portfolio_submission_user (UserId),
  UNIQUE KEY uq_coach_portfolio_slug (PublicSlug),
  KEY idx_coach_portfolio_submission_status (Status),
  KEY idx_coach_portfolio_submission_updated (UpdatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
