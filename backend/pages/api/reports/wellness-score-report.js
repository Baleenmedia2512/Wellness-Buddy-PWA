/**
 * GET /api/reports/wellness-score-report
 *
 * Single optimized request for the Wellness Score Report dashboard.
 * Returns name, today/previous weight, wellness score, and sponsor
 * for the coach's reporting hierarchy (Mine / Direct / Full).
 *
 * Query: coachId (required), page, limit, search, teamFilter (mine|direct|full),
 * sort (name|score|weight), exportAll, date (optional YYYY-MM-DD IST).
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getWellnessScoreReport } from '../../../features/reports/wellness-score-report.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  if (!isEnabled('ff.wellness-score-sheet') || !isEnabled('ff.reports-module')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }

  // Avoid browser 304 revalidation (was waiting ~2s on a full origin recompute).
  // Client + server memory caches own freshness instead.
  res.setHeader('Cache-Control', 'private, no-store');
  return runService(res, () => getWellnessScoreReport(req.query));
}
