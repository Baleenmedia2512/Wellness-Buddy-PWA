import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { getProfile } from '../user/user.service.js';
import * as userRepo from '../user/user.repository.js';
import * as repo from './data/field-collection.repo.js';
import {
  FIELD_KEYS,
  collectionRoleFromAppRole,
  decideField,
  hasFieldValue,
  normalizeFieldPolicy,
  planCollectionStep,
  stateMapFromRows,
  valuesFromProfile,
} from './domain/fieldCollection.rules.js';

const REQUESTER_COLUMNS = '"UserId", "Role"';

async function resolveRequester({ requesterUserId, requesterEmail }) {
  if (requesterEmail) {
    const byEmail = await userRepo.findByEmail(requesterEmail, REQUESTER_COLUMNS);
    if (byEmail) return byEmail;
  }
  if (requesterUserId != null && requesterUserId !== '') {
    const byId = await userRepo.findByUserId(requesterUserId, REQUESTER_COLUMNS);
    if (byId) return byId;
  }
  return null;
}

function assertAdmin(userRow) {
  const role = String(userRow?.Role || '').toLowerCase();
  if (role !== 'admin' && role !== 'developer') {
    throw new ValidationError(403, 'Field collection setup is restricted to admin and developer roles.');
  }
}

export async function getAdminPolicy({ requesterUserId, requesterEmail }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAdmin(requester);
  const row = await repo.getLatestPolicy();
  const fields = normalizeFieldPolicy(row?.fields);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        fields,
        updatedAt: row?.updated_at ?? null,
        updatedByUserId: row?.updated_by_user_id ?? null,
      },
    },
  };
}

export async function putAdminPolicy({ requesterUserId, requesterEmail, fields }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAdmin(requester);
  const normalized = normalizeFieldPolicy(fields);
  const saved = await repo.insertPolicy({
    fields: normalized,
    updatedByUserId: requester.UserId,
  });
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        fields: normalizeFieldPolicy(saved.fields),
        updatedAt: saved.updated_at,
        updatedByUserId: saved.updated_by_user_id,
      },
    },
  };
}

const SCALAR_COLUMNS = '"Gender", "Age", "Height", "DietType", "PhysicalActivityLevel"';
const SCALAR_COLUMNS_NO_AGE = '"Gender", "Height", "DietType", "PhysicalActivityLevel"';

async function readSavedScalars(userId) {
  try {
    return await userRepo.findByUserId(userId, SCALAR_COLUMNS);
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (!/column|Age/i.test(msg)) throw err;
    return userRepo.findByUserId(userId, SCALAR_COLUMNS_NO_AGE);
  }
}

function applySavedScalars(values, row) {
  if (!row) return values;
  const next = { ...values };
  if (row.Gender != null && String(row.Gender).trim() !== '') next.gender = row.Gender;
  if (row.Age != null && row.Age !== '') next.age = row.Age;
  if (row.Height != null && row.Height !== '') next.height = row.Height;
  if (row.DietType != null && String(row.DietType).trim() !== '') next.diet = row.DietType;
  if (row.PhysicalActivityLevel != null && String(row.PhysicalActivityLevel).trim() !== '') {
    next.lifestyle = row.PhysicalActivityLevel;
  }
  return next;
}

async function loadContext(userId, appVersion) {
  const user = await userRepo.findByUserId(userId, '"UserId", "Role", "Email"');
  if (!user) throw new ValidationError(404, 'User not found');
  // Always the signed-in row, never a 60s profile snapshot from before this save.
  const profile = await getProfile({
    userId: user.UserId,
    appVersion,
    bypassCache: true,
  });
  if (profile.httpStatus !== 200 || !profile.body?.data) {
    throw new ValidationError(profile.httpStatus || 404, profile.body?.message || 'User not found');
  }
  const values = applySavedScalars(
    valuesFromProfile(profile.body.data),
    await readSavedScalars(user.UserId),
  );
  const role = collectionRoleFromAppRole(user.Role);
  const policyRow = await repo.getLatestPolicy();
  const fields = normalizeFieldPolicy(policyRow?.fields);
  let rows = await repo.listPromptState(user.UserId);
  const nowIso = nowUtc();
  const states = stateMapFromRows(rows);

  // A stored later field is already closed by its value. Record the fill so
  // the prompt state matches the profile, without opening another ask.
  for (const field of fields) {
    if (field.phase !== 'scheduled' || field.key === 'currentWeight') continue;
    if (!hasFieldValue(field.key, values)) continue;
    if (states[field.key]?.lastFilledAt) continue;
    const written = await repo.markFilled(user.UserId, field.key, nowIso);
    if (written) {
      states[field.key] = {
        skipCount: 0,
        cycleStartedAt: null,
        lastFilledAt: written.last_filled_at || nowIso,
        lastSkippedAt: null,
      };
    }
  }

  return { user, values, role, fields, states, nowIso };
}

function inactiveBody() {
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        active: false,
        step: 'done',
        entryFields: [],
        photoSlots: [],
        scheduled: null,
        profileFields: [],
        fields: [],
      },
    },
  };
}

export async function getPrompts({ userId, appVersion = null, deferKeys = [] }) {
  if (!isEnabled('ff.field-collection')) return inactiveBody();
  const { user, values, role, fields, states, nowIso } = await loadContext(userId, appVersion);
  const plan = planCollectionStep({
    fields,
    values,
    states,
    role,
    now: new Date(nowIso),
    deferKeys,
  });
  if (plan.step === 'scheduled' && plan.scheduled) {
    const current = states[plan.scheduled.key];
    if (!current?.cycleStartedAt) {
      const written = await repo.markCycleStart(user.UserId, plan.scheduled.key, nowIso);
      if (written?.cycle_started_at) {
        plan.scheduled.cycleStartedAt = written.cycle_started_at;
      }
    }
  }
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        active: true,
        role,
        step: plan.step,
        entryFields: plan.entryFields,
        photoSlots: plan.photoSlots,
        scheduled: plan.scheduled,
        profileFields: plan.profileFields || [],
        fields,
      },
    },
  };
}

export async function recordPromptAction({ userId, fieldKey, action, appVersion = null }) {
  if (!isEnabled('ff.field-collection')) {
    throw new ValidationError(404, 'Feature not enabled');
  }
  if (!FIELD_KEYS.includes(fieldKey)) throw new ValidationError(400, 'Unknown field');
  if (action !== 'skip' && action !== 'filled') {
    throw new ValidationError(400, 'Action must be skip or filled');
  }
  const { user, values, role, fields, states, nowIso } = await loadContext(userId, appVersion);
  const field = fields.find((item) => item.key === fieldKey);
  if (!field || field.phase !== 'scheduled') {
    throw new ValidationError(400, 'Only later fields can be skipped or clocked here');
  }
  if (action === 'filled') {
    const written = await repo.markFilled(user.UserId, fieldKey, nowIso);
    if (!written) {
      throw new ValidationError(503, 'Field collection storage is not ready. Run the field collection migration.');
    }
    return { httpStatus: 200, body: { ok: true } };
  }
  const mode = decideField({
    field,
    values,
    state: states[fieldKey] || null,
    role,
    now: new Date(nowIso),
  });
  if (mode !== 'ask_skippable') {
    throw new ValidationError(400, 'This field cannot be skipped now');
  }
  const state = states[fieldKey] || { skipCount: 0, cycleStartedAt: null };
  const written = await repo.markSkipped(
    user.UserId,
    fieldKey,
    nowIso,
    (state.skipCount || 0) + 1,
    state.cycleStartedAt || nowIso,
  );
  if (!written) {
    throw new ValidationError(503, 'Field collection storage is not ready. Run the field collection migration.');
  }
  return { httpStatus: 200, body: { ok: true } };
}
