import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateHistoryInput } from '../../../features/weight/weight.validators.js';
import { getHistory } from '../../../features/weight/weight.service.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'POST' && req.method !== 'GET') return methodNotAllowed(res);
  const input = req.method === 'POST' ? req.body : req.query;
  return runService(res, () => getHistory(validateHistoryInput(input)));
}
