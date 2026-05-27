-- ============================================================================
-- Migration: drop_legacy_share_columns_from_food.sql
-- Purpose:   PR 5 — flip captures_table to CANONICAL for share-link resolve.
--            Drop the three legacy columns from food_nutrition_data_table
--            that captures_table now owns:
--              • PublicShareToken  → moved to captures_table
--              • ShareExpiresAt    → moved to captures_table
--              • ImageType         → moved to captures_table (state machine
--                                    enforced by features/captures/domain/)
--
--            After this migration:
--            • Every new capture is identified by captures_table.PublicShareToken.
--            • food_nutrition_data_table is a pure feature table (food analysis
--              data) linked to its capture via the nullable CaptureID FK
--              created in link_features_to_captures.sql.
--            • listAnalyses no longer filters on ImageType — it filters on
--              `AnalysisData IS NOT NULL` (only completed food analyses).
--
-- Author:    [ai-assisted] tool=copilot, scope=captures + background-analysis
-- ============================================================================
-- Forward-only. To revert, write a new migration that re-adds the columns
-- and backfills from captures_table. There is no automatic rollback path.
--
-- BREAKING CHANGE NOTICE — accepted by product owner:
--   Pre-PR-2 historical rows in food_nutrition_data_table have CaptureID=NULL
--   (no captures_table twin was created for them). After this migration,
--   those rows' share URLs return 404 because the resolve path now reads
--   captures_table exclusively. This loss is intentional; no backfill is
--   planned for legacy rows.
--
-- PREREQUISITES (must be applied first, in this order):
--   1. create_captures_table.sql
--   2. add_image_type_to_captures.sql
--   3. link_features_to_captures.sql
-- If any prerequisite is missing this migration will succeed (columns just
-- get dropped) but the application will fail at runtime — the resolve path
-- depends on captures_table existing and being populated.
-- ============================================================================

BEGIN;

ALTER TABLE food_nutrition_data_table
  DROP COLUMN IF EXISTS "PublicShareToken";

ALTER TABLE food_nutrition_data_table
  DROP COLUMN IF EXISTS "ShareExpiresAt";

ALTER TABLE food_nutrition_data_table
  DROP COLUMN IF EXISTS "ImageType";

-- Drop the supporting index that was paired with the dropped PublicShareToken
-- column. CREATE INDEX in earlier migrations used IF NOT EXISTS; we mirror
-- with IF EXISTS so this is idempotent across already-migrated environments.
DROP INDEX IF EXISTS idx_food_nutrition_public_share_token;
DROP INDEX IF EXISTS idx_food_nutrition_image_type;

COMMIT;
