-- Migration: add_ai_credits_availability_windows
-- Admin-configurable AI availability per meal slot (enabled + custom start/end).
-- Independent of activity_time_windows_table (discipline windows).

ALTER TABLE ai_credits_config_table
  ADD COLUMN IF NOT EXISTS availability_windows jsonb NOT NULL DEFAULT '{
    "breakfast": {"enabled": true, "start": "05:30:00", "end": "08:30:00"},
    "lunch":     {"enabled": true, "start": "12:00:00", "end": "16:00:00"},
    "dinner":    {"enabled": true, "start": "17:30:00", "end": "20:30:00"}
  }'::jsonb;

COMMENT ON COLUMN ai_credits_config_table.availability_windows IS
  'AI availability slots: breakfast/lunch/dinner with enabled + start/end (HH:MM:SS, IST).';
