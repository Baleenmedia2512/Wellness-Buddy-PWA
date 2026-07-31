-- Migration: create_ai_credits_tables
-- Run in Supabase SQL editor before deploying AI credit-based food analysis.
-- Admin-configurable daily AI credits + per-user daily usage (user timezone day key).

-- ─── 1. Global config (append-latest row wins) ────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_credits_config_table (
  id                  bigserial PRIMARY KEY,
  daily_ai_credits    integer      NOT NULL DEFAULT 3
                                   CHECK (daily_ai_credits >= 0 AND daily_ai_credits <= 1000),
  ai_mode_enabled     boolean      NOT NULL DEFAULT true,
  updated_at          timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_by_user_id  bigint
);

ALTER TABLE ai_credits_config_table DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ai_credits_config_table TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE ai_credits_config_table_id_seq TO anon, authenticated;

-- Seed default config (3 credits / day, AI Mode ON)
INSERT INTO ai_credits_config_table (daily_ai_credits, ai_mode_enabled)
SELECT 3, true
WHERE NOT EXISTS (SELECT 1 FROM ai_credits_config_table LIMIT 1);

-- ─── 2. Per-user daily usage ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_credits_daily_usage_table (
  id                      bigserial PRIMARY KEY,
  user_id                 bigint       NOT NULL,
  usage_date              date         NOT NULL,
  credits_used            integer      NOT NULL DEFAULT 0
                                       CHECK (credits_used >= 0),
  credits_limit_snapshot  integer      NOT NULL DEFAULT 3
                                       CHECK (credits_limit_snapshot >= 0),
  updated_at              timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_daily_usage_user_date
  ON ai_credits_daily_usage_table (user_id, usage_date);

ALTER TABLE ai_credits_daily_usage_table DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ai_credits_daily_usage_table TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE ai_credits_daily_usage_table_id_seq TO anon, authenticated;

-- ─── 3. Reservations (hold before AI; confirm only on food success) ──────────

CREATE TABLE IF NOT EXISTS ai_credits_reservations_table (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         bigint       NOT NULL,
  usage_date      date         NOT NULL,
  status          text         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'confirmed', 'released', 'expired')),
  created_at      timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_reservations_user_date_status
  ON ai_credits_reservations_table (user_id, usage_date, status);

ALTER TABLE ai_credits_reservations_table DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ai_credits_reservations_table TO anon, authenticated;
