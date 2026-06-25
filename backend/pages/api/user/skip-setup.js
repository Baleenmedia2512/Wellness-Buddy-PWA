import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSkipSetup } from '../../../features/user/user.validators.js';
import { skipSetup } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => skipSetup(validateSkipSetup(req.body)));
}
