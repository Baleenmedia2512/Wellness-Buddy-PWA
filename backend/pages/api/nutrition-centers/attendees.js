import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetAttendees } from '../../../features/nutrition-centers/centers.validators.js';
import { getAttendees } from '../../../features/nutrition-centers/centers.service.js';

/**
 * GET /api/nutrition-centers/attendees?centerId=X&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns the de-duplicated list of users who attended a specific nutrition centre
 * in the given date range.
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => getAttendees(validateGetAttendees(req.query)));
  }
  return methodNotAllowed(res);
}
