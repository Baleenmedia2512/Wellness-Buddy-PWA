import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { validateDetectFace } from '../../../features/misc/misc.validators.js';
import { detectFace } from '../../../features/misc/misc.service.js';

export { config };

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => detectFace(validateDetectFace(req.body)));
}
