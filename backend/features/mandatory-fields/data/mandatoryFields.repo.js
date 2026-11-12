/**
 * Persistence for mandatory field rules and per-user grace.
 * Skip updates are conditional so two requests cannot pass the same limit.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';

function dbOr(client) {
  return client || getPrisma();
}

/**
 * Distinguish a missing table from a table that exists without the campaign columns.
 * Connection failures are neither.
 *
 * @param {unknown} err
 * @returns {'tables-missing'|'campaign-columns-missing'|null}
 */
export function classifyMandatorySchemaGap(err) {
  const code = err?.code;
  const message = String(err?.message || err || '');
  const mentionsTable = /mandatory_field_rules|user_field_grace/i.test(message);
  if (code === 'P2021') return 'tables-missing';
  if (code === 'P2022') return 'campaign-columns-missing';
  if (!mentionsTable) return null;
  if (/unknown column|1054/i.test(message)) return 'campaign-columns-missing';
  if (/does not exist|doesn't exist|unknown table|1146/i.test(message)) return 'tables-missing';
  return null;
}

/**
 * True when the mandatory tables or their campaign columns are not installed.
 * Connection failures and other database errors are not this case.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMandatorySchemaMissing(err) {
  return classifyMandatorySchemaGap(err) != null;
}

/**
 * Map a rules-read error to the deployment state.
 * Missing tables stay unenforced. Missing campaign columns fail closed.
 *
 * @param {unknown} err
 */
export function mandatoryRulesReadState(err) {
  const gap = classifyMandatorySchemaGap(err);
  if (gap === 'campaign-columns-missing') {
    return {
      rows: [],
      deployed: true,
      failed: true,
      schemaReady: false,
      activated: false,
      reason: 'campaign-columns-missing',
    };
  }
  if (gap === 'tables-missing') {
    return {
      rows: [],
      deployed: false,
      failed: false,
      schemaReady: false,
      activated: false,
      reason: 'tables-missing',
    };
  }
  return {
    rows: [],
    deployed: true,
    failed: true,
    schemaReady: true,
    activated: false,
    reason: 'read-failed',
  };
}

/** @param {unknown} err */
export function isMandatoryTableMissing(err) {
  return isMandatorySchemaMissing(err);
}

/**
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function listRules(client) {
  return dbOr(client).mandatory_field_rules.findMany({
    orderBy: { field_key: 'asc' },
  });
}

/**
 * @param {string} fieldKey
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function findRule(fieldKey, client) {
  return dbOr(client).mandatory_field_rules.findUnique({
    where: { field_key: fieldKey },
  });
}

/**
 * @param {object} rule
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function saveRule(rule, client) {
  const data = {
    required: rule.required === true,
    grace_type: rule.graceType,
    grace_limit: rule.graceLimit,
    audience: rule.audience,
    min_app_version: rule.minAppVersion,
    notify_enabled: rule.notifyEnabled !== false,
    remind_every_days: Number.isInteger(Number(rule.remindEveryDays))
      ? Math.max(0, Number(rule.remindEveryDays))
      : 0,
    position_scope: rule.positionScope === 'specific' ? 'specific' : 'all',
    position_codes: Array.isArray(rule.positionCodes) && rule.positionCodes.length
      ? rule.positionCodes
      : null,
    required_since: rule.requiredSince || null,
    updated_by_user_id: rule.updatedByUserId,
  };
  return dbOr(client).mandatory_field_rules.upsert({
    where: { field_key: rule.fieldKey },
    create: { field_key: rule.fieldKey, ...data },
    update: data,
  });
}

/**
 * @param {number} userId
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function listGraceForUser(userId, client) {
  return dbOr(client).user_field_grace.findMany({
    where: { user_id: userId },
  });
}

/**
 * Insert the first-notification row. A unique conflict means another
 * request already stored the start time. That row is kept.
 *
 * @param {{ userId: number, fieldKey: string, notifiedAt: Date }} input
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function ensureFirstNotification(input, client) {
  const prisma = dbOr(client);
  try {
    await prisma.user_field_grace.create({
      data: {
        user_id: input.userId,
        field_key: input.fieldKey,
        first_notified_at: input.notifiedAt,
        last_prompted_at: input.promptedAt || null,
        skip_count: 0,
      },
    });
    return { created: true };
  } catch (err) {
    if (err?.code === 'P2002') return { created: false };
    throw err;
  }
}

/**
 * @param {{ userId: number, fieldKey: string, expectedSkipCount: number, graceLimit: number, skippedAt: Date }} input
 * @param {import('@prisma/client').PrismaClient} [client]
 * @returns {Promise<boolean>} true when this request won the increment
 */
export async function conditionalIncrementSkip(input, client) {
  const result = await dbOr(client).user_field_grace.updateMany({
    where: {
      user_id: input.userId,
      field_key: input.fieldKey,
      AND: [
        { skip_count: input.expectedSkipCount },
        { skip_count: { lt: input.graceLimit } },
      ],
    },
    data: {
      skip_count: { increment: 1 },
      last_skipped_at: input.skippedAt,
      last_prompted_at: input.skippedAt,
    },
  });
  return result.count === 1;
}

/**
 * Days skip records the time only. It does not increment skip_count
 * and does not write a profile column.
 *
 * @param {{ userId: number, fieldKey: string, skippedAt: Date }} input
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function recordDaySkip(input, client) {
  await dbOr(client).user_field_grace.updateMany({
    where: {
      user_id: input.userId,
      field_key: input.fieldKey,
    },
    data: {
      last_skipped_at: input.skippedAt,
      last_prompted_at: input.skippedAt,
    },
  });
}

/**
 * Remember when the member was asked, so the next ask waits remind_every_days.
 * Does not write a profile column.
 *
 * @param {{ userId: number, fieldKey: string, promptedAt: Date }} input
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function recordPrompt(input, client) {
  await dbOr(client).user_field_grace.updateMany({
    where: {
      user_id: input.userId,
      field_key: input.fieldKey,
    },
    data: { last_prompted_at: input.promptedAt },
  });
}

/**
 * Claim one reminder slot. A second worker sees zero updated rows and must not send.
 * @param {{ userId: number, fieldKey: string, expectedMask: number, nextMask: number }} input
 * @param {import('@prisma/client').PrismaClient} [client]
 * @returns {Promise<boolean>}
 */
export async function claimReminderSlot(input, client) {
  const prisma = dbOr(client);
  const updated = await prisma.user_field_grace.updateMany({
    where: {
      user_id: input.userId,
      field_key: input.fieldKey,
      reminder_mask: input.expectedMask,
    },
    data: { reminder_mask: input.nextMask },
  });
  if (updated.count > 0) return true;
  try {
    await prisma.user_field_grace.create({
      data: {
        user_id: input.userId,
        field_key: input.fieldKey,
        skip_count: 0,
        reminder_mask: input.nextMask,
      },
    });
    return true;
  } catch (err) {
    if (err?.code !== 'P2002') throw err;
    return false;
  }
}

/**
 * Give a claimed slot back after the email was not accepted.
 * Only the mask this worker wrote is cleared, so a newer claim is left alone.
 *
 * @param {{ userId: number, fieldKey: string, expectedMask: number, previousMask: number }} input
 * @param {import('@prisma/client').PrismaClient} [client]
 * @returns {Promise<boolean>}
 */
export async function releaseReminderSlot(input, client) {
  const result = await dbOr(client).user_field_grace.updateMany({
    where: {
      user_id: input.userId,
      field_key: input.fieldKey,
      reminder_mask: input.expectedMask,
    },
    data: { reminder_mask: input.previousMask },
  });
  return result.count === 1;
}

/**
 * A restarted campaign must be able to send days 2, 4, 6, and 8 again.
 * @param {string} fieldKey
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function clearReminderMasks(fieldKey, client) {
  const result = await dbOr(client).user_field_grace.updateMany({
    where: { field_key: fieldKey },
    data: { reminder_mask: 0 },
  });
  return result.count;
}

/**
 * Save the rule and, on a new activation, clear reminder claims together.
 * @param {object} rule
 * @param {{ restarted?: boolean }} [options]
 * @param {import('@prisma/client').PrismaClient} [client]
 */
export async function saveCampaignRule(rule, { restarted = false } = {}, client) {
  const prisma = dbOr(client);
  return prisma.$transaction(async (tx) => {
    const saved = await saveRule(rule, tx);
    if (restarted) await clearReminderMasks(rule.fieldKey, tx);
    return saved;
  });
}

const REMINDER_PROFILE_SELECT = Object.freeze({
  UserId: true,
  Email: true,
  Role: true,
  UserName: true,
  PhoneNumber: true,
  Height: true,
  DietType: true,
  Gender: true,
  BodyFat: true,
  Bmr: true,
  PhysicalActivityLevel: true,
  CommunityId: true,
  EventLevel: true,
});

export async function listReminderCandidates(client) {
  return dbOr(client).team_table.findMany({ select: REMINDER_PROFILE_SELECT });
}

export async function listGraceRows(client) {
  return dbOr(client).user_field_grace.findMany();
}
