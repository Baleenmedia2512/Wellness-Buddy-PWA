-- Create discipline_table in Supabase
-- This table tracks discipline schedules (activity time windows for users)

CREATE TABLE IF NOT EXISTS discipline_table (
  id INTEGER PRIMARY KEY,
  entry_date DATE NOT NULL,
  entry_user VARCHAR(100) NOT NULL,
  activity VARCHAR(100) NOT NULL,
  activity_start_time TIME NOT NULL,
  activity_end_time TIME NOT NULL,
  validity_start_date DATE NOT NULL,
  validity_end_date DATE NOT NULL,
  track_for_discipline INTEGER DEFAULT 1,
  discipline_group_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_discipline_user ON discipline_table(entry_user);
CREATE INDEX IF NOT EXISTS idx_discipline_activity ON discipline_table(activity);
CREATE INDEX IF NOT EXISTS idx_discipline_validity ON discipline_table(validity_start_date, validity_end_date);
CREATE INDEX IF NOT EXISTS idx_discipline_group ON discipline_table(discipline_group_id);
