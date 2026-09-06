import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { validateImageInput } from '../../../features/weight/weight.validators.js';
import { getImage } from '../../../features/weight/weight.service.js';
import { sendImageRedirect } from '../../../shared/lib/r2/sendImageRedirect.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    const result = await getImage(validateImageInput(req.query));
    if (result.httpStatus !== 200) {
      return res.status(result.httpStatus).json(result.body);
    }
    if (sendImageRedirect(res, result.body?.r2Url)) return;
    return res.status(404).json({ success: false, message: 'No image' });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to load weight image' });
  }
}
