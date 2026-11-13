-- Cashfree Premium orders. ExpiresAt is the last India calendar day of access.
CREATE TABLE IF NOT EXISTS premium_orders_table (
  Id        BIGINT        NOT NULL AUTO_INCREMENT,
  OrderId   VARCHAR(64)   NOT NULL,
  UserId    BIGINT        NOT NULL,
  Amount    DECIMAL(10,2) NOT NULL,
  Mode      VARCHAR(16)   NOT NULL,
  Status    VARCHAR(16)   NOT NULL DEFAULT 'paid',
  PaidAt    DATETIME      NOT NULL,
  ExpiresAt DATETIME      NULL,
  CreatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_premium_orders_order (OrderId),
  KEY idx_premium_orders_user_mode (UserId, Mode, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
