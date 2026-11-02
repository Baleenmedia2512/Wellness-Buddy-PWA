/**
 * POST /api/user/community-id/request
 * Send a 24h Community ID approval OTP to the requester's sponsor.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { validateCommunityIdRequest } from '../../../../features/user/user.validators.js';
import { requestCommunityIdApproval } from '../../../../features/user/communityIdApproval.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => requestCommunityIdApproval(validateCommunityIdRequest(req.body)));
}
