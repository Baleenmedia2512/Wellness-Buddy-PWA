/**
 * GET /api/reports/wellness-score-report
 *
 * Single optimized request for the Wellness Score Report dashboard.
 * Returns name, today/previous weight, wellness score, sponsor, and coach
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

  res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=15');
  return runService(res, () => getWellnessScoreReport(req.query));
}
