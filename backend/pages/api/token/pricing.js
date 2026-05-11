import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetPricing } from '../../../features/token/token.validators.js';
import { getPricing } from '../../../features/token/token.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getPricing(validateGetPricing(req.query)));
}
