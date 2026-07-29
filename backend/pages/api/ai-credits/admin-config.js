import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  getAdminConfig,
  putAdminConfig,
} from '../../../features/ai-credits/ai-credits.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, OPTIONS')) return;
  if (!isEnabled('ff.ai-credits')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    return runService(res, () => getAdminConfig({
      requesterUserId: req.query.requesterUserId,
      requesterEmail: req.query.requesterEmail,
    }));
  }
  if (req.method === 'PUT') {
    return runService(res, () => putAdminConfig({
      requesterUserId: req.body?.requesterUserId,
      requesterEmail: req.body?.requesterEmail,
      dailyAiCredits: req.body?.dailyAiCredits,
      aiModeEnabled: req.body?.aiModeEnabled,
    }));
  }
  return methodNotAllowed(res);
}
