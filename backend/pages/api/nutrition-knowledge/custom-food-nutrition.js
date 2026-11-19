import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  validateSetCustomFoodNutrition,
  setCustomFoodNutrition,
} from '../../../features/nutrition-knowledge/index.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => setCustomFoodNutrition(validateSetCustomFoodNutrition(req.body || {})));
}
