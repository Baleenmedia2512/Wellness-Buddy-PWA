import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateProfileGet, validateProfileUpdate } from '../../../features/user/user.validators.js';
import { getProfile, updateProfile } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'GET') {
    return runService(res, () => getProfile(validateProfileGet(req.query)));
  }
  if (req.method === 'POST') {
    return runService(res, () => updateProfile(validateProfileUpdate(req.body)));
  }
  return methodNotAllowed(res);
}
