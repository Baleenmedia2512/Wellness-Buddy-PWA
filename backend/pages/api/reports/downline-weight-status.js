/**
 * GET /api/reports/downline-weight-status
 *
 * Query: coachId (required), page, limit (default 20), search, teamFilter
 * (mine|direct|full), statusFilter (all|off_track|on_track|no_data), sort.
 *
 * Returns a page of weight-status rows plus aggregate status/team counts so the
 * Ideal Weight UI can keep Mine / Direct / Full chips accurate without loading
 * the entire downline into the client.
 *
 * Authorization: coachId is supplied by the authenticated client. The field is
 * validated as a positive integer; in future this should be re-derived from the
 * session token (see §3 of claude.md — never trust client-sent IDs). Until a
 * session middleware is wired here, callers must be trusted coach clients.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getDownlineWeightStatus } from '../../../features/reports/reports.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  // Encourage intermediaries / clients to keep short-lived copies (15–30s).
  res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=15');
  return runService(res, () => getDownlineWeightStatus(req.query));
}
