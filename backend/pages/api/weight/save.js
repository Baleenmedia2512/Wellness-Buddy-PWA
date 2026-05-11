import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveInput } from '../../../features/weight/weight.validators.js';
import { saveWeight } from '../../../features/weight/weight.service.js';

export { config };

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => saveWeight(validateSaveInput(req.body)));
}
