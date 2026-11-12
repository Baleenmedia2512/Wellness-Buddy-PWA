import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  validateCreateEventRegistration,
  validateGetMyRegistration,
  validateListMyRegistrations,
} from '../../../features/events/events.validators.js';
import {
  createEventRegistration,
  getMyEventRegistration,
  listMyEventRegistrations,
} from '../../../features/events/events.service.js';
import { listActivePositionCodes } from '../../../features/user/communityPosition.service.js';

function flagOff() {
  return {
    httpStatus: 404,
    body: { success: false, message: 'Create Event is not enabled.' },
  };
}

/**
 * POST — create registration
 *   confirmPayment absent → legacy save-only (no wallet debit)
 *   confirmPayment true → wallet debit + entry code + QR payload
 * GET — My Booking list (?userId=) or one booking (?userId=&id=)
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');

  if (!isEnabled('ff.create-event')) {
    return runService(res, async () => flagOff());
  }

  if (req.method === 'POST') {
    return runService(res, async () => {
      const levelOptions = await listActivePositionCodes();
      return createEventRegistration(validateCreateEventRegistration(req.body, levelOptions));
    });
  }
  if (req.method === 'GET') {
    if (req.query?.id != null && String(req.query.id).trim() !== '') {
      return runService(res, () => getMyEventRegistration(validateGetMyRegistration(req.query)));
    }
    return runService(res, () => listMyEventRegistrations(validateListMyRegistrations(req.query)));
  }
  return methodNotAllowed(res);
}
