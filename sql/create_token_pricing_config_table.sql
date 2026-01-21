-- Token Pricing Configuration Table
-- This table stores user-specific token pricing configurations (USD per million tokens)
-- Allows users to customize pricing rates for different AI models

CREATE TABLE IF NOT EXISTS token_pricing_config_table (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    UserId VARCHAR(255) NOT NULL,
    Email VARCHAR(255) NOT NULL,
    
    -- Model-specific pricing (USD per 1 million tokens)
    ModelName VARCHAR(100) DEFAULT 'gemini-2.5-flash-lite',
    InputPerMillion DECIMAL(10, 4) DEFAULT 0.1000,  -- $0.10 per 1M input tokens
    OutputPerMillion DECIMAL(10, 4) DEFAULT 0.4000, -- $0.40 per 1M output tokens
    
    -- Timestamps
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better query performance
    UNIQUE KEY unique_user_model (UserId, ModelName),
    INDEX idx_user_id (UserId),
    INDEX idx_email (Email),
    INDEX idx_model_name (ModelName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- supabase version ================================================
-- CREATE TABLE IF NOT EXISTS token_pricing_config_table (
--     id SERIAL PRIMARY KEY,
--     user_id VARCHAR(255) NOT NULL,
--     email VARCHAR(255) NOT NULL,
--     model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash-lite',
--     input_per_million DECIMAL(10, 4) DEFAULT 0.1000,
--     output_per_million DECIMAL(10, 4) DEFAULT 0.4000,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (user_id, model_name)
-- );

-- =================================================================

-- Insert default configuration for existing users (if needed)
-- This can be run after table creation to set default values
-- Uncomment and modify as needed:
/*
INSERT INTO token_pricing_config_table (UserId, Email, ModelName, InputPerMillion, OutputPerMillion)
SELECT DISTINCT UserId, Email, 'gemini-2.5-flash-lite', 0.1000, 0.4000
FROM ai_token_usage_table
WHERE UserId NOT IN (SELECT UserId FROM token_pricing_config_table)
ON DUPLICATE KEY UPDATE UpdatedAt = CURRENT_TIMESTAMP;
*/

-- Supabase version (PascalCase to snake_case mapping)
-- Run this in Supabase SQL Editor:
/*
CREATE TABLE IF NOT EXISTS token_pricing_config_table (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash-lite',
    input_per_million DECIMAL(10, 4) DEFAULT 0.1000,
    output_per_million DECIMAL(10, 4) DEFAULT 0.4000,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (user_id, model_name)
);

CREATE INDEX idx_token_pricing_user_id ON token_pricing_config_table(user_id);
CREATE INDEX idx_token_pricing_email ON token_pricing_config_table(email);
CREATE INDEX idx_token_pricing_model ON token_pricing_config_table(model_name);
*/
