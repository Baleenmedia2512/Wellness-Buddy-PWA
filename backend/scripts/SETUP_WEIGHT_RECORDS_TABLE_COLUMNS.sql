-- Create weight_records_table columns with PascalCase naming

-- Add columns if table doesn't have them
ALTER TABLE weight_records_table 
ADD COLUMN IF NOT EXISTS "ID" INTEGER PRIMARY KEY,
ADD COLUMN IF NOT EXISTS "UserId" INTEGER,
ADD COLUMN IF NOT EXISTS "Weight" NUMERIC,
ADD COLUMN IF NOT EXISTS "Bmi" NUMERIC,
ADD COLUMN IF NOT EXISTS "BodyFat" NUMERIC,
ADD COLUMN IF NOT EXISTS "MuscleMass" NUMERIC,
ADD COLUMN IF NOT EXISTS "Bmr" INTEGER,
ADD COLUMN IF NOT EXISTS "WeightImageBase64" TEXT,
ADD COLUMN IF NOT EXISTS "CreatedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "UpdatedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "IsDeleted" INTEGER;

-- Final columns in PascalCase:
-- ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, 
-- WeightImageBase64, CreatedAt, UpdatedAt, IsDeleted
