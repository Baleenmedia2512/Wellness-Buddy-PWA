/**
 * POST /api/user/height/verify-otp
 * Confirm height change after the member enters the 5-minute OTP.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { validateHeightChangeVerify } from '../../../../features/user/user.validators.js';
import { verifyHeightChangeOtp } from '../../../../features/user/heightChange.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyHeightChangeOtp(validateHeightChangeVerify(req.body)));
}
