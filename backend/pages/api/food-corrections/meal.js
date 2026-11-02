import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateMealDetailInput } from '../../../features/food-corrections/food-corrections.validators.js';
import { getMealDetail } from '../../../features/food-corrections/food-corrections.service.js';

/**
 * GET /api/food-corrections/meal?userId=&id=
 * Full meal row (AnalysisData + totals) for a single indexed meal.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getMealDetail(validateMealDetailInput(req.query)));
}
