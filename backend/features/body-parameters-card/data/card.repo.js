/**
 * card.repo.js — Data layer for body_parameters_cards.
 * Table access uses Prisma against MySQL (MYSQL_DATABASE_URL).
 */
import { getMysqlClient } from '../../../utils/mysqlClient.js';
import { getPrisma } from '../../../shared/lib/prisma.js';
import { assertViewerCanAccessMember } from '../../../utils/reportingHierarchyService.js';
import { nowUtc } from '../../../shared/lib/datetime/index.js';
import { canonicalPhoneForStorage, buildPhoneLookupVariants } from '../../auth/domain/phone-identity.rules.js';
import {
  buildTeamMemberInsert,
  computeBmiFromHeightWeight,
  shouldClearBpcLeadCoachId,
  isMemberActivatedForBcmExclusion,
  BCM_ACTIVATED_MEMBER_MESSAGE,
  canOverrideBcmForMember,
  computeDefaultAppointmentDate,
} from '../domain/card.rules.js';
import { getLatestWeight, getLatestWeightBodyFat, getLatestWeightMetricsByUserIds } from '../../user/user.repository.js';
import logger from '../../../shared/lib/logger.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { mapTransformationPhotos } from '../../user/domain/transformationPhotos.rules.js';

const TABLE = 'body_parameters_cards';
const APPROVALS = 'approval_requests_table';

function plainDb(value, kind) {
  if (value == null) return null;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Date) {
    if (kind === 'date') return value.toISOString().slice(0, 10);
    return value.toISOString();
  }
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const asNumber = value.toNumber();
    return Number.isFinite(asNumber) ? asNumber : value.toString();
  }
  return value;
}

function asCard(row) {
  if (!row) return null;
  return {
    ...row,
    id: plainDb(row.id),
    height_cm: plainDb(row.height_cm),
    weight_kg: plainDb(row.weight_kg),
    bmi: plainDb(row.bmi),
    fat_percent: plainDb(row.fat_percent),
    bmr: plainDb(row.bmr),
    visceral_fat: plainDb(row.visceral_fat),
    chest_cm: plainDb(row.chest_cm),
    waist_cm: plainDb(row.waist_cm),
    hip_cm: plainDb(row.hip_cm),
    recorded_date: row.recorded_date == null ? null : plainDb(row.recorded_date, 'date'),
    created_at: row.created_at == null ? null : plainDb(row.created_at),
    updated_at: row.updated_at == null ? null : plainDb(row.updated_at),
    share_expires_at: row.share_expires_at == null ? row.share_expires_at : plainDb(row.share_expires_at),
  };
}

function toCardPk(id) {
  return typeof id === 'bigint' ? id : BigInt(id);
}

function mysql() {
  return getPrisma();
}

/** Prisma DateTime rejects `YYYY-MM-DD`. Store calendar dates at UTC midnight. */
function asDbDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00.000Z`);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Insert a new body-parameters card.
 * @param {object} payload - validated + coerced from card.schema.js
 * @returns {object} inserted row
 */
export async function insertCard(payload) {
  const locationName = payload.locationName != null && String(payload.locationName).trim() !== ''
    ? String(payload.locationName).trim().substring(0, 200)
    : null;

  const row = {
    created_by:    payload.createdBy,
    user_id:       payload.userId ?? null,
    name:          payload.name,
    age:           payload.age ,
    gender:        payload.gender ,
    height_cm:     payload.heightCm ,
    weight_kg:     payload.weightKg ,
    bmi:           payload.bmi ,
    fat_percent:   payload.fatPercent ,
    bmr:           payload.bmr ,
    body_age:      payload.bodyAge ,
    visceral_fat:  payload.visceralFat ,
    chest_cm:      payload.chestCm ,
    waist_cm:      payload.waistCm ,
    hip_cm:        payload.hipCm ,
    location_name: locationName,
    appointment_date: asDbDate(payload.appointmentDate),

    recovered_health_issues: Array.isArray(payload.recoveredHealthIssues)
      ? payload.recoveredHealthIssues
      : [],
  };
  if (payload.recordedDate) {
    row.recorded_date = asDbDate(payload.recordedDate);
  }

  const created = await mysql().body_parameters_cards.create({ data: row });
  return { ...asCard(created), appointment_date: payload.appointmentDate || null };
}

/**
 * Update an existing body-parameters card by id.
 * @param {number} id
 * @param {object} payload - validated + coerced from validateUpdateCard
 * @param {{ allowActivated?: boolean }} [opts]
 * @returns {object} updated row
 */
export async function updateCard(id, payload, opts = {}) {
  const allowActivated = opts.allowActivated === true;
  const existingRow = await mysql().body_parameters_cards.findFirst({
    where: { id: toCardPk(id), is_deleted: false },
    select: { id: true, user_id: true },
  });
  if (!existingRow) {
    throw new ValidationError(404, 'Card not found');
  }
  if (!allowActivated && existingRow.user_id && await isUserActivatedForBcm(existingRow.user_id)) {
    await rejectBcmForActivatedMember(existingRow.user_id);
  }

  const locationName = payload.locationName != null && String(payload.locationName).trim() !== ''
    ? String(payload.locationName).trim().substring(0, 200)
    : null;

  const updated = await mysql().body_parameters_cards.update({
    where: { id: existingRow.id },
    data: {
      name: payload.name,
      age: payload.age ?? null,
      gender: payload.gender ?? null,
      height_cm: payload.heightCm ?? null,
      weight_kg: payload.weightKg ?? null,
      bmi: payload.bmi ?? null,
      fat_percent: payload.fatPercent ?? null,
      bmr: payload.bmr ?? null,
      body_age: payload.bodyAge ?? null,
      visceral_fat: payload.visceralFat ?? null,
      chest_cm: payload.chestCm ?? null,
      waist_cm: payload.waistCm ?? null,
      hip_cm: payload.hipCm ?? null,
      recorded_date: asDbDate(payload.recordedDate) ?? undefined,
      appointment_date: asDbDate(payload.appointmentDate),
      location_name: locationName,
      recovered_health_issues: Array.isArray(payload.recoveredHealthIssues)
        ? payload.recoveredHealthIssues
        : [],
      updated_at: new Date(),
    },
  });
  return { ...asCard(updated), appointment_date: payload.appointmentDate || null };
}

/**
 * Find an unexpired card by its public share token.
 * Returns null when not found or expired.
 *
 * @param {string} token - UUID
 * @returns {object|null}
 */
export async function findCardByToken(token) {
  const row = await mysql().body_parameters_cards.findFirst({
    where: { public_share_token: token, is_deleted: false },
  });
  return asCard(row);
}

/**
 * Read PhoneNumber from team_table for a linked member.
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
export async function findTeamPhoneByUserId(userId) {
  const row = await mysql().team_table.findUnique({
    where: { UserId: Number(userId) },
    select: { PhoneNumber: true },
  });
  const phone = row?.PhoneNumber;
  return phone && String(phone).trim() ? String(phone).trim() : null;
}

/**
 * Whether this member has ever completed coach selection via OTP approval.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function hasApprovedCoachSelection(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return false;
  try {
    const row = await mysql().approval_requests_table.findFirst({
      where: { RequesterId: uid, Status: 'approved' },
      select: { Id: true },
    });
    return Boolean(row?.Id);
  } catch (error) {
    logger.warn('[body-params-card] approved coach-selection lookup failed', {
      userId: uid,
      message: error.message,
    });
    return false;
  }
}

/**
 * Activated for BCM exclusion = approved coach/sponsor OTP (implies logged-in member).
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function isUserActivatedForBcm(userId) {
  const approved = await hasApprovedCoachSelection(userId);
  return isMemberActivatedForBcmExclusion({ hasApprovedCoachSelection: approved });
}

/**
 * Hard-delete every body_parameters_cards row linked to this member (all creators).
 * Activation lock remains via OTP approval — delete does not reopen BCM for the phone.
 *
 * @param {number} userId
 * @returns {Promise<{ deleted: number, createdByIds: number[] }>}
 */
export async function hardDeleteCardsForUserId(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return { deleted: 0, createdByIds: [] };

  const rows = await mysql().body_parameters_cards.findMany({
    where: { user_id: uid },
    select: { id: true, created_by: true },
  });
  if (rows.length === 0) return { deleted: 0, createdByIds: [] };

  const createdByIds = [
    ...new Set(
      rows
        .map((r) => parseInt(r.created_by, 10))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];

  await mysql().body_parameters_cards.deleteMany({ where: { user_id: uid } });

  for (const coachId of createdByIds) {
    invalidateBpcListCache(coachId);
  }

  logger.info('[body-params-card] hard-deleted BCM cards for activated member', {
    userId: uid,
    deleted: rows.length,
    createdByIds,
  });

  return { deleted: rows.length, createdByIds };
}

/**
 * After coach OTP approval: remove all BCM records for this member.
 * Safe to call even when no cards exist.
 *
 * @param {number} userId
 * @returns {Promise<{ deleted: number, createdByIds: number[] }>}
 */
export async function purgeBcmCardsForActivatedMember(userId) {
  return hardDeleteCardsForUserId(userId);
}

/**
 * @param {number[]} userIds
 * @returns {Promise<Set<number>>} userIds that are activated for BCM exclusion
 */
async function findActivatedUserIdsAmong(userIds) {
  const activated = new Set();
  const ids = [...new Set(
    (userIds || [])
      .map((id) => parseInt(id, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  )];
  if (ids.length === 0) return activated;

  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const data = await mysql().approval_requests_table.findMany({
        where: { RequesterId: { in: chunk }, Status: 'approved' },
        select: { RequesterId: true },
      });
      for (const row of data) {
        const rid = parseInt(row.RequesterId, 10);
        if (Number.isFinite(rid) && rid > 0) activated.add(rid);
      }
    } catch (error) {
      logger.warn('[body-params-card] batch activated lookup failed', {
        message: error.message,
      });
    }
  }
  return activated;
}

/**
 * Reject BCM when the phone belongs to an activated member: hard-delete cards, then throw.
 * @param {number} userId
 */
async function rejectBcmForActivatedMember(userId) {
  try {
    await hardDeleteCardsForUserId(userId);
  } catch (purgeErr) {
    logger.error('[body-params-card] failed to purge cards before activated reject', {
      userId,
      message: purgeErr?.message,
    });
  }
  throw new ValidationError(409, BCM_ACTIVATED_MEMBER_MESSAGE);
}

/**
 * Force CoachId = null on BPC leads that have not completed coach OTP onboarding.
 * Handles legacy rows, stale API processes, and any DB-side default/trigger.
 *
 * @param {number|null|undefined} userId
 * @returns {Promise<boolean>} true when CoachId was cleared
 */
export async function enforceBpcLeadNoCoachUntilOnboarding(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return false;

  const member = await mysql().team_table.findUnique({
    where: { UserId: uid },
    select: { UserId: true, CoachId: true, EntryUser: true, SetupSkipped: true },
  });
  if (!member) return false;

  const approved = await hasApprovedCoachSelection(uid);
  if (
    !shouldClearBpcLeadCoachId({
      currentCoachId: member.CoachId,
      entryUser: member.EntryUser,
      setupSkipped: member.SetupSkipped,
      hasApprovedCoachSelection: approved,
    })
  ) {
    return false;
  }

  const previousCoachId = member.CoachId;
  const updated = await mysql().team_table.update({
    where: { UserId: uid },
    data: { CoachId: null },
    select: { UserId: true, CoachId: true, EntryUser: true },
  });
  if (updated.CoachId != null && updated.CoachId !== '') {
    throw new Error(
      `[bpc] CoachId still ${updated.CoachId} after clear for UserId ${uid} — check MySQL triggers on team_table / body_parameters_cards`,
    );
  }

  logger.info('[body-params-card] cleared stale BPC lead CoachId', {
    userId: uid,
    previousCoachId,
  });
  return true;
}

/** @deprecated Use enforceBpcLeadNoCoachUntilOnboarding */
export async function clearLegacyCounsellorCoachAssignment(userId, _counsellorId) {
  return enforceBpcLeadNoCoachUntilOnboarding(userId);
}

/**
 * Look up team_table UserId by phone (all variants). Lowest UserId wins.
 * @param {string} phoneNumber
 * @returns {Promise<number|null>}
 */
export async function findTeamMemberIdByPhone(phoneNumber) {
  if (!phoneNumber || !String(phoneNumber).trim()) return null;
  for (const variant of buildPhoneLookupVariants(phoneNumber)) {
    const existing = await mysql().team_table.findFirst({
      where: { PhoneNumber: variant },
      orderBy: { UserId: 'asc' },
      select: { UserId: true },
    });
    if (existing?.UserId) return existing.UserId;
  }
  return null;
}

/**
 * Whether this coach may override this member's BCM.
 * Override is only their own card, and only before the member starts the app.
 * Another counsellor's card (including a co-sponsor) is never returned.
 *
 * @param {number} userId
 * @param {{ coachId?: number|null, phoneNumber?: string|null }} [opts]
 * @returns {Promise<{ activated: boolean, userId: number|null, existingCard: object|null, canOverride: boolean, counselledByOther: boolean }>}
 */
export async function getBcmMemberCounsellingAccess(userId, { coachId = null, phoneNumber = null } = {}) {
  const uid = parseInt(userId, 10);
  const empty = {
    activated: false,
    userId: null,
    existingCard: null,
    canOverride: false,
    counselledByOther: false,
  };
  if (!Number.isFinite(uid) || uid < 1) return empty;

  const activated = await isUserActivatedForBcm(uid);
  const coachIdN = parseInt(coachId, 10);
  const ownCard = Number.isFinite(coachIdN) && coachIdN > 0
    ? await findLatestFullCardByUserIdAndCreatedBy(uid, coachIdN)
    : null;

  let counselledByOther = false;
  if (!ownCard) {
    const anyCard = await findLatestFullCardByUserId(uid);
    const creator = parseInt(anyCard?.created_by, 10);
    counselledByOther = Boolean(anyCard?.id) && creator !== coachIdN;
  }

  const counselledByViewer = Boolean(ownCard?.id);
  return {
    activated,
    userId: uid,
    existingCard: (!activated && ownCard)
      ? mapFullCardRowToPrefill(ownCard, phoneNumber)
      : null,
    canOverride: canOverrideBcmForMember({ activated, counselledByViewer }),
    counselledByOther: !activated && counselledByOther,
  };
}

/**
 * Whether this phone belongs to an activated member, and whether this coach
 * counselled the BCM. Never returns another counsellor's card.
 *
 * @param {string} phoneNumber
 * @param {{ coachId?: number|null }} [opts]
 * @returns {Promise<{ activated: boolean, userId: number|null, existingCard: object|null, canOverride: boolean, counselledByOther: boolean }>}
 */
export async function getBcmPhoneActivationStatus(phoneNumber, { coachId = null } = {}) {
  const userId = await findTeamMemberIdByPhone(phoneNumber);
  if (!userId) {
    return {
      activated: false,
      userId: null,
      existingCard: null,
      canOverride: false,
      counselledByOther: false,
    };
  }
  return getBcmMemberCounsellingAccess(userId, { coachId, phoneNumber });
}

function mapFullCardRowToPrefill(card, phoneNumber) {
  if (!card?.id) return null;
  const issues = Array.isArray(card.recovered_health_issues)
    ? card.recovered_health_issues.filter((x) => typeof x === 'string' && x.trim())
    : [];
  return {
    id: card.id,
    name: card.name ?? '',
    phoneNumber: phoneNumber || null,
    age: card.age ?? null,
    gender: card.gender ?? null,
    heightCm: card.height_cm ?? null,
    weightKg: card.weight_kg ?? null,
    bmi: card.bmi ?? null,
    fatPercent: card.fat_percent ?? null,
    bmr: card.bmr ?? null,
    bodyAge: card.body_age ?? null,
    visceralFat: card.visceral_fat ?? null,
    chestCm: card.chest_cm ?? null,
    waistCm: card.waist_cm ?? null,
    hipCm: card.hip_cm ?? null,
    locationName: card.location_name ?? null,
    recordedDate: card.recorded_date ?? null,
    appointmentDate: card.appointment_date ?? null,
    recoveredHealthIssues: issues,
  };
}

const FULL_CARD_SELECT = {
  id: true,
  created_by: true,
  user_id: true,
  name: true,
  age: true,
  gender: true,
  height_cm: true,
  weight_kg: true,
  bmi: true,
  fat_percent: true,
  bmr: true,
  body_age: true,
  visceral_fat: true,
  chest_cm: true,
  waist_cm: true,
  hip_cm: true,
  location_name: true,
  recorded_date: true,
  recovered_health_issues: true,
  created_at: true,
  updated_at: true,
};

/**
 * Latest non-deleted card for member + creating coach (own list visibility).
 * @param {number} userId
 * @param {number} createdBy
 * @returns {Promise<object|null>}
 */
export async function findLatestCardByUserIdAndCreatedBy(userId, createdBy) {
  const row = await findLatestFullCardByUserIdAndCreatedBy(userId, createdBy);
  return row ? { id: row.id } : null;
}

async function findLatestFullCardByUserIdAndCreatedBy(userId, createdBy) {
  const uid = parseInt(userId, 10);
  const cid = parseInt(createdBy, 10);
  if (!Number.isFinite(uid) || uid < 1 || !Number.isFinite(cid) || cid < 1) return null;

  const row = await mysql().body_parameters_cards.findFirst({
    where: { user_id: uid, created_by: cid, is_deleted: false },
    orderBy: { created_at: 'desc' },
    select: FULL_CARD_SELECT,
  });
  return asCard(row);
}

async function findLatestFullCardByUserId(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const row = await mysql().body_parameters_cards.findFirst({
    where: { user_id: uid, is_deleted: false },
    orderBy: { created_at: 'desc' },
    select: FULL_CARD_SELECT,
  });
  return asCard(row);
}

/**
 * Create a new team_table row from the phone entered on the body-params form.
 * Checks if phone exists first; if yes, UPDATES the member (name/height/BMR only).
 * If no, creates a new member with CoachId left null — coach is chosen at onboarding.
 * Never assigns CoachId from the counsellor. May clear a legacy wrong assignment
 * when counsellorId matches CoachId and the member never completed coach selection.
 *
 * @param {{ name: string, phoneNumber: string, counsellorId?: number|null, heightCm?: number|null, bmr?: number|null, weightKg?: number|null, fatPercent?: number|null, allowActivated?: boolean }} input
 * @returns {Promise<{ userId: number, isNew: boolean }>}
 */
export async function createTeamMemberFromPhone({
  name,
  phoneNumber,
  counsellorId = null,
  heightCm,
  bmr,
  weightKg,
  fatPercent,
  allowActivated = false,
}) {
  const storedPhone = canonicalPhoneForStorage(phoneNumber);

  let existingMember = null;
  for (const variant of buildPhoneLookupVariants(phoneNumber)) {
    const existing = await mysql().team_table.findFirst({
      where: { PhoneNumber: variant },
      orderBy: { UserId: 'asc' },
      select: { UserId: true, CoachId: true, EntryUser: true, SetupSkipped: true },
    });
    if (existing?.UserId) {
      existingMember = existing;
      break;
    }
  }

  // STEP 2: If phone exists, UPDATE existing member (never assign coach from counsellor)
  if (existingMember) {
    const existingUserId = existingMember.UserId;
    const approved = await hasApprovedCoachSelection(existingUserId);
    if (
      !allowActivated
      && isMemberActivatedForBcmExclusion({ hasApprovedCoachSelection: approved })
    ) {
      logger.info('[body-params-card] blocking BCM for activated member', {
        userId: existingUserId,
      });
      await rejectBcmForActivatedMember(existingUserId);
    }

    const updatePatch = {};
    if (name && String(name).trim()) updatePatch.UserName = String(name).trim();
    if (heightCm != null) updatePatch.Height = heightCm;
    if (bmr != null) updatePatch.Bmr = bmr;

    if (
      shouldClearBpcLeadCoachId({
        currentCoachId: existingMember.CoachId,
        entryUser: existingMember.EntryUser,
        setupSkipped: existingMember.SetupSkipped,
        hasApprovedCoachSelection: approved,
      })
    ) {
      updatePatch.CoachId = null;
      logger.info('[body-params-card] clearing stale BPC lead CoachId', {
        userId: existingUserId,
        previousCoachId: existingMember.CoachId,
      });
    }
    
    if (Object.keys(updatePatch).length > 0) {
      try {
        await mysql().team_table.update({
          where: { UserId: existingUserId },
          data: updatePatch,
        });
      } catch (updateErr) {
        logger.warn('[body-params-card] failed to update existing member profile', {
          userId: existingUserId,
          message: updateErr?.message,
        });
      }
    }
    
    logger.info('[body-params-card] phone exists in team_table, updated and reusing', {
      userId: existingUserId, updated: Object.keys(updatePatch).length > 0
    });
    return { userId: existingUserId, isNew: false };
  }

  // STEP 3: Phone doesn't exist, CREATE new member (CoachId set later via onboarding)
  const memberFields = buildTeamMemberInsert({ name, heightCm, bmr, weightKg, fatPercent });
  const now = nowUtc();
  const insertPayload = {
    EntryDateTime: now,
    LastActiveAt: now,
    EntryUser: 'Body Parameters Card',
    UserName: memberFields.UserName,
    Password: 'User@123#',
    TargetWeightInKg: 0,
    Status: 'Active',
    CoachApproved: 0,
    PhoneNumber: storedPhone,
    CoachId: null,
    Role: 'user',
    ...(memberFields.Height != null ? { Height: memberFields.Height } : {}),
    ...(memberFields.Bmr != null ? { Bmr: memberFields.Bmr } : {}),
  };

  const created = await mysql().$transaction(async (tx) => {
    const max = await tx.team_table.aggregate({ _max: { UserId: true } });
    const UserId = Number(max._max.UserId || 0) + 1;
    return tx.team_table.create({
      data: { ...insertPayload, UserId },
      select: { UserId: true },
    });
  });

  await enforceBpcLeadNoCoachUntilOnboarding(created.UserId);

  logger.info('[body-params-card] created new team_table member', { userId: created.UserId });
  return { userId: created.UserId, isNew: true };
}

/** @deprecated Use createTeamMemberFromPhone */
export const findOrCreateTeamMember = async (input) => {
  const { userId } = await createTeamMemberFromPhone(input);
  return userId;
};

/**
 * Link a card to a team member after phone resolution.
 * @param {number} cardId
 * @param {number} userId
 */
export async function linkCardToUser(cardId, userId) {
  await mysql().body_parameters_cards.updateMany({
    where: { id: toCardPk(cardId), is_deleted: false },
    data: { user_id: userId },
  });
}

/**
 * Ensure a card row is linked to a team_table member (via phone).
 * Required before Profile sync — body_parameters_cards.user_id is the join key.
 *
 * @param {object} card - persisted card row
 * @param {{ phoneNumber?: string|null, name?: string, counsellorId?: number|null, heightCm?: number|null, bmr?: number|null, weightKg?: number|null, fatPercent?: number|null }} linkPayload
 * @returns {Promise<number|null>} linked UserId
 */
export async function ensureCardLinkedToUser(card, linkPayload = {}) {
  if (card?.user_id) return card.user_id;
  const phoneNumber = linkPayload.phoneNumber;
  if (!phoneNumber || !card?.id) return null;

  const { userId } = await createTeamMemberFromPhone({
    name:          linkPayload.name ?? card.name,
    phoneNumber,
    counsellorId:  linkPayload.counsellorId ?? card.created_by ?? null,
    heightCm:      linkPayload.heightCm ?? card.height_cm,
    bmr:           linkPayload.bmr ?? card.bmr,
    weightKg:      linkPayload.weightKg ?? card.weight_kg,
    fatPercent:    linkPayload.fatPercent ?? card.fat_percent,
  });
  await linkCardToUser(card.id, userId);
  logger.info('[body-params-card] linked card to team member', { cardId: card.id, userId });
  return userId;
}

/**
 * Latest body_parameters_cards row for Profile → Card sync.
 * Prefers user_id match; backfills user_id on a recent orphan with the same name.
 *
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function findLatestCardForProfileSync(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const cardSelect = {
    id: true,
    name: true,
    height_cm: true,
    bmr: true,
    weight_kg: true,
    fat_percent: true,
    bmi: true,
    user_id: true,
    age: true,
    gender: true,
    visceral_fat: true,
    body_age: true,
    chest_cm: true,
    waist_cm: true,
    hip_cm: true,
  };

  const linked = await mysql().body_parameters_cards.findFirst({
    where: { user_id: uid, is_deleted: false },
    orderBy: { created_at: 'desc' },
    select: cardSelect,
  });
  if (linked) return asCard(linked);

  const member = await mysql().team_table.findUnique({
    where: { UserId: uid },
    select: { UserName: true, CoachId: true },
  });

  const userName = member?.UserName ? String(member.UserName).trim() : '';
  if (!userName) return null;

  const coachId = member?.CoachId != null ? parseInt(member.CoachId, 10) : null;
  const orphan = await mysql().body_parameters_cards.findFirst({
    where: {
      user_id: null,
      is_deleted: false,
      name: userName,
      ...(Number.isFinite(coachId) && coachId > 0 ? { created_by: coachId } : {}),
    },
    orderBy: { created_at: 'desc' },
    select: cardSelect,
  });
  if (!orphan) return null;
  const plainOrphan = asCard(orphan);

  await linkCardToUser(plainOrphan.id, uid);
  return { ...plainOrphan, user_id: uid };
}

/**
 * Latest body_parameters_cards row linked to a member (user_id match only).
 * Read-only profile display — no orphan name matching or auto-link side effects.
 *
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function findLatestLinkedBodyMetricsCard(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const row = await mysql().body_parameters_cards.findFirst({
    where: { user_id: uid, is_deleted: false },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      user_id: true,
      name: true,
      age: true,
      gender: true,
      height_cm: true,
      weight_kg: true,
      fat_percent: true,
      bmr: true,
      visceral_fat: true,
      bmi: true,
      body_age: true,
      chest_cm: true,
      waist_cm: true,
      hip_cm: true,
    },
  });
  return asCard(row);
}

/**
 * Search team_table rows by phone number prefix, scoped to a specific coach. * Returns up to 10 matches ordered by UserId ascending.
 *
 * @param {{ prefix: string, coachId: number }} opts
 * @returns {Promise<Array<{ userId: number, userName: string, phoneNumber: string, heightCm: number|null, bmr: number|null }>>}
 */
export async function searchTeamPhonesByPrefix({ prefix, coachId }) {
  const data = await mysql().team_table.findMany({
    where: {
      CoachId: Number(coachId),
      PhoneNumber: { startsWith: prefix },
      Status: 'Active',
    },
    orderBy: { UserId: 'asc' },
    take: 10,
    select: {
      UserId: true,
      UserName: true,
      PhoneNumber: true,
      Height: true,
      Bmr: true,
      Age: true,
      VisceralFat: true,
      BodyAge: true,
      ChestCm: true,
      WaistCm: true,
      HipCm: true,
      Gender: true,
    },
  });
  if (!data.length) return [];

  const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);

  // Deduplicate by PhoneNumber (keep lowest UserId); drop activated members (OTP approved).
  const candidateIds = data.map((row) => row.UserId).filter(Boolean);
  const activatedIds = await findActivatedUserIdsAmong(candidateIds);

  const seen = new Set();
  const results = [];
  for (const row of data) {
    const uid = parseInt(row.UserId, 10);
    if (Number.isFinite(uid) && activatedIds.has(uid)) continue;
    const phone = String(row.PhoneNumber || '').trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    results.push({
      userId:      row.UserId,
      userName:    row.UserName || '',
      phoneNumber: phone,
      heightCm:    row.Height ?? null,
      bmr:         row.Bmr    ?? null,
      gender:      row.Gender ?? null,
      age:         num(row.Age),
      visceralFat: num(row.VisceralFat),
      bodyAge:     num(row.BodyAge),
      chestCm:     num(row.ChestCm),
      waistCm:     num(row.WaistCm),
      hipCm:       num(row.HipCm),
      weightKg:    null,
      fatPercent:  null,
      bmi:         null,
    });
  }

  const userIds = results.map((r) => r.userId).filter((id) => id != null);
  if (userIds.length > 0) {
    const weightByUser = await getLatestWeightMetricsByUserIds(userIds);
    for (const r of results) {
      const w = weightByUser.get(Number(r.userId));
      if (!w) continue;
      r.weightKg = w.weightKg;
      r.fatPercent = w.fatPercent;
      r.bmi = w.bmi;
      if (r.bmr == null && w.bmr != null) r.bmr = w.bmr;
    }
  }

  return results;
}

/**
 * Resolve weight / fat / BMI for one member (latest weight + any BodyFat row).
 * @param {number} userId
 * @param {number|null|undefined} heightCm
 * @returns {Promise<{ weightKg: number|null, fatPercent: number|null, bmi: number|null, bmr: number|null }>}
 */
async function resolveMemberWeightMetrics(userId, heightCm) {
  const empty = { weightKg: null, fatPercent: null, bmi: null, bmr: null };
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid < 1) return empty;

  try {
    const [latest, fatFromAny] = await Promise.all([
      getLatestWeight(uid),
      getLatestWeightBodyFat(uid),
    ]);

    const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
    const weightKg = latest?.Weight != null ? num(latest.Weight) : null;
    const fatPercent = num(latest?.BodyFat) ?? (fatFromAny != null ? num(fatFromAny) : null);
    let bmi = latest?.Bmi != null ? num(latest.Bmi) : null;
    if (bmi == null && weightKg != null && heightCm != null) {
      bmi = computeBmiFromHeightWeight(heightCm, weightKg);
    }
    const bmr = latest?.Bmr != null ? num(latest.Bmr) : null;
    return { weightKg, fatPercent, bmi, bmr };
  } catch (err) {
    logger.warn('[card.repo] resolveMemberWeightMetrics failed', {
      userId: uid,
      message: err?.message || String(err),
    });
    return empty;
  }
}

/**
 * Full BCM form prefill for a team member (team_table + latest weight).
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getMemberPrefillForCard(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return null;

  const data = await mysql().team_table.findUnique({
    where: { UserId: uid },
    select: {
      UserId: true,
      UserName: true,
      PhoneNumber: true,
      Height: true,
      Bmr: true,
      Age: true,
      VisceralFat: true,
      BodyAge: true,
      ChestCm: true,
      WaistCm: true,
      HipCm: true,
      Gender: true,
      DietType: true,
      PhysicalActivityLevel: true,
      recovered_health_issues: true,
      transformation_photos: true,
    },
  });
  if (!data) return null;

  // Activated members may still be prefilled when the coach chose Override / New.
  // Do not purge cards from a read path.

  const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const heightCm = data.Height != null ? Number(data.Height) : null;
  const w = await resolveMemberWeightMetrics(uid, heightCm);
  const transformationPhotos = mapTransformationPhotos(data.transformation_photos);
  const hasAnyPhoto = Boolean(
    transformationPhotos.front || transformationPhotos.left || transformationPhotos.right,
  );

  return {
    userId: uid,
    userName: data.UserName || '',
    phoneNumber: data.PhoneNumber ? String(data.PhoneNumber).trim() : null,
    heightCm,
    bmr: data.Bmr != null ? Number(data.Bmr) : (w.bmr ?? null),
    gender: data.Gender ?? null,
    age: num(data.Age),
    visceralFat: num(data.VisceralFat),
    bodyAge: num(data.BodyAge),
    chestCm: num(data.ChestCm),
    waistCm: num(data.WaistCm),
    hipCm: num(data.HipCm),
    weightKg: w.weightKg ?? null,
    fatPercent: w.fatPercent ?? null,
    bmi: w.bmi ?? null,
    dietType: data.DietType != null ? String(data.DietType).trim() || null : null,
    physicalActivityLevel: data.PhysicalActivityLevel != null
      ? String(data.PhysicalActivityLevel).trim() || null
      : null,
    recoveredHealthIssues: Array.isArray(data.recovered_health_issues)
      ? data.recovered_health_issues.filter((x) => typeof x === 'string' && x.trim())
      : [],
    transformationPhotos: hasAnyPhoto ? transformationPhotos : null,
  };
}

/**
 * Find the latest card for a user (to check if card already exists).
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function findLatestCardByUserId(userId) {
  if (!userId) return null;
  const row = await mysql().body_parameters_cards.findFirst({
    where: { user_id: Number(userId), is_deleted: false },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  });
  if (!row) return null;
  return { id: plainDb(row.id) };
}

/**
 * Find the most recent previous card for a given user, excluding the current card.
 * Returns null when no prior card exists (fresh user).
 *
 * @param {number} userId
 * @param {number} excludeCardId - the card just created/updated (exclude it)
 * @returns {Promise<object|null>}
 */
export async function findPreviousCardByUserId(userId, excludeCardId) {
  if (!userId) return null;
  const row = asCard(await mysql().body_parameters_cards.findFirst({
    where: {
      user_id: Number(userId),
      is_deleted: false,
      NOT: { id: toCardPk(excludeCardId) },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      weight_kg: true,
      bmi: true,
      fat_percent: true,
      body_age: true,
      chest_cm: true,
      waist_cm: true,
      hip_cm: true,
      recorded_date: true,
    },
  }));
  if (!row) return null;

  return {
    id:           row.id,
    weightKg:     row.weight_kg     ?? null,
    bmi:          row.bmi           ?? null,
    fatPercent:   row.fat_percent   ?? null,
    bodyAge:      row.body_age      ?? null,
    chestCm:      row.chest_cm      ?? null,
    waistCm:      row.waist_cm      ?? null,
    hipCm:        row.hip_cm        ?? null,
    recordedDate: row.recorded_date ?? null,
  };
}

/** Columns needed for the BCM grid list (no SELECT *). */
const LIST_SUMMARY_COLS = [
  'id',
  'user_id',
  'name',
  'age',
  'gender',
  'height_cm',
  'weight_kg',
  'bmi',
  'recorded_date',
  'location_name',
  'appointment_date',
  'created_at',
  'updated_at',
  'created_by',
].join(', ');

/** Full card columns for edit / detail. */
const LIST_DETAIL_COLS = [
  'id',
  'user_id',
  'name',
  'age',
  'gender',
  'height_cm',
  'weight_kg',
  'bmi',
  'fat_percent',
  'bmr',
  'body_age',
  'visceral_fat',
  'chest_cm',
  'waist_cm',
  'hip_cm',
  'recorded_date',
  'location_name',
  'appointment_date',
  'recovered_health_issues',
  'created_at',
  'updated_at',
  'created_by',
].join(', ');

const BPC_LIST_CACHE_TTL_MS = 20 * 1000;
const bpcListCache = new Map();
const bpcListInflight = new Map();

function bpcListCacheKey(coachId) {
  return `bpc:list:v3:${coachId}`;
}

function mapRecoveredHealthIssues(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string' && x.trim());
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === 'string' && x.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function resolveCardAppointmentDate(card) {
  if (card?.appointment_date && String(card.appointment_date).trim()) {
    return String(card.appointment_date).trim().slice(0, 10);
  }
  const baseDate = card?.created_at || card?.recorded_date || null;
  return computeDefaultAppointmentDate(baseDate);
}

function mapCardSummary(card, memberMeta = null) {
  const phone = memberMeta?.phoneNumber || null;
  return {
    id: card.id,
    userId: card.user_id,
    name: card.name,
    phoneNumber: phone,
    email: memberMeta?.email || null,
    communityId: memberMeta?.communityId || null,
    age: card.age,
    gender: card.gender,
    heightCm: card.height_cm,
    weightKg: card.weight_kg,
    bmi: card.bmi,
    recordedDate: card.recorded_date,
    locationName: card.location_name || null,
    appointmentDate: resolveCardAppointmentDate(card),
    createdAt: card.created_at,
    updatedAt: card.updated_at ?? null,
    createdBy: card.created_by,
  };
}

function mapCardDetail(card, memberMeta = null) {
  return {
    ...mapCardSummary(card, memberMeta),
    fatPercent: card.fat_percent,
    bmr: card.bmr,
    bodyAge: card.body_age,
    visceralFat: card.visceral_fat,
    chestCm: card.chest_cm,
    waistCm: card.waist_cm,
    hipCm: card.hip_cm,
    locationName: card.location_name,
    appointmentDate: resolveCardAppointmentDate(card),
    recoveredHealthIssues: mapRecoveredHealthIssues(card.recovered_health_issues),
  };
}

/**
 * Dated body-parameter snapshots for one member (Reports Trend).
 * Includes leftover cards when more than one still exists.
 *
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
function plainHistoryValue(value, kind) {
  if (value == null) return null;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Date) {
    if (kind === 'date') return value.toISOString().slice(0, 10);
    return value.toISOString();
  }
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const asNumber = value.toNumber();
    return Number.isFinite(asNumber) ? asNumber : value.toString();
  }
  return value;
}

function mapHistoryRow(row) {
  return {
    id: plainHistoryValue(row.id),
    user_id: row.user_id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    height_cm: plainHistoryValue(row.height_cm),
    weight_kg: plainHistoryValue(row.weight_kg),
    bmi: plainHistoryValue(row.bmi),
    fat_percent: plainHistoryValue(row.fat_percent),
    bmr: plainHistoryValue(row.bmr),
    body_age: row.body_age,
    visceral_fat: plainHistoryValue(row.visceral_fat),
    chest_cm: plainHistoryValue(row.chest_cm),
    waist_cm: plainHistoryValue(row.waist_cm),
    hip_cm: plainHistoryValue(row.hip_cm),
    recorded_date: plainHistoryValue(row.recorded_date, 'date'),
    location_name: row.location_name,
    recovered_health_issues: row.recovered_health_issues,
    created_at: plainHistoryValue(row.created_at),
    updated_at: plainHistoryValue(row.updated_at),
    created_by: row.created_by,
  };
}

export async function listCardHistoryByUserId(userId) {
  const uid = parseInt(userId, 10);
  if (!Number.isFinite(uid) || uid < 1) return [];
  const prisma = getPrisma();
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET time_zone = '+00:00'");
    return tx.body_parameters_cards.findMany({
      where: { user_id: uid, is_deleted: false },
      orderBy: [{ recorded_date: 'asc' }, { created_at: 'asc' }],
      select: {
        id: true,
        user_id: true,
        name: true,
        age: true,
        gender: true,
        height_cm: true,
        weight_kg: true,
        bmi: true,
        fat_percent: true,
        bmr: true,
        body_age: true,
        visceral_fat: true,
        chest_cm: true,
        waist_cm: true,
        hip_cm: true,
        recorded_date: true,
        location_name: true,
        recovered_health_issues: true,
        created_at: true,
        updated_at: true,
        created_by: true,
      },
    });
  });
  return rows.map((row) => mapCardDetail(mapHistoryRow(row)));
}

/**
 * Hierarchy-gated card history. Same viewer rule as /api/weight/history.
 *
 * @param {number} userId
 * @param {number|null} viewerUserId
 * @returns {Promise<object[]>}
 */
export async function listVisibleCardHistoryByUserId(userId, viewerUserId) {
  await assertViewerCanAccessMember(getMysqlClient(), viewerUserId, userId);
  return listCardHistoryByUserId(userId);
}

async function fetchTeamMemberMetaByUserIds(userIds) {
  const teamMembersMap = {};
  if (!userIds.length) return teamMembersMap;

  const CHUNK = 200;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK).map((id) => Number(id)).filter((id) => Number.isFinite(id));
    const teamMembers = await mysql().team_table.findMany({
      where: { UserId: { in: chunk } },
      select: { UserId: true, PhoneNumber: true, Email: true, CommunityId: true },
    });
    for (const m of teamMembers) {
      teamMembersMap[String(m.UserId)] = {
        phoneNumber: m.PhoneNumber && String(m.PhoneNumber).trim()
          ? String(m.PhoneNumber).trim()
          : null,
        email: m.Email && String(m.Email).trim() ? String(m.Email).trim() : null,
        communityId: m.CommunityId && String(m.CommunityId).trim()
          ? String(m.CommunityId).trim()
          : null,
      };
    }
  }
  return teamMembersMap;
}

/** @deprecated use fetchTeamMemberMetaByUserIds */
async function fetchPhonesByUserIds(_db, userIds) {
  return fetchTeamMemberMetaByUserIds(userIds);
}

/**
 * Soft-delete a body-parameters card owned by the coach.
 * Sets `is_deleted = true`. Returns null when missing or not owned.
 *
 * @param {{ id: number, coachId: number }} opts
 * @returns {Promise<{ id: number, created_by: number }|null>}
 */
export async function softDeleteCard({ id, coachId }) {
  const existing = await mysql().body_parameters_cards.findFirst({
    where: { id: toCardPk(id), created_by: Number(coachId), is_deleted: false },
    select: { id: true, created_by: true },
  });
  if (!existing) return null;
  await mysql().body_parameters_cards.update({
    where: { id: existing.id },
    data: { is_deleted: true },
  });
  return { id: plainDb(existing.id), created_by: existing.created_by };
}

/**
 * Invalidate the slim list cache for a coach (call after create/update).
 * @param {number|string} coachId
 */
export function invalidateBpcListCache(coachId) {
  if (coachId == null) return;
  bpcListCache.delete(bpcListCacheKey(coachId));
}

/**
 * Load all slim summary cards for a coach (cached ~20s). Used for search + pagination.
 * @param {number|string} coachId
 * @returns {Promise<Array>}
 */
async function loadSlimCardsForCoach(coachId) {
  const key = bpcListCacheKey(coachId);
  const cached = bpcListCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  if (bpcListInflight.has(key)) {
    return bpcListInflight.get(key);
  }

  const promise = (async () => {
    logger.info('[listCardsForCoach] querying slim columns', { coachId });
    const cards = await mysql().body_parameters_cards.findMany({
      where: { created_by: Number(coachId), is_deleted: false },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        user_id: true,
        name: true,
        age: true,
        gender: true,
        height_cm: true,
        weight_kg: true,
        bmi: true,
        recorded_date: true,
        location_name: true,
        created_at: true,
        updated_at: true,
        created_by: true,
      },
    });
    const rows = cards.map(asCard);
    const userIds = [...new Set(rows.map((c) => c.user_id).filter(Boolean))];
    // Only hide activated members from the list. Hard-delete happens on OTP approve /
    // create reject — never purge here (non-activated BCM history must stay visible).
    const activatedIds = await findActivatedUserIdsAmong(userIds);

    const visibleRows = rows.filter((c) => {
      const uid = parseInt(c.user_id, 10);
      return !(Number.isFinite(uid) && activatedIds.has(uid));
    });

    const visibleUserIds = [...new Set(visibleRows.map((c) => c.user_id).filter(Boolean))];
    const teamMembersMap = await fetchTeamMemberMetaByUserIds(visibleUserIds);

    const mapped = visibleRows.map((card) => {
      const member = teamMembersMap[String(card.user_id)] || null;
      return mapCardSummary(card, member);
    });

    bpcListCache.set(key, { rows: mapped, expiresAt: Date.now() + BPC_LIST_CACHE_TTL_MS });
    return mapped;
  })().finally(() => {
    bpcListInflight.delete(key);
  });

  bpcListInflight.set(key, promise);
  return promise;
}

/**
 * List body-parameter cards for a coach with server-side search + pagination.
 * Returns only summary fields for the grid.
 *
 * @param {number|string} coachId
 * @param {{ page?: number, limit?: number, search?: string }} [opts]
 * @returns {Promise<{ cards: Array, pagination: object }>}
 */
export async function listCardsForCoach(coachId, opts = {}) {
  const { paginateBpcListRecords } = await import('../domain/list.pagination.js');
  const allCards = await loadSlimCardsForCoach(coachId);
  const { records, pagination } = paginateBpcListRecords(allCards, opts);
  logger.info('[listCardsForCoach] page ready', {
    coachId,
    total: pagination.totalRecords,
    page: pagination.currentPage,
    returned: records.length,
  });
  return { cards: records, pagination };
}

/**
 * Full card detail for edit — single row, coach-scoped.
 * @param {number|string} coachId
 * @param {number|string} cardId
 * @returns {Promise<object|null>}
 */
export async function getCardByIdForCoach(coachId, cardId) {
  const card = asCard(await mysql().body_parameters_cards.findFirst({
    where: {
      id: toCardPk(cardId),
      created_by: Number(coachId),
      is_deleted: false,
    },
    select: FULL_CARD_SELECT,
  }));
  if (!card) return null;

  let memberMeta = null;
  if (card.user_id) {
    const map = await fetchTeamMemberMetaByUserIds([card.user_id]);
    memberMeta = map[String(card.user_id)] || null;
  }
  return mapCardDetail(card, memberMeta);
}
