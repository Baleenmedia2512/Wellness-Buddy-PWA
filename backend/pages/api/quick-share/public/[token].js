import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { validatePublicToken } from '../../../../features/quick-share/validation/quick-share.validators.js';
import { getPublic } from '../../../../features/quick-share/api/get-public.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getPublic(validatePublicToken(req.query)));
}
