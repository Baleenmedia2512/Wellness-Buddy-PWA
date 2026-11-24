-- Migration: create_profile_change_requests_table
-- Unified sponsor OTP for later profile field changes (ADR-0018).
-- PendingPayload JSON holds the gated patch until the coach approves (24h).

CREATE TABLE IF NOT EXISTS profile_change_requests_table (
  Id              BIGINT       NOT NULL AUTO_INCREMENT,
  RequesterId     BIGINT       NOT NULL,
  ApproverId      BIGINT       NOT NULL,
  PendingPayload  JSON         NOT NULL,
  ChangedKeys     JSON         NOT NULL,
  OtpHash         VARCHAR(255) NOT NULL,
  OtpExpiresAt    DATETIME     NOT NULL,
  OtpSentAt       DATETIME     NULL,
  OtpAttempts     INT          NOT NULL DEFAULT 0,
  Status          VARCHAR(16)  NOT NULL DEFAULT 'pending',
  RequestedAt     DATETIME     NOT NULL,
  ProcessedAt     DATETIME     NULL,
  PRIMARY KEY (Id),
  KEY idx_profile_change_requests_requester_status (RequesterId, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
