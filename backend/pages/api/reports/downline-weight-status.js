/**
 * GET /api/reports/downline-weight-status?coachId=<id>
 *
 * Returns the weight status of every direct-downline member for the given
 * coach: current weight, ideal range (BMI 19–23), and a status classification.
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
  return runService(res, () => getDownlineWeightStatus(req.query));
}
