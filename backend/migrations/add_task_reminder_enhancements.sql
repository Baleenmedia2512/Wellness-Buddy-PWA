-- add_task_reminder_enhancements.sql
--
-- Adds snooze/dismiss state columns to tasks_table and creates
-- user_task_averages for personalized reminder timing.
--
-- Rollback: see compensating migration notes at bottom.
-- Per claude.md §2.7: forward-only, parameterised, RLS mandatory on new tables.

-- ──────────────────────────────────────────────────────────────
-- 1. Extend tasks_table with reminder state columns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE tasks_table
  ADD COLUMN IF NOT EXISTS "ReminderCount"          INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "SnoozedUntil"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ReminderDismissedToday" BOOLEAN     NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tasks_table."ReminderCount"
  IS 'How many reminder notifications have been sent for this task today (max 2).';

COMMENT ON COLUMN tasks_table."SnoozedUntil"
  IS 'If set, suppress reminder notifications until this timestamp.';

COMMENT ON COLUMN tasks_table."ReminderDismissedToday"
  IS 'User chose "Do not remind again today" for this task.';

-- ──────────────────────────────────────────────────────────────
-- 2. Create user_task_averages for personalised timing
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_task_averages (
  "AverageId"             SERIAL       PRIMARY KEY,
  "UserId"                INTEGER      NOT NULL,
  "TaskType"              VARCHAR(50)  NOT NULL,
  "AverageCompletionTime" TIME         NOT NULL,
  "SampleCount"           INTEGER      NOT NULL DEFAULT 1,
  "LastCalculatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "CreatedAt"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_task_averages UNIQUE ("UserId", "TaskType"),
  CONSTRAINT fk_user_task_averages_user
    FOREIGN KEY ("UserId")
    REFERENCES team_table ("UserId")
    ON DELETE CASCADE
);

COMMENT ON TABLE user_task_averages
  IS 'Rolling average of the clock-time at which a user completes each task type. Used to personalise reminder windows.';

-- ──────────────────────────────────────────────────────────────
-- 3. RLS — mandatory per claude.md §2.7
-- ──────────────────────────────────────────────────────────────
ALTER TABLE user_task_averages ENABLE ROW LEVEL SECURITY;

-- Members see only their own rows
CREATE POLICY "user_task_averages_select_own"
  ON user_task_averages
  FOR SELECT
  USING ("UserId"::text = auth.uid()::text);

CREATE POLICY "user_task_averages_insert_own"
  ON user_task_averages
  FOR INSERT
  WITH CHECK ("UserId"::text = auth.uid()::text);

CREATE POLICY "user_task_averages_update_own"
  ON user_task_averages
  FOR UPDATE
  USING ("UserId"::text = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- 4. Index for scheduler hot path
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_snooze_lookup
  ON tasks_table ("Status", "SnoozedUntil")
  WHERE "Status" = 'pending' AND "SnoozedUntil" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_dismissed_lookup
  ON tasks_table ("TaskDate", "ReminderDismissedToday")
  WHERE "ReminderDismissedToday" = FALSE;

-- ──────────────────────────────────────────────────────────────
-- ROLLBACK NOTES (forward-only — write a new migration to undo)
-- ──────────────────────────────────────────────────────────────
-- To undo:
--   DROP TABLE IF EXISTS user_task_averages;
--   DROP INDEX IF EXISTS idx_tasks_snooze_lookup;
--   DROP INDEX IF EXISTS idx_tasks_dismissed_lookup;
--   ALTER TABLE tasks_table
--     DROP COLUMN IF EXISTS "ReminderCount",
--     DROP COLUMN IF EXISTS "SnoozedUntil",
--     DROP COLUMN IF EXISTS "ReminderDismissedToday";
