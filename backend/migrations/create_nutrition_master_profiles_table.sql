-- Migration: create_nutrition_master_profiles_table
-- Master nutrition catalog (ADR-0005) + user custom foods (Manual Log).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.nutrition_master_profiles_table (
  id                   bigserial PRIMARY KEY,
  canonical_name       text        NOT NULL,
  normalized_name      text        NOT NULL,
  aliases              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  reference_weight_g   numeric     NOT NULL DEFAULT 100,
  is_liquid            boolean     NOT NULL DEFAULT false,
  portion_label        text        NULL,
  nutrition            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  source               text        NOT NULL DEFAULT 'seed',
  status               text        NOT NULL DEFAULT 'draft',
  sightings            integer     NOT NULL DEFAULT 0,
  version              integer     NOT NULL DEFAULT 1,
  reviewed_by_user_id  bigint      NULL,
  created_at           timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  updated_at           timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT nutrition_master_profiles_normalized_unique UNIQUE (normalized_name),
  CONSTRAINT nutrition_master_profiles_status_check
    CHECK (status IN ('draft', 'approved', 'rejected')),
  CONSTRAINT nutrition_master_profiles_source_check
    CHECK (source IN ('seed', 'brand_preset', 'ai_promoted', 'ai_enrich', 'user_manual'))
);

CREATE INDEX IF NOT EXISTS idx_nutrition_master_profiles_status_name
  ON public.nutrition_master_profiles_table (status, canonical_name);

CREATE INDEX IF NOT EXISTS idx_nutrition_master_profiles_normalized
  ON public.nutrition_master_profiles_table (normalized_name);

-- If the table already existed with a narrower source CHECK, widen it.
DO $$
BEGIN
  ALTER TABLE public.nutrition_master_profiles_table
    DROP CONSTRAINT IF EXISTS nutrition_master_profiles_source_check;
  ALTER TABLE public.nutrition_master_profiles_table
    ADD CONSTRAINT nutrition_master_profiles_source_check
    CHECK (source IN ('seed', 'brand_preset', 'ai_promoted', 'ai_enrich', 'user_manual'));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

ALTER TABLE public.nutrition_master_profiles_table ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; keep explicit grants for tooling.
GRANT SELECT, INSERT, UPDATE ON public.nutrition_master_profiles_table TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nutrition_master_profiles_table TO service_role;
GRANT SELECT ON public.nutrition_master_profiles_table TO anon;

DROP POLICY IF EXISTS nutrition_master_profiles_select_approved ON public.nutrition_master_profiles_table;
CREATE POLICY nutrition_master_profiles_select_approved
  ON public.nutrition_master_profiles_table
  FOR SELECT
  USING (status = 'approved' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS nutrition_master_profiles_write_service ON public.nutrition_master_profiles_table;
CREATE POLICY nutrition_master_profiles_write_service
  ON public.nutrition_master_profiles_table
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
