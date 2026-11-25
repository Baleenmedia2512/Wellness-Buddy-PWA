import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  requestCentrePhoneOtp,
  verifyCentrePhoneOtp,
} from '../../../features/nutrition-centers/centre-phone.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.body?.action || 'request');
  if (action === 'verify') {
    return runService(res, () => verifyCentrePhoneOtp(req.body || {}));
  }
  return runService(res, () => requestCentrePhoneOtp(req.body || {}));
}
