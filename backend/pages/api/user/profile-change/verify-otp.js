/**
 * POST /api/user/profile-change/verify-otp
 * Confirm the coach code and apply all pending gated profile changes.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { getClientAppVersion } from '../../../../shared/lib/client-app-version.js';
import { validateProfileChangeVerify } from '../../../../features/user/user.validators.js';
import { verifyProfileChangeOtp } from '../../../../features/user/profileChange.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyProfileChangeOtp({
    ...validateProfileChangeVerify(req.body),
    appVersion: getClientAppVersion(req),
  }));
}
