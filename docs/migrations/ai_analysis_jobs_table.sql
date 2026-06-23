-- Migration: docs/migrations/ai_analysis_jobs_table.sql
-- Purpose:   Durable backing store for the AI enrichment job queue.
--            In-memory JobQueue is authoritative within a Vercel function lifetime;
--            this table provides durability across cold starts and multi-instance deploys.
--
-- Reviewed by: @principal-eng + @dba  (required per claude.md §9)
-- ADR:         docs/adr/0005-enterprise-ai-orchestration-architecture.md
--
-- IMPORTANT: This is a FORWARD-ONLY migration. Do not drop or modify existing columns.
--            A compensating migration must be used if a rollback is required.
--
-- Run via: scripts/migration-apply.js

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_analysis_jobs_table (
  "JobId"            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "CaptureId"        TEXT         NOT NULL,
  "UserID"           BIGINT       REFERENCES users_table("ID") ON DELETE CASCADE,
  "TraceId"          UUID         NOT NULL,
  "MimeType"         TEXT         NOT NULL DEFAULT 'image/jpeg',
  "FastNutrition"    JSONB,
  "FoodRowId"        BIGINT       REFERENCES food_nutrition_data_table("ID") ON DELETE SET NULL,
  "Status"           TEXT         NOT NULL DEFAULT 'pending'
                                  CHECK ("Status" IN ('pending','processing','completed','failed')),
  "RetryCount"       SMALLINT     NOT NULL DEFAULT 0,
  "LastError"        TEXT,
  "EnrichmentResult" JSONB,
  "CreatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "UpdatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "IsDeleted"        SMALLINT     NOT NULL DEFAULT 0
  -- NOTE: imageBase64 is intentionally NOT stored here to avoid PII exposure.
  --       The in-memory JobQueue carries it for the lifetime of the warm instance.
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Worker CLAIM query: find oldest pending, non-deleted jobs.
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created
  ON ai_analysis_jobs_table ("Status", "CreatedAt")
  WHERE "IsDeleted" = 0 AND "Status" = 'pending';

-- Dedup check / status lookup by captureId.
CREATE INDEX IF NOT EXISTS idx_ai_jobs_capture
  ON ai_analysis_jobs_table ("CaptureId")
  WHERE "IsDeleted" = 0;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Required per claude.md §13 — RLS must be enabled on every new table.

ALTER TABLE ai_analysis_jobs_table ENABLE ROW LEVEL SECURITY;

-- Users may read only their own job records.
-- Workers use the Supabase service-role key which bypasses RLS.
CREATE POLICY ai_jobs_owner_read ON ai_analysis_jobs_table
  FOR SELECT
  USING (auth.uid()::text = "UserID"::text);

-- ── UpdatedAt trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."UpdatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_jobs_updated_at ON ai_analysis_jobs_table;

CREATE TRIGGER trg_ai_jobs_updated_at
  BEFORE UPDATE ON ai_analysis_jobs_table
  FOR EACH ROW
  EXECUTE FUNCTION set_ai_jobs_updated_at();
