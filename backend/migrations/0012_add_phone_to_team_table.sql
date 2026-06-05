-- Add Phone column to team_table so users can sign up / sign in with a phone
-- number via Firebase Phone Auth (see backend/features/auth/auth.service.js
-- firebasePhoneLogin()). Stored as E.164 (e.g. '+919876543210').
--
-- Forward-only per claude.md §2.7. To revert, write a new migration that
-- drops the column (data loss expected — back up first).
--
-- Notes:
--   * NULL = email-only user (legacy + new email signups).
--   * UNIQUE prevents two users colliding on the same verified phone.
--   * No NOT NULL constraint: existing rows must remain valid.
--   * Length 20 covers E.164 max (15 digits) + leading '+' + slack.

ALTER TABLE team_table
  ADD COLUMN IF NOT EXISTS "Phone" VARCHAR(20) DEFAULT NULL;

-- Partial unique index — only enforce uniqueness on non-NULL phones so the
-- many legacy NULL rows do not all collide on a single constraint.
CREATE UNIQUE INDEX IF NOT EXISTS team_table_phone_unique
  ON team_table ("Phone")
  WHERE "Phone" IS NOT NULL;
