/**
 * GET /api/body-parameters-card/member-prefill
 * Returns team_table + latest weight fields for BCM form prefill.
 */
import { handleMemberPrefill } from '../../../features/body-parameters-card/api/member-prefill.handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET only' } });
    return;
  }

  try {
    const { httpStatus, body } = await handleMemberPrefill(req.query);
    res.status(httpStatus).json(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.status).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
      return;
    }
    logger.error('[member-prefill] unexpected error', { err });
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
