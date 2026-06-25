import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUpdateAnalysis } from '../../../features/food-corrections/food-corrections.validators.js';
import { updateAnalysis } from '../../../features/food-corrections/food-corrections.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'PUT, OPTIONS')) return;
  if (req.method !== 'PUT') return methodNotAllowed(res);
  return runService(res, () => updateAnalysis(validateUpdateAnalysis(req.body)));
}
