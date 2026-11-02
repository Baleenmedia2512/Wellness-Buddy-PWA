import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import { getStatus } from '../../../features/ai-credits/ai-credits.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (!isEnabled('ff.ai-credits')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getStatus({
    userId: req.query.userId,
    appVersion: getClientAppVersion(req),
  }));
}
