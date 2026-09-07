import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateMarathonComparisonInput } from '../../../features/weight/weight.validators.js';
import { getMarathonWeightComparison } from '../../../features/weight/weight.service.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getMarathonWeightComparison(validateMarathonComparisonInput(req.query)));
}
