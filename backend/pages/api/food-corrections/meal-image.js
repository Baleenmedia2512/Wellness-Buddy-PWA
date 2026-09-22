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

    if (result.body?.r2Url) {
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.redirect(302, result.body.r2Url);
    }
    return res.status(404).json({ success: false, message: 'No image' });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }
    console.error('[meal-image]', err);
    return res.status(500).json({ success: false, message: 'Failed to load meal image' });
  }
}
