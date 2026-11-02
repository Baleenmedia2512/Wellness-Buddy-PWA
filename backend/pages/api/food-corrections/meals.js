import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateMealsBatchInput } from '../../../features/food-corrections/food-corrections.validators.js';
import { getMealsBatch } from '../../../features/food-corrections/food-corrections.service.js';

/**
 * GET /api/food-corrections/meals?userId=&ids=1,2,3
 * Batch meal details for background prefetch (max 20 ids).
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getMealsBatch(validateMealsBatchInput(req.query)));
}
