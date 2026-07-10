import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import logger from '../../../shared/lib/logger.js';
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
    logger.info('[profile] incoming update request', {
      email: req.body?.email,
      hasCommunityId: req.body?.CommunityId !== undefined || req.body?.Community_id !== undefined,
    });
    return runService(res, async () => {
      let input;
      try {
        input = validateUpdateProfile(req.body);
      } catch (err) {
        if (err?.status === 400
          && (req.body?.CommunityId !== undefined || req.body?.CommunityId !== undefined)) {
          logger.info('[profile/update] community_id validation result', {
            valid: false,
            message: err.message,
          });
        }
        throw err;
      }
      return updateProfile(input);
    });
  }
  return methodNotAllowed(res);
}
