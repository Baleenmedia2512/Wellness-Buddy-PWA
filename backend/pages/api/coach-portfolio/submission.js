import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  getMySubmission,
  listMyWebsites,
  saveMySubmissionDraft,
  requestPublishOtp,
  verifyPublishOtp,
} from '../../../features/coach-portfolio/api/submission.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, POST, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    const action = String(req.query?.action || '').trim();
    if (action === 'list') {
      return runService(res, () => listMyWebsites({ userId: req.query?.userId }));
    }
    return runService(res, () => getMySubmission({
      userId: req.query?.userId,
      centerId: req.query?.centerId,
      createNew: req.query?.createNew,
    }));
  }
  if (req.method === 'PUT') {
    return runService(res, () => saveMySubmissionDraft({
      userId: req.body?.userId,
      centerId: req.body?.centerId,
      form: req.body?.form,
      createNew: req.body?.createNew === true,
    }));
  }
  if (req.method === 'POST') {
    const action = String(req.body?.action || 'request-publish-otp').trim();
    if (action === 'verify-publish-otp') {
      return runService(res, () => verifyPublishOtp({
        userId: req.body?.userId,
        centerId: req.body?.centerId,
        otp: req.body?.otp,
        otpKey: req.body?.otpKey,
      }));
    }
    return runService(res, () => requestPublishOtp({
      userId: req.body?.userId,
      centerId: req.body?.centerId,
      form: req.body?.form,
      createNew: req.body?.createNew === true,
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
