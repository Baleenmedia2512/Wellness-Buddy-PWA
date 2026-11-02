import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import {
  listAdminTimeWindows,
  updateAdminTimeWindow,
} from '../../../features/activity/time-windows.service.js';

/**
 * API: Admin Time Windows Management
 * GET: Fetch current active time windows (admin/developer)
 * POST: Update time window with versioning (admin/developer)
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  try {
    if (req.method === 'GET') {
      const result = await listAdminTimeWindows({
        requesterUserId: req.query?.requesterUserId ?? req.query?.userId,
        requesterEmail: req.query?.requesterEmail,
      });
      if (result.headers) {
        Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
      }
      return res.status(result.httpStatus).json(result.body);
    }

    if (req.method === 'POST') {
      const result = await updateAdminTimeWindow({
        requesterUserId: req.body?.requesterUserId ?? req.body?.userId,
        requesterEmail: req.body?.requesterEmail,
        activityType: req.body?.activityType,
        windowStartTime: req.body?.windowStartTime,
        windowEndTime: req.body?.windowEndTime,
        effectiveFromDate: req.body?.effectiveFromDate,
        changeReason: req.body?.changeReason,
      });
      return res.status(result.httpStatus).json(result.body);
    }

    return methodNotAllowed(res);
  } catch (err) {
    if (err?.status) {
      const body = { success: false, error: err.message, message: err.message };
      if (err.details) body.details = err.details;
      return res.status(err.status).json(body);
    }
    console.error('[admin/time-windows] Unhandled error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err?.message || 'Internal server error',
    });
  }
}
