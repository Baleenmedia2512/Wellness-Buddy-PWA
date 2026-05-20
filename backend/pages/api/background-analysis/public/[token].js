import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { validatePublicCapture } from '../../../../features/background-analysis/analysis.validators.js';
import { getPublicCapture } from '../../../../features/background-analysis/analysis.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return runService(res, () => getPublicCapture(validatePublicCapture({ token: req.query.token })));
  }
  return methodNotAllowed(res);
}
