/**
 * GET /api/background-analysis/captures/unknown-share
 *
 * PR-E / ADR-0003 — share-link viewer target for `unknown` captures.
 *
 * Returns the capture image plus a `canMutate` flag so the frontend
 * `UnknownShareViewer` can render the image card and gate the Retry / Edit
 * buttons. `viewerUserId` is optional: anonymous recipients get image-only
 * (`canMutate: false`); owner / upline-coach viewers get `canMutate: true`.
 *
 * Thin proxy (§2.6): validation + service delegation only.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { validateResolveUnknownShare } from '../../../../features/background-analysis/analysis.validators.js';
import { resolveUnknownShare } from '../../../../features/background-analysis/diary.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () =>
    resolveUnknownShare(
      validateResolveUnknownShare({
        token: req.query.token,
        viewerUserId: req.query.viewerUserId,
      }),
    ),
  );
}
