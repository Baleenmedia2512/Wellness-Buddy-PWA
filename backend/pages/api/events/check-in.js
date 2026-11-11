import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { validateEventCheckIn } from '../../../features/events/events.validators.js';
import { checkInEventRegistration } from '../../../features/events/events.service.js';

function flagOff() {
  return {
    httpStatus: 404,
    body: { success: false, message: 'Create Event is not enabled.' },
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');

  if (!isEnabled('ff.create-event')) {
    return runService(res, async () => flagOff());
  }

  if (req.method === 'POST') {
    return runService(res, () => checkInEventRegistration(validateEventCheckIn(req.body)));
  }
  return methodNotAllowed(res);
}
