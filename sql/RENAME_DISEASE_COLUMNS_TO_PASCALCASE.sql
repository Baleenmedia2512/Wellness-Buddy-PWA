-- Rename disease_table columns from snake_case to PascalCase

ALTER TABLE disease_table RENAME COLUMN entry_id TO "EntryId";
ALTER TABLE disease_table RENAME COLUMN entry_user TO "EntryUser";
ALTER TABLE disease_table RENAME COLUMN entry_date TO "EntryDate";
ALTER TABLE disease_table RENAME COLUMN disease_name TO "DiseaseName";
