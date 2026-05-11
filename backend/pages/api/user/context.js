import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateUserContext } from '../../../features/user/user.validators.js';
import { getUserContext } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getUserContext(validateUserContext(req.query)));
}
