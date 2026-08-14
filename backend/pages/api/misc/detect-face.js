import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
// Inline config for Next.js 15
import { validateDetectFace } from '../../../features/misc/misc.validators.js';
import { detectFace } from '../../../features/misc/misc.service.js';

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
