import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGoogleUser } from '../../../features/user/user.validators.js';
import { saveGoogleUser } from '../../../features/user/user.service.js';
import { buildConsentDeviceInfo, extractClientIp } from '../../../shared/lib/clientMeta.js';
import { rejectIfAppVersionTooOld } from '../../../features/app-version/api/enforce-api.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (rejectIfAppVersionTooOld(req, res)) return;

  const body = {
    ...(req.body || {}),
    ipAddress: extractClientIp(req),
    deviceInfo: buildConsentDeviceInfo(req, req.body?.deviceInfo),
  };

  return runService(res, () => saveGoogleUser(validateGoogleUser(body)));
}
