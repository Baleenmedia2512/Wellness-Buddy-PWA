import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateImageInput } from '../../../features/weight/weight.validators.js';
import { getImage } from '../../../features/weight/weight.service.js';

export default async function handler(req, res) {
  // Allow long browser caching since image bytes for a record never change
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getImage(validateImageInput(req.query)));
}
