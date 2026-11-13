import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  getAdminRequest,
  listAdminRequests,
  patchAdminRequest,
} from '../../../features/gbp-listing/api/admin.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PATCH, POST, OPTIONS')) return;
  if (!isEnabled('ff.gbp-listing')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    const { requesterUserId, requestId, status } = req.query || {};
    if (requestId) {
      return runService(res, async () => getAdminRequest({ requesterUserId, requestId }));
    }
    return runService(res, async () => listAdminRequests({ requesterUserId, status }));
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    return runService(res, async () => patchAdminRequest({
      requesterUserId: body.requesterUserId,
      requestId: body.requestId,
      status: body.status,
      mapsUrl: body.mapsUrl,
      opsNote: body.opsNote,
    }));
  }

  return methodNotAllowed(res);
}
