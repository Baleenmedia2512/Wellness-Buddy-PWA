import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateReverseLookup } from '../../../features/token/token.validators.js';
import { reverseLookup } from '../../../features/token/token.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => reverseLookup(validateReverseLookup(req.query)));
}
