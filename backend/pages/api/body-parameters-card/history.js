/**
 * GET /api/body-parameters-card/history
 * Dated body-parameter snapshots for a member the viewer may access.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleCardHistory } from '../../../features/body-parameters-card/api/history.handler.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => handleCardHistory(req.query));
}
