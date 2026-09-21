-- Migration: create_community_id_requests_table
-- Run this SQL in the Supabase SQL editor before deploying Community ID OTP approval.
-- Pending create / co-sponsor requests from Home → Profile. OTP hashes live here
-- until the requester's sponsor approves (24h). Auth is enforced at the API layer;
-- RLS is on so the anon key cannot read OTP hashes.

CREATE TABLE IF NOT EXISTS community_id_requests_table (
  "Id"                  bigserial      PRIMARY KEY,
  "RequesterId"         bigint         NOT NULL,
  "ApproverId"          bigint         NOT NULL,
  "CommunityId"         text           NOT NULL,
  "RequestKind"         text           NOT NULL
                        CHECK ("RequestKind" IN ('create', 'co-sponsor')),
  "MainSponsorId"       bigint,
  "MainSponsorName"     text,
  "OtpHash"             text           NOT NULL,
  "OtpExpiresAt"        timestamptz    NOT NULL,
  "OtpSentAt"           timestamptz,
  "OtpAttempts"         integer        NOT NULL DEFAULT 0,
  "Status"              text           NOT NULL DEFAULT 'pending'
                        CHECK ("Status" IN ('pending', 'approved', 'cancelled', 'expired')),
  "RequestedAt"         timestamptz    NOT NULL,
  "ProcessedAt"         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_community_id_requests_requester_status
  ON community_id_requests_table ("RequesterId", "Status");

CREATE INDEX IF NOT EXISTS idx_community_id_requests_community_status
  ON community_id_requests_table ("CommunityId", "Status");

ALTER TABLE community_id_requests_table ENABLE ROW LEVEL SECURITY;

GRANT ALL ON community_id_requests_table TO service_role;
GRANT USAGE, SELECT ON SEQUENCE community_id_requests_table_Id_seq TO service_role;
