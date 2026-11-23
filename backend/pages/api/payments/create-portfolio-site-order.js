import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { findByUserId } from '../../../features/user/user.repository.js';
import { createPortfolioSiteOrder } from '../../../features/coach-portfolio/api/site-order.handler.js';
import { PORTFOLIO_FLAG } from '../../../features/coach-portfolio/domain/access.rules.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled(PORTFOLIO_FLAG) || !isEnabled('ff.portfolio-site-checkout')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const userId = req.body?.userId;
    const row = await findByUserId(
      userId,
      '"UserId", "UserName", "PhoneNumber"',
    );
    if (!row) {
      throw new ValidationError(404, 'Account not found');
    }
    return createPortfolioSiteOrder({
      userId: row.UserId,
      phone: row.PhoneNumber,
      customerName: row.UserName,
      returnUrl: req.body?.returnUrl,
      kind: req.body?.kind,
      submissionId: req.body?.submissionId,
      centerId: req.body?.centerId,
    });
  });
}
