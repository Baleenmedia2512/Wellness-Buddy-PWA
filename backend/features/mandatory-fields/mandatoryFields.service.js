/**
 * Mandatory-field admin and member APIs.
 * Profile columns stay the source of truth. Skip never writes them.
 * Role and user id are loaded from team_table, not from a client role field.
 */
import { ValidationError } from '../../shared/lib/ValidationError.js';
import logger from '../../shared/lib/logger.js';
import * as userRepo from '../user/user.repository.js';
import { findLatestLinkedBodyMetricsCard } from '../body-parameters-card/data/card.repo.js';
import {
  evaluateMandatoryFields,
  planSkip,
  validateAdminRule,
} from './domain/evaluateMandatoryFields.js';
import { nextRequiredSince } from './domain/campaignSchedule.js';
import {
  getRegisteredField,
  listRegisteredFieldKeys,
  MANDATORY_FIELD_REGISTRY,
} from './domain/fieldRegistry.js';
import {
  isMandatorySettingsAdmin,
  mandatoryActorLookup,
  mandatoryDeploymentDecision,
} from './domain/access.rules.js';
import * as repo from './data/mandatoryFields.repo.js';
import { listActivePositionCodes } from '../user/communityPosition.service.js';
import {
  LEGACY_COMMUNITY_POSITION_CODES,
  normalizePositionCode,
} from '../user/domain/communityPosition.rules.js';

const PROFILE_COLUMNS = [
  'UserId',
  'Role',
  'UserName',
  'Email',
  'PhoneNumber',
  'Height',
  'DietType',
  'Gender',
  'BodyFat',
  'CommunityId',
  'PhysicalActivityLevel',
  'Bmr',
].map((column) => `"${column}"`).join(', ');

function toNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} row
 * @param {number|null} latestWeightBodyFat
 * @param {object|null} card
 */
export function profileSnapshot(row, latestWeightBodyFat, card, communityPosition) {
  return {
    userName: row?.UserName ?? '',
    email: row?.Email ?? '',
    phoneNumber: row?.PhoneNumber ?? '',
    height: toNumber(row?.Height),
    dietType: row?.DietType ?? '',
    gender: row?.Gender ?? '',
    bodyFat: toNumber(row?.BodyFat),
    latestWeightBodyFat: latestWeightBodyFat ?? null,
    bodyMetrics: card
      ? { fatPercent: card.fat_percent ?? null, gender: card.gender ?? null }
      : null,
    communityId: row?.CommunityId ?? null,
    physicalActivityLevel: row?.PhysicalActivityLevel ?? '',
    bmr: toNumber(row?.Bmr),
    communityPosition: communityPosition || null,
  };
}

function ruleFromRow(row) {
  if (!row) return null;
  return {
    fieldKey: row.field_key,
    required: row.required === true,
    graceType: row.grace_type,
    graceLimit: Number(row.grace_limit) || 0,
    audience: row.audience,
    minAppVersion: row.min_app_version,
    notifyEnabled: row.notify_enabled !== false,
    remindEveryDays: Number(row.remind_every_days) || 0,
    positionScope: row.position_scope === 'specific' ? 'specific' : 'all',
    positionCodes: positionCodesFromRow(row.position_codes),
    requiredSince: row.required_since || null,
  };
}

function positionCodesFromRow(value) {
  const raw = typeof value === 'string' ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizePositionCode(item)).filter(Boolean);
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function graceFromRow(row) {
  return {
    fieldKey: row.field_key,
    firstNotifiedAt: row.first_notified_at,
    skipCount: Number(row.skip_count) || 0,
    lastSkippedAt: row.last_skipped_at,
    lastPromptedAt: row.last_prompted_at,
  };
}

async function loadRequester({ userId, email }) {
  const rowById = userId ? await userRepo.findByUserId(userId, PROFILE_COLUMNS) : null;
  const rowByEmail = !userId && email
    ? await userRepo.findByEmail(email, PROFILE_COLUMNS)
    : null;
  const actor = mandatoryActorLookup({ userId, email, rowById, rowByEmail });
  if (actor.mismatch) {
    throw new ValidationError(403, actor.message);
  }
  if (!actor.ok) return null;
  return actor.row;
}

const SCHEMA_INCOMPLETE_BODY = Object.freeze({
  success: false,
  code: 'MANDATORY_SCHEMA_INCOMPLETE',
  message: 'Mandatory campaign columns are missing. Profile enforcement is not operational until they are installed.',
});

async function loadRulesOrEmpty() {
  try {
    const rows = await repo.listRules();
    return {
      rows,
      deployed: true,
      failed: false,
      activated: rows.some((row) => row?.required === true),
    };
  } catch (err) {
    const state = repo.mandatoryRulesReadState(err);
    if (state.reason === 'tables-missing') {
      logger.warn('[mandatory-fields] rules table is not installed yet');
    } else if (state.reason === 'campaign-columns-missing') {
      logger.error('[mandatory-fields] campaign columns are missing', {
        message: err?.message || String(err),
      });
    } else {
      logger.warn('[mandatory-fields] rules could not be read', {
        message: err?.message || String(err),
      });
    }
    return state;
  }
}

/**
 * @param {object} row
 */
async function loadSnapshot(row) {
  try {
    const [latestWeightBodyFat, card, prefs] = await Promise.all([
      userRepo.getLatestWeightBodyFat(row.UserId),
      findLatestLinkedBodyMetricsCard(row.UserId),
      userRepo.getEventProfilePreferences(row.UserId),
    ]);
    return profileSnapshot(row, latestWeightBodyFat, card, prefs?.eventLevel);
  } catch (err) {
    logger.warn('[mandatory-fields] profile sources failed', {
      userId: row.UserId,
      message: err?.message || String(err),
    });
    return null;
  }
}

function publicFields(evaluation) {
  return (evaluation.fields || []).map((field) => ({
    fieldKey: field.fieldKey,
    label: field.label,
    editor: field.editor,
    saveMethod: field.saveMethod,
    protectedSave: field.protectedSave,
    editorMinAppVersion: field.editorMinAppVersion || null,
    graceType: field.graceType,
    graceLimit: field.graceLimit,
    remaining: field.remaining,
    blocking: field.blocking,
    showPrompt: field.showPrompt,
    notifyEnabled: field.notifyEnabled,
    remindEveryDays: field.remindEveryDays || 0,
    positionScope: field.positionScope === 'specific' ? 'specific' : 'all',
    positionCodes: Array.isArray(field.positionCodes) ? field.positionCodes : [],
    campaignDay: Number.isInteger(field.campaignDay) ? field.campaignDay : null,
  }));
}

function unavailableResult() {
  return {
    blocked: false,
    status: 'profile-unavailable',
    enforcement: 'unavailable',
    fields: [],
    unknownFieldKeys: [],
  };
}

async function persistFirstNotifications(userId, evaluation, now) {
  if (!evaluation || evaluation.enforcement !== 'evaluated') return evaluation;
  const pending = (evaluation.fields || []).filter((field) => field.recordFirstNotification);
  if (pending.length === 0) return evaluation;
  try {
    await Promise.all(pending.map((field) => repo.ensureFirstNotification({
      userId,
      fieldKey: field.fieldKey,
      notifiedAt: now,
      promptedAt: field.recordPrompt ? now : null,
    })));
  } catch (err) {
    logger.warn('[mandatory-fields] could not store first notification', {
      userId,
      message: err?.message || String(err),
    });
    return unavailableResult();
  }
  return evaluation;
}

async function persistPrompts(userId, evaluation, now) {
  if (!evaluation || evaluation.enforcement !== 'evaluated') return evaluation;
  const pending = (evaluation.fields || []).filter((field) => field.recordPrompt);
  if (pending.length === 0) return evaluation;
  try {
    await Promise.all(pending.map((field) => repo.recordPrompt({
      userId,
      fieldKey: field.fieldKey,
      promptedAt: now,
    })));
  } catch (err) {
    logger.warn('[mandatory-fields] could not store ask time', {
      userId,
      message: err?.message || String(err),
    });
    return unavailableResult();
  }
  return evaluation;
}

/**
 * @param {{ userId: number|null, email: string|null, appVersion?: string|null, now?: Date }} input
 */
export async function evaluateUserMandatoryFields({
  userId = null,
  email = null,
  appVersion = null,
  now = new Date(),
  conflict = false,
} = {}) {
  if (conflict) {
    throw new ValidationError(403, 'This profile does not match the signed-in account.');
  }
  if (!userId && !email) {
    throw new ValidationError(401, 'Sign in before loading mandatory profile fields.');
  }

  const rulesState = await loadRulesOrEmpty();
  const deployment = mandatoryDeploymentDecision(rulesState);
  if (deployment === 'unavailable') {
    return {
      ...unavailableResult(),
      activated: false,
      reason: rulesState.reason || 'read-failed',
      schemaReady: rulesState.schemaReady !== false,
    };
  }
  if (deployment === 'allow') {
    return {
      blocked: false,
      status: 'ok',
      enforcement: 'evaluated',
      fields: [],
      unknownFieldKeys: [],
      rulesReady: rulesState.deployed === true,
      activated: false,
    };
  }

  const row = await loadRequester({ userId, email });
  if (!row) return { ...unavailableResult(), activated: true };

  const snapshot = await loadSnapshot(row);
  if (!snapshot) return { ...unavailableResult(), activated: true };

  let graceRows = [];
  try {
    graceRows = (await repo.listGraceForUser(Number(row.UserId))).map(graceFromRow);
  } catch (err) {
    logger.warn('[mandatory-fields] grace rows failed', {
      userId: row.UserId,
      message: err?.message || String(err),
    });
    return { ...unavailableResult(), activated: true };
  }

  const evaluation = evaluateMandatoryFields({
    rules: rulesState.rows.map(ruleFromRow).filter(Boolean),
    profile: snapshot,
    graceRows,
    role: row.Role,
    appVersion,
    now,
  });
  const stored = await persistFirstNotifications(Number(row.UserId), evaluation, now);
  const prompted = await persistPrompts(Number(row.UserId), stored, now);
  return {
    ...prompted,
    rulesReady: true,
    activated: true,
    userId: Number(row.UserId),
    role: row.Role,
  };
}

function assertAdmin(row) {
  if (!isMandatorySettingsAdmin(row?.Role)) {
    throw new ValidationError(403, 'Mandatory field settings are restricted to admin and developer roles.');
  }
}

async function assertKnownPositionCodes(codes) {
  let active = [];
  try {
    active = await listActivePositionCodes();
  } catch (err) {
    logger.warn('[mandatory-fields] community position catalog could not be read', {
      message: err?.message || String(err),
    });
    active = [];
  }
  const known = (active.length ? active : LEGACY_COMMUNITY_POSITION_CODES)
    .map((code) => normalizePositionCode(code));
  const unknown = codes.filter((code) => !known.includes(code));
  if (unknown.length > 0) {
    throw new ValidationError(400, `Unknown community position: ${unknown.join(', ')}`);
  }
}

export async function getAdminMandatoryFields({ userId = null, email = null, conflict = false } = {}) {
  if (conflict) {
    throw new ValidationError(403, 'This profile does not match the signed-in account.');
  }
  if (!userId && !email) {
    throw new ValidationError(401, 'Sign in before opening mandatory field settings.');
  }
  const requester = await loadRequester({ userId, email });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAdmin(requester);

  const rulesState = await loadRulesOrEmpty();
  if (rulesState.reason === 'campaign-columns-missing') {
    return { httpStatus: 503, body: SCHEMA_INCOMPLETE_BODY };
  }
  if (rulesState.failed) {
    throw new ValidationError(503, 'Mandatory field settings could not be loaded. Please try again.');
  }
  const rows = rulesState.rows;
  const byKey = new Map(rows.map((row) => [row.field_key, row]));
  return {
    httpStatus: 200,
    body: {
      success: true,
      fields: MANDATORY_FIELD_REGISTRY.map((entry) => {
        const saved = byKey.get(entry.fieldKey);
        return {
          fieldKey: entry.fieldKey,
          label: entry.label,
          editor: entry.editor,
          editorMinAppVersion: entry.editorMinAppVersion,
          protectedSave: entry.protectedSave,
          required: saved ? saved.required === true : false,
          graceType: saved?.grace_type || 'days',
          graceLimit: saved ? Number(saved.grace_limit) || 0 : 0,
          audience: saved?.audience || 'both',
          minAppVersion: saved?.min_app_version || entry.editorMinAppVersion,
          notifyEnabled: saved ? saved.notify_enabled !== false : true,
          remindEveryDays: saved ? Number(saved.remind_every_days) || 0 : 0,
          positionScope: saved?.position_scope === 'specific' ? 'specific' : 'all',
          positionCodes: saved ? positionCodesFromRow(saved.position_codes) : [],
          requiredSince: saved?.required_since || null,
        };
      }),
      schemaReady: rulesState.schemaReady !== false,
    },
  };
}

export async function putAdminMandatoryField({
  userId = null,
  email = null,
  conflict = false,
  fieldKey,
  required,
  graceType,
  graceLimit,
  audience,
  minAppVersion,
  notifyEnabled,
  remindEveryDays,
  positionScope,
  positionCodes,
} = {}) {
  if (conflict) {
    throw new ValidationError(403, 'This profile does not match the signed-in account.');
  }
  if (!userId && !email) {
    throw new ValidationError(401, 'Sign in before changing mandatory field settings.');
  }
  const requester = await loadRequester({ userId, email });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAdmin(requester);

  const validated = validateAdminRule({
    fieldKey,
    required,
    graceType,
    graceLimit,
    audience,
    minAppVersion,
    notifyEnabled,
    remindEveryDays,
    positionScope,
    positionCodes,
  });
  if (!validated.ok) throw new ValidationError(400, validated.message);
  if (!getRegisteredField(validated.rule.fieldKey)) {
    throw new ValidationError(400, 'Unknown profile field.');
  }
  if (validated.rule.fieldKey === 'communityPosition' && validated.rule.positionScope === 'specific') {
    await assertKnownPositionCodes(validated.rule.positionCodes);
  }

  let existing = null;
  try {
    existing = await repo.findRule(validated.rule.fieldKey);
  } catch (err) {
    if (repo.classifyMandatorySchemaGap(err) === 'campaign-columns-missing') {
      return { httpStatus: 503, body: SCHEMA_INCOMPLETE_BODY };
    }
    throw err;
  }
  const activation = nextRequiredSince({
    wasRequired: existing?.required === true,
    previousSince: existing?.required_since || null,
    required: validated.rule.required === true,
    now: new Date(),
  });

  try {
    await repo.saveCampaignRule({
      ...validated.rule,
      requiredSince: activation.requiredSince,
      updatedByUserId: Number(requester.UserId),
    }, { restarted: activation.restarted });
  } catch (err) {
    if (repo.classifyMandatorySchemaGap(err) === 'campaign-columns-missing') {
      return { httpStatus: 503, body: SCHEMA_INCOMPLETE_BODY };
    }
    throw err;
  }

  logger.info('[mandatory-fields] rule saved', {
    fieldKey: validated.rule.fieldKey,
    required: validated.rule.required,
    restarted: activation.restarted,
    updatedByUserId: Number(requester.UserId),
  });

  return {
    httpStatus: 200,
    body: { success: true, field: validated.rule },
  };
}

export async function getUserMandatoryFields(input) {
  const evaluation = await evaluateUserMandatoryFields(input);
  if (evaluation.reason === 'campaign-columns-missing') {
    return { httpStatus: 503, body: SCHEMA_INCOMPLETE_BODY };
  }
  if (evaluation.enforcement === 'unavailable') {
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded. Please try again.',
      },
    };
  }
  return {
    httpStatus: 200,
    body: {
      success: true,
      blocked: evaluation.blocked === true,
      enforcement: 'evaluated',
      fields: publicFields(evaluation),
    },
  };
}

export async function skipMandatoryField({
  userId = null,
  email = null,
  conflict = false,
  fieldKey,
  appVersion = null,
  now = new Date(),
} = {}) {
  const entry = getRegisteredField(fieldKey);
  if (!entry) throw new ValidationError(400, 'Unknown profile field.');

  const evaluation = await evaluateUserMandatoryFields({ userId, email, appVersion, now });
  if (evaluation.enforcement === 'unavailable') {
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded. Please try again.',
      },
    };
  }
  if (evaluation.activated !== true) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        blocked: false,
        enforcement: 'evaluated',
        fields: [],
      },
    };
  }

  const rulesState = await loadRulesOrEmpty();
  const decision = mandatoryDeploymentDecision(rulesState);
  if (decision === 'unavailable') {
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded. Please try again.',
      },
    };
  }
  if (decision !== 'enforce') {
    return {
      httpStatus: 200,
      body: {
        success: true,
        blocked: false,
        enforcement: 'evaluated',
        fields: [],
      },
    };
  }
  const { rows } = rulesState;
  const rule = rows.map(ruleFromRow).find((item) => item?.fieldKey === entry.fieldKey)
    || {
      fieldKey: entry.fieldKey,
      required: false,
      graceType: 'days',
      graceLimit: 0,
      audience: 'both',
      minAppVersion: entry.editorMinAppVersion,
      notifyEnabled: false,
    };
  let graceRows = [];
  try {
    graceRows = await repo.listGraceForUser(evaluation.userId);
  } catch (err) {
    logger.warn('[mandatory-fields] grace rows failed during skip', {
      userId: evaluation.userId,
      message: err?.message || String(err),
    });
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded. Please try again.',
      },
    };
  }
  const grace = graceRows.map(graceFromRow).find((item) => item.fieldKey === entry.fieldKey) || null;
  const row = await loadRequester({ userId: evaluation.userId, email: null });
  const snapshot = row ? await loadSnapshot(row) : null;
  if (!snapshot) {
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'PROFILE_UNAVAILABLE',
        message: 'Profile could not be loaded. Please try again.',
      },
    };
  }

  const skipDecision = planSkip({
    rule,
    profile: snapshot,
    grace,
    role: row.Role,
    appVersion,
    now,
  });
  if (!skipDecision.ok) {
    const message = skipDecision.reason === 'grace-expired'
      ? 'This field can no longer be skipped.'
      : 'This field is not waiting for a skip.';
    throw new ValidationError(409, message);
  }

  if (!grace) {
    await repo.ensureFirstNotification({
      userId: evaluation.userId,
      fieldKey: entry.fieldKey,
      notifiedAt: now,
    });
  }

  if (skipDecision.increment) {
    const won = await repo.conditionalIncrementSkip({
      userId: evaluation.userId,
      fieldKey: entry.fieldKey,
      expectedSkipCount: skipDecision.expectedSkipCount,
      graceLimit: rule.graceLimit,
      skippedAt: now,
    });
    if (!won) {
      throw new ValidationError(409, 'This skip was already used. Refresh and try again.');
    }
  } else {
    await repo.recordDaySkip({
      userId: evaluation.userId,
      fieldKey: entry.fieldKey,
      skippedAt: now,
    });
  }

  const after = await evaluateUserMandatoryFields({
    userId: evaluation.userId,
    appVersion,
    now,
  });
  return {
    httpStatus: 200,
    body: {
      success: true,
      blocked: after.blocked === true,
      enforcement: after.enforcement,
      fields: publicFields(after),
    },
  };
}

export function registeredFieldKeyList() {
  return listRegisteredFieldKeys();
}
