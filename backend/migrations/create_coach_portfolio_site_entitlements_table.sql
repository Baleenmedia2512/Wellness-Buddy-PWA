-- Digital Portfolio: ₹399/year per website slot (Cashfree).
-- Unbound row (SubmissionId NULL) = unused credit. Bound = that site's yearly window.
-- Removal: after MIN_REQUIRED >= PORTFOLIO_SITE_SLOTS_MIN and no legacy trial clients for portfolio.
-- Backfill: grant 365d bound entitlement to every already-published submission (see repo ensure).

CREATE TABLE IF NOT EXISTS coach_portfolio_site_entitlements_table (
  Id            BIGINT        NOT NULL AUTO_INCREMENT,
  OrderId       VARCHAR(64)   NOT NULL,
  UserId        BIGINT        NOT NULL,
  Amount        DECIMAL(10,2) NOT NULL,
  Mode          VARCHAR(16)   NOT NULL,
  Status        VARCHAR(16)   NOT NULL DEFAULT 'pending',
  Kind          VARCHAR(16)   NOT NULL DEFAULT 'credit',
  PaidAt        DATETIME      NULL,
  ExpiresAt     DATETIME      NULL,
  SubmissionId  BIGINT        NULL,
  CenterId      BIGINT        NULL,
  CreatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_portfolio_site_entitlement_order (OrderId),
  KEY idx_portfolio_site_entitlement_user_exp (UserId, Status, ExpiresAt),
  KEY idx_portfolio_site_entitlement_submission (SubmissionId),
  KEY idx_portfolio_site_entitlement_center (CenterId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
