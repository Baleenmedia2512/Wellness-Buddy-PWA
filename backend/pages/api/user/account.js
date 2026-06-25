import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateDeleteAccount } from '../../../features/user/user.validators.js';
import { deleteAccount } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'DELETE, OPTIONS')) return;
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  return runService(res, () => deleteAccount(validateDeleteAccount(req.body)));
}
