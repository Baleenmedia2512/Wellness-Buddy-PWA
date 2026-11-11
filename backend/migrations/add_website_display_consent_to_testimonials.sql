-- Migration: add_website_display_consent_to_testimonials
-- Member must agree + verify email OTP before Transformation media appears
-- on upline coach public websites (What We Say / What We Do).
--
-- Run ONCE. Forward-only.

ALTER TABLE testimonials_table
  ADD COLUMN IF NOT EXISTS website_display_agreed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_display_consent_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS website_display_consent_revoked_at TIMESTAMP NULL;
