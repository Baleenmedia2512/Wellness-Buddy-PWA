import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  getVersionPolicy,
  validateVersionPolicyQuery,
} from '../../../features/app-version/index.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => getVersionPolicy(validateVersionPolicyQuery(req.query || {})));
}
