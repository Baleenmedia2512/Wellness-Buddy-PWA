import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { validateListOpenEvents } from '../../../features/events/events.validators.js';
import { listOpenEvents } from '../../../features/events/events.service.js';

function flagOff() {
  return {
    httpStatus: 404,
    body: { success: false, message: 'Create Event is not enabled.' },
  };
}

/** Additive list of registrable events. Does not change owner GET /api/events. */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');

  if (!isEnabled('ff.create-event')) {
    return runService(res, async () => flagOff());
  }

  if (req.method === 'GET') {
    validateListOpenEvents(req.query);
    return runService(res, () => listOpenEvents());
  }
  return methodNotAllowed(res);
}
