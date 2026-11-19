import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { verifyWalletOtp } from '../../../features/wallet/api/verify-otp.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyWalletOtp(req.body || {}));
}
