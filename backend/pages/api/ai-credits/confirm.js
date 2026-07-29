import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { confirmCredit } from '../../../features/ai-credits/ai-credits.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.ai-credits')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => confirmCredit({
    userId: req.body?.userId,
    reservationId: req.body?.reservationId,
    analysisResult: req.body?.analysisResult ?? null,
  }));
}
