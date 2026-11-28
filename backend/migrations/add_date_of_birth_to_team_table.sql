-- Date of birth as per Aadhaar. Age remains on team_table.Age (derived from DOB when set).
-- Nullable so existing rows and older apps that only send Age stay valid.

ALTER TABLE team_table
  ADD COLUMN DateOfBirth DATE NULL;
