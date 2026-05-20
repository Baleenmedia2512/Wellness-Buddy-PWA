import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateCreateCapture } from '../../../features/background-analysis/analysis.validators.js';
import { createPendingCapture } from '../../../features/background-analysis/analysis.service.js';

export { config };

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, () => createPendingCapture(validateCreateCapture(req.body)));
  }
  return methodNotAllowed(res);
}
