-- DEPRECATED for access: Create Event / Check-in / Paid Features now share
-- report_trials_table (centralized 14-day trial with Reports). Keep this file
-- only if an old environment already created events_trials_table; new deploys
-- do not need it.
--
-- Shared trial (create if missing):
--   backend/migrations/create_report_trials_table.sql
CREATE TABLE IF NOT EXISTS events_trials_table (
  UserId    BIGINT   NOT NULL,
  StartedAt DATETIME NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
