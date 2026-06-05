import { ValidationError } from '../../shared/lib/ValidationError.js';

export function validateSave(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing or too large. Maximum size is 10MB.');
  const { userId, imagePath, analysisResult } = body;
  if (!userId || !imagePath || !analysisResult) {
    throw new ValidationError(400, 'Missing required fields: userId, imagePath, analysisResult');
  }
  return body;
}

export function validateList(query) {
  if (!query?.userId) throw new ValidationError(400, 'UserId is required');
  return {
    userId: query.userId,
    limit: parseInt(query.limit, 10) || 50,
    offset: parseInt(query.offset, 10) || 0,
  };
}

export function validateDelete(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId } = body;
  if (!id || !userId) {
    throw new ValidationError(400, 'Analysis ID and userId are required');
  }
  return { id, userId };
}

export function validateUndo(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId } = body;
  if (!id) throw new ValidationError(400, 'Analysis ID is required');
  return { id, userId };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCreateCapture(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { userId, imageBase64, token } = body;
  if (!userId) throw new ValidationError(400, 'userId is required');
  if (!imageBase64) throw new ValidationError(400, 'imageBase64 is required');
  // token is optional. When supplied by the frontend (instant-share path),
  // it MUST be a valid UUID so we can use it directly as the PublicShareToken.
  // The server still generates its own UUID when the field is absent.
  if (token !== undefined && !UUID_RE.test(token)) {
    throw new ValidationError(400, 'token must be a valid UUID v4');
  }
  // imageType is intentionally NOT accepted here. All pending captures start
  // as ImageType='pending' (set in the repository). The type is resolved via
  // PATCH /captures after AI analysis determines the correct category.
  return { userId, imageBase64, token: token || null };
}

export function validateUpdateCapture(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { id, userId, imageType } = body;
  if (!id) throw new ValidationError(400, 'id is required');
  if (!userId) throw new ValidationError(400, 'userId is required');
  // 'unknown' added in PR 2 (captures slice): when AI confidence is below the
  // food/weight/education/smartwatch thresholds, the frontend classifies the
  // capture as 'unknown' rather than letting it fall through to the food
  // dashboard. Unknown captures are auto-purged after 24h by the cron at
  // pages/api/cron/purge-unknown-captures.js. The terminal-state list is
  // duplicated as the CHECK constraint in migrations/create_captures_table.sql
  // and the enum in features/captures/domain/image-types.js — keep all three
  // in sync.
  const VALID_TYPES = ['food', 'weight', 'education', 'smartwatch', 'unknown'];
  if (!imageType || !VALID_TYPES.includes(imageType)) {
    throw new ValidationError(400, `imageType must be one of: ${VALID_TYPES.join(', ')}`);
  }
  return { id: id.toString(), userId: userId.toString(), imageType };
}

export function validatePublicCapture(query) {
  const { token } = query || {};
  if (!token) throw new ValidationError(400, 'token is required');
  // Validate UUID format to prevent injection via query string.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) throw new ValidationError(400, 'Invalid token format');
  return { token };
}

export function validateResolveCapture(query) {
  const { token, viewerUserId } = query || {};
  if (!token) throw new ValidationError(400, 'token is required');
  if (!viewerUserId) throw new ValidationError(400, 'viewerUserId is required');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) throw new ValidationError(400, 'Invalid token format');
  return { token, viewerUserId: viewerUserId.toString() };
}

/**
 * PR-A.2 / ADR-0003 — input schema for POST /api/background-analysis/captures/retry-promotion.
 *
 * The body carries:
 *   - captureId        — primary key of the captures_table row to promote.
 *   - viewerUserId     — the authenticated session user performing the action.
 *                        The OWNER of the capture is resolved server-side from
 *                        the captures_table row — NEVER trusted from the body.
 *   - analysisResult   — the new Gemini analysis JSON (Retry path) OR the
 *                        manually-edited nutrition object (Edit path). Shape
 *                        validation is delegated to extractNutrition() in the
 *                        service so we don't duplicate the schema here.
 *   - imagePath        — optional. Falls back to the original capture's
 *                        ImagePath in the service if absent.
 */
export function validateRetryPromotion(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { captureId, viewerUserId, analysisResult, imagePath } = body;
  if (!captureId) throw new ValidationError(400, 'captureId is required');
  if (!viewerUserId) throw new ValidationError(400, 'viewerUserId is required');
  if (analysisResult == null) {
    throw new ValidationError(400, 'analysisResult is required');
  }
  // analysisResult may arrive as a JSON string (Retry from native client) or
  // an object (Edit from the web modal). Both are accepted; the service
  // normalises via the existing extractNutrition() path.
  if (typeof analysisResult !== 'string' && typeof analysisResult !== 'object') {
    throw new ValidationError(400, 'analysisResult must be an object or JSON string');
  }
  return {
    captureId: captureId.toString(),
    viewerUserId: viewerUserId.toString(),
    analysisResult,
    imagePath: imagePath ? imagePath.toString() : null,
  };
}

/**
 * PR-B / ADR-0003 — input schema for GET /api/diary/list.
 *
 * Query params:
 *   - ownerUserId  required — the diary subject. Coach reads pass the
 *                  member's id; self reads pass the viewer's own id.
 *   - viewerUserId required — the authenticated session user.
 *   - date         required — `YYYY-MM-DD` in IST. Future dates are
 *                  rejected because no per-vertical write produces a
 *                  future row, and the predicate prevents callers from
 *                  trivially scanning years of history with a single
 *                  request.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDiaryList(query) {
  const { ownerUserId, viewerUserId, date } = query || {};
  if (!ownerUserId) throw new ValidationError(400, 'ownerUserId is required');
  if (!viewerUserId) throw new ValidationError(400, 'viewerUserId is required');
  if (!date) throw new ValidationError(400, 'date is required (YYYY-MM-DD)');
  if (!DATE_RE.test(date)) {
    throw new ValidationError(400, 'date must match YYYY-MM-DD');
  }
  // Guard against impossible dates that pass the regex (e.g. 2026-02-31).
  // Parsing as UTC because the format itself is calendar-only.
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ValidationError(400, 'date is not a valid calendar date');
  }
  // Reject future dates (per ADR-0003 PR-B test plan).
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (date > todayUtc) {
    throw new ValidationError(400, 'date cannot be in the future');
  }
  return {
    ownerUserId:  ownerUserId.toString(),
    viewerUserId: viewerUserId.toString(),
    date,
  };
}
