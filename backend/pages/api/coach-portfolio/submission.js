import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  getMySubmission,
  listMyWebsites,
  saveMySubmissionDraft,
  requestPublishOtp,
  verifyPublishOtp,
} from '../../../features/coach-portfolio/api/submission.handler.js';
import {
  assertDigitalPortfolioAllowed,
  requestUsesPortfolioSiteSlots,
} from '../../../features/coach-portfolio/api/portfolio-access.guard.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, POST, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const useSiteSlots = requestUsesPortfolioSiteSlots(req);

  if (req.method === 'GET') {
    const action = String(req.query?.action || '').trim();
    if (action === 'list') {
      return runService(res, async () => {
        await assertDigitalPortfolioAllowed(req, req.query?.userId);
        return listMyWebsites({ userId: req.query?.userId, useSiteSlots });
      });
    }
    return runService(res, async () => {
      await assertDigitalPortfolioAllowed(req, req.query?.userId);
      return getMySubmission({
        userId: req.query?.userId,
        centerId: req.query?.centerId,
        submissionId: req.query?.submissionId,
        createNew: req.query?.createNew,
        useSiteSlots,
      });
    });
  }
  if (req.method === 'PUT') {
    return runService(res, async () => {
      await assertDigitalPortfolioAllowed(req, req.body?.userId);
      return saveMySubmissionDraft({
        userId: req.body?.userId,
        centerId: req.body?.centerId,
        form: req.body?.form,
        createNew: req.body?.createNew === true,
        submissionId: req.body?.submissionId ?? null,
        useSiteSlots,
      });
    });
  }
  if (req.method === 'POST') {
    const action = String(req.body?.action || 'request-publish-otp').trim();
    if (action === 'verify-publish-otp') {
      return runService(res, async () => {
        await assertDigitalPortfolioAllowed(req, req.body?.userId);
        return verifyPublishOtp({
          userId: req.body?.userId,
          centerId: req.body?.centerId,
          otp: req.body?.otp,
          otpKey: req.body?.otpKey,
          useSiteSlots,
        });
      });
    }
    return runService(res, async () => {
      await assertDigitalPortfolioAllowed(req, req.body?.userId);
      return requestPublishOtp({
        userId: req.body?.userId,
        centerId: req.body?.centerId,
        form: req.body?.form,
        createNew: req.body?.createNew === true,
        submissionId: req.body?.submissionId ?? null,
        useSiteSlots,
      });
    });
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
