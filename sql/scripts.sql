ALTER TABLE team_table ADD COLUMN Email VARCHAR(100);

CREATE TABLE otp_tokens_table (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Recipient VARCHAR(100) NOT NULL,
  ContactType ENUM('phone', 'email') NOT NULL DEFAULT 'email',
  OTPHash VARCHAR(255) NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  Verified TINYINT(1) DEFAULT 0,
  IsActive TINYINT(1) DEFAULT 1,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing background service food analysis results
CREATE TABLE food_nutrition_data_table (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  UserID VARCHAR(255) NOT NULL,
  ImagePath VARCHAR(500) NOT NULL,
  AnalysisData JSON NOT NULL,
  ConfidenceScore DECIMAL(3,2) DEFAULT NULL,
  TotalCalories INT DEFAULT NULL,
  TotalProtein DECIMAL(6,2) DEFAULT NULL,
  TotalCarbs DECIMAL(6,2) DEFAULT NULL,
  TotalFat DECIMAL(6,2) DEFAULT NULL,
  TotalFiber DECIMAL(6,2) DEFAULT NULL,
  ProcessedBy ENUM('background_service', 'manual_app') DEFAULT 'background_service',
  DeviceInfo VARCHAR(255) DEFAULT NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_created (UserID, CreatedAt),
  INDEX idx_created_at (CreatedAt),
  INDEX idx_processed_by (ProcessedBy)
);

ALTER TABLE food_nutrition_data_table ADD COLUMN ImageBase64 LONGTEXT DEFAULT NULL;

ALTER TABLE food_nutrition_data_table
ADD COLUMN IsDeleted TINYINT(1) NOT NULL DEFAULT 0 
