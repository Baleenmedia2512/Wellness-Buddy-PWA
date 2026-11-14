import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { validateEventTicketReport } from '../../../features/events/events.validators.js';
import { getEventTicketReport } from '../../../features/events/events.service.js';
import { assertEventsHostToolsAllowed } from '../../../features/payments/api/events-access.handler.js';

function flagOff() {
  return {
    httpStatus: 404,
    body: { success: false, message: 'Create Event is not enabled.' },
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store');

  if (!isEnabled('ff.create-event')) {
    return runService(res, async () => flagOff());
  }

  if (req.method === 'GET') {
    return runService(res, async () => {
      const input = validateEventTicketReport(req.query);
      await assertEventsHostToolsAllowed(req, input.userId);
      return getEventTicketReport(input);
    });
  }
  return methodNotAllowed(res);
}
