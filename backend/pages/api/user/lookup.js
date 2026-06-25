import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateLookup } from '../../../features/user/user.validators.js';
import { lookupUser } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Cache', 'MISS');
  return runService(res, () => lookupUser(validateLookup(req)));
}
