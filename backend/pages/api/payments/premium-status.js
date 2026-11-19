import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getPremiumStatus } from '../../../features/payments/api/confirm-order.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return methodNotAllowed(res);

  return runService(res, () => getPremiumStatus({ userId: req.query?.userId }));
}
