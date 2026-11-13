-- Rename Community Position labels/codes for UI + Premium:
-- GET TEAM → GET, 2500 GET TEAM → GET 2500, MILL TEAM → MILL, add MILL 7500.
-- Safe to re-run (checks / IGNORE). Run after create_community_positions.sql.

UPDATE community_positions_table
SET Code = 'GET', Label = 'GET'
WHERE Code = 'GET TEAM';

UPDATE community_positions_table
SET Code = 'GET 2500', Label = 'GET 2500'
WHERE Code = '2500 GET TEAM';

UPDATE community_positions_table
SET Code = 'MILL', Label = 'MILL'
WHERE Code = 'MILL TEAM';

INSERT IGNORE INTO community_positions_table
  (Code, Label, FeatureKey, UsageNote, SortOrder, IsActive)
VALUES
  ('MILL 7500', 'MILL 7500', 'mill-7500', 'Profile role. Features check the key mill-7500.', 85, 1);

-- Keep existing member EventLevel values in sync with the new codes.
UPDATE team_table SET EventLevel = 'GET' WHERE EventLevel = 'GET TEAM';
UPDATE team_table SET EventLevel = 'GET 2500' WHERE EventLevel = '2500 GET TEAM';
UPDATE team_table SET EventLevel = 'MILL' WHERE EventLevel = 'MILL TEAM';

-- Keep OTP request history codes aligned with the catalog.
UPDATE community_position_requests_table
SET PositionCode = 'GET' WHERE PositionCode = 'GET TEAM';
UPDATE community_position_requests_table
SET PositionCode = 'GET 2500' WHERE PositionCode = '2500 GET TEAM';
UPDATE community_position_requests_table
SET PositionCode = 'MILL' WHERE PositionCode = 'MILL TEAM';
