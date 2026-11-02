import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateVerifySession } from '../../../features/user/user.validators.js';
import { verifyUserSession } from '../../../features/user/user.service.js';
import { rejectIfAppVersionTooOld } from '../../../features/app-version/api/enforce-api.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res);
  if (rejectIfAppVersionTooOld(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Cache', 'MISS');
  return runService(res, () => verifyUserSession(validateVerifySession(req)));
}
