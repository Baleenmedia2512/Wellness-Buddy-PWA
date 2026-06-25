/**
 * POST /api/user/push-token
 *
 * Persists a device's FCM push token into team_table.PushToken so the
 * notification scheduler can deliver FCM messages to that device.
 *
 * Called by the frontend's initializeFCM() callback whenever the Capacitor
 * PushNotifications plugin emits a 'registration' event (i.e. on first
 * install, after a token refresh, or after a permission grant).
 *
 * Request body (JSON):
 *   { userId: number|string, pushToken: string }
 *
 * Response 200:
 *   { success: true, message: 'Push token saved' }
 *
 * Security: userId comes from the authenticated session cached in
 * localStorage (Session.getDbUserId). The endpoint validates that userId
 * is a valid integer before writing. No server-side JWT exists yet; the
 * route follows the same trust model as the other /api/user/* endpoints
 * (userId from body, validated server-side before the DB write).
 */

import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { updateUserById } from '../../../features/user/user.repository.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const { userId, pushToken } = req.body ?? {};

    if (!userId) {
      throw new ValidationError(400, 'Missing required field: userId');
    }

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      throw new ValidationError(400, 'userId must be a positive integer');
    }

    if (!pushToken || typeof pushToken !== 'string' || pushToken.trim() === '') {
      throw new ValidationError(400, 'Missing or invalid required field: pushToken');
    }

    await updateUserById(parsedUserId, { PushToken: pushToken.trim() });

    logger.info('[push-token] FCM token persisted', { userId: parsedUserId });

    return {
      httpStatus: 200,
      body: { success: true, message: 'Push token saved' },
    };
  });
}
