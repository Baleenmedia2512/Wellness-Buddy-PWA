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
import { assertEventsHostToolsAllowed } from '../../../features/payments/api/events-access.handler.js';

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

  // GET list stays open (shell). Mutating host tools need trial/Premium on 3.5.7+.
  if (req.method === 'GET') return runService(res, () => listEvents(validateListEvents(req.query)));
  if (req.method === 'POST') {
    return runService(res, async () => {
      const input = validateCreateEvent(req.body);
      await assertEventsHostToolsAllowed(req, input.userId);
      return createEvent(input);
    });
  }
  if (req.method === 'PATCH') {
    return runService(res, async () => {
      const input = validateUpdateEvent(req.body);
      await assertEventsHostToolsAllowed(req, input.userId);
      return updateEvent(input);
    });
  }
  if (req.method === 'DELETE') {
    return runService(res, async () => {
      const input = validateDeleteEvent(req.body);
      await assertEventsHostToolsAllowed(req, input.userId);
      return deleteEvent(input);
    });
  }
  return methodNotAllowed(res);
}
