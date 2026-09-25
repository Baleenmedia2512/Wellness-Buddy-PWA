/**
 * POST /api/user/height/request-otp
 * Send a 5-minute OTP so a member can change a locked profile height.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { validateHeightChangeRequest } from '../../../../features/user/user.validators.js';
import { requestHeightChangeOtp } from '../../../../features/user/heightChange.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => requestHeightChangeOtp(validateHeightChangeRequest(req.body)));
}
