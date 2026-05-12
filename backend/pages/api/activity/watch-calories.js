import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateWatchCalories } from '../../../features/activity/activity.validators.js';
import { getWatchBurnedCalories } from '../../../features/activity/activity.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => getWatchBurnedCalories(validateWatchCalories(req.query)));
}
