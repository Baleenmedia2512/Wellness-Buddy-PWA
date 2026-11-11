-- Wellness Events (Create Event feature). Aligns with live yvyunomg_wellness_valley.events_table.
-- Safe to skip if the table already exists (CREATE IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS events_table (
  Id                INT            NOT NULL AUTO_INCREMENT,
  CreatedByUserId   INT            NOT NULL,
  EventName         VARCHAR(200)   NOT NULL,
  HostName          VARCHAR(200)   NOT NULL,
  Place             VARCHAR(300)   NOT NULL,
  Venue             VARCHAR(300)   NULL,
  EventDate         DATE           NOT NULL,
  TicketPrice       DECIMAL(10, 2) NOT NULL,
  SeatCount         INT            NOT NULL,
  DesignatedPersons JSON           NOT NULL,
  Status            VARCHAR(20)    NOT NULL DEFAULT 'scheduled',
  IsDeleted         SMALLINT       NOT NULL DEFAULT 0,
  CreatedAt         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  KEY idx_events_owner_deleted (CreatedByUserId, IsDeleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
