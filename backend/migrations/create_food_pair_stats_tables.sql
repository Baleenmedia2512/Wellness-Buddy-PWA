-- Migration: create_food_pair_stats_tables
-- Anonymous global + per-user food co-occurrence counts for Meal Builder
-- "Often added with" suggestions (frequency-v1). No AI/ML.

-- ─── 1. Global anonymous pair aggregate ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS food_pair_stats_table (
  id          bigserial PRIMARY KEY,
  food_a      text         NOT NULL,
  food_b      text         NOT NULL,
  pair_count  integer      NOT NULL DEFAULT 0
                           CHECK (pair_count >= 0),
  updated_at  timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT food_pair_stats_ordered CHECK (food_a < food_b),
  CONSTRAINT food_pair_stats_unique UNIQUE (food_a, food_b)
);

CREATE INDEX IF NOT EXISTS idx_food_pair_stats_a ON food_pair_stats_table (food_a);
CREATE INDEX IF NOT EXISTS idx_food_pair_stats_b ON food_pair_stats_table (food_b);
CREATE INDEX IF NOT EXISTS idx_food_pair_stats_count ON food_pair_stats_table (pair_count DESC);

ALTER TABLE food_pair_stats_table DISABLE ROW LEVEL SECURITY;
GRANT ALL ON food_pair_stats_table TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE food_pair_stats_table_id_seq TO anon, authenticated;

-- ─── 2. Per-user pair aggregate (personal-first suggestions) ─────────────────

CREATE TABLE IF NOT EXISTS food_pair_stats_user_table (
  id          bigserial PRIMARY KEY,
  user_id     text         NOT NULL,
  food_a      text         NOT NULL,
  food_b      text         NOT NULL,
  pair_count  integer      NOT NULL DEFAULT 0
                           CHECK (pair_count >= 0),
  updated_at  timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT food_pair_stats_user_ordered CHECK (food_a < food_b),
  CONSTRAINT food_pair_stats_user_unique UNIQUE (user_id, food_a, food_b)
);

CREATE INDEX IF NOT EXISTS idx_food_pair_stats_user_anchor
  ON food_pair_stats_user_table (user_id, food_a);
CREATE INDEX IF NOT EXISTS idx_food_pair_stats_user_anchor_b
  ON food_pair_stats_user_table (user_id, food_b);

ALTER TABLE food_pair_stats_user_table DISABLE ROW LEVEL SECURITY;
GRANT ALL ON food_pair_stats_user_table TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE food_pair_stats_user_table_id_seq TO anon, authenticated;
