import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateClubAttendance } from '../../../features/misc/misc.validators.js';
import { getClubAttendance } from '../../../features/misc/misc.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  return runService(res, () => getClubAttendance(validateClubAttendance(req.query)));
}
