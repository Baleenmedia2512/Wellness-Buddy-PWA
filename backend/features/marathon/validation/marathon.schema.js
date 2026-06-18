/**
 * marathon.schema.js — Input validation for Marathon Recognition Engine endpoints.
 *
 * Hand-written validators consistent with the rest of the codebase (no joi / zod).
 * All validators throw ValidationError on bad input.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { CARD_TYPES, MARATHON_STATUS, LAP_ROLES } from '../domain/marathon.rules.js';

const VALID_CARD_TYPES  = Object.values(CARD_TYPES);
const VALID_STATUSES    = Object.values(MARATHON_STATUS);
const VALID_LAP_ROLES   = Object.values(LAP_ROLES);

// ─────────────────────────────────────────────────────────────────────────────
// Create marathon
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} body
 * @returns {{ coachId: number, name: string, totalLaps: number, daysPerLap: number,
 *             startedAt: string, participantUserIds: number[] }}
 */
export function validateCreateMarathon(body) {
  const { coachId, name, teamName, totalLaps, daysPerLap, startedAt, participantUserIds, participants } = body || {};

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

  // Accept either `participants` (new — objects with userId+role) or `participantUserIds` (legacy)
  let resolvedParticipants;
  if (Array.isArray(participants) && participants.length > 0) {
    if (participants.some(p => !p.userId || isNaN(Number(p.userId)))) {
      throw new ValidationError(400, 'Each participant must have a valid userId');
    }
    const invalidRole = participants.find(p => p.role && !VALID_LAP_ROLES.includes(p.role));
    if (invalidRole) {
      throw new ValidationError(400, `participant role must be one of: ${VALID_LAP_ROLES.join(', ')}`);
    }
    const captains = participants.filter(p => p.role === 'captain');
    const assistants = participants.filter(p => p.role === 'assistant_captain');
    if (captains.length > 1)   throw new ValidationError(400, 'A LAP may have at most 1 captain');
    if (assistants.length > 1) throw new ValidationError(400, 'A LAP may have at most 1 assistant captain');
    resolvedParticipants = participants.map(p => ({ userId: Number(p.userId), role: p.role || 'member' }));
  } else if (Array.isArray(participantUserIds) && participantUserIds.length > 0) {
    if (participantUserIds.some(id => isNaN(Number(id)))) {
      throw new ValidationError(400, 'participantUserIds must all be numbers');
    }
    resolvedParticipants = participantUserIds.map(id => ({ userId: Number(id), role: 'member' }));
  } else {
    throw new ValidationError(400, 'participants (or participantUserIds) must be a non-empty array');
  }

  return {
    coachId:      Number(coachId),
    name:         name.trim(),
    teamName:     teamName ? String(teamName).trim() : null,
    totalLaps:    Number(totalLaps),
    daysPerLap:   Number(daysPerLap),
    startedAt,
    participants: resolvedParticipants,
    // legacy compat
    participantUserIds: resolvedParticipants.map(p => p.userId),
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

// ─────────────────────────────────────────────────────────────────────────────
// Finalize day
// ─────────────────────────────────────────────────────────────────────────────
export function validateFinalizeDay(body) {
  const { marathonId, coachId } = body || {};
  if (!marathonId || isNaN(Number(marathonId))) throw new ValidationError(400, 'marathonId is required');
  if (!coachId    || isNaN(Number(coachId)))    throw new ValidationError(400, 'coachId is required');
  return { marathonId: Number(marathonId), coachId: Number(coachId) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────────────────────────────────
export function validateGetLeaderboard(query) {
  const { marathonId, type, topN } = query || {};
  if (!marathonId || isNaN(Number(marathonId))) throw new ValidationError(400, 'marathonId is required');
  const VALID_TYPES = ['day', 'lap', 'community'];
  if (!type || !VALID_TYPES.includes(type)) throw new ValidationError(400, `type must be one of: ${VALID_TYPES.join(', ')}`);
  return { marathonId: Number(marathonId), type, topN: Math.min(Number(topN) || 10, 50) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recognition
// ─────────────────────────────────────────────────────────────────────────────
export function validateGetRecognition(query) {
  const { userId } = query || {};
  if (!userId || isNaN(Number(userId))) throw new ValidationError(400, 'userId is required');
  return { userId: Number(userId) };
}

export function validateMarkRecognitionViewed(body) {
  const { userId, marathonId, resultDate } = body || {};
  if (!userId     || isNaN(Number(userId)))     throw new ValidationError(400, 'userId is required');
  if (!marathonId || isNaN(Number(marathonId))) throw new ValidationError(400, 'marathonId is required');
  if (!resultDate || !/^\d{4}-\d{2}-\d{2}$/.test(resultDate)) throw new ValidationError(400, 'resultDate must be YYYY-MM-DD');
  return { userId: Number(userId), marathonId: Number(marathonId), resultDate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin config
// ─────────────────────────────────────────────────────────────────────────────
export function validateSaveAdminConfig(body) {
  const { marathonId, coachId, disciplineStartTime, disciplineEndTime } = body || {};
  if (!marathonId || isNaN(Number(marathonId))) throw new ValidationError(400, 'marathonId is required');
  if (!coachId    || isNaN(Number(coachId)))    throw new ValidationError(400, 'coachId is required');
  const TIME_RE = /^\d{2}:\d{2}$/;
  if (!disciplineStartTime || !TIME_RE.test(disciplineStartTime)) throw new ValidationError(400, 'disciplineStartTime must be HH:MM');
  if (!disciplineEndTime   || !TIME_RE.test(disciplineEndTime))   throw new ValidationError(400, 'disciplineEndTime must be HH:MM');
  return { marathonId: Number(marathonId), coachId: Number(coachId), disciplineStartTime, disciplineEndTime };
}

// ─────────────────────────────────────────────────────────────────────────────
// Member lap dashboard
// ─────────────────────────────────────────────────────────────────────────────
export function validateGetMyLaps(query) {
  const { userId } = query || {};
  if (!userId || isNaN(Number(userId))) throw new ValidationError(400, 'userId is required');
  return { userId: Number(userId) };
}
