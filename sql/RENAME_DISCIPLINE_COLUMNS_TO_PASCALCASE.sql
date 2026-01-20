-- Rename discipline_table columns from snake_case to PascalCase

ALTER TABLE discipline_table RENAME COLUMN id TO "ID";
ALTER TABLE discipline_table RENAME COLUMN entry_date TO "EntryDate";
ALTER TABLE discipline_table RENAME COLUMN entry_user TO "EntryUser";
ALTER TABLE discipline_table RENAME COLUMN activity TO "Activity";
ALTER TABLE discipline_table RENAME COLUMN activity_start_time TO "ActivityStartTime";
ALTER TABLE discipline_table RENAME COLUMN activity_end_time TO "ActivityEndTime";
ALTER TABLE discipline_table RENAME COLUMN validity_start_date TO "ValidityStartDate";
ALTER TABLE discipline_table RENAME COLUMN validity_end_date TO "ValidityEndDate";
ALTER TABLE discipline_table RENAME COLUMN track_for_discipline TO "TrackForDiscipline";
ALTER TABLE discipline_table RENAME COLUMN discipline_group_id TO "DisciplineGroupID";
ALTER TABLE discipline_table RENAME COLUMN created_at TO "CreatedAt";
ALTER TABLE discipline_table RENAME COLUMN updated_at TO "UpdatedAt";
