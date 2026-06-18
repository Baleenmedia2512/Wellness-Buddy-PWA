-- 0017_marathon_disable_rls.sql
-- Compensating migration for 0015 + 0016.
-- RLS was enabled on all marathon tables but no policies were created,
-- causing "row-level security policy" errors for every backend INSERT/SELECT.
-- These tables are backend-only (no direct client access needed).
-- Disable RLS on all six marathon tables.
-- Forward-only. To re-enable, write a new migration with explicit policies.

ALTER TABLE marathon_table              DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_participants       DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_share_cards        DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_config             DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_daily_results      DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_recognition_views  DISABLE ROW LEVEL SECURITY;
