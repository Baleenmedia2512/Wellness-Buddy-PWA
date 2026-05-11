import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetProfile, validateUpdateProfile } from '../../../features/user/user.validators.js';
import { getProfile, updateProfile } from '../../../features/user/user.service.js';
import { largeBodyConfig as config } from '../../../utils/apiConfig.js';

export { config };

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'GET') {
    return runService(res, () => getProfile(validateGetProfile(req.query)));
  }
  if (req.method === 'POST') {
    return runService(res, () => updateProfile(validateUpdateProfile(req.body)));
  }
  return methodNotAllowed(res);
}
