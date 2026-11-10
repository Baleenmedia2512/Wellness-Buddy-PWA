-- One 14-day report-detail trial per member. StartedAt is UTC.
-- The payments repository also creates this table on first use.
CREATE TABLE IF NOT EXISTS report_trials_table (
  UserId    BIGINT   NOT NULL,
  StartedAt DATETIME NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
