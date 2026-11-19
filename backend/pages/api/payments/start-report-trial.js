import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { startReportTrial } from '../../../features/payments/api/report-access.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.report-trial')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => startReportTrial({ userId: req.body?.userId }));
}
