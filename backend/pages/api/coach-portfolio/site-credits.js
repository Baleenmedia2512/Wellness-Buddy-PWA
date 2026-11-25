import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getPortfolioSiteCredits } from '../../../features/coach-portfolio/api/site-order.handler.js';
import { PORTFOLIO_FLAG } from '../../../features/coach-portfolio/domain/access.rules.js';
import { assertDigitalPortfolioAllowed } from '../../../features/coach-portfolio/api/portfolio-access.guard.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (!isEnabled(PORTFOLIO_FLAG)) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res);

  return runService(res, async () => {
    await assertDigitalPortfolioAllowed(req, req.query?.userId);
    return getPortfolioSiteCredits({ userId: req.query?.userId });
  });
}
