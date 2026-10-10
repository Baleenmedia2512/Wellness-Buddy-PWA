-- Allow Manual Log custom foods (source = user_manual) on existing master table.
-- Run on test/prod Supabase if POST /api/nutrition-knowledge/custom-food returns SAVE_FAILED.

DO $$
BEGIN
  ALTER TABLE public.nutrition_master_profiles_table
    DROP CONSTRAINT IF EXISTS nutrition_master_profiles_source_check;

  -- Also drop unnamed / legacy check constraints that mention source, if present.
  ALTER TABLE public.nutrition_master_profiles_table
    DROP CONSTRAINT IF EXISTS nutrition_master_profiles_table_source_check;

  ALTER TABLE public.nutrition_master_profiles_table
    ADD CONSTRAINT nutrition_master_profiles_source_check
    CHECK (source IN ('seed', 'brand_preset', 'ai_promoted', 'ai_enrich', 'user_manual'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'nutrition_master_profiles_table missing — run create_nutrition_master_profiles_table.sql first';
  WHEN duplicate_object THEN
    NULL;
END $$;
