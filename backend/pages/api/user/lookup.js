import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateLookupInput } from '../../../features/user/user.validators.js';
import { lookupUser } from '../../../features/user/user.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => lookupUser(validateLookupInput(req)));
}
