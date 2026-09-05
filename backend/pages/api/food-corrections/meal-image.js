import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { validateMealImageInput } from '../../../features/food-corrections/food-corrections.validators.js';
import { getMealImage } from '../../../features/food-corrections/food-corrections.service.js';

/**
 * GET /api/food-corrections/meal-image?userId=&id=
 * Default: raw image/jpeg for <img src> (browser-cacheable).
 * ?format=json → { success, image } (weight/image-compatible).
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const input = validateMealImageInput(req.query);
    const result = await getMealImage(input);

    if (result.httpStatus !== 200) {
      return res.status(result.httpStatus).json(result.body);
    }

    if (String(req.query.format || '').toLowerCase() === 'json') {
      const jsonBody = { ...(result.body || {}) };
      delete jsonBody.r2Url;
      return res.status(200).json(jsonBody);
    }

    if (result.body?.r2Url) {
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.redirect(302, result.body.r2Url);
    }

    const image = result.body?.image;
    const imagePath = result.body?.imagePath;
    if ((!image || String(image).trim() === '') && imagePath) {
      return res.redirect(302, imagePath);
    }
    if (!image || String(image).trim() === '') {
      return res.status(404).json({ success: false, message: 'No image' });
    }

    let raw = String(image).trim();
    if (raw.startsWith('data:')) {
      const comma = raw.indexOf(',');
      raw = comma >= 0 ? raw.slice(comma + 1) : raw;
    }
    const buf = Buffer.from(raw, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }
    console.error('[meal-image]', err);
    return res.status(500).json({ success: false, message: 'Failed to load meal image' });
  }
}
