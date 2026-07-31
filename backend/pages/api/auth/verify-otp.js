import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { readJsonBody } from '../../../shared/lib/readJsonBody.js';
import { validateVerifyOtp } from '../../../features/auth/auth.validators.js';
import { verifyOtp } from '../../../features/auth/auth.service.js';
import logger from '../../../shared/lib/logger.js';
import { buildConsentDeviceInfo, extractClientIp } from '../../../shared/lib/clientMeta.js';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    logger.warn('[verify-otp] invalid JSON body');
    return res.status(400).json({ success: false, message: parsed.message });
  }

  const body = {
    ...parsed.body,
    ipAddress: extractClientIp(req),
    deviceInfo: buildConsentDeviceInfo(req, parsed.body?.deviceInfo),
  };

  return runService(res, () => verifyOtp(validateVerifyOtp(body)));
}
