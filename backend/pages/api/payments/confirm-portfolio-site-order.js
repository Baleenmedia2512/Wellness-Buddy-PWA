import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { confirmPortfolioSiteOrder } from '../../../features/coach-portfolio/api/site-order.handler.js';
import { PORTFOLIO_FLAG } from '../../../features/coach-portfolio/domain/access.rules.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled(PORTFOLIO_FLAG) || !isEnabled('ff.portfolio-site-checkout')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => confirmPortfolioSiteOrder({
    userId: req.body?.userId,
    orderId: req.body?.orderId,
  }));
}
