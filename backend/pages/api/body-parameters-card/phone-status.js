/**
 * GET /api/body-parameters-card/phone-status
 * Returns whether the phone belongs to an activated member (BCM blocked).
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { handlePhoneStatus } from '../../../features/body-parameters-card/api/phone-status.handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  // Must allow X-App-Version* (same as create) — otherwise browser reports CORS error on preflight.
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const { httpStatus, body } = await handlePhoneStatus(req.query);
    res.status(httpStatus).json(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.status).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
      return;
    }
    logger.error('[phone-status] unexpected error', { err });
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
