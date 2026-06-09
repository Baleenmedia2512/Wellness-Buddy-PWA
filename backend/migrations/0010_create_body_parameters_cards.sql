-- ============================================================================
-- Migration: 0010_create_body_parameters_cards.sql
-- Purpose:   New table to store body-parameter cards created by coaches in
--            the Wellness Counselling page. Each card has a public share token
--            so coaches can share a formatted card with new/existing members.
-- Author:    [ai-assisted] tool=copilot, scope=body-parameters-card
-- Date:      2026-06-09
-- ============================================================================
-- Forward-only. To revert, write 0011_drop_body_parameters_cards.sql.
-- Backward-compatible: no existing table is altered.
-- RLS: enabled per claude.md §2.7.
-- ============================================================================

CREATE TABLE IF NOT EXISTS body_parameters_cards (
  id                  bigserial     PRIMARY KEY,

  -- The coach (or user) who created this card.
  created_by          integer       NOT NULL,

  -- Optional link to the member this card was made for.
  -- NULL when the card is for a person not yet in the system.
  user_id             integer       NULL,

  -- Share token — capability URL: knowledge of this token = read access.
  public_share_token  uuid          NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Card expires 30 days after creation.
  share_expires_at    timestamptz   NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  -- Card fields (all nullable — coach may leave some blank).
  name                text          NOT NULL,
  age                 smallint      NULL CHECK (age IS NULL OR (age >= 1 AND age <= 120)),
  gender              varchar(10)   NULL CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
  height_cm           numeric(5,1)  NULL CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250)),
  weight_kg           numeric(6,2)  NULL CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 300)),
  bmi                 numeric(5,2)  NULL CHECK (bmi IS NULL OR (bmi >= 5 AND bmi <= 70)),
  fat_percent         numeric(5,2)  NULL CHECK (fat_percent IS NULL OR (fat_percent >= 1 AND fat_percent <= 70)),
  bmr                 numeric(7,2)  NULL CHECK (bmr IS NULL OR (bmr >= 500 AND bmr <= 10000)),

  -- Body Age: displayed on card only — never synced to team_table.
  body_age            smallint      NULL CHECK (body_age IS NULL OR (body_age >= 1 AND body_age <= 120)),

  -- Date and location shown on the card header.
  recorded_date       date          NOT NULL DEFAULT CURRENT_DATE,
  location_name       text          NULL,

  -- Soft delete and audit timestamps — snake_case per claude.md §2.7.
  is_deleted          boolean       NOT NULL DEFAULT FALSE,
  created_at          timestamptz   NOT NULL DEFAULT NOW(),
  updated_at          timestamptz   NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Public lookup path (GET /api/body-parameters-card/public/[token]).
CREATE INDEX IF NOT EXISTS idx_bpc_share_token
  ON body_parameters_cards (public_share_token)
  WHERE public_share_token IS NOT NULL;

-- Coach view — list cards created by a specific coach.
CREATE INDEX IF NOT EXISTS idx_bpc_created_by
  ON body_parameters_cards (created_by)
  WHERE is_deleted = FALSE;

-- Member view — find cards for a specific user_id.
CREATE INDEX IF NOT EXISTS idx_bpc_user_id
  ON body_parameters_cards (user_id)
  WHERE is_deleted = FALSE;

-- ── RLS (mandatory per claude.md §2.7) ───────────────────────────────────────
ALTER TABLE body_parameters_cards ENABLE ROW LEVEL SECURITY;

-- Coaches can read and write their own cards.
CREATE POLICY bpc_creator_rw ON body_parameters_cards
  USING (created_by::text = current_setting('app.current_user_id', TRUE))
  WITH CHECK (created_by::text = current_setting('app.current_user_id', TRUE));

-- Public read via token is handled at the application layer (no auth header
-- required for the public endpoint) so no additional RLS policy is needed
-- for the public lookup; the app service-role key bypasses RLS for that path.

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE body_parameters_cards IS
  'Stores body-parameter cards created by coaches in Wellness Counselling. '
  'Each card has a public share token valid for 30 days. '
  'body_age is stored here only — it is never synced to team_table or weight_records_table.';

COMMENT ON COLUMN body_parameters_cards.user_id IS
  'Foreign key to team_table.UserId. NULL when the card is for a person not yet registered.';

COMMENT ON COLUMN body_parameters_cards.body_age IS
  'Display-only field shown on the shared card. Never written to any profile table.';

COMMENT ON COLUMN body_parameters_cards.public_share_token IS
  'UUID token used in the public share URL. Knowledge of this token grants read access.';
