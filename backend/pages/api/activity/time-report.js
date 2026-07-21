import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateTimeReport } from '../../../features/activity/activity.validators.js';
import { getTimeReport } from '../../../features/activity/time-report.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return runService(res, () => getTimeReport(validateTimeReport(req.query)));
}
