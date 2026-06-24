-- Add CompletionHistory JSONB column to user_task_averages for rolling 7-completion average.
-- Forward-only migration; requires @principal-eng + @dba approval before production apply.

ALTER TABLE user_task_averages
  ADD COLUMN IF NOT EXISTS "CompletionHistory" jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_task_averages."CompletionHistory" IS
  'Last up to 7 IST completion times (HH:mm:ss strings) per activity type';
