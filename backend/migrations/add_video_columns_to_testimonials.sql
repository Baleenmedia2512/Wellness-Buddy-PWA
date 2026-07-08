-- Migration: add_video_columns_to_testimonials
-- Adds health_results and business_results video upload support to testimonials_table.
-- Each video has its own storage path, independent OTP flow, and status lifecycle.
--
-- STORAGE BUCKET NOTE:
--   The existing 'testimonials' bucket is reused for videos.
--   Update the bucket Max File Size to 50 MB in the Supabase dashboard to support video files.
--
-- Run ONCE in the Supabase SQL editor.

-- ─── 1. Add video columns ─────────────────────────────────────────────────────

ALTER TABLE testimonials_table
  ADD COLUMN IF NOT EXISTS health_video_path       text,
  ADD COLUMN IF NOT EXISTS business_video_path     text,
  ADD COLUMN IF NOT EXISTS video_status            text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_otp_hash          text,
  ADD COLUMN IF NOT EXISTS video_otp_expires_at    timestamp,
  ADD COLUMN IF NOT EXISTS video_verified_at       timestamp;

-- ─── 2. Add CHECK constraint for video_status ─────────────────────────────────

ALTER TABLE testimonials_table
  ADD CONSTRAINT testimonials_video_status_check
  CHECK (video_status IN ('none', 'pending', 'verified'));

-- ─── 3. Verification ──────────────────────────────────────────────────────────
-- After running, verify with:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'testimonials_table'
--   ORDER BY ordinal_position;
