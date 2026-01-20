-- Rename token_correction_table columns to PascalCase

ALTER TABLE token_correction_table 
RENAME COLUMN id TO "ID";

ALTER TABLE token_correction_table 
RENAME COLUMN user_id TO "UserId";

ALTER TABLE token_correction_table 
RENAME COLUMN input_token_cost TO "InputTokenCost";

ALTER TABLE token_correction_table 
RENAME COLUMN output_token_cost TO "OutputTokenCost";

ALTER TABLE token_correction_table 
RENAME COLUMN total_token_cost TO "TotalTokenCost";

ALTER TABLE token_correction_table 
RENAME COLUMN created_at TO "CreatedAt";

-- Final columns: ID, UserId, InputTokenCost, OutputTokenCost, TotalTokenCost, CreatedAt
