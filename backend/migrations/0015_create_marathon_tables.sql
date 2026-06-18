-- 0015_create_marathon_tables.sql
-- Marathon Recognition Engine: core tables for marathons, participants, and share cards.
-- Forward-only. To revert, write a new compensating migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- marathon_table  — one row per marathon event created by a coach
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marathon_table (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT        NOT NULL,
  coach_id       INTEGER     NOT NULL,  -- FK: team_table.UserId (coach role)
  status         VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | completed | cancelled
  total_laps     INTEGER     NOT NULL DEFAULT 10,
  days_per_lap   INTEGER     NOT NULL DEFAULT 10,
  started_at     DATE        NOT NULL,
  completed_at   DATE        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marathon_status_check CHECK (status IN ('active', 'completed', 'cancelled')),
  CONSTRAINT marathon_total_laps_check CHECK (total_laps >= 1),
  CONSTRAINT marathon_days_per_lap_check CHECK (days_per_lap >= 1)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- marathon_participants  — members enrolled in a marathon
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marathon_participants (
  id           BIGSERIAL   PRIMARY KEY,
  marathon_id  BIGINT      NOT NULL REFERENCES marathon_table(id) ON DELETE CASCADE,
  user_id      INTEGER     NOT NULL,  -- FK: team_table.UserId (user/member role)
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marathon_participants_unique UNIQUE (marathon_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- marathon_share_cards  — snapshot of a generated card + public share token
-- Each time a coach generates a card (team/day-leader/lap-leader) a row is
-- upserted here and the token is embedded in the WhatsApp share URL.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marathon_share_cards (
  id                 BIGSERIAL    PRIMARY KEY,
  marathon_id        BIGINT       NOT NULL REFERENCES marathon_table(id) ON DELETE CASCADE,
  card_type          VARCHAR(30)  NOT NULL,  -- team | day_leader | lap_leader | community_leader
  lap_number         INTEGER      NULL,
  day_number         INTEGER      NULL,
  public_share_token UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  share_expires_at   TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  card_data          JSONB        NOT NULL,  -- snapshot at generation time
  created_by         INTEGER      NOT NULL,  -- FK: team_table.UserId
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT marathon_share_card_type_check
    CHECK (card_type IN ('team', 'day_leader', 'lap_leader', 'community_leader'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marathon_table         ENABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_share_cards   ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_marathon_coach_id
  ON marathon_table(coach_id)
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_marathon_participants_marathon
  ON marathon_participants(marathon_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_marathon_participants_user
  ON marathon_participants(user_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_marathon_share_token
  ON marathon_share_cards(public_share_token);

CREATE INDEX IF NOT EXISTS idx_marathon_share_marathon
  ON marathon_share_cards(marathon_id, card_type, lap_number, day_number);
