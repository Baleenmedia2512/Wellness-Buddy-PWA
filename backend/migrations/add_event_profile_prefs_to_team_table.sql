-- Profile event prefs and the confirmed Community Position.
-- EventLevel is written after the coach OTP is verified.
-- MySQL / MariaDB. Nullable so existing rows stay valid.
-- Already applied. Running this again returns #1060 Duplicate column name.
-- That error means EventTranslation, EventYourCity, and EventLevel are already there.

ALTER TABLE team_table
  ADD COLUMN EventTranslation VARCHAR(40) NULL DEFAULT NULL,
  ADD COLUMN EventYourCity VARCHAR(40) NULL DEFAULT NULL,
  ADD COLUMN EventLevel VARCHAR(40) NULL DEFAULT NULL;
