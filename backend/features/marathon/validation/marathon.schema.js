/**
 * marathon.schema.js — Input validation for Marathon Recognition Engine endpoints.
 *
 * Hand-written validators consistent with the rest of the codebase (no joi / zod).
 * All validators throw ValidationError on bad input.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { CARD_TYPES, MARATHON_STATUS } from '../domain/marathon.rules.js';

const VALID_CARD_TYPES  = Object.values(CARD_TYPES);
const VALID_STATUSES    = Object.values(MARATHON_STATUS);

// ─────────────────────────────────────────────────────────────────────────────
// Create marathon
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} body
 * @returns {{ coachId: number, name: string, totalLaps: number, daysPerLap: number,
 *             startedAt: string, participantUserIds: number[] }}
 */
export function validateCreateMarathon(body) {
  const { coachId, name, totalLaps, daysPerLap, startedAt, participantUserIds } = body || {};

  if (!coachId || isNaN(Number(coachId))) {
    throw new ValidationError(400, 'coachId is required and must be a number');
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    throw new ValidationError(400, 'name is required (min 2 characters)');
  }
  if (!totalLaps || isNaN(Number(totalLaps)) || Number(totalLaps) < 1 || Number(totalLaps) > 52) {
    throw new ValidationError(400, 'totalLaps must be a number between 1 and 52');
  }
  if (!daysPerLap || isNaN(Number(daysPerLap)) || Number(daysPerLap) < 1 || Number(daysPerLap) > 30) {
    throw new ValidationError(400, 'daysPerLap must be a number between 1 and 30');
  }
  if (!startedAt || !/^\d{4}-\d{2}-\d{2}$/.test(startedAt)) {
    throw new ValidationError(400, 'startedAt must be a date in YYYY-MM-DD format');
  }
  if (!Array.isArray(participantUserIds) || participantUserIds.length === 0) {
    throw new ValidationError(400, 'participantUserIds must be a non-empty array');
  }
  if (participantUserIds.some(id => isNaN(Number(id)))) {
    throw new ValidationError(400, 'participantUserIds must all be numbers');
  }

  return {
    coachId:             Number(coachId),
    name:                name.trim(),
    totalLaps:           Number(totalLaps),
    daysPerLap:          Number(daysPerLap),
    startedAt,
    participantUserIds:  participantUserIds.map(Number),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get card data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} query
 * @returns {{ marathonId: number, cardType: string, coachId: number }}
 */
export function validateGetCardData(query) {
  const { marathonId, cardType, coachId } = query || {};

  if (!marathonId || isNaN(Number(marathonId))) {
    throw new ValidationError(400, 'marathonId is required and must be a number');
  }
  if (!cardType || !VALID_CARD_TYPES.includes(cardType)) {
    throw new ValidationError(400, `cardType must be one of: ${VALID_CARD_TYPES.join(', ')}`);
  }
  if (!coachId || isNaN(Number(coachId))) {
    throw new ValidationError(400, 'coachId is required and must be a number');
  }

  return {
    marathonId: Number(marathonId),
    cardType,
    coachId:    Number(coachId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// List marathons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} query
 * @returns {{ coachId: number, status: string|null }}
 */
export function validateListMarathons(query) {
  const { coachId, status } = query || {};

  if (!coachId || isNaN(Number(coachId))) {
    throw new ValidationError(400, 'coachId is required and must be a number');
  }
  if (status && !VALID_STATUSES.includes(status)) {
    throw new ValidationError(400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  return {
    coachId: Number(coachId),
    status:  status || null,
  };
}
