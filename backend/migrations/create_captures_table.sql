-- ============================================================================
-- Migration: create_captures_table.sql
-- Purpose:   Introduce a dedicated captures_table that owns every photo the
--            user takes (food, weight, education, smartwatch, or unknown).
--            This is the first step of the architecture split that removes
--            the share-link / image-bytes / discriminator overload from
--            food_nutrition_data_table.
-- Author:    [ai-assisted] tool=copilot, scope=captures
-- ============================================================================
-- Forward-only. To revert, write a new migration that drops the table.
-- This migration is BEHAVIOR-PRESERVING on its own: no code reads or writes
-- this table yet. PR 2 (backend) wires up dual-write; PR 4 (cleanup) drops
-- the legacy share columns from food_nutrition_data_table once dual-write
-- has soaked through one release cycle.
--
-- Naming follows existing repo convention: PascalCase quoted column names,
-- snake_case table name with `_table` suffix.
--
-- Authorization model: app-layer ownership check via "UserID" filter, matching
-- the rest of the schema (food_nutrition_data_table, weight_records_table,
-- education_logs_table). RLS is NOT enabled here for consistency — a separate
-- cross-table RLS rollout is tracked in a follow-up PR per claude.md §2.7.
-- ============================================================================

CREATE TABLE IF NOT EXISTS captures_table (
  "ID"               bigserial    PRIMARY KEY,

  -- Owner of the capture. Stored as text to match food_nutrition_data_table
  -- ("UserID" text) and team_table ("UserId" varies). All writes pass
  -- userId.toString().
  "UserID"           text         NOT NULL,

  -- Share-link identity. Universal — generated for EVERY capture so the
  -- recipient gets a working link regardless of image type. Unknown captures
  -- get a token too; they're auto-purged after 24h by a separate job.
  "PublicShareToken" uuid         NOT NULL UNIQUE,
  "ShareExpiresAt"   timestamptz  NULL,

  -- Image payload. Kept on the capture row so any feature can render the
  -- shared image without joining back to a feature-specific table.
  "ImageBase64"      text         NULL,
  "ImagePath"        text         NULL,

  -- Single source of truth for the image-type discriminator. Replaces the
  -- "ImageType" column on food_nutrition_data_table after PR 4.
  --
  -- State machine (enforced by PR 2 domain layer):
  --   'pending'    → initial state on insert
  --   'pending'    → 'food' | 'weight' | 'education' | 'smartwatch' | 'unknown'
  --   no other transitions allowed
  --
  -- Adding a new type later = add to the CHECK below (additive migration).
  "ImageType"        varchar(20)  NOT NULL DEFAULT 'pending',

  -- Provenance fields, mirror food_nutrition_data_table for parity.
  "DeviceInfo"       text         NULL,
  "ProcessedBy"      varchar(50)  NULL,

  -- Soft-delete column matches the repo-wide convention.
  "IsDeleted"        smallint     NOT NULL DEFAULT 0,

  "CreatedAt"        timestamptz  NOT NULL DEFAULT now(),
  "UpdatedAt"        timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT chk_captures_image_type CHECK (
    "ImageType" IN ('pending','food','weight','education','smartwatch','unknown')
  )
);

-- Hot path: GET /api/v1/captures/resolve?token=... and the public share page.
CREATE INDEX IF NOT EXISTS idx_captures_public_share_token
  ON captures_table ("PublicShareToken");

-- Hot path: lookups by owner + recency (dashboards, history, audits).
CREATE INDEX IF NOT EXISTS idx_captures_user_created
  ON captures_table ("UserID", "CreatedAt" DESC);

-- Used by the dashboard filter (e.g. WHERE ImageType='food') once the
-- legacy column is dropped from food_nutrition_data_table in PR 4.
CREATE INDEX IF NOT EXISTS idx_captures_image_type
  ON captures_table ("ImageType");

-- Supports the daily auto-purge of unknown captures (retention = 24h).
-- Partial index keeps it tiny — only indexes the rows the job actually scans.
CREATE INDEX IF NOT EXISTS idx_captures_unknown_created
  ON captures_table ("CreatedAt")
  WHERE "ImageType" = 'unknown';
