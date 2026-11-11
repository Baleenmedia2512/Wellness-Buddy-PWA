/**
 * GET /api/user/community-positions
 * Active community roles for the Profile dropdown.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../features/app-version/api/enforce-api.handler.js';
import { listCommunityPositions } from '../../../features/user/communityPosition.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => listCommunityPositions());
}
