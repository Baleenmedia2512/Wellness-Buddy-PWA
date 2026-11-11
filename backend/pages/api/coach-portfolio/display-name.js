import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { checkDisplayNameAvailability } from '../../../features/coach-portfolio/api/submission.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    return runService(res, () => checkDisplayNameAvailability({
      userId: req.query?.userId,
      centerId: req.query?.centerId,
      name: req.query?.name,
    }));
  }
  return methodNotAllowed(res);
}
