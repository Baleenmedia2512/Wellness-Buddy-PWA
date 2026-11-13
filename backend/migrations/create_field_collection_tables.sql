-- Field collection policy (admin) and per-user skip / fill clock.
-- Run on MySQL (phpMyAdmin). Reads fall back to code defaults until this exists.
-- Saving admin rules and counting skips need these tables.

CREATE TABLE IF NOT EXISTS field_collection_policy_table (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  fields              JSON         NOT NULL,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_user_id  BIGINT       NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS field_collection_prompt_state_table (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  user_id           BIGINT       NOT NULL,
  field_key         VARCHAR(64)  NOT NULL,
  skip_count        INT          NOT NULL DEFAULT 0,
  cycle_started_at  DATETIME     NULL,
  last_filled_at    DATETIME     NULL,
  last_skipped_at   DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_field_collection_user_field (user_id, field_key),
  KEY idx_field_collection_prompt_state_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
