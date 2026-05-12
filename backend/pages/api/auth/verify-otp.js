import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateVerifyOtp } from '../../../features/auth/auth.validators.js';
import { verifyOtp } from '../../../features/auth/auth.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyOtp(validateVerifyOtp(req.body)));
}
