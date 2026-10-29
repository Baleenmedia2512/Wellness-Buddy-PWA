import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { confirmPremiumOrder } from '../../../features/payments/api/confirm-order.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, () => confirmPremiumOrder({
    userId: req.body?.userId,
    orderId: req.body?.orderId,
  }));
}
