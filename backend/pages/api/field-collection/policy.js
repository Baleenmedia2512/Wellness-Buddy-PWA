import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getAdminPolicy, putAdminPolicy } from '../../../features/field-collection/field-collection.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, OPTIONS')) return;
  if (!isEnabled('ff.field-collection')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    return runService(res, () => getAdminPolicy({
      requesterUserId: req.query?.requesterUserId,
      requesterEmail: req.query?.requesterEmail,
    }));
  }
  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!Array.isArray(body.fields)) {
      return runService(res, async () => {
        throw new ValidationError(400, 'fields array is required');
      });
    }
    return runService(res, () => putAdminPolicy({
      requesterUserId: body.requesterUserId,
      requesterEmail: body.requesterEmail,
      fields: body.fields,
    }));
  }
  return methodNotAllowed(res);
}
