import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { saveDraft } from '../../../features/gbp-listing/api/request.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.gbp-listing')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const { userId, centerId, fields, ...rest } = body;
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const siteBaseUrl = host ? `${proto}://${host}`.replace(/\/$/, '') : '';

  return runService(res, async () => saveDraft({
    userId,
    centerId,
    fields: fields && typeof fields === 'object' ? fields : rest,
    siteBaseUrl,
  }));
}
