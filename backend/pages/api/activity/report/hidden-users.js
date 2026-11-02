/**
 * Activity Report hidden users — list / hide / unhide.
 *
 * GET    ?userId= — list currently hidden members for the viewer
 * POST   { userId, hiddenUserId } — hide (IsHidden=true)
 * DELETE { userId, hiddenUserId } — unhide (IsHidden=false)
 *
 * Does not delete users or activity records.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { ValidationError } from '../../../../shared/lib/ValidationError.js';
import {
  hideActivityReportUser,
  listActivityReportHiddenUsers,
  unhideActivityReportUser,
} from '../../../../features/activity/activity-report-hidden.service.js';
import { invalidateActivityReportCachesForViewer } from '../../../../features/activity/activity-report.service.js';

function parseViewerUserId(source) {
  const raw = source?.userId ?? source?.viewerUserId;
  const userId = parseInt(raw, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  return userId;
}

function parseHiddenUserId(source) {
  const raw = source?.hiddenUserId ?? source?.targetUserId;
  const hiddenUserId = parseInt(raw, 10);
  if (!Number.isFinite(hiddenUserId) || hiddenUserId <= 0) {
    throw new ValidationError(400, 'hiddenUserId is required');
  }
  return hiddenUserId;
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;

  if (req.method === 'GET') {
    return runService(res, () => listActivityReportHiddenUsers({
      userId: parseViewerUserId(req.query),
    }));
  }

  if (req.method === 'POST') {
    return runService(res, async () => {
      const result = await hideActivityReportUser({
        userId: parseViewerUserId(req.body),
        hiddenUserId: parseHiddenUserId(req.body),
      });
      invalidateActivityReportCachesForViewer(result.body.viewerUserId);
      return result;
    });
  }

  if (req.method === 'DELETE') {
    return runService(res, async () => {
      const source = { ...(req.query || {}), ...(req.body || {}) };
      const result = await unhideActivityReportUser({
        userId: parseViewerUserId(source),
        hiddenUserId: parseHiddenUserId(source),
      });
      invalidateActivityReportCachesForViewer(result.body.viewerUserId);
      return result;
    });
  }

  return methodNotAllowed(res);
}
