import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateStats } from '../../../features/food-corrections/food-corrections.validators.js';
import { getStats } from '../../../features/food-corrections/food-corrections.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return runService(res, () => getStats(validateStats(req.query)));
}
