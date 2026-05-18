import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateCreateCapture } from '../../../features/quick-share/validation/quick-share.validators.js';
import { createCapture } from '../../../features/quick-share/api/create-capture.handler.js';
import { largeBodyConfig } from '../../../utils/apiConfig.js';

export const config = largeBodyConfig;

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => createCapture(validateCreateCapture(req.body)));
}
