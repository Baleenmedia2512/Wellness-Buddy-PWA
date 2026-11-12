-- Migration: create_mandatory_field_tables
-- MySQL / MariaDB. Run this manually before deploying mandatory-field APIs.
-- Does not read or update team_table. Does not enable any rule (required = 0).
--
-- field_key values must stay inside the code registry
-- (backend/features/mandatory-fields/domain/fieldRegistry.js).
-- The admin API rejects any other key. These seed rows only give each
-- registered field a disabled starting rule.

CREATE TABLE IF NOT EXISTS mandatory_field_rules (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  field_key           VARCHAR(64)  NOT NULL,
  required            TINYINT(1)   NOT NULL DEFAULT 0,
  grace_type          VARCHAR(16)  NOT NULL DEFAULT 'days',
  grace_limit         INT          NOT NULL DEFAULT 0,
  audience            VARCHAR(16)  NOT NULL DEFAULT 'both',
  min_app_version     VARCHAR(32)  NOT NULL,
  notify_enabled      TINYINT(1)   NOT NULL DEFAULT 1,
  remind_every_days   INT          NOT NULL DEFAULT 0,
  position_scope      VARCHAR(16)  NOT NULL DEFAULT 'all',
  position_codes      JSON         NULL,
  required_since      DATETIME(3)  NULL,
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by_user_id  INT          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mandatory_field_rules_field_key (field_key),
  CONSTRAINT chk_mandatory_field_rules_grace_type
    CHECK (grace_type IN ('days', 'skips')),
  CONSTRAINT chk_mandatory_field_rules_audience
    CHECK (audience IN ('member', 'coach', 'both')),
  CONSTRAINT chk_mandatory_field_rules_grace_limit
    CHECK (grace_limit >= 0),
  CONSTRAINT chk_mandatory_field_rules_remind_every_days
    CHECK (remind_every_days >= 0),
  CONSTRAINT chk_mandatory_field_rules_position_scope
    CHECK (position_scope IN ('all', 'specific'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_field_grace (
  id                 BIGINT       NOT NULL AUTO_INCREMENT,
  user_id            INT          NOT NULL,
  field_key          VARCHAR(64)  NOT NULL,
  first_notified_at  DATETIME(3)  NULL,
  skip_count         INT          NOT NULL DEFAULT 0,
  last_skipped_at    DATETIME(3)  NULL,
  last_prompted_at   DATETIME(3)  NULL,
  reminder_mask      INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_field_grace_user_field (user_id, field_key),
  KEY idx_user_field_grace_user (user_id),
  CONSTRAINT chk_user_field_grace_skip_count
    CHECK (skip_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Disabled seed. min_app_version matches the registry floor (3.5.0).
INSERT INTO mandatory_field_rules
  (field_key, required, grace_type, grace_limit, audience, min_app_version, notify_enabled)
SELECT seed.field_key, 0, 'days', 0, 'both', '3.5.0', 1
FROM (
  SELECT 'name' AS field_key
  UNION ALL SELECT 'gender'
  UNION ALL SELECT 'height'
  UNION ALL SELECT 'diet'
  UNION ALL SELECT 'bodyFat'
  UNION ALL SELECT 'email'
  UNION ALL SELECT 'phone'
  UNION ALL SELECT 'communityId'
  UNION ALL SELECT 'physicalActivity'
  UNION ALL SELECT 'bmr'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM mandatory_field_rules existing
  WHERE existing.field_key = seed.field_key
);

-- Community position editor starts at 3.5.6. Required stays off.
INSERT INTO mandatory_field_rules
  (field_key, required, grace_type, grace_limit, audience, min_app_version, notify_enabled, remind_every_days, position_scope)
SELECT 'communityPosition', 0, 'days', 0, 'both', '3.5.6', 1, 0, 'all'
WHERE NOT EXISTS (
  SELECT 1 FROM mandatory_field_rules existing
  WHERE existing.field_key = 'communityPosition'
);
