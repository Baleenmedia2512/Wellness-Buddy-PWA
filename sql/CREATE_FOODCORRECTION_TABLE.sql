-- Create foodcorrection_table in Supabase
-- This table tracks AI food detection corrections made by users

CREATE TABLE IF NOT EXISTS foodcorrection_table (
  "Id" INTEGER PRIMARY KEY,
  "UserId" INTEGER NOT NULL,
  "AiDetected" VARCHAR(255) NOT NULL,
  "UserCorrected" VARCHAR(255) NOT NULL,
  "TimesCorrected" INTEGER DEFAULT 1,
  "CreatedAt" TIMESTAMP NOT NULL,
  "LastCorrected" TIMESTAMP NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_foodcorrection_user ON foodcorrection_table("UserId");
CREATE INDEX IF NOT EXISTS idx_foodcorrection_ai_detected ON foodcorrection_table("AiDetected");
CREATE INDEX IF NOT EXISTS idx_foodcorrection_created ON foodcorrection_table("CreatedAt");
