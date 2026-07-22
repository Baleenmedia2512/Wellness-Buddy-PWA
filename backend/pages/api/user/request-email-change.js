import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateRequestEmailChange } from '../../../features/user/user.validators.js';
import { requestEmailChange } from '../../../features/user/change-email.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => requestEmailChange(validateRequestEmailChange(req.body)));
}
