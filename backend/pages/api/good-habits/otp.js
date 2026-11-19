/**
 * Dedicated Task by Coach OTP routes so old servers return 404
 * instead of silently treating the body as a legacy immediate save.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  requestGoodHabitOtp,
  verifyGoodHabitOtp,
} from '../../../features/good-habits/api/otp.handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function flagOff() {
  return {
    httpStatus: 404,
    body: { ok: false, error: { code: 'FLAG_OFF', message: 'Task by Coach is not enabled' } },
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;

  if (!isEnabled('ff.good-habit')) {
    return runService(res, async () => flagOff());
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  const action = String(req.body?.action || 'request-otp').trim().toLowerCase();
  if (action === 'verify-otp') {
    return runService(res, () => verifyGoodHabitOtp({
      userId: req.body?.userId,
      otp: req.body?.otp,
      otpKey: req.body?.otpKey,
    }));
  }
  return runService(res, () => requestGoodHabitOtp(req.body));
}
