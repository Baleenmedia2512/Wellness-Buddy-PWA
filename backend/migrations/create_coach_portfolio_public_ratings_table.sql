-- Migration: create_coach_portfolio_public_ratings_table
-- Anonymous visitor star ratings (1–5, no comments) for published coach pages.
-- One row per (SubmissionId, RaterKey); re-rate upserts Rating.

CREATE TABLE IF NOT EXISTS coach_portfolio_public_ratings_table (
  Id             BIGINT       NOT NULL AUTO_INCREMENT,
  SubmissionId   BIGINT       NOT NULL,
  PublicSlug     VARCHAR(160) NOT NULL,
  Rating         TINYINT      NOT NULL,
  RaterKey       VARCHAR(64)  NOT NULL,
  CreatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_portfolio_rating_submission_rater (SubmissionId, RaterKey),
  KEY idx_portfolio_rating_submission (SubmissionId),
  KEY idx_portfolio_rating_slug (PublicSlug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
