-- Add medical_condition column to testimonials_table.
-- Run forward-only on production clone before deploy.

ALTER TABLE testimonials_table
  ADD COLUMN IF NOT EXISTS medical_condition VARCHAR(100);

COMMENT ON COLUMN testimonials_table.medical_condition IS
  'Primary medical condition / disease for the member health assessment (catalog pick or custom text).';
