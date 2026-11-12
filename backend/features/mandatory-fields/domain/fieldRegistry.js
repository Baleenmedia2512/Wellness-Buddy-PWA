/**
 * Supported mandatory profile fields.
 * Admins configure these keys. They cannot add a key that is not listed here.
 *
 * Address is omitted: team_table has no address column.
 * Working physical centre is omitted: it is derived from the coach chain and
 * has no member write API.
 *
 * editorMinAppVersion is the oldest app that may be required to complete the
 * field. Community ID and height use the OTP floors already enforced in
 * communityIdApproval.rules.js and heightChange.rules.js (3.5.0).
 * Community position uses the coach-OTP floor in communityPosition.rules.js
 * (3.5.6). The other profile editors use 3.5.0 so a pre-3.5.0 binary, which
 * has no mandatory-field screen, is not blocked for those keys.
 */
import { isValidEmail } from '../../auth/domain/contactIdentifier.js';
import { isValidPhysicalActivityLevel } from '../../../utils/tdeeCalculations.js';
import { COMMUNITY_ID_OTP_MIN_APP_VERSION } from '../../user/domain/communityIdApproval.rules.js';
import {
  COMMUNITY_POSITION_OTP_MIN_APP_VERSION,
  isValidPositionCode,
  normalizePositionCode,
} from '../../user/domain/communityPosition.rules.js';
import {
  HEIGHT_CHANGE_OTP_MIN_APP_VERSION,
  parseHeightCm,
} from '../../user/domain/heightChange.rules.js';
import {
  hasValidBodyFatSource,
  hasValidProfileGender,
  hasValidProfileName,
} from '../../user/domain/profileCompleteness.js';
import { validateCommunityId } from '../../user/user.validators.js';

/** Same floor as the OTP-backed profile editors this screen reuses. */
export const MANDATORY_FIELD_EDITOR_MIN_APP_VERSION = '3.5.0';

/** Matches isProfileComplete in profileCompleteness.js. OTP edits use 50–198. */
const STORED_HEIGHT_MIN_CM = 50;
const STORED_HEIGHT_MAX_CM = 250;

/**
 * @param {unknown} phone
 * @returns {boolean}
 */
function hasStoredPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * @param {unknown} bmr
 * @returns {boolean}
 */
function hasStoredBmr(bmr) {
  if (bmr == null || bmr === '') return false;
  const n = typeof bmr === 'number' ? bmr : parseFloat(String(bmr));
  return Number.isFinite(n) && n > 0;
}

/**
 * @param {unknown} dietType
 * @returns {boolean}
 */
function hasStoredDiet(dietType) {
  return typeof dietType === 'string' && dietType.trim() !== '';
}

/**
 * @param {unknown} height
 * @returns {boolean}
 */
function hasStoredHeight(height) {
  const n = parseHeightCm(height);
  if (n == null) return false;
  return n >= STORED_HEIGHT_MIN_CM && n <= STORED_HEIGHT_MAX_CM;
}

/**
 * @param {unknown} communityId
 * @returns {boolean}
 */
function hasStoredCommunityId(communityId) {
  const validation = validateCommunityId(communityId);
  return validation.valid === true && validation.value != null;
}

/**
 * EventLevel holds the confirmed community position code.
 * Scope "all" accepts any valid code. Scope "specific" accepts only the
 * codes on the rule.
 *
 * @param {object|null|undefined} profile
 * @param {object|null|undefined} rule
 * @returns {boolean}
 */
function hasMatchingCommunityPosition(profile, rule) {
  const code = normalizePositionCode(profile?.communityPosition);
  if (!isValidPositionCode(code)) return false;
  if (rule?.positionScope !== 'specific') return true;
  const allowed = (Array.isArray(rule.positionCodes) ? rule.positionCodes : [])
    .map((item) => normalizePositionCode(item));
  return allowed.includes(code);
}

/**
 * @type {ReadonlyArray<{
 *   fieldKey: string,
 *   label: string,
 *   source: { table: string, column: string },
 *   editor: string,
 *   saveMethod: string,
 *   editorMinAppVersion: string,
 *   protectedSave: 'none'|'kyc-otp'|'sponsor-otp'|'otp-after-first-save',
 *   isFilled: (profile: object) => boolean,
 * }>}
 */
export const MANDATORY_FIELD_REGISTRY = Object.freeze([
  Object.freeze({
    fieldKey: 'name',
    label: 'Name',
    source: { table: 'team_table', column: 'UserName' },
    editor: 'OnboardingIdentityPage',
    saveMethod: 'saveEmailIdentity or saveProfile',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => hasValidProfileName(profile?.userName, {
      email: profile?.email,
      phoneNumber: profile?.phoneNumber,
    }),
  }),
  Object.freeze({
    fieldKey: 'gender',
    label: 'Gender',
    source: { table: 'team_table', column: 'Gender' },
    editor: 'UserProfileFields',
    saveMethod: 'saveProfile',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => hasValidProfileGender(profile?.gender, profile?.bodyMetrics),
  }),
  Object.freeze({
    fieldKey: 'height',
    label: 'Height',
    source: { table: 'team_table', column: 'Height' },
    editor: 'HeightField',
    saveMethod: 'saveProfile for the first value; verifyHeightChangeOtp after it is stored',
    editorMinAppVersion: HEIGHT_CHANGE_OTP_MIN_APP_VERSION,
    protectedSave: 'otp-after-first-save',
    isFilled: (profile) => hasStoredHeight(profile?.height),
  }),
  Object.freeze({
    fieldKey: 'diet',
    label: 'Diet',
    source: { table: 'team_table', column: 'DietType' },
    editor: 'UserProfileFields',
    saveMethod: 'saveProfile',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => hasStoredDiet(profile?.dietType),
  }),
  Object.freeze({
    fieldKey: 'bodyFat',
    label: 'Body fat',
    source: { table: 'team_table', column: 'BodyFat' },
    editor: 'CompleteProfilePage',
    saveMethod: 'saveProfile bodyFat (also accepts weight or body-parameters fat %)',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => hasValidBodyFatSource({
      bodyFat: profile?.bodyFat,
      latestWeightBodyFat: profile?.latestWeightBodyFat,
      bodyMetrics: profile?.bodyMetrics,
    }),
  }),
  Object.freeze({
    fieldKey: 'email',
    label: 'Email',
    source: { table: 'team_table', column: 'Email' },
    editor: 'ProfileEmailKycSection',
    saveMethod: 'verifyOnboardingEmail',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'kyc-otp',
    isFilled: (profile) => isValidEmail(profile?.email),
  }),
  Object.freeze({
    fieldKey: 'phone',
    label: 'Phone',
    source: { table: 'team_table', column: 'PhoneNumber' },
    editor: 'UserProfileFields',
    saveMethod: 'saveProfile phoneNumber',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => hasStoredPhone(profile?.phoneNumber),
  }),
  Object.freeze({
    fieldKey: 'communityId',
    label: 'Community ID',
    source: { table: 'team_table', column: 'CommunityId' },
    editor: 'CommunityIdField',
    saveMethod: 'verifyCommunityIdOtp',
    editorMinAppVersion: COMMUNITY_ID_OTP_MIN_APP_VERSION,
    protectedSave: 'sponsor-otp',
    isFilled: (profile) => hasStoredCommunityId(profile?.communityId),
  }),
  Object.freeze({
    fieldKey: 'communityPosition',
    label: 'Community position',
    source: { table: 'team_table', column: 'EventLevel' },
    editor: 'CommunityPositionField',
    saveMethod: 'verifyCommunityPositionOtp',
    editorMinAppVersion: COMMUNITY_POSITION_OTP_MIN_APP_VERSION,
    protectedSave: 'coach-otp',
    isFilled: (profile, rule) => hasMatchingCommunityPosition(profile, rule),
  }),
  Object.freeze({
    fieldKey: 'physicalActivity',
    label: 'Physical activity',
    source: { table: 'team_table', column: 'PhysicalActivityLevel' },
    editor: 'PhysicalActivityField',
    saveMethod: 'saveProfile',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => isValidPhysicalActivityLevel(profile?.physicalActivityLevel),
  }),
  Object.freeze({
    fieldKey: 'bmr',
    label: 'BMR',
    source: { table: 'team_table', column: 'Bmr' },
    editor: 'UserProfileFields',
    saveMethod: 'saveProfile bmr when the client sends a positive number',
    editorMinAppVersion: MANDATORY_FIELD_EDITOR_MIN_APP_VERSION,
    protectedSave: 'none',
    isFilled: (profile) => hasStoredBmr(profile?.bmr),
  }),
]);

const REGISTRY_BY_KEY = new Map(
  MANDATORY_FIELD_REGISTRY.map((entry) => [entry.fieldKey, entry]),
);

/**
 * @param {unknown} fieldKey
 * @returns {boolean}
 */
export function isRegisteredFieldKey(fieldKey) {
  return REGISTRY_BY_KEY.has(String(fieldKey || ''));
}

/**
 * @param {unknown} fieldKey
 * @returns {(typeof MANDATORY_FIELD_REGISTRY)[number]|null}
 */
export function getRegisteredField(fieldKey) {
  return REGISTRY_BY_KEY.get(String(fieldKey || '')) || null;
}

/**
 * @returns {string[]}
 */
export function listRegisteredFieldKeys() {
  return MANDATORY_FIELD_REGISTRY.map((entry) => entry.fieldKey);
}

/**
 * Columns a member cannot be required to fill.
 * A new team_table column must be added here or to the eligible registry.
 * The coverage test reads prisma/schema.prisma and fails the build otherwise.
 */
const INELIGIBLE_PROFILE_COLUMNS = Object.freeze({
  EntryDateTime: 'System audit timestamp. Members cannot edit it.',
  EntryUser: 'System audit user. Members cannot edit it.',
  UserId: 'Account id. Members cannot choose it.',
  Password: 'Credential. Not a profile field and not shown in the mandatory editor.',
  TargetWeightInKg: 'Derived goal weight. No mandatory-profile editor.',
  CoachName: 'Assigned by the coach chain. Members cannot edit it.',
  CoCoachName: 'Assigned by the coach chain. Members cannot edit it.',
  Status: 'Account status. Members cannot edit it.',
  CoachApproved: 'Coach approval flag. Members cannot edit it.',
  Role: 'Authorization role. Members cannot assign it.',
  TeamId: 'Team linkage. Members cannot edit it.',
  UplineCoachId: 'Hierarchy link. Members cannot edit it.',
  SetupSkipped: 'Onboarding flag. Members cannot edit it.',
  id: 'Internal row id. Members cannot edit it.',
  ProfileImage: 'Photo uses the profile-picture flow, not the mandatory field editors.',
  CoachId: 'Assigned by the coach chain. Members cannot edit it.',
  CoCoachId: 'Assigned by the coach chain. Members cannot edit it.',
  CoachTeamId: 'Team linkage. Members cannot edit it.',
  LastActiveAt: 'System activity timestamp. Members cannot edit it.',
  profile_pic_snooze: 'Picture reminder state. Members cannot edit it as a profile value.',
  PushToken: 'Device push token. Members cannot edit it.',
  PushTokenUpdatedAt: 'System timestamp. Members cannot edit it.',
  WeightGoalMode: 'Has a default and is not a mandatory identity field.',
  timezone_iana: 'Account timezone. Not part of the mandatory profile editors.',
  ConsentAcceptedAt: 'Consent record. Members accept it on the consent screen.',
  ConsentVersion: 'Consent record. Members cannot type it.',
  ConsentIpAddress: 'Consent audit. Members cannot edit it.',
  ConsentDeviceInfo: 'Consent audit. Members cannot edit it.',
  Age: 'Optional body metric. No mandatory-profile editor yet.',
  VisceralFat: 'Optional body metric. No mandatory-profile editor yet.',
  BodyAge: 'Optional body metric. No mandatory-profile editor yet.',
  ChestCm: 'Optional body metric. No mandatory-profile editor yet.',
  WaistCm: 'Optional body metric. No mandatory-profile editor yet.',
  HipCm: 'Optional body metric. No mandatory-profile editor yet.',
  recovered_health_issues: 'Optional health list. No mandatory-profile editor yet.',
  transformation_photos: 'Uses the transformation-photo flow, not the mandatory field editors.',
  ProfileImageKey: 'Stored photo pointer. Members cannot edit it.',
  IdealWeightReachedAt: 'System milestone. Members cannot edit it.',
  IdealWeightReachedNotifiedAt: 'System milestone. Members cannot edit it.',
  BcmProfileReviewedAt: 'System review timestamp. Members cannot edit it.',
  WorkingPhysicalCentreId: 'Derived from the coach chain. No member write API.',
  EventTranslation: 'Optional event preference. No mandatory-profile editor yet.',
  EventYourCity: 'Optional event preference. No mandatory-profile editor yet.',
});

export const PROFILE_FIELD_CATALOG = Object.freeze([
  ...MANDATORY_FIELD_REGISTRY.map((entry) => Object.freeze({
    ...entry,
    column: entry.source.column,
    mandatoryEligible: true,
    ineligibleReason: null,
  })),
  ...Object.entries(INELIGIBLE_PROFILE_COLUMNS).map(([column, reason]) => Object.freeze({
    fieldKey: column,
    column,
    label: column,
    mandatoryEligible: false,
    ineligibleReason: reason,
    editor: null,
    saveMethod: null,
    editorMinAppVersion: null,
    protectedSave: 'none',
    isFilled: null,
  })),
]);

export function listMandatoryEligibleFields() {
  return PROFILE_FIELD_CATALOG.filter((entry) => entry.mandatoryEligible === true);
}

/**
 * @param {object[]} entries
 * @param {string[]} prismaColumns
 * @returns {string[]}
 */
export function explainCatalogProblems(entries, prismaColumns) {
  const problems = [];
  const keys = new Set();
  const columns = new Set();
  for (const entry of entries || []) {
    const key = entry?.fieldKey;
    if (!key || keys.has(key)) problems.push(`duplicate or missing field key ${key || ''}`);
    if (key) keys.add(key);
    if (!entry?.column || columns.has(entry.column)) problems.push(`duplicate or missing column ${entry?.column || ''}`);
    if (entry?.column) columns.add(entry.column);
    if (entry?.mandatoryEligible === true) {
      if (!entry.editor) problems.push(`${key} has no editor`);
      if (!entry.saveMethod) problems.push(`${key} has no save method`);
      if (typeof entry.isFilled !== 'function') problems.push(`${key} has no isFilled`);
      if (!entry.editorMinAppVersion) problems.push(`${key} has no editorMinAppVersion`);
    } else if (entry?.mandatoryEligible === false) {
      if (!entry.ineligibleReason) problems.push(`${key} has no ineligible reason`);
    } else {
      problems.push(`${key} has no mandatory eligibility`);
    }
  }
  for (const column of prismaColumns || []) {
    if (!columns.has(column)) problems.push(`team_table.${column} has no catalog entry`);
  }
  for (const column of columns) {
    if (!(prismaColumns || []).includes(column)) problems.push(`catalog column ${column} is not on team_table`);
  }
  return problems;
}
