# Profile field development

Every member-editable value stored on `team_table` is classified in one catalog:

`backend/features/mandatory-fields/domain/fieldRegistry.js`

`PROFILE_FIELD_CATALOG` is that list. `MANDATORY_FIELD_REGISTRY` is the eligible slice. Admin Mandatory Fields and the member prompt both use that slice. There is no second registry.

The coverage test reads `backend/prisma/schema.prisma` and fails if a `team_table` column is missing, duplicated, or incomplete. Do not keep a separate hand-written list of column names for CI.

## When you add or change a member-editable profile field

1. Read this document.
2. Declare the column in `PROFILE_FIELD_CATALOG`.
3. Set `mandatoryEligible` to `true` or `false`.
4. Reuse the existing editor, save method, and OTP flow. Do not add a second form.
5. Keep Admin and Member on this catalog. Admin loads `MANDATORY_FIELD_REGISTRY` from the API. Member fill uses `frontend/src/features/mandatory-fields/domain/fieldEditors.js`, whose keys must match the eligible catalog.
6. Update or add tests. `catalog.coverage.test.js` must pass.
7. Run the mandatory-field tests before finishing:

```
node --test backend/features/mandatory-fields/domain/__tests__/catalog.coverage.test.js backend/features/mandatory-fields/domain/__tests__/campaignSchedule.test.js backend/features/mandatory-fields/domain/__tests__/evaluateMandatoryFields.test.js backend/features/mandatory-fields/domain/__tests__/access.rules.test.js
```

## Eligible field

`mandatoryEligible: true`. Required stays off until an admin saves it.

Required metadata: `fieldKey`, `column`, `editor`, `saveMethod`, `isFilled`, `editorMinAppVersion`, `protectedSave`.

Example shape already used for phone:

- column `PhoneNumber`
- editor `UserProfileFields`
- save `saveProfile`
- OTP `none`
- `isFilled` checks 10 to 15 stored digits
- `editorMinAppVersion` `3.5.0`

Community Position stays on editor floor `3.5.6` and coach OTP. Community ID and height keep their existing OTP floors.

## Ineligible field

`mandatoryEligible: false` and `ineligibleReason` must explain why a member cannot be required to edit it. These columns do not appear on the admin page.

Password, coach ids, and consent audit columns are ineligible. Optional body measurements are ineligible until they have a mandatory-profile editor.

## Campaign clock

The clock is elapsed UTC time from `required_since`. Day 10 is exactly ten 24-hour periods after that instant, not the next IST midnight. Opening the app does not move it.

- Required stays on: later saves keep the same `required_since`.
- Required turns off: enforcement stops. The old timestamp stays stored and is not used.
- Required turns on again: a new `required_since` is stored and reminder claims for that field are cleared. An expired deadline is not reused.
- Grace limit 0: those fields are required immediately, together, with no Skip.
- Grace limit above 0: those fields stay together on one screen and each has Skip until the grace ends.
- Days 2, 4, 6, 8: one email each, through `sendTransactionalMail`. A failed send releases that slot so a later pass can retry. Two overlapping passes cannot both send the same slot.
- Day 10: normal product APIs return 403 while any required field is still incomplete. The app shell locks.
- Completing every overdue field removes the restriction on the next evaluation.
- Admin and developer roles are not blocked.

Rules with no `required_since` keep the older grace behaviour.

If the tables exist without `required_since` or `reminder_mask`, product and admin APIs return HTTP 503 `MANDATORY_SCHEMA_INCOMPLETE`. That is not treated as “no rules configured.”

Apply `backend/migrations/alter_mandatory_fields_campaign_clock.sql` before this code reads the new columns. If the tables do not exist yet, use `create_mandatory_field_tables.sql`, which already includes those columns. Do not run either file from the app.
