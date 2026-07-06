-- Migration: create_testimonials_table
-- Run this SQL in the Supabase SQL editor before deploying the testimonials feature.
--
-- STORAGE BUCKET (create manually in Supabase dashboard first):
--   Name: testimonials  |  Public: OFF  |  Max file size: 1 MB
--   Then run the storage policies section below.

-- ─── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS testimonials_table (
  id                bigserial      PRIMARY KEY,
  user_id           bigint         NOT NULL,
  coach_id          bigint         NOT NULL,
  before_image_path text           NOT NULL,
  after_image_path  text           NOT NULL,
  before_weight_kg  numeric(5, 2)  NOT NULL,
  after_weight_kg   numeric(5, 2)  NOT NULL,
  goal_type         text           NOT NULL CHECK (goal_type IN ('loss', 'gain')),
  duration_text     text           NOT NULL,
  status            text           NOT NULL DEFAULT 'incomplete'
                                   CHECK (status IN ('incomplete', 'pending', 'verified')),
  otp_hash          text,
  otp_expires_at    timestamp,
  verified_at       timestamp,
  created_at        timestamp      NOT NULL,
  updated_at        timestamp      NOT NULL,
  is_deleted        boolean        NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_testimonials_user_id   ON testimonials_table (user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_coach_id  ON testimonials_table (coach_id);

-- ─── 2. Table permissions (no RLS — auth enforced at API layer) ───────────────

ALTER TABLE testimonials_table DISABLE ROW LEVEL SECURITY;

GRANT ALL ON testimonials_table                    TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE testimonials_table_id_seq TO anon, authenticated;

-- ─── 3. Fix existing table (if already created with old CHECK constraint) ────
-- ALTER TABLE testimonials_table DROP CONSTRAINT IF EXISTS testimonials_table_status_check;
-- ALTER TABLE testimonials_table ADD CONSTRAINT testimonials_table_status_check
--   CHECK (status IN ('incomplete', 'pending', 'verified'));
-- ALTER TABLE testimonials_table ALTER COLUMN status SET DEFAULT 'incomplete';

-- ─── 4. Storage bucket policies ───────────────────────────────────────────────
-- The `storage.objects` table has its own RLS. With 0 bucket policies the
-- anon key is denied and Postgres throws "new row violates row-level security
-- policy". Add a single permissive policy for the testimonials bucket:

CREATE POLICY "testimonials_bucket_all"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING     (bucket_id = 'testimonials')
  WITH CHECK (bucket_id = 'testimonials');


-- ─── 3. Supabase Storage bucket RLS policies ──────────────────────────────────
-- Run these AFTER creating the `testimonials` bucket in the Supabase dashboard.
-- Replace <bucket_id> with the actual bucket ID shown in the dashboard.
--
-- Policy: service role can read/write all objects (API uses service key).
-- INSERT policy for authenticated users — path must start with their user_id.
-- SELECT/DELETE policy for owner or coach (enforced in application layer via signed URLs).
--
-- Example (adapt as needed):
-- CREATE POLICY "service-role full access"
--   ON storage.objects FOR ALL
--   USING (bucket_id = 'testimonials')
--   WITH CHECK (bucket_id = 'testimonials');
