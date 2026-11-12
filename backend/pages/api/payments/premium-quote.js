import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { findByUserId, getEventProfilePreferences } from '../../../features/user/user.repository.js';
import { getPremiumQuote } from '../../../features/payments/api/premium-quote.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (!isEnabled('ff.go-premium')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res);

  return runService(res, async () => {
    const userId = req.query?.userId;
    const row = await findByUserId(userId, '"UserId"');
    if (!row) {
      throw new ValidationError(404, 'Account not found');
    }
    const prefs = await getEventProfilePreferences(row.UserId);
    return getPremiumQuote({ eventLevel: prefs?.eventLevel });
  });
}
