import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSendOtp } from '../../../features/auth/auth.validators.js';
import { sendOtp } from '../../../features/auth/auth.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[send-otp] incoming request', {
    route: '/api/auth/send-otp',
    contactType: req.body?.contactType || 'unknown',
  });

  return runService(res, () => sendOtp(validateSendOtp(req.body)));
}
