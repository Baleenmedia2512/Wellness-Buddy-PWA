import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSuggestionsQuery } from '../../../features/food-suggestions/food-suggestions.validators.js';
import { getFoodSuggestions } from '../../../features/food-suggestions/food-suggestions.service.js';

/**
 * GET /api/food-suggestions?userId=&anchor=&limit=&exclude=
 * Additive suggestions API — latest (self) + oftenWith (personal-first).
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => getFoodSuggestions(validateSuggestionsQuery(req.query)));
}
