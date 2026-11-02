/**
 * POST /api/user/community-id/verify-otp
 * Confirm a pending Community ID after the sponsor shares the 24h code.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { validateCommunityIdVerify } from '../../../../features/user/user.validators.js';
import { verifyCommunityIdOtp } from '../../../../features/user/communityIdApproval.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyCommunityIdOtp(validateCommunityIdVerify(req.body)));
}
