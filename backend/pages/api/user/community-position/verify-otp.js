/**
 * POST /api/user/community-position/verify-otp
 * Member enters the code their coach shared. The position is saved only then.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { validateCommunityPositionVerify } from '../../../../features/user/user.validators.js';
import { verifyCommunityPositionOtp } from '../../../../features/user/communityPosition.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyCommunityPositionOtp(validateCommunityPositionVerify(req.body)));
}
