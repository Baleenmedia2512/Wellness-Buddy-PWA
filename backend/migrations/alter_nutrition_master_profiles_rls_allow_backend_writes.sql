-- Fix: custom-food INSERT fails with
--   "new row violates row-level security policy for table 'nutrition_master_profiles_table'"
--
-- Backend uses Supabase REST (anon or service key). Auth is enforced in API handlers,
-- same pattern as food_pair_stats / ai_credits / testimonials (RLS off for server writes).
--
-- Run this on test/prod Supabase SQL editor. Table already exists — do NOT run create_*.

-- Drop restrictive policies if present (from create_nutrition_master_profiles_table.sql).
DROP POLICY IF EXISTS nutrition_master_profiles_select_approved
  ON public.nutrition_master_profiles_table;
DROP POLICY IF EXISTS nutrition_master_profiles_write_service
  ON public.nutrition_master_profiles_table;
DROP POLICY IF EXISTS nutrition_master_profiles_insert_backend
  ON public.nutrition_master_profiles_table;

ALTER TABLE public.nutrition_master_profiles_table DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.nutrition_master_profiles_table TO anon;
GRANT SELECT, INSERT, UPDATE ON public.nutrition_master_profiles_table TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nutrition_master_profiles_table TO service_role;

-- Sequence needed for bigserial inserts via PostgREST.
GRANT USAGE, SELECT ON SEQUENCE public.nutrition_master_profiles_table_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.nutrition_master_profiles_table_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.nutrition_master_profiles_table_id_seq TO service_role;
