import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import logger from '../../../shared/lib/logger.js';
import { validateGetProfile, validateUpdateProfile } from '../../../features/user/user.validators.js';
import { getProfile, updateProfile } from '../../../features/user/user.service.js';
import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { rejectIfAppVersionTooOld } from '../../../features/app-version/api/enforce-api.handler.js';

export { config };

async function handleUpdateProfile(req, res) {
  logger.info('[profile] incoming update request', {
    method: req.method,
    email: req.body?.email,
    hasCommunityId: req.body?.communityId !== undefined || req.body?.community_id !== undefined,
    hasTimezone: req.body?.timezone !== undefined
      || req.body?.timezoneIana !== undefined
      || req.body?.timezone_iana !== undefined,
  });
  return runService(res, async () => {
    let input;
    try {
      input = validateUpdateProfile(req.body);
    } catch (err) {
      if (err?.status === 400
        && (req.body?.communityId !== undefined || req.body?.community_id !== undefined)) {
        logger.info('[profile/update] CommunityId validation result', {
          valid: false,
          message: err.message,
        });
      }
      throw err;
    }
    return updateProfile(input);
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, PUT, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method === 'GET') {
    return runService(res, () => getProfile(validateGetProfile(req.query)));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    return handleUpdateProfile(req, res);
  }
  return methodNotAllowed(res);
}
