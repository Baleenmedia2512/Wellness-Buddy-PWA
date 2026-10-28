import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { findByUserId } from '../../../features/user/user.repository.js';
import { createPremiumOrder } from '../../../features/payments/api/create-order.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.go-premium')) {
    return res.status(404).json({ success: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const userId = req.body?.userId;
    const row = await findByUserId(
      userId,
      '"UserId", "UserName", "PhoneNumber"',
    );
    if (!row) {
      throw new ValidationError(404, 'Account not found');
    }
    return createPremiumOrder({
      userId: row.UserId,
      phone: row.PhoneNumber,
      customerName: row.UserName,
      returnUrl: req.body?.returnUrl,
    });
  });
}
