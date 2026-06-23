-- Migration: docs/migrations/food_nutrition_enrichment_status.sql
-- Purpose:   Add EnrichmentStatus column to food_nutrition_data_table so the
--            background job worker can signal micronutrient completion and the
--            client can differentiate between "macros only" and "fully enriched" rows.
--
-- Reviewed by: @principal-eng + @dba  (required per claude.md §9)
-- ADR:         docs/adr/0005-enterprise-ai-orchestration-architecture.md
--
-- IMPORTANT: This is a FORWARD-ONLY migration.
--            Adding a nullable column with a default is non-breaking.
--
-- Run via: scripts/migration-apply.js

-- ── Add column ────────────────────────────────────────────────────────────────
-- Nullable with default 'pending'; existing rows default to 'pending' so they
-- are eligible for re-enrichment by the worker if needed.

ALTER TABLE food_nutrition_data_table
  ADD COLUMN IF NOT EXISTS "EnrichmentStatus" TEXT
    NOT NULL DEFAULT 'pending'
    CHECK ("EnrichmentStatus" IN ('pending', 'processing', 'completed', 'skipped'));

-- ── Index ─────────────────────────────────────────────────────────────────────
-- Used by any future backfill job that needs to find all non-enriched rows.

CREATE INDEX IF NOT EXISTS idx_food_enrichment_status
  ON food_nutrition_data_table ("EnrichmentStatus")
  WHERE "EnrichmentStatus" IN ('pending', 'processing');

-- ── Back-fill ─────────────────────────────────────────────────────────────────
-- Rows created before this migration that already have micronutrient data
-- (vitamin_a, etc. are non-null) should be marked 'completed' to avoid
-- unnecessary re-processing by the worker.

UPDATE food_nutrition_data_table
SET "EnrichmentStatus" = 'completed'
WHERE "TotalVitaminA"  IS NOT NULL
  AND "TotalCalcium"   IS NOT NULL
  AND "EnrichmentStatus" = 'pending';
