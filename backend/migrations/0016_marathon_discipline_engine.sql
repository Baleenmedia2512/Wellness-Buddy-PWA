-- 0016_marathon_discipline_engine.sql
-- Enhances marathon tables with LAP roles, baseline weights, discipline config,
-- finalized daily results, and recognition view tracking.
-- Forward-only migration. All changes are purely additive.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LAP role + baseline weight on marathon_participants
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marathon_participants
  ADD COLUMN IF NOT EXISTS lap_role       VARCHAR(20) NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS baseline_weight NUMERIC(6,2) NULL;

ALTER TABLE marathon_participants
  DROP CONSTRAINT IF EXISTS marathon_lap_role_check;

ALTER TABLE marathon_participants
  ADD CONSTRAINT marathon_lap_role_check
    CHECK (lap_role IN ('captain', 'assistant_captain', 'member'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Team name + lap sequence on marathon_table
--    team_name:    base name entered by captain, e.g. "Power Burners"
--    lap_sequence: auto-incremented per team; 1 → "Power Burners - LAP 1"
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marathon_table
  ADD COLUMN IF NOT EXISTS team_name    TEXT    NULL,
  ADD COLUMN IF NOT EXISTS lap_sequence INTEGER NOT NULL DEFAULT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. marathon_config — admin-configurable discipline window per marathon
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marathon_config (
  id                    BIGSERIAL    PRIMARY KEY,
  marathon_id           BIGINT       NOT NULL REFERENCES marathon_table(id) ON DELETE CASCADE,
  discipline_start_time TIME         NOT NULL DEFAULT '03:00:00',
  discipline_end_time   TIME         NOT NULL DEFAULT '07:30:00',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT marathon_config_marathon_unique UNIQUE (marathon_id)
);

ALTER TABLE marathon_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_marathon_config_marathon
  ON marathon_config(marathon_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. marathon_daily_results — finalized leaders computed after discipline window
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marathon_daily_results (
  id                          BIGSERIAL    PRIMARY KEY,
  marathon_id                 BIGINT       NOT NULL REFERENCES marathon_table(id) ON DELETE CASCADE,
  result_date                 DATE         NOT NULL,
  lap_number                  INTEGER      NOT NULL,
  day_number                  INTEGER      NOT NULL,
  day_leader_user_id          INTEGER      NULL,
  day_leader_reduction_kg     NUMERIC(6,2) NULL,
  lap_leader_user_id          INTEGER      NULL,
  lap_leader_reduction_kg     NUMERIC(6,2) NULL,
  community_leader_user_id    INTEGER      NULL,
  community_leader_reduction_kg NUMERIC(6,2) NULL,
  eligible_count              INTEGER      NOT NULL DEFAULT 0,
  total_participants          INTEGER      NOT NULL DEFAULT 0,
  computed_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT marathon_daily_results_unique UNIQUE (marathon_id, result_date)
);

ALTER TABLE marathon_daily_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_marathon_daily_results_marathon
  ON marathon_daily_results(marathon_id, result_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. marathon_recognition_views — per-user splash screen view tracking
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marathon_recognition_views (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      INTEGER      NOT NULL,
  marathon_id  BIGINT       NOT NULL REFERENCES marathon_table(id) ON DELETE CASCADE,
  result_date  DATE         NOT NULL,
  viewed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT marathon_recognition_views_unique UNIQUE (user_id, marathon_id, result_date)
);

ALTER TABLE marathon_recognition_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_marathon_recognition_user
  ON marathon_recognition_views(user_id, result_date DESC);
