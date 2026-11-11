import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  getMySubmission,
  saveMySubmissionDraft,
  submitMySubmission,
} from '../../../features/coach-portfolio/api/submission.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, PUT, POST, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    return runService(res, () => getMySubmission({ userId: req.query?.userId }));
  }
  if (req.method === 'PUT') {
    return runService(res, () => saveMySubmissionDraft({
      userId: req.body?.userId,
      form: req.body?.form,
    }));
  }
  if (req.method === 'POST') {
    return runService(res, () => submitMySubmission({
      userId: req.body?.userId,
      form: req.body?.form,
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
