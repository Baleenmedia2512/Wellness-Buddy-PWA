import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateStatusInput } from '../../../features/user/user.validators.js';
import { getUserStatus } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  // Prevent caching of dynamic status data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getUserStatus(validateStatusInput(req.query)));
}
