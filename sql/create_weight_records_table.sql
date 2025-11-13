-- Create weight_records_table for Wellness Buddy PWA
-- This table stores weight tracking data with body composition metrics

CREATE TABLE IF NOT EXISTS weight_records_table (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  UserId VARCHAR(255) NOT NULL COMMENT 'User email or unique identifier',
  Weight DECIMAL(5,2) NOT NULL COMMENT 'Weight in kg (e.g., 72.50)',
  Bmi DECIMAL(4,2) DEFAULT NULL COMMENT 'Body Mass Index',
  BodyFat DECIMAL(4,2) DEFAULT NULL COMMENT 'Body Fat Percentage',
  MuscleMass DECIMAL(5,2) DEFAULT NULL COMMENT 'Muscle Mass in kg',
  Bmr INT DEFAULT NULL COMMENT 'Basal Metabolic Rate (calories)',
  WeightImageBase64 LONGTEXT DEFAULT NULL COMMENT 'Base64 encoded image of weighing scale',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  IsDeleted TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag (0=active, 1=deleted)',
  
  INDEX idx_user_id (UserId),
  INDEX idx_created_at (CreatedAt),
  INDEX idx_is_deleted (IsDeleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stores weight tracking and body composition data';

-- Display success message
SELECT 'Table weight_records_table created successfully!' AS Status;
