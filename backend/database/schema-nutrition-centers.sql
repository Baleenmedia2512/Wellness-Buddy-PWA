-- =====================================================
-- Schema: Nutrition Centers & Attendance Tracking
-- Version: 1.0.0
-- Date: March 7, 2026
-- =====================================================

-- =====================================================
-- Table: nutrition_centers_table
-- Stores registered nutrition centers/clubs
-- =====================================================
CREATE TABLE IF NOT EXISTS nutrition_centers_table (
  id SERIAL PRIMARY KEY,
  center_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  education_hour TIME,  -- e.g., "09:00:00"
  owner_user_id INTEGER REFERENCES team_table("UserId"),
  owner_phone VARCHAR(20),
  registered_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Indexes
  CONSTRAINT valid_coordinates CHECK (
    latitude BETWEEN -90 AND 90 AND 
    longitude BETWEEN -180 AND 180
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nutrition_centers_owner ON nutrition_centers_table(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_centers_status ON nutrition_centers_table(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_nutrition_centers_location ON nutrition_centers_table(latitude, longitude);

-- =====================================================
-- Alter education_logs_table
-- Add location tracking & attendance type
-- =====================================================
-- Check if columns exist before adding (idempotent)
DO $$ 
BEGIN
  -- Add latitude column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='education_logs_table' AND column_name='latitude'
  ) THEN
    ALTER TABLE education_logs_table 
      ADD COLUMN latitude DECIMAL(10, 8);
  END IF;

  -- Add longitude column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='education_logs_table' AND column_name='longitude'
  ) THEN
    ALTER TABLE education_logs_table 
      ADD COLUMN longitude DECIMAL(11, 8);
  END IF;

  -- Add attendance_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='education_logs_table' AND column_name='attendance_type'
  ) THEN
    ALTER TABLE education_logs_table 
      ADD COLUMN attendance_type VARCHAR(10) CHECK (attendance_type IN ('club', 'remote'));
  END IF;

  -- Add nutrition_center_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='education_logs_table' AND column_name='nutrition_center_id'
  ) THEN
    ALTER TABLE education_logs_table 
      ADD COLUMN nutrition_center_id INTEGER REFERENCES nutrition_centers_table(id);
  END IF;
END $$;

-- Create index on nutrition_center_id for attendance queries
CREATE INDEX IF NOT EXISTS idx_education_logs_center ON education_logs_table(nutrition_center_id);
CREATE INDEX IF NOT EXISTS idx_education_logs_attendance ON education_logs_table(attendance_type);

-- =====================================================
-- Example Data (for testing)
-- =====================================================
-- Uncomment to insert sample data:
/*
INSERT INTO nutrition_centers_table 
  (center_name, latitude, longitude, education_hour, owner_user_id, owner_phone)
VALUES 
  ('Downtown Wellness Hub', 40.7128, -74.0060, '09:00:00', 1, '+1-234-567-8900'),
  ('Uptown Health Center', 34.0522, -118.2437, '10:00:00', 2, '+1-234-567-8901');
*/

-- =====================================================
-- Verification Queries
-- =====================================================
-- Run these to verify the schema was created correctly:

-- Check nutrition_centers_table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'nutrition_centers_table' 
-- ORDER BY ordinal_position;

-- Check education_logs_table new columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'education_logs_table' 
-- AND column_name IN ('latitude', 'longitude', 'attendance_type', 'nutrition_center_id')
-- ORDER BY ordinal_position;
