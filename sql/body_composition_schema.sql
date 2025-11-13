-- =====================================================
-- Body Composition Tracking Schema
-- =====================================================
-- Created: November 11, 2025
-- Purpose: Store comprehensive body composition metrics
-- =====================================================

CREATE TABLE IF NOT EXISTS body_composition_entries (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    
    -- Basic Metrics
    Weight DECIMAL(6,2) NOT NULL COMMENT 'Weight in kg',
    WeightUnit VARCHAR(10) DEFAULT 'kg' COMMENT 'kg or lbs',
    BMI DECIMAL(4,1) NULL COMMENT 'Body Mass Index',
    
    -- Body Fat Metrics
    BodyFatPercentage DECIMAL(4,1) NULL COMMENT 'Body fat percentage',
    SubcutaneousFat DECIMAL(4,1) NULL COMMENT 'Subcutaneous fat percentage',
    VisceralFat DECIMAL(4,1) NULL COMMENT 'Visceral fat level',
    
    -- Muscle Metrics
    MuscleRate DECIMAL(4,1) NULL COMMENT 'Muscle rate percentage',
    SkeletalMuscle DECIMAL(4,1) NULL COMMENT 'Skeletal muscle percentage',
    MuscleMass DECIMAL(6,2) NULL COMMENT 'Muscle mass in kg',
    
    -- Composition Metrics
    FatFreeBodyWeight DECIMAL(6,2) NULL COMMENT 'Fat-free body weight in kg',
    BoneMass DECIMAL(4,2) NULL COMMENT 'Bone mass in kg',
    Protein DECIMAL(4,1) NULL COMMENT 'Protein percentage',
    BodyWater DECIMAL(4,1) NULL COMMENT 'Body water percentage',
    
    -- Metabolic Metrics
    BMR INT NULL COMMENT 'Basal Metabolic Rate in kcal',
    BodyAge INT NULL COMMENT 'Biological body age',
    
    -- Status Indicators (calculated or user input)
    WeightStatus VARCHAR(20) NULL COMMENT 'Standard, Overweight, etc.',
    BodyFatStatus VARCHAR(20) NULL COMMENT 'Excellent, Fitness, Standard, etc.',
    MuscleStatus VARCHAR(20) NULL COMMENT 'Standard, High, Low',
    VisceralFatStatus VARCHAR(20) NULL COMMENT 'Excellent, Good, Standard, High',
    
    -- Image and Notes
    ImageBase64 LONGTEXT NULL COMMENT 'Base64 encoded scale image',
    ImagePath VARCHAR(500) NULL COMMENT 'Alternative image path',
    Notes TEXT NULL COMMENT 'User notes about measurement',
    
    -- OCR Data (if extracted from image)
    OCRConfidence DECIMAL(5,2) NULL COMMENT 'OCR confidence score 0-100',
    OCRRawText TEXT NULL COMMENT 'Raw OCR text from image',
    
    -- Measurement Context
    MeasurementTime TIME NULL COMMENT 'Time of day measured',
    MeasurementCondition VARCHAR(50) NULL COMMENT 'Before/after meal, morning, evening',
    
    -- Timestamps
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    DeletedAt TIMESTAMP NULL COMMENT 'Soft delete timestamp',
    
    -- Indexes
    INDEX idx_user_created (UserID, CreatedAt),
    INDEX idx_user_deleted (UserID, DeletedAt),
    INDEX idx_created_date (CreatedAt)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sample Data Insert
-- =====================================================

-- Example: Complete body composition entry
-- INSERT INTO body_composition_entries (
--     UserID, Weight, WeightUnit, BMI,
--     BodyFatPercentage, SubcutaneousFat, VisceralFat,
--     MuscleRate, SkeletalMuscle, MuscleMass,
--     FatFreeBodyWeight, BoneMass, Protein, BodyWater,
--     BMR, BodyAge,
--     WeightStatus, BodyFatStatus, MuscleStatus, VisceralFatStatus,
--     MeasurementTime, MeasurementCondition, Notes
-- ) VALUES (
--     1, 73.30, 'kg', 22.6,
--     15.8, 14.0, 5.7,
--     80.0, 54.4, 58.6,
--     61.7, 3.1, 19.2, 60.8,
--     1703, 37,
--     'Standard', 'Fitness', 'Standard', 'Low',
--     '08:30:00', 'Morning - Before breakfast', 'Feeling good today'
-- );

-- =====================================================
-- Status Calculation Reference
-- =====================================================

/*
WEIGHT STATUS (BMI-based):
- Underweight: BMI < 18.5
- Standard: BMI 18.5-24.9
- Overweight: BMI 25-29.9
- Obese: BMI >= 30

BODY FAT STATUS (Age & Gender dependent):
Men:
- Excellent: 6-13%
- Fitness: 14-17%
- Standard: 18-24%
- High: 25%+

Women:
- Excellent: 14-20%
- Fitness: 21-24%
- Standard: 25-31%
- High: 32%+

VISCERAL FAT STATUS:
- Excellent: 1-9
- Good: 10-14
- Standard: 15-19
- High: 20+

MUSCLE RATE STATUS:
- High: > 75%
- Standard: 65-75%
- Low: < 65%
*/

-- =====================================================
-- Queries for Analytics
-- =====================================================

-- Get latest body composition for user
-- SELECT * FROM body_composition_entries 
-- WHERE UserID = ? AND DeletedAt IS NULL 
-- ORDER BY CreatedAt DESC LIMIT 1;

-- Get body composition trend (last 30 days)
-- SELECT DATE(CreatedAt) as Date, 
--        Weight, BMI, BodyFatPercentage, MuscleMass, BMR
-- FROM body_composition_entries
-- WHERE UserID = ? AND DeletedAt IS NULL
--   AND CreatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
-- ORDER BY CreatedAt ASC;

-- Calculate changes from previous entry
-- SELECT 
--     a.Weight - b.Weight as WeightChange,
--     a.BMI - b.BMI as BMIChange,
--     a.BodyFatPercentage - b.BodyFatPercentage as BodyFatChange,
--     a.MuscleMass - b.MuscleMass as MuscleMassChange
-- FROM body_composition_entries a
-- LEFT JOIN body_composition_entries b ON b.UserID = a.UserID 
--     AND b.CreatedAt < a.CreatedAt 
--     AND b.DeletedAt IS NULL
-- WHERE a.UserID = ? AND a.DeletedAt IS NULL
-- ORDER BY b.CreatedAt DESC
-- LIMIT 1;
