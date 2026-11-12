# Cursor instructions

Obey `CLAUDE.md`. This file does not replace it.

Profile fields: `docs/PROFILE_FIELD_DEVELOPMENT.md`.

Whenever adding or modifying a member-editable profile field:

1. Read `docs/PROFILE_FIELD_DEVELOPMENT.md`.
2. Declare the field in `PROFILE_FIELD_CATALOG` (`backend/features/mandatory-fields/domain/fieldRegistry.js`).
3. Set `mandatoryEligible` true, or false with an explicit reason.
4. Reuse the existing editor, save method, and OTP flow.
5. Keep Admin Mandatory Fields and the member prompt on that same catalog.
6. Add or update tests, including `catalog.coverage.test.js`.
7. Run the mandatory-field tests listed in that document before finishing.

Do not add a second field registry. Do not expose every `team_table` column on the admin page. The coverage test reads `schema.prisma` and fails when a new column is unclassified.
