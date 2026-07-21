import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  validateGetScoreHistory,
} from '../../../features/wellness-score/validation/wellness-score.schema.js';
import { getScoreHistory } from '../../../features/wellness-score/api/daily-score.handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (!isEnabled('ff.wellness-score-sheet')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () => getScoreHistory(validateGetScoreHistory(req.query)));
}
