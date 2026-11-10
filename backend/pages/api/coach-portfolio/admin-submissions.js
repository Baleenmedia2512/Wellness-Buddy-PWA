import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  getAdminSubmission,
  listAdminSubmissions,
  publishAdminSubmission,
  updateAdminSubmissionStatus,
} from '../../../features/coach-portfolio/api/admin-submissions.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, POST, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    if (req.query?.targetUserId) {
      return runService(res, () => getAdminSubmission({
        requesterUserId: req.query?.requesterUserId,
        targetUserId: req.query?.targetUserId,
      }));
    }
    return runService(res, () => listAdminSubmissions({
      requesterUserId: req.query?.requesterUserId,
      status: req.query?.status || null,
    }));
  }

  if (req.method === 'PUT') {
    return runService(res, () => updateAdminSubmissionStatus({
      requesterUserId: req.body?.requesterUserId,
      targetUserId: req.body?.targetUserId,
      status: req.body?.status,
      adminNote: req.body?.adminNote,
    }));
  }

  if (req.method === 'POST') {
    return runService(res, () => publishAdminSubmission({
      requesterUserId: req.body?.requesterUserId,
      targetUserId: req.body?.targetUserId,
    }));
  }

  return methodNotAllowed(res);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};
