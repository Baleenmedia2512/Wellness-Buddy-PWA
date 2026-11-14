import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { resendWalletOtp } from '../../../features/wallet/api/request-cash.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => resendWalletOtp(req.body || {}));
}
