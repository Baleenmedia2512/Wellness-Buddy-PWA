// Inline config for Next.js 15
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { validateRetryPromotion } from '../../../../features/background-analysis/analysis.validators.js';
import { retryPromotionToFood } from '../../../../features/background-analysis/diary.service.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * POST /api/background-analysis/captures/retry-promotion
 *
 * PR-A.2 / ADR-0003 — Diary "Other → Retry / Edit" promotion.
 *
 * Thin proxy (claude.md §2.1 / §15.2). All orchestration, permission
 * enforcement, and audit logging live in
 * `features/background-analysis/diary.service.js :: retryPromotionToFood`.
 *
 * Body:  { captureId, viewerUserId, analysisResult, imagePath? }
 * 200:   { ok: true, data: { id, message, data: { … } } }    // save() shape
 * 404:   { ok: false, error: { code: 'CAPTURE_NOT_FOUND' } }
 * 409:   { ok: false, error: { code: 'NOT_RETRYABLE', currentType, … } }
 *        (only pending|unknown → food is allowed)
 * 401:   { success: false, message: 'Authentication required …' }
 * 403:   { success: false, message: 'You do not have permission …' }
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () =>
    retryPromotionToFood(validateRetryPromotion(req.body)),
  );
}
