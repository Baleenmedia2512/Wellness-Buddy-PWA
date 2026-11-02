-- Log every Manual Log custom-food add for developer Excel review.
-- Master nutrition stays on nutrition_master_profiles_table (shared + scaled by quantity).

ALTER TABLE public.nutrition_master_profiles_table
  ADD COLUMN IF NOT EXISTS created_by_user_id bigint NULL;

CREATE TABLE IF NOT EXISTS public.nutrition_custom_food_submissions_table (
  id              bigserial PRIMARY KEY,
  user_id         bigint      NOT NULL,
  food_name       text        NOT NULL,
  normalized_name text        NOT NULL,
  unit            text        NOT NULL CHECK (unit IN ('g', 'ml')),
  quantity        numeric     NOT NULL CHECK (quantity > 0),
  profile_id      bigint      NULL REFERENCES public.nutrition_master_profiles_table(id),
  created_at      timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_nutrition_custom_food_submissions_created
  ON public.nutrition_custom_food_submissions_table (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_custom_food_submissions_normalized
  ON public.nutrition_custom_food_submissions_table (normalized_name);

ALTER TABLE public.nutrition_custom_food_submissions_table DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.nutrition_custom_food_submissions_table TO anon;
GRANT SELECT, INSERT ON public.nutrition_custom_food_submissions_table TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nutrition_custom_food_submissions_table TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.nutrition_custom_food_submissions_table_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.nutrition_custom_food_submissions_table_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.nutrition_custom_food_submissions_table_id_seq TO service_role;
