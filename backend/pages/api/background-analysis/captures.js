import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateCreateCapture, validateUpdateCapture } from '../../../features/background-analysis/analysis.validators.js';
import { createPendingCapture, updateCaptureType } from '../../../features/background-analysis/analysis.service.js';

export { config };

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, PATCH, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, () => createPendingCapture(validateCreateCapture(req.body)));
  }
  // PATCH: update the ImageType of an existing pending capture.
  // Called after AI determines the image is weight/education/smartwatch so the
  // row routes to the correct dashboard tab and never shows in nutrition list.
  if (req.method === 'PATCH') {
    return runService(res, () => updateCaptureType(validateUpdateCapture(req.body)));
  }
  return methodNotAllowed(res);
}
