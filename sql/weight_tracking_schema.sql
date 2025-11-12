-- Weight Tracking Table Schema
-- Stores user weight entries captured via OCR from weighing scale photos

CREATE TABLE IF NOT EXISTS weight_tracking (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  UserID VARCHAR(255) NOT NULL,
  WeightValue DECIMAL(5,2) NOT NULL COMMENT 'Weight in kg (e.g., 72.50)',
  Unit VARCHAR(10) DEFAULT 'kg' COMMENT 'Weight unit (kg or lbs)',
  ImagePath VARCHAR(500) DEFAULT NULL COMMENT 'Path or filename of the weighing scale photo',
  ImageBase64 LONGTEXT DEFAULT NULL COMMENT 'Base64 encoded image data',
  ConfidenceScore DECIMAL(3,2) DEFAULT NULL COMMENT 'OCR confidence score (0.00 to 1.00)',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when the entry was created',
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  IsDeleted TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag',
  Notes TEXT DEFAULT NULL COMMENT 'Optional notes from user',
  INDEX idx_user_id (UserID),
  INDEX idx_created_at (CreatedAt),
  INDEX idx_is_deleted (IsDeleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stores weight tracking entries from OCR-scanned weighing scale photos';

-- Sample query to get user's weight history
-- SELECT ID, WeightValue, Unit, CreatedAt, ConfidenceScore 
-- FROM weight_tracking 
-- WHERE UserID = ? AND IsDeleted = 0 
-- ORDER BY CreatedAt DESC;
