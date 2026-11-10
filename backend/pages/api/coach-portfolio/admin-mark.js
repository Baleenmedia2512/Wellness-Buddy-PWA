import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { adminMarkPortfolioAccess } from '../../../features/coach-portfolio/api/admin-mark.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => adminMarkPortfolioAccess({
    requesterUserId: req.body?.requesterUserId,
    targetUserId: req.body?.targetUserId,
    paid: req.body?.paid,
  }));
}
