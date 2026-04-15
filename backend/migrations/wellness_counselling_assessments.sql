-- Migration: Create wellness_counselling_assessments table
-- Description: Stores wellness counselling assessment data for team members
-- Date: 2026-03-24

-- Create the table (normalized - only IDs, join with team_table for names/emails)
CREATE TABLE IF NOT EXISTS public.wellness_counselling_assessments (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL,
  counsellor_id integer NULL,
  health_problems jsonb NOT NULL,
  eating_habits jsonb,
  sleep_data jsonb,
  medication_details text,
  submitted_at timestamp without time zone DEFAULT NOW(),
  created_at timestamp without time zone DEFAULT NOW(),
  updated_at timestamp without time zone DEFAULT NOW(),
  is_deleted boolean DEFAULT FALSE,
  CONSTRAINT fk_user
    FOREIGN KEY (user_id)
    REFERENCES public.team_table ("UserId")
    ON DELETE CASCADE,
  CONSTRAINT fk_counsellor
    FOREIGN KEY (counsellor_id)
    REFERENCES public.team_table ("UserId")
    ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wellness_counselling_user_id 
  ON public.wellness_counselling_assessments(user_id);

CREATE INDEX IF NOT EXISTS idx_wellness_counselling_counsellor_id 
  ON public.wellness_counselling_assessments(counsellor_id);

CREATE INDEX IF NOT EXISTS idx_wellness_counselling_submitted_at 
  ON public.wellness_counselling_assessments(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_wellness_counselling_deleted 
  ON public.wellness_counselling_assessments(is_deleted) 
  WHERE is_deleted = false;

-- Add comment to table
COMMENT ON TABLE public.wellness_counselling_assessments IS 
  'Stores wellness counselling assessments. Join with team_table using user_id/counsellor_id for names and emails.';

-- Add comments to important columns
COMMENT ON COLUMN public.wellness_counselling_assessments.user_id IS 
  'Foreign key to team_table.UserId - the person being assessed';

COMMENT ON COLUMN public.wellness_counselling_assessments.counsellor_id IS 
  'Foreign key to team_table.UserId - the coach who conducted the assessment';

COMMENT ON COLUMN public.wellness_counselling_assessments.health_problems IS 
  'Array of selected health problems (e.g., ["Diabetes", "Hypertension"])';

COMMENT ON COLUMN public.wellness_counselling_assessments.eating_habits IS 
  'JSON object containing meal times, diet type, and water intake';

COMMENT ON COLUMN public.wellness_counselling_assessments.sleep_data IS 
  'JSON object containing sleep quality rating and duration in hours';

COMMENT ON COLUMN public.wellness_counselling_assessments.medication_details IS 
  'Free text description of current medications';
