import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { createCaptureHandler } from '../../../features/quick-share/api/create.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return createCaptureHandler(req, res);
}
