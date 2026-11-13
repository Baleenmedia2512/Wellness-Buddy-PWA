-- Community Position roles and coach OTP requests.
-- Run on MySQL before Profile Community Position OTP is used.
-- Add a new role with INSERT into community_positions_table.
-- Do not hard-code new roles in the app.

CREATE TABLE IF NOT EXISTS community_positions_table (
  Id           BIGINT       NOT NULL AUTO_INCREMENT,
  Code         VARCHAR(40)  NOT NULL,
  Label        VARCHAR(40)  NOT NULL,
  FeatureKey   VARCHAR(40)  NOT NULL,
  UsageNote    VARCHAR(240) NOT NULL,
  SortOrder    INT          NOT NULL DEFAULT 0,
  IsActive     TINYINT(1)   NOT NULL DEFAULT 1,
  CreatedAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_community_positions_code (Code),
  UNIQUE KEY uq_community_positions_feature_key (FeatureKey),
  KEY idx_community_positions_active_sort (IsActive, SortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO community_positions_table
  (Code, Label, FeatureKey, UsageNote, SortOrder, IsActive)
VALUES
  ('PC', 'PC', 'pc', 'Profile role. Features check the key pc.', 10, 1),
  ('ASSOCIATE', 'ASSOCIATE', 'associate', 'Profile role. Features check the key associate.', 20, 1),
  ('SV', 'SV', 'sv', 'Profile role. Features check the key sv.', 30, 1),
  ('WT', 'WT', 'wt', 'Profile role. Features check the key wt.', 40, 1),
  ('AWT', 'AWT', 'awt', 'Profile role. Features check the key awt.', 50, 1),
  ('GET', 'GET', 'get-team', 'Profile role. Features check the key get-team.', 60, 1),
  ('GET 2500', 'GET 2500', 'get-team-2500', 'Profile role. Features check the key get-team-2500.', 70, 1),
  ('MILL', 'MILL', 'mill-team', 'Profile role. Features check the key mill-team.', 80, 1),
  ('MILL 7500', 'MILL 7500', 'mill-7500', 'Profile role. Features check the key mill-7500.', 85, 1),
  ('PT', 'PT', 'pt', 'Profile role. Features check the key pt.', 90, 1);

CREATE TABLE IF NOT EXISTS community_position_requests_table (
  Id            BIGINT       NOT NULL AUTO_INCREMENT,
  RequesterId   BIGINT       NOT NULL,
  ApproverId    BIGINT       NOT NULL,
  PositionCode  VARCHAR(40)  NOT NULL,
  OtpHash       VARCHAR(255) NOT NULL,
  OtpExpiresAt  DATETIME     NOT NULL,
  OtpSentAt     DATETIME     NULL,
  OtpAttempts   INT          NOT NULL DEFAULT 0,
  Status        VARCHAR(16)  NOT NULL DEFAULT 'pending',
  RequestedAt   DATETIME     NOT NULL,
  ProcessedAt   DATETIME     NULL,
  PRIMARY KEY (Id),
  KEY idx_community_position_requests_requester_status (RequesterId, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
