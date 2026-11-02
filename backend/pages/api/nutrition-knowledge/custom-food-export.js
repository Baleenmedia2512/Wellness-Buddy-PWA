import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import {
  validateCustomFoodExport,
  exportCustomFoodSubmissions,
} from '../../../features/nutrition-knowledge/index.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const result = await exportCustomFoodSubmissions(validateCustomFoodExport(req.query));
    if (result.headers) {
      Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    }
    if (typeof result.body === 'string') {
      return res.status(result.httpStatus).send(result.body);
    }
    return res.status(result.httpStatus).json(result.body);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ ok: false, error: { message: err.message } });
    }
    console.error('[custom-food-export] Unhandled error:', err);
    return res.status(500).json({ ok: false, error: { message: err?.message || 'Internal server error' } });
  }
}
