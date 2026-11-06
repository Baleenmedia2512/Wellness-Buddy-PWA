import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getPortfolioStatus } from '../../../features/coach-portfolio/api/status.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getPortfolioStatus({ userId: req.query?.userId }));
}
