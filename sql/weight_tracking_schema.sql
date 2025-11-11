-- Weight Tracking Schema for Wellness Buddy
-- Stores weight measurements with photos and OCR-extracted values

CREATE TABLE IF NOT EXISTS weight_entries_table (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    WeightValue DECIMAL(5,2) NOT NULL COMMENT 'Weight in kg (e.g., 72.50)',
    WeightUnit VARCHAR(10) DEFAULT 'kg' COMMENT 'Unit: kg or lbs',
    ImagePath VARCHAR(500) DEFAULT NULL COMMENT 'Local path to scale photo',
    ImageBase64 LONGTEXT DEFAULT NULL COMMENT 'Base64 encoded photo of weighing scale',
    OCRConfidence DECIMAL(5,2) DEFAULT NULL COMMENT 'OCR confidence score (0-100)',
    OCRRawText TEXT DEFAULT NULL COMMENT 'Raw OCR extracted text',
    DeviceInfo VARCHAR(200) DEFAULT NULL COMMENT 'Device used for capture',
    Notes TEXT DEFAULT NULL COMMENT 'Optional user notes',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    IsDeleted TINYINT(1) DEFAULT 0,
    
    INDEX idx_user_date (UserID, CreatedAt),
    INDEX idx_created (CreatedAt),
    
    FOREIGN KEY (UserID) REFERENCES team_table(UserId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Weight tracking with OCR from scale photos';

-- Sample query to retrieve user weight history
-- SELECT ID, WeightValue, WeightUnit, OCRConfidence, CreatedAt 
-- FROM weight_entries_table 
-- WHERE UserID = ? AND IsDeleted = 0 
-- ORDER BY CreatedAt DESC 
-- LIMIT 30;
