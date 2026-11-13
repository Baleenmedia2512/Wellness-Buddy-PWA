-- Community Position, translation, and city on the member profile.
-- MySQL / phpMyAdmin. Skip a line if that column already exists.

ALTER TABLE team_table
  ADD COLUMN EventTranslation VARCHAR(64) NULL,
  ADD COLUMN EventYourCity VARCHAR(64) NULL,
  ADD COLUMN EventLevel VARCHAR(64) NULL;
