import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateDiaryList } from '../../../features/background-analysis/analysis.validators.js';
import { listDiaryEntries } from '../../../features/background-analysis/diary.service.js';

/**
 * GET /api/diary/list?ownerUserId=&viewerUserId=&date=YYYY-MM-DD
 *
 * PR-B / ADR-0003 — Diary feed read-model.
 *
 * Returns the joined { food, weight, education, watch [, unknown] }
 * entries for one owner + one IST calendar day, sorted newest-first.
 * `unknown` rows are gated on the `ff.diary-feed` server-side flag.
 *
 * Auth posture matches `retryPromotionToFood` (PR-A.2): owner OR a user
 * in the owner's upline coach chain. See `diary.service.js` for the
 * complete contract and the §8 audit-log behaviour.
 *
 * Thin proxy (claude.md §2.1 / §15.2): no logic here.
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return runService(res, () =>
    listDiaryEntries(validateDiaryList(req.query)),
  );
}
