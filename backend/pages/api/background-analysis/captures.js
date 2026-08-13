import { methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  validateCreateCapture,
  validateUpdateCapture,
} from '../../../features/background-analysis/analysis.validators.js';
import {
  createPendingCapture,
  updateCaptureType,
} from '../../../features/background-analysis/analysis.service.js';

// Must be a literal export — Next.js cannot statically parse re-exported config.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Set CORS before OPTIONS early-return so preflight sees the full allow-list.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, cache-control, pragma',
  );
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    return runService(res, () => createPendingCapture(validateCreateCapture(req.body)));
  }

  if (req.method === 'PATCH') {
    return runService(res, () => updateCaptureType(validateUpdateCapture(req.body)));
  }

  return methodNotAllowed(res);
}
