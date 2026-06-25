import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { validateResolveCapture } from '../../../../features/background-analysis/analysis.validators.js';
import { resolvePublicCapture } from '../../../../features/background-analysis/diary.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return runService(res, () =>
      resolvePublicCapture(
        validateResolveCapture({
          token: req.query.token,
          viewerUserId: req.query.viewerUserId,
        }),
      ),
    );
  }
  return methodNotAllowed(res);
}
