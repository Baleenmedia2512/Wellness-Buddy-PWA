import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { startEventsTrial } from '../../../features/payments/api/events-access.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.events-trial')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => startEventsTrial({ userId: req.body?.userId }));
}
