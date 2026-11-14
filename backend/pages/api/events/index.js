import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  validateCreateEvent,
  validateDeleteEvent,
  validateListEvents,
  validateUpdateEvent,
} from '../../../features/events/events.validators.js';
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from '../../../features/events/events.service.js';
function flagOff() {
  return {
    httpStatus: 404,
    body: { success: false, message: 'Create Event is not enabled.' },
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, PATCH, DELETE, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');

  if (!isEnabled('ff.create-event')) {
    return runService(res, async () => flagOff());
  }

  if (req.method === 'GET') return runService(res, () => listEvents(validateListEvents(req.query)));
  if (req.method === 'POST') {
    return runService(res, () => createEvent(validateCreateEvent(req.body)));
  }
  if (req.method === 'PATCH') {
    return runService(res, () => updateEvent(validateUpdateEvent(req.body)));
  }
  if (req.method === 'DELETE') {
    return runService(res, () => deleteEvent(validateDeleteEvent(req.body)));
  }
  return methodNotAllowed(res);
}
