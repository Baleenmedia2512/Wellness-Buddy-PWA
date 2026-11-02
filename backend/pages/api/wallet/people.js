import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { searchWalletPeople } from '../../../features/wallet/api/search-people.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => searchWalletPeople({
    userId: req.query?.userId,
    q: req.query?.q,
  }));
}
