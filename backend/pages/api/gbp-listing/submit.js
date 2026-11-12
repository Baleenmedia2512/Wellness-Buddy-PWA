import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { submitRequest } from '../../../features/gbp-listing/api/request.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.gbp-listing')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  return runService(res, async () => submitRequest({
    userId: body.userId,
    requestId: body.requestId,
  }));
}
