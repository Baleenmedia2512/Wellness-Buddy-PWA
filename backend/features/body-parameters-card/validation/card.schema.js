/**
 * card.schema.js — Body Parameters Card input validation.
 * Governs both the create (POST) and the public-resolve (GET) paths.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const VALID_GENDERS = ['Male', 'Female', 'Other'];

/**
 * Validate the payload for POST /api/body-parameters-card/create.
 * All body fields are optional except `name`.
 *
 * @param {object} body
 * @returns {object} clean, coerced payload
 * @throws {ValidationError}
 */
export function validateCreateCard(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { createdBy, userId, name, age, gender, heightCm, weightKg,
          bmi, fatPercent, bmr, bodyAge, visceralFat, chestCm, waistCm, hipCm,
          recordedDate, locationName, phoneNumber } = body;

  if (!createdBy) throw new ValidationError(400, 'createdBy is required');
  const createdByN = parseInt(createdBy, 10);
  if (isNaN(createdByN) || createdByN < 1) {
    throw new ValidationError(400, 'createdBy must be a valid UserId');
  }
  if (!name || String(name).trim() === '') throw new ValidationError(400, 'name is required');
  if (String(name).trim().length > 100) throw new ValidationError(422, 'name must be ≤ 100 characters');

  const ageN      = _optionalInt(age, 'age', 1, 120);
  const bodyAgeN  = _optionalInt(bodyAge, 'bodyAge', 1, 120);
  const heightN   = _optionalFloat(heightCm, 'heightCm', 50, 250);
  const weightN   = _optionalFloat(weightKg, 'weightKg', 20, 300);
  const bmiN      = _optionalFloat(bmi, 'bmi', 5, 70);
  const fatN      = _optionalFloat(fatPercent, 'fatPercent', 1, 70);
  const bmrN      = _optionalFloat(bmr, 'bmr', 500, 10000);
  const visceralN = _optionalFloat(visceralFat, 'visceralFat', 0, 99); // No strict validation - allow any reasonable value
  const chestN    = _optionalFloat(chestCm, 'chestCm', 20, 250);
  const waistN    = _optionalFloat(waistCm, 'waistCm', 20, 250);
  const hipN      = _optionalFloat(hipCm, 'hipCm', 20, 250);

  if (gender != null && !VALID_GENDERS.includes(gender)) {
    throw new ValidationError(422, `gender must be one of: ${VALID_GENDERS.join(', ')}`);
  }

  // recordedDate: accept ISO date string or default to today
  let recordedDateVal = null;
  if (recordedDate) {
    const d = new Date(recordedDate);
    if (isNaN(d.getTime())) throw new ValidationError(422, 'recordedDate must be a valid ISO date');
    recordedDateVal = d.toISOString().substring(0, 10);
  }

  const phoneVal = _optionalPhone(phoneNumber);

  return {
    createdBy: createdByN,
    userId:    userId ? parseInt(userId) : null,
    name:      String(name).trim(),
    age:       ageN,
    gender:    gender || null,
    heightCm:  heightN,
    weightKg:  weightN,
    bmi:       bmiN,
    fatPercent: fatN,
    bmr:       bmrN,
    bodyAge:   bodyAgeN,
    visceralFat: visceralN,
    chestCm:   chestN,
    waistCm:   waistN,
    hipCm:     hipN,
    recordedDate: recordedDateVal,
    locationName: locationName ? String(locationName).trim().substring(0, 200) : null,
    phoneNumber: phoneVal,
  };
}

/**
 * Validate the payload for PATCH /api/body-parameters-card/update.
 * Requires `id`; all body fields remain optional.
 *
 * @param {object} body
 * @returns {object} clean, coerced payload
 * @throws {ValidationError}
 */
export function validateUpdateCard(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');

  const { id, name, age, gender, heightCm, weightKg,
          bmi, fatPercent, bmr, bodyAge, visceralFat, chestCm, waistCm, hipCm,
          recordedDate, locationName, phoneNumber } = body;

  if (!id) throw new ValidationError(400, 'id is required');
  const idN = parseInt(id);
  if (isNaN(idN) || idN < 1) throw new ValidationError(422, 'id must be a positive integer');

  if (!name || String(name).trim() === '') throw new ValidationError(400, 'name is required');
  if (String(name).trim().length > 100) throw new ValidationError(422, 'name must be ≤ 100 characters');

  const ageN      = _optionalInt(age, 'age', 1, 120);
  const bodyAgeN  = _optionalInt(bodyAge, 'bodyAge', 1, 120);
  const heightN   = _optionalFloat(heightCm, 'heightCm', 50, 250);
  const weightN   = _optionalFloat(weightKg, 'weightKg', 20, 300);
  const bmiN      = _optionalFloat(bmi, 'bmi', 5, 70);
  const fatN      = _optionalFloat(fatPercent, 'fatPercent', 1, 70);
  const bmrN      = _optionalFloat(bmr, 'bmr', 500, 10000);
  const visceralN = _optionalFloat(visceralFat, 'visceralFat', 0, 999); // No strict validation - allow any reasonable value
  const chestN    = _optionalFloat(chestCm, 'chestCm', 20, 250);
  const waistN    = _optionalFloat(waistCm, 'waistCm', 20, 250);
  const hipN      = _optionalFloat(hipCm, 'hipCm', 20, 250);

  if (gender != null && !VALID_GENDERS.includes(gender)) {
    throw new ValidationError(422, `gender must be one of: ${VALID_GENDERS.join(', ')}`);
  }

  let recordedDateVal = null;
  if (recordedDate) {
    const d = new Date(recordedDate);
    if (isNaN(d.getTime())) throw new ValidationError(422, 'recordedDate must be a valid ISO date');
    recordedDateVal = d.toISOString().substring(0, 10);
  }

  const phoneVal = _optionalPhone(phoneNumber);

  return {
    id:          idN,
    name:        String(name).trim(),
    age:         ageN,
    gender:      gender || null,
    heightCm:    heightN,
    weightKg:    weightN,
    bmi:         bmiN,
    fatPercent:  fatN,
    bmr:         bmrN,
    bodyAge:     bodyAgeN,
    visceralFat: visceralN,
    chestCm:     chestN,
    waistCm:     waistN,
    hipCm:       hipN,
    recordedDate: recordedDateVal,
    locationName: locationName ? String(locationName).trim().substring(0, 200) : null,
    phoneNumber: phoneVal,
  };
}

/**
 * Validate the token query param for
 * GET /api/body-parameters-card/public/[token].
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateToken(token) {
  const t = String(token || '').trim();
  if (!UUID_RE.test(t)) throw new ValidationError(400, 'Invalid token format');
  return t;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _optionalInt(val, field, min, max) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val);
  if (isNaN(n)) throw new ValidationError(422, `${field} must be a number`);
  if (n < min || n > max) throw new ValidationError(422, `${field} must be between ${min} and ${max}`);
  return n;
}

function _optionalFloat(val, field, min, max) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) throw new ValidationError(422, `${field} must be a number`);
  if (n < min || n > max) throw new ValidationError(422, `${field} must be between ${min} and ${max}`);
  return n;
}

function _optionalPhone(val) {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = String(val).trim().replace(/[\s\-()]/g, '');
  if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
    throw new ValidationError(422, 'phoneNumber must be 10–15 digits (optional + prefix)');
  }
  return cleaned;
}

/**
 * Validate the query params for GET /api/body-parameters-card/phone-search.
 *
 * @param {{ prefix: string, coachId: string }} query
 * @returns {{ prefix: string, coachId: number }}
 * @throws {ValidationError}
 */
export function validatePhoneSearchQuery(query) {
  if (!query) throw new ValidationError(400, 'Query params missing');
  const { prefix, coachId } = query;

  if (!prefix || String(prefix).trim() === '') {
    throw new ValidationError(400, 'prefix is required');
  }
  const cleanPrefix = String(prefix).trim().replace(/[\s\-()]/g, '');
  if (!/^[0-9]{2,15}$/.test(cleanPrefix)) {
    throw new ValidationError(422, 'prefix must be 2–15 digits');
  }

  if (!coachId) throw new ValidationError(400, 'coachId is required');
  const coachIdN = parseInt(coachId, 10);
  if (isNaN(coachIdN) || coachIdN < 1) {
    throw new ValidationError(400, 'coachId must be a valid UserId');
  }

  return { prefix: cleanPrefix, coachId: coachIdN };
}
