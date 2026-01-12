-- Create disease_table in Supabase
-- This table tracks user disease/health conditions

CREATE TABLE IF NOT EXISTS disease_table (
  "EntryId" INTEGER PRIMARY KEY,
  "EntryUser" VARCHAR(100) NOT NULL,
  "EntryDate" DATE NOT NULL,
  "DiseaseName" TEXT NOT NULL,
  "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_disease_user ON disease_table("EntryUser");
CREATE INDEX IF NOT EXISTS idx_disease_date ON disease_table("EntryDate");
