/**
 * POST /api/user/profile-change/request-otp
 * Send one coach approval code for all gated profile field changes.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { getClientAppVersion } from '../../../../shared/lib/client-app-version.js';
import { validateProfileChangeRequest } from '../../../../features/user/user.validators.js';
import { requestProfileChangeOtp } from '../../../../features/user/profileChange.service.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => requestProfileChangeOtp({
    ...validateProfileChangeRequest(req.body),
    appVersion: getClientAppVersion(req),
  }));
}
