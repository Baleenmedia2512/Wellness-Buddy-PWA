import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetDaily, validateSaveDaily } from '../../../features/activity/activity.validators.js';
import { getDailyActivity, saveDailyActivity } from '../../../features/activity/activity.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => getDailyActivity(validateGetDaily(req.query)));
  }
  if (req.method === 'POST') {
    return runService(res, () => saveDailyActivity(validateSaveDaily(req.body)));
  }
  return methodNotAllowed(res);
}
