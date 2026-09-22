import { applyCors, methodNotAllowed } from '../../../../shared/lib/handler.js';
import { ValidationError } from '../../../../shared/lib/ValidationError.js';
import { getCaptureImageForDiary } from '../../../../features/background-analysis/diary.service.js';

/**
 * GET /api/background-analysis/captures/image?captureId=&viewerUserId=
 *
 * Lazy diary thumb for unknown/pending captures. Returns JPEG bytes
 * (or redirects to ImagePath) so list responses can omit Base64.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const { captureId, viewerUserId } = req.query || {};
    if (!captureId) throw new ValidationError(400, 'captureId is required');
    if (!viewerUserId) throw new ValidationError(400, 'viewerUserId is required');

    const result = await getCaptureImageForDiary({
      captureId: String(captureId),
      viewerUserId: String(viewerUserId),
    });

    if (result.httpStatus !== 200) {
      return res.status(result.httpStatus).json(result.body);
    }

    if (result.body?.data?.r2Url) {
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.redirect(302, result.body.data.r2Url);
    }
    return res.status(404).json({ ok: false, error: { code: 'NO_IMAGE', message: 'No image' } });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status || 400).json({ ok: false, error: { message: err.message } });
    }
    if (err.status) {
      return res.status(err.status).json({
        ok: false,
        error: { code: err.code || 'ERROR', message: err.message },
      });
    }
    console.error('[captures/image]', err);
    return res.status(500).json({ ok: false, error: { message: 'Failed to load capture image' } });
  }
}
