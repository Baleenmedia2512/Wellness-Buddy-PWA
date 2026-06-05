/**
 * backend/features/captures/captures.service.js
 * ---------------------------------------------------------------------------
 * Orchestration layer for the captures slice.
 *
 * Public API (called by background-analysis service during the PR 2 dual-write
 * phase, and by route handlers in PR 3):
 *
 *   recordPending({ userId, publicShareToken, shareExpiresAt, imageBase64, ... })
 *   updateType({ publicShareToken, userId, fromType, toType })
 *
 * State-machine enforcement lives here (domain rules call), DB calls are
 * delegated to `data/captures.repository.js`.
 *
 * Failure policy (PR 2, dual-write phase): the new `captures_table` is
 * SHADOW storage. The legacy `food_nutrition_data_table` is still canonical.
 * Therefore failures inside this module MUST NOT cascade to the user-facing
 * request. The background-analysis caller wraps every invocation in a
 * try/catch + logger.warn. PR 4 flips canonical and removes that try/catch.
 * ---------------------------------------------------------------------------
 */

import * as repo from './data/captures.repository.js';
import {
  IMAGE_TYPE_PENDING,
  assertCanTransition,
  isValidImageType,
} from './domain/image-types.js';

/**
 * Mirror the legacy `createPendingCapture` write into `captures_table`.
 * The token MUST be supplied by the caller so both rows share identity.
 *
 * @returns {Promise<{ id: number, publicShareToken: string }>}
 */
export async function recordPending({
  userId,
  publicShareToken,
  shareExpiresAt = null,
  imageBase64 = null,
  imagePath = null,
  deviceInfo = null,
  processedBy = null,
}) {
  if (!userId)            throw new Error('captures.recordPending: userId required');
  if (!publicShareToken)  throw new Error('captures.recordPending: publicShareToken required');

  const row = await repo.insertPending({
    userId,
    publicShareToken,
    shareExpiresAt,
    imageBase64,
    imagePath,
    deviceInfo,
    processedBy,
  });
  return { id: row.ID, publicShareToken: row.PublicShareToken };
}

/**
 * Promote a pending capture to a terminal type. Looks up the capture by
 * token (the universal identifier shared with the legacy row), validates the
 * transition through the domain state machine, then writes.
 *
 * Returns:
 *   { changed: true,  imageType }   on successful transition
 *   { changed: false, reason }      on no-op (row not found / wrong owner /
 *                                   already in target state)
 * Throws (with `err.status = 409`) on an ILLEGAL transition — e.g. trying to
 * re-classify an already-terminal capture.
 */
export async function updateType({ publicShareToken, userId, toType }) {
  if (!publicShareToken) throw new Error('captures.updateType: publicShareToken required');
  if (!userId)           throw new Error('captures.updateType: userId required');
  if (!isValidImageType(toType)) {
    const err = new Error(`captures.updateType: invalid imageType '${toType}'`);
    err.status = 400;
    throw err;
  }

  const current = await repo.findByToken(publicShareToken);
  if (!current || current.UserID?.toString() !== userId.toString()) {
    return { changed: false, reason: 'NOT_FOUND_OR_NOT_OWNER' };
  }
  if (current.ImageType === toType) {
    return { changed: false, reason: 'ALREADY_IN_TARGET_STATE' };
  }

  // Enforce state machine. Throws on illegal transition.
  assertCanTransition(current.ImageType || IMAGE_TYPE_PENDING, toType);

  const updated = await repo.updateImageTypeByToken({
    token: publicShareToken,
    userId,
    imageType: toType,
  });
  if (!updated) {
    return { changed: false, reason: 'UPDATE_RETURNED_NO_ROW' };
  }
  return { changed: true, imageType: updated.ImageType };
}

/**
 * PR 5 — same as `updateType` but keyed by captures_table primary key
 * (CaptureID) instead of the public share token. The background-analysis
 * service uses this path because `food_nutrition_data_table.PublicShareToken`
 * was dropped: it now stores `CaptureID` on the food row instead and looks
 * the capture up by id.
 *
 * Returns / throws semantics are identical to `updateType`.
 */
export async function updateTypeById({ captureId, userId, toType }) {
  if (!captureId) throw new Error('captures.updateTypeById: captureId required');
  if (!userId)    throw new Error('captures.updateTypeById: userId required');
  if (!isValidImageType(toType)) {
    const err = new Error(`captures.updateTypeById: invalid imageType '${toType}'`);
    err.status = 400;
    throw err;
  }

  const current = await repo.findByIdForOwner(captureId, userId);
  if (!current) {
    return { changed: false, reason: 'NOT_FOUND_OR_NOT_OWNER' };
  }
  if (current.ImageType === toType) {
    return { changed: false, reason: 'ALREADY_IN_TARGET_STATE' };
  }

  // Enforce state machine. Throws on illegal transition.
  assertCanTransition(current.ImageType || IMAGE_TYPE_PENDING, toType);

  const updated = await repo.updateImageTypeById({
    captureId,
    userId,
    imageType: toType,
  });
  if (!updated) {
    return { changed: false, reason: 'UPDATE_RETURNED_NO_ROW' };
  }
  return { changed: true, imageType: updated.ImageType };
}

/**
 * PR-A.2 / ADR-0003 — read a capture by primary key WITHOUT enforcing
 * ownership. Used by orchestrators (e.g. the Diary retry-promotion
 * endpoint in background-analysis) that need to learn who the owner is
 * BEFORE running the permission policy.
 *
 * SECURITY: callers MUST pair this read with `assertCanRetryCapture(...)`
 * from `domain/permissions/retry.policy.js`. Returning the row here is
 * NOT an access grant.
 *
 * Returns the row (PascalCase keys) or null when not found / soft-deleted.
 */
export async function findById(captureId) {
  if (!captureId) {
    const err = new Error('captures.findById: captureId required');
    err.status = 400;
    throw err;
  }
  return repo.findById(captureId);
}
