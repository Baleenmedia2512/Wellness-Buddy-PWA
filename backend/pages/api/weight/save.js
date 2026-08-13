import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveInput } from '../../../features/weight/weight.validators.js';
import { saveWeight } from '../../../features/weight/weight.service.js';
import logger from '../../../shared/lib/logger.js';

// Must be a literal export — Next.js cannot statically parse re-exported config.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const input = validateSaveInput(req.body);
    const result = await saveWeight(input);

    return result;
  });
}
