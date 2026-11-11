/**
 * POST /api/user/community-position/request
 * Email a 24h approval code to the member's coach.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { validateCommunityPositionRequest } from '../../../../features/user/user.validators.js';
import { requestCommunityPositionApproval } from '../../../../features/user/communityPosition.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => requestCommunityPositionApproval(validateCommunityPositionRequest(req.body)));
}
