/**
 * backend/features/quick-share/api/get-public.handler.js
 * ---------------------------------------------------------------------------
 * GET /api/quick-share/public/[token]
 *
 * Returns the AI analysis result for a public share link.
 * - 404 if token not found / expired.
 * - 202 if token valid but analysis still pending (AnalysisData is null).
 * - 200 if result ready.
 *
 * No authentication required — this is a public endpoint.
 * PII is limited: no user names, emails, or IDs are returned.
 * ---------------------------------------------------------------------------
 */
import { validatePublicToken } from '../validation/captures.schema.js';
import * as repo from '../data/captures.repo.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} req - Next.js request (req.query.token)
 * @param {object} res - Next.js response
 */
export async function getPublicCaptureHandler(req, res) {
  const { token } = req.query;

  const validation = validatePublicToken(token);
  if (!validation.ok) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_TOKEN', message: validation.error } });
  }

  let row;
  try {
    row = await repo.findCaptureByToken(token);
  } catch (err) {
    logger.error('[get-public.handler] DB lookup failed', { token, err: err.message });
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Lookup failed.' } });
  }

  if (!row) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found or expired.' } });
  }

  if (!row.AnalysisData) {
    // Analysis still running
    return res.status(202).json({ ok: true, data: { status: 'pending' } });
  }

  let analysisData;
  try {
    analysisData = typeof row.AnalysisData === 'string'
      ? JSON.parse(row.AnalysisData)
      : row.AnalysisData;
  } catch {
    analysisData = { raw: row.AnalysisData };
  }

  return res.status(200).json({ ok: true, data: { status: 'ready', analysis: analysisData } });
}
