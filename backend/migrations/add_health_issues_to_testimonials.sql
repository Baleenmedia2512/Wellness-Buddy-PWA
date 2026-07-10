-- Migration: add_health_issues_to_testimonials
-- Adds recovered_health_issues JSONB array to testimonials_table.
-- Stores a list of disease/condition names the member recovered from during their wellness journey.
-- Each element is a plain string (disease label). Example: ["Diabetes Type 2", "High Blood Pressure"]
--
-- Run ONCE in the Supabase SQL editor.

-- ─── 1. Add column ────────────────────────────────────────────────────────────

ALTER TABLE testimonials_table
  ADD COLUMN IF NOT EXISTS recovered_health_issues jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ─── 2. Verification ──────────────────────────────────────────────────────────
-- After running, verify with:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'testimonials_table' AND column_name = 'recovered_health_issues';
