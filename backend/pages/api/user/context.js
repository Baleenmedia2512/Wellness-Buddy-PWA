import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUserId } from '../../../features/user/user.validators.js';
import { getContext } from '../../../features/user/user.service.js';
import { rejectIfAppVersionTooOld } from '../../../features/app-version/api/enforce-api.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (rejectIfAppVersionTooOld(req, res)) return;
  return runService(res, () => getContext(validateUserId(req.query)));
}
