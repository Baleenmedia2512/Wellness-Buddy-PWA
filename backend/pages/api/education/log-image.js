import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateGetLogImage } from '../../../features/education/education.validators.js';
import { getLogImage } from '../../../features/education/education.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => getLogImage(validateGetLogImage(req.query)));
}
