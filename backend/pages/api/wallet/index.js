import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getWallet } from '../../../features/wallet/api/get-wallet.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getWallet({ userId: req.query?.userId }));
}
