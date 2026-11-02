-- Create Event page storage.
-- Run this on MySQL before using /api/events.
-- If an earlier events_table was created with organizer/location/seating columns,
-- drop that table first, then run this script.
-- Then from backend: npm run prisma:generate
-- Restart the API after generate.

CREATE TABLE IF NOT EXISTS events_table (
  Id INT NOT NULL AUTO_INCREMENT,
  CreatedByUserId INT NOT NULL,
  EventName VARCHAR(200) NOT NULL,
  HostName VARCHAR(200) NOT NULL,
  Place VARCHAR(300) NOT NULL,
  EventDate DATE NOT NULL,
  TicketPrice DECIMAL(10, 2) NOT NULL,
  SeatCount INT NOT NULL,
  DesignatedPersons JSON NOT NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  IsDeleted SMALLINT NOT NULL DEFAULT 0,
  CreatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UpdatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (Id),
  KEY idx_events_owner_deleted (CreatedByUserId, IsDeleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
