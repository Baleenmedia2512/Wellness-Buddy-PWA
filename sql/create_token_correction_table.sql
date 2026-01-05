-- Token Correction Table
-- This table stores original and corrected token cost data for tracking pricing adjustments

CREATE TABLE IF NOT EXISTS token_correction_table (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    UserId VARCHAR(255) NOT NULL,
    
    -- Original costs (from old pricing or before correction)
    InputCost DECIMAL(10, 4) DEFAULT 0.0000,
    OutputCost DECIMAL(10, 4) DEFAULT 0.0000,
    TotalCost DECIMAL(10, 4) DEFAULT 0.0000,
    
    -- Corrected costs (with updated pricing rates)
    CorrectedInputCost DECIMAL(10, 4) DEFAULT 0.0000,
    CorrectedOutputCost DECIMAL(10, 4) DEFAULT 0.0000,
    CorrectedTotalCost DECIMAL(10, 4) DEFAULT 0.0000,
    
    -- Timestamps
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    LastCorrected TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    TimesCorrected INT DEFAULT 0,
    
    -- Indexes for better query performance
    INDEX idx_user_id (UserId),
    INDEX idx_created_at (CreatedAt),
    INDEX idx_last_corrected (LastCorrected)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample query to insert correction data
-- INSERT INTO token_correction_table (
--     user_id, 
--     input_cost, 
--     output_cost, 
--     total_cost,
--     corrected_input_cost,
--     corrected_output_cost,
--     corrected_total_cost
-- ) VALUES (
--     'user123',
--     0.0082,
--     0.0027,
--     0.0109,
--     0.0109,
--     0.0036,
--     0.0145
-- );

-- Sample query to get all corrections for a user
-- SELECT * FROM token_correction_table 
-- WHERE user_id = 'user123' 
-- ORDER BY created_at DESC;

-- Sample query to get total corrected costs by user
-- SELECT 
--     user_id,
--     SUM(total_cost) as original_total,
--     SUM(corrected_total_cost) as corrected_total,
--     SUM(corrected_total_cost - total_cost) as cost_difference,
--     COUNT(*) as correction_count
-- FROM token_correction_table
-- GROUP BY user_id
-- ORDER BY cost_difference DESC;
