import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { readJsonBody } from '../../../shared/lib/readJsonBody.js';
import { validateSendOtp } from '../../../features/auth/auth.validators.js';
import { sendOtp } from '../../../features/auth/auth.service.js';
import logger from '../../../shared/lib/logger.js';
import { rejectIfAppVersionTooOld } from '../../../features/app-version/api/enforce-api.handler.js';

// Parse JSON ourselves so malformed/empty bodies return JSON the client can read
// instead of Next.js's opaque `Error: Invalid JSON` before the handler runs.
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (rejectIfAppVersionTooOld(req, res)) return;

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    logger.warn('[send-otp] invalid JSON body');
    return res.status(400).json({ success: false, message: parsed.message });
  }

  // Re-check after body parse so appVersion in JSON body is visible.
  req.body = parsed.body;
  if (rejectIfAppVersionTooOld(req, res)) return;

  logger.info('[send-otp] incoming request', {
    route: '/api/auth/send-otp',
    contactType: parsed.body?.contactType || 'unknown',
  });

  return runService(res, () => sendOtp(validateSendOtp(parsed.body)));
}
