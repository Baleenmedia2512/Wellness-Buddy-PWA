/**
 * POST /api/weight-progress-tips/submit-review
 * Persist the user's accountability review after a reverse-progress alert.
 *
 * Body: see validateSubmitReview in validation/submit-review.schema.js
 * Returns: { ok: true, data: { weightRecordId, message } }
 */
import { submitReviewHandler } from '../../../features/weight-progress-tips/api/submit-review.handler.js';
import { methodNotAllowed } from '../../../shared/lib/handler.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const result = await submitReviewHandler(req.body);

    logger.info('Weight progress review submitted', {
      requestId,
      userId: req.body?.userId,
      durationMs: Date.now() - startTime,
    });

    return res.status(201).json(result);
  } catch (error) {
    logger.error('Weight progress review submission failed', {
      requestId,
      userId: req.body?.userId,
      error: error.message,
      stack: error.stack,
      durationMs: Date.now() - startTime,
    });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: error.message, details: error.details },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Failed to submit review'
            : `Failed to submit review: ${error.message}`,
      },
    });
  }
}
