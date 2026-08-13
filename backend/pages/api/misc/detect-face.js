import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateDetectFace } from '../../../features/misc/misc.validators.js';
import { detectFace } from '../../../features/misc/misc.service.js';

// Must be a literal export — Next.js cannot statically parse re-exported config.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => detectFace(validateDetectFace(req.body)));
}
