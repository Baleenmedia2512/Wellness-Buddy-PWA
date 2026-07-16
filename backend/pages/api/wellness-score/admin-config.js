import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  validateAdminConfigGet,
  validateAdminConfigPut,
} from '../../../features/wellness-score/validation/wellness-score.schema.js';
import {
  getAdminConfig,
  putAdminConfig,
} from '../../../features/wellness-score/api/admin-config.handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, OPTIONS')) return;
  if (!isEnabled('ff.wellness-score-sheet')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    return runService(res, () => getAdminConfig(validateAdminConfigGet(req.query)));
  }
  if (req.method === 'PUT') {
    return runService(res, () => putAdminConfig(validateAdminConfigPut(req.body)));
  }
  return methodNotAllowed(res);
}
