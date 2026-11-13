-- Profile introduction fields. Nullable so existing rows and older apps stay valid.
-- Run on MySQL before Profile About you is saved.

ALTER TABLE team_table
  ADD COLUMN ProfessionalTitle VARCHAR(80) NULL,
  ADD COLUMN InstagramUrl VARCHAR(255) NULL,
  ADD COLUMN YoutubeUrl VARCHAR(255) NULL,
  ADD COLUMN LinkedinUrl VARCHAR(255) NULL,
  ADD COLUMN HerbalifeJoinedOn DATE NULL,
  ADD COLUMN AboutMe VARCHAR(500) NULL,
  ADD COLUMN Qualification VARCHAR(250) NULL,
  ADD COLUMN Languages JSON NULL;
