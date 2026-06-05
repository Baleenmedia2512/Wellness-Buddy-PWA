/**
 * backend/features/background-analysis/diary.service.js
 *
 * "Diary" view orchestrators. Composes:
 *   - captures slice (read + state-machine writes)
 *   - food/weight/education repositories (read)
 *   - retry permission policy
 *   - structured logger (audit trail)
 *
 * Two responsibilities live here:
 *
 *   1. **resolvePublicCapture** — share-link deep-link target lookup.
 *      Extracted from `analysis.service.js` in PR-B (ADR-0003) to keep
 *      `analysis.service.js` under the §2.3 file-size budget.
 *
 *   2. **retryPromotionToFood** — the Diary "Other → Retry / Edit"
 *      action introduced in PR-A.2. Same reason for the extraction.
 *
 * PR-B (the feature commit that follows this refactor) adds a third:
 *   3. **listDiaryEntries** — the joined feed read-model.
 *
 * NOTE: this is a pure refactor in its first commit — every function moved
 * here is byte-identical to what was in `analysis.service.js` immediately
 * before the move, modulo the explicit `from './analysis.service.js'`
 * import for `save()` (the only intra-feature back-reference).
 *
 * Module boundary (claude.md §2.2): this file is part of the same
 * background-analysis feature, so importing from `./analysis.service.js`
 * and `./analysis.repository.js` is permitted.
 */

import * as repo from './analysis.repository.js';
import { save } from './analysis.service.js';
import * as captures from '../captures/captures.service.js';
import { IMAGE_TYPE_UNKNOWN } from '../captures/domain/image-types.js';
import { assertCanRetryCapture } from '../captures/domain/permissions/retry.policy.js';
import logger from '../../shared/lib/logger.js';

// ─── resolvePublicCapture (deep-link target lookup) ─────────────────────────

/**
 * Look up the OWNER + meal date for a shared token. Used by the in-app
 * deep-link handler: the app opens Dashboard for that user/date and
 * automatically expands the specific meal card. Enforces permission — viewer
 * must be the owner OR appear in the owner's upline coach chain.
 *
 * Returns:
 *   { ok: true,  data: { mealId, ownerUserId, ownerUserName, mealDate, isSelf, imageType } }
 *   { ok: false, error: { code: 'NOT_FOUND' | 'EXPIRED' | 'FORBIDDEN', message } }
 */
export async function resolvePublicCapture({ token, viewerUserId }) {
  const row = await repo.findOwnerByToken(token);
  if (!row) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } } };
  }
  if (row.ShareExpiresAt && new Date(row.ShareExpiresAt) < new Date()) {
    return { httpStatus: 410, body: { ok: false, error: { code: 'EXPIRED', message: 'This share link has expired' } } };
  }
  const mealId = row.ID ? row.ID.toString() : null;
  const ownerUserId = row.UserID ? row.UserID.toString() : null;
  if (!ownerUserId) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link has no owner' } } };
  }

  const viewer = viewerUserId.toString();
  const isSelf = viewer === ownerUserId;
  if (!isSelf) {
    // Permission: viewer must appear in the owner's upline coach chain.
    // Co-coach partners are NOT granted access — they are peers of the owner's
    // coach and have no supervisory relationship with the owner.
    const chain = await repo.getCoachChain(ownerUserId);
    if (!chain.includes(viewer)) {
      return { httpStatus: 403, body: { ok: false, error: { code: 'FORBIDDEN', message: "You don't have access to this meal" } } };
    }
  }

  const ownerUserName = isSelf ? null : await repo.findUserName(ownerUserId);
  // Slice the IST-stored CreatedAt to YYYY-MM-DD so the Dashboard opens the
  // correct local date. Using toISOString() would shift a late-evening IST
  // timestamp to the next UTC day, showing the wrong nutrition entries.
  const mealDate = row.CreatedAt ? row.CreatedAt.toString().slice(0, 10) : null;

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        mealId,
        ownerUserId,
        ownerUserName,
        mealDate,
        isSelf,
        // imageType drives in-app deep-link tab routing.
        // Falls back to 'food' for legacy rows that pre-date this column.
        imageType: row.ImageType || 'food',
      },
    },
  };
}

// ─── retryPromotionToFood ────────────────────────────────────────────────────
// PR-A.2 / ADR-0003 — Diary "Other → Retry / Edit" promotion endpoint.
//
// Called when the user (or a coach in the user's upline) supplies a new
// Gemini analysis (Retry path) or a manual nutrition edit (Edit path) for
// a capture currently tagged `unknown`. Promotes the capture
// `unknown → food` and upserts the corresponding `food_nutrition_data_table`
// row by delegating to the existing `save()` orchestrator.
//
// Auth posture:
//   1. The capture is read WITHOUT owner guard (captures.findById).
//   2. The OWNER is taken from the row and a coach chain is fetched.
//   3. assertCanRetryCapture decides; throws 401 / 403 on denial.
//   4. State-machine guard inside save() → captures.updateTypeById
//      → assertCanTransition('unknown', 'food') enforces immutability for
//      every other path.
//
// Returns:
//   { httpStatus: 200, body: { ok: true, data: { ... } } } — passes through save() envelope
//   { httpStatus: 404, body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND' } } }
//   { httpStatus: 409, body: { ok: false, error: { code: 'NOT_RETRYABLE', currentType } } }
//   throws 401 / 403 (caught by runService) on permission denial.
export async function retryPromotionToFood(input) {
  const { captureId, viewerUserId, analysisResult, imagePath } = input;

  // 1. Load the capture. NO owner guard — the policy decides.
  const capture = await captures.findById(captureId);
  if (!capture) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND', message: 'Capture not found' } },
    };
  }

  const ownerUserId = capture.UserID ? capture.UserID.toString() : null;
  if (!ownerUserId) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND', message: 'Capture has no owner' } },
    };
  }

  // 2. Only `unknown` captures may be retried via this endpoint.
  if (capture.ImageType !== IMAGE_TYPE_UNKNOWN) {
    return {
      httpStatus: 409,
      body: {
        ok: false,
        error: {
          code: 'NOT_RETRYABLE',
          message: `Only 'unknown' captures may be retried. Current type: '${capture.ImageType}'.`,
          currentType: capture.ImageType,
        },
      },
    };
  }

  // 3. Fetch the owner's upline coach chain and run the permission policy.
  const coachChain = await repo.getCoachChain(ownerUserId);

  let decision;
  try {
    decision = assertCanRetryCapture({
      viewerId: viewerUserId,
      ownerId: ownerUserId,
      coachChain,
    });
  } catch (err) {
    logger.warn('retryPromotionToFood: permission denied', {
      captureId, viewerUserId, ownerUserId, reason: err.reason, code: err.code,
    });
    throw err;
  }

  // 4. Audit-log every coach-on-member promotion (ADR-0003 F5).
  if (decision.actorRole === 'COACH') {
    logger.info('retryPromotionToFood: coach action on member capture', {
      actorId: viewerUserId,
      ownerId: ownerUserId,
      captureId,
      action: 'retry-promotion-to-food',
    });
  }

  // 5. Delegate to save() — owner's userId, not the viewer's.
  return save({
    userId: ownerUserId,
    imagePath: imagePath || capture.ImagePath || 'retry-promotion',
    analysisResult,
    deviceInfo: 'Wellness Valley Diary Retry',
    ImageBase64: capture.ImageBase64 || null,
    captureId,
  });
}
