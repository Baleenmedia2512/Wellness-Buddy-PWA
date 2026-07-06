-- Migration: create_testimonials_table
-- Run this SQL in the Supabase SQL editor before deploying the testimonials feature.
--
-- Also create the Supabase Storage bucket manually (or via the dashboard):
--   1. Go to Storage > New Bucket
--   2. Name: testimonials
--   3. Public: OFF (private)
--   4. Max file size: 1 MB (1048576 bytes)
--   5. Allowed MIME types: image/jpeg, image/png, image/webp
-- Then add RLS policies to the bucket per section below.

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
  status            text           NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'verified')),
  otp_hash          text,
  otp_expires_at    timestamp,
  verified_at       timestamp,
  created_at        timestamp      NOT NULL,
  updated_at        timestamp      NOT NULL,
  is_deleted        boolean        NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_testimonials_user_id   ON testimonials_table (user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_coach_id  ON testimonials_table (coach_id);

-- ─── 2. Row-Level Security ────────────────────────────────────────────────────
-- Enable RLS so the anon/service keys only access allowed rows.
-- Adjust policies to match your Supabase auth setup.

ALTER TABLE testimonials_table ENABLE ROW LEVEL SECURITY;

-- Service-role key (used by the Next.js API) bypasses RLS — no policy needed.
-- If using anon key add granular policies here.

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
