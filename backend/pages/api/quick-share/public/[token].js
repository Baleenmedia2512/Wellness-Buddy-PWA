import { applyCors, methodNotAllowed } from '../../../../shared/lib/handler.js';
import { getPublicCaptureHandler } from '../../../../features/quick-share/api/get-public.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return getPublicCaptureHandler(req, res);
}
