-- Create education_logs_table in Supabase
-- This table tracks user education activity with screenshots

CREATE TABLE IF NOT EXISTS education_logs_table (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  platform VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  confidence DECIMAL(3, 2),
  device_info TEXT,
  image_base64 TEXT,
  is_deleted INTEGER DEFAULT 0
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_education_logs_user ON education_logs_table(user_id);
CREATE INDEX IF NOT EXISTS idx_education_logs_created ON education_logs_table(created_at);
CREATE INDEX IF NOT EXISTS idx_education_logs_platform ON education_logs_table(platform);
