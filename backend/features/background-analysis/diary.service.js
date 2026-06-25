/**
 * backend/features/background-analysis/diary.service.js
 *
 * "Diary" view orchestrators. Composes:
 *   - captures slice (read + state-machine writes)
 *   - food/weight/education repositories (read)
 *   - retry permission policy
 *   - structured logger (audit trail)
 *
 * Two responsibilities live here:
 *
 *   1. **resolvePublicCapture** — share-link deep-link target lookup.
 *      Extracted from `analysis.service.js` in PR-B (ADR-0003) to keep
 *      `analysis.service.js` under the §2.3 file-size budget.
 *
 *   2. **retryPromotionToFood** — the Diary "Other → Retry / Edit"
 *      action introduced in PR-A.2. Same reason for the extraction.
 *
 * PR-B (the feature commit that follows this refactor) adds a third:
 *   3. **listDiaryEntries** — the joined feed read-model.
 *
 * NOTE: this is a pure refactor in its first commit — every function moved
 * here is byte-identical to what was in `analysis.service.js` immediately
 * before the move, modulo the explicit `from './analysis.service.js'`
 * import for `save()` (the only intra-feature back-reference).
 *
 * Module boundary (claude.md §2.2): this file is part of the same
 * background-analysis feature, so importing from `./analysis.service.js`
 * and `./analysis.repository.js` is permitted.
 */

import * as repo from './analysis.repository.js';
import * as diaryRepo from './diary.repository.js';
import { save } from './analysis.service.js';
import * as captures from '../captures/captures.service.js';
import { IMAGE_TYPE_UNKNOWN } from '../captures/domain/image-types.js';
import {
  assertCanRetryCapture,
  canRetryCapture,
} from '../captures/domain/permissions/retry.policy.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import logger from '../../shared/lib/logger.js';

// ─── resolvePublicCapture (deep-link target lookup) ─────────────────────────

/**
 * Look up the OWNER + meal date for a shared token. Used by the in-app
 * deep-link handler: the app opens Dashboard for that user/date and
 * automatically expands the specific meal card. Enforces permission — viewer
 * must be the owner OR appear in the owner's upline coach chain.
 *
 * Returns:
 *   { ok: true,  data: { mealId, ownerUserId, ownerUserName, mealDate, isSelf, imageType } }
 *   { ok: false, error: { code: 'NOT_FOUND' | 'EXPIRED' | 'FORBIDDEN', message } }
 */
export async function resolvePublicCapture({ token, viewerUserId }) {
  const row = await repo.findOwnerByToken(token);
  if (!row) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } } };
  }
  if (row.ShareExpiresAt && new Date(row.ShareExpiresAt) < new Date()) {
    return { httpStatus: 410, body: { ok: false, error: { code: 'EXPIRED', message: 'This share link has expired' } } };
  }
  const mealId = row.ID ? row.ID.toString() : null;
  const ownerUserId = row.UserID ? row.UserID.toString() : null;
  if (!ownerUserId) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link has no owner' } } };
  }

  const viewer = viewerUserId.toString();
  const isSelf = viewer === ownerUserId;
  if (!isSelf) {
    // Permission: viewer must appear in the owner's upline coach chain.
    // Co-coach partners are NOT granted access — they are peers of the owner's
    // coach and have no supervisory relationship with the owner.
    const chain = await repo.getCoachChain(ownerUserId);
    if (!chain.includes(viewer)) {
      return { httpStatus: 403, body: { ok: false, error: { code: 'FORBIDDEN', message: "You don't have access to this meal" } } };
    }
  }

  const ownerUserName = isSelf ? null : await repo.findUserName(ownerUserId);
  // Slice the IST-stored CreatedAt to YYYY-MM-DD so the Dashboard opens the
  // correct local date. Using toISOString() would shift a late-evening IST
  // timestamp to the next UTC day, showing the wrong nutrition entries.
  const mealDate = row.CreatedAt ? row.CreatedAt.toString().slice(0, 10) : null;

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        mealId,
        ownerUserId,
        ownerUserName,
        mealDate,
        isSelf,
        // imageType drives in-app deep-link tab routing.
        // Falls back to 'food' for legacy rows that pre-date this column.
        imageType: row.ImageType || 'food',
      },
    },
  };
}

// ─── retryPromotionToFood ────────────────────────────────────────────────────
// PR-A.2 / ADR-0003 — Diary "Other → Retry / Edit" promotion endpoint.
//
// Called when the user (or a coach in the user's upline) supplies a new
// Gemini analysis (Retry path) or a manual nutrition edit (Edit path) for
// a capture currently tagged `unknown`. Promotes the capture
// `unknown → food` and upserts the corresponding `food_nutrition_data_table`
// row by delegating to the existing `save()` orchestrator.
//
// Auth posture:
//   1. The capture is read WITHOUT owner guard (captures.findById).
//   2. The OWNER is taken from the row and a coach chain is fetched.
//   3. assertCanRetryCapture decides; throws 401 / 403 on denial.
//   4. State-machine guard inside save() → captures.updateTypeById
//      → assertCanTransition('unknown', 'food') enforces immutability for
//      every other path.
//
// Returns:
//   { httpStatus: 200, body: { ok: true, data: { ... } } } — passes through save() envelope
//   { httpStatus: 404, body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND' } } }
//   { httpStatus: 409, body: { ok: false, error: { code: 'NOT_RETRYABLE', currentType } } }
//   throws 401 / 403 (caught by runService) on permission denial.
export async function retryPromotionToFood(input) {
  const { captureId, viewerUserId, analysisResult, imagePath } = input;

  // 1. Load the capture. NO owner guard — the policy decides.
  const capture = await captures.findById(captureId);
  if (!capture) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND', message: 'Capture not found' } },
    };
  }

  const ownerUserId = capture.UserID ? capture.UserID.toString() : null;
  if (!ownerUserId) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND', message: 'Capture has no owner' } },
    };
  }

  // 2. Only `unknown` captures may be retried via this endpoint.
  if (capture.ImageType !== IMAGE_TYPE_UNKNOWN) {
    return {
      httpStatus: 409,
      body: {
        ok: false,
        error: {
          code: 'NOT_RETRYABLE',
          message: `Only 'unknown' captures may be retried. Current type: '${capture.ImageType}'.`,
          currentType: capture.ImageType,
        },
      },
    };
  }

  // 3. Fetch the owner's upline coach chain and run the permission policy.
  const coachChain = await repo.getCoachChain(ownerUserId);

  let decision;
  try {
    decision = assertCanRetryCapture({
      viewerId: viewerUserId,
      ownerId: ownerUserId,
      coachChain,
    });
  } catch (err) {
    logger.warn('retryPromotionToFood: permission denied', {
      captureId, viewerUserId, ownerUserId, reason: err.reason, code: err.code,
    });
    throw err;
  }

  // 4. Audit-log every coach-on-member promotion (ADR-0003 F5).
  if (decision.actorRole === 'COACH') {
    logger.info('retryPromotionToFood: coach action on member capture', {
      actorId: viewerUserId,
      ownerId: ownerUserId,
      captureId,
      action: 'retry-promotion-to-food',
    });
  }

  // 5. Delegate to save() — owner's userId, not the viewer's.
  return save({
    userId: ownerUserId,
    imagePath: imagePath || capture.ImagePath || 'retry-promotion',
    analysisResult,
    deviceInfo: 'Wellness Valley Diary Retry',
    ImageBase64: capture.ImageBase64 || null,
    captureId,
  });
}

// ─── listDiaryEntries ───────────────────────────────────────────────────────
//
// PR-B / ADR-0003 — the Diary feed read-model.
//
// Joins food + weight + education + watch (+ optionally `unknown`
// captures when `ff.diary-feed` is ON) for a single owner + IST day,
// normalises each row to the same envelope shape, and sorts by
// `capturedAt` DESC (newest at the top, matching every per-vertical
// dashboard convention).
//
// Auth posture
//   - Owner viewing self    → always allowed.
//   - Coach viewing member  → allowed iff in the owner's upline chain.
//                             Re-uses `canRetryCapture` for the predicate
//                             so the "may I view this user's diary"
//                             question stays bit-for-bit identical to
//                             the "may I Retry this user's capture"
//                             question. ADR-0003 §"Pinned product answers"
//                             explicitly aligns the two.
//   - Anyone else           → 403.
//   - No auth                → 401.
//
// Feature flag `ff.diary-feed`
//   - OFF (default): inclusion of `unknown` rows is suppressed. The
//     response shape is unchanged; the `entries` array simply has zero
//     `kind: 'unknown'` rows. This lets PR-B ship before PR-C/D and lets
//     the client opt in per build.
//   - ON: `unknown` captures for the day are included. PR-3's "don't
//     pollute the food feed" intent is preserved because the rows arrive
//     as `kind: 'unknown'`, never `kind: 'food'`.
//
// Output
//   {
//     httpStatus: 200,
//     body: {
//       ok: true,
//       data: {
//         date, ownerUserId, isSelf, includesUnknown,
//         entries: [
//           {
//             kind: 'food' | 'weight' | 'education' | 'watch' | 'unknown',
//             capturedAt: ISO string,
//             capture: { id, type, ... } | null,
//             payload: { … kind-specific projection … },
//           },
//           ...
//         ],
//       },
//     },
//   }
//
//   { httpStatus: 401 }  — no viewer
//   { httpStatus: 403 }  — viewer not in owner's chain
//   { httpStatus: 400 }  — validation error (handled by validator before us)
//
// Defensive notes
//   - Each per-table read is independent — one failure does NOT take
//     down the whole feed. Failures are caught, warn-logged with the
//     `kind`, and substituted with an empty array so the rest of the
//     diary still renders. This mirrors the "fail loudly to the error
//     sink, but don't cascade" rule for background jobs (§2.8).
//   - Watch rows whose `Topic` does not match the
//     `Calories Burned: <n> kcal` pattern parse to `kcal=0` instead of
//     throwing; this matches the existing
//     `activity.service.getWatchBurnedCalories` parser.
export async function listDiaryEntries(input) {
  const { ownerUserId, viewerUserId, date } = input;

  // 1. Permission. The diary aggregates four verticals' data, so the gate
  // must cover all of them — same gate `canRetryCapture` uses for the
  // single-capture mutation path (ADR-0003 §"Pinned product answers").
  const coachChain = await repo.getCoachChain(ownerUserId);
  const decision = canRetryCapture({
    viewerId: viewerUserId,
    ownerId:  ownerUserId,
    coachChain,
  });
  if (!decision.allowed) {
    if (decision.reason === 'NO_VIEWER') {
      const err = new Error('Authentication required');
      err.status = 401; err.code = 'UNAUTHENTICATED';
      throw err;
    }
    const err = new Error('You do not have access to this diary');
    err.status = 403; err.code = 'FORBIDDEN_DIARY';
    err.reason = decision.reason;
    throw err;
  }
  const isSelf = decision.actorRole === 'OWNER';

  // 2. Audit-log coach-on-member reads, same posture as
  // `retryPromotionToFood` (F5). Reads are higher-volume than writes,
  // so info-level is correct — `logger` is expected to ship to the
  // structured sink with throttling configured per environment.
  if (!isSelf) {
    logger.info('listDiaryEntries: coach reading member diary', {
      actorId: viewerUserId,
      ownerId: ownerUserId,
      date,
    });
  }

  // 3. Resolve the flag once per request — never per row.
  const includesUnknown = isEnabled('ff.diary-feed');

  // 4. Fan out the per-vertical reads in parallel. Each call is wrapped
  // so a partial failure degrades gracefully instead of failing the
  // whole feed.
  const safe = async (kind, fn) => {
    try { return { kind, rows: await fn() }; }
    catch (err) {
      logger.warn('listDiaryEntries: per-vertical read failed', {
        kind, ownerUserId, date, err: err.message,
      });
      return { kind, rows: [] };
    }
  };
  const reads = [
    safe('food',      () => diaryRepo.fetchFoodForDay(ownerUserId, date)),
    safe('weight',    () => diaryRepo.fetchWeightForDay(ownerUserId, date)),
    safe('education', () => diaryRepo.fetchEducationForDay(ownerUserId, date)),
    safe('watch',     () => diaryRepo.fetchWatchForDay(ownerUserId, date)),
  ];
  if (includesUnknown) {
    reads.push(safe('unknown', () => diaryRepo.fetchUnknownCapturesForDay(ownerUserId, date)));
  }
  const results = await Promise.all(reads);

  // 5. Normalise + flatten. Per-kind projections are deliberately small
  // (the card UI does not need micronutrients or full image base64 in
  // the list; the detail modal still fetches via the established
  // per-vertical endpoints).
  const entries = [];
  for (const { kind, rows } of results) {
    for (const row of rows) {
      entries.push(toDiaryEntry(kind, row));
    }
  }
  entries.sort((a, b) =>
    new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        date,
        ownerUserId,
        isSelf,
        includesUnknown,
        entries,
      },
    },
  };
}

/**
 * Pure projection — given a kind + row, build the diary envelope.
 * No DB, no I/O. Exported only for tests; production callers should
 * always go through `listDiaryEntries`.
 *
 * @internal
 */
export function toDiaryEntry(kind, row) {
  switch (kind) {
    case 'food':
      return {
        kind: 'food',
        capturedAt: row.CreatedAt,
        capture: row.CaptureID ? { id: row.CaptureID } : null,
        payload: {
          id:           row.ID,
          imagePath:    row.ImagePath,
          imageBase64:  row.ImageBase64,
          analysisData: row.AnalysisData,
          confidence:   row.ConfidenceScore,
          totals: {
            calories: row.TotalCalories,
            protein:  row.TotalProtein,
            carbs:    row.TotalCarbs,
            fat:      row.TotalFat,
            fiber:    row.TotalFiber,
          },
          processedBy: row.ProcessedBy,
          deviceInfo:  row.DeviceInfo,
        },
      };

    case 'weight':
      return {
        kind: 'weight',
        capturedAt: row.CreatedAt,
        capture: null,
        payload: {
          id:           row.ID,
          weight:       row.Weight,
          bmi:          row.Bmi,
          bodyFat:      row.BodyFat,
          muscleMass:   row.MuscleMass,
          bmr:          row.Bmr,
          imageBase64:  row.WeightImageBase64,
        },
      };

    case 'education':
      return {
        kind: 'education',
        capturedAt: row.CreatedAt,
        capture: null,
        payload: {
          id:          row.Id,
          platform:    row.Platform,
          topic:       row.Topic,
          confidence:  row.Confidence,
          imageBase64: row.ImageBase64,
        },
      };

    case 'watch': {
      // Mirrors activity.service.getWatchBurnedCalories parser:
      //   "Calories Burned: 245 kcal" → 245
      // Non-matching topics parse to 0 (not throw) so a stray row
      // doesn't take the feed down.
      const match = (row.Topic || '').match(/(\d+(?:\.\d+)?)\s*kcal/i);
      const kcal = match ? Math.round(parseFloat(match[1])) : 0;
      return {
        kind: 'watch',
        capturedAt: row.CreatedAt,
        capture: null,
        payload: {
          id:    row.Id,
          topic: row.Topic,
          kcal,
        },
      };
    }

    case 'unknown':
      return {
        kind: 'unknown',
        capturedAt: row.CreatedAt,
        capture: {
          id:               row.ID,
          type:             row.ImageType,
          publicShareToken: row.PublicShareToken,
        },
        payload: {
          id:          row.ID,
          imagePath:   row.ImagePath,
          imageBase64: row.ImageBase64,
        },
      };

    default: {
      // Defensive — should be unreachable because `kind` is constructed
      // in this file. If it ever isn't, we want loud failure during
      // tests, not silent data loss.
      const err = new Error(`toDiaryEntry: unknown kind '${kind}'`);
      err.status = 500;
      err.code = 'UNKNOWN_DIARY_KIND';
      throw err;
    }
  }
}

// ─── resolveUnknownShare ─────────────────────────────────────────────────────
//
// PR-E / ADR-0003 — share-link viewer target for `unknown` captures.
//
// Today an `unknown` capture's share link routes (via tabForImageType) to an
// empty nutrition tab. PR-E instead opens a dedicated viewer that shows the
// image with Retry / Edit buttons. This endpoint backs that viewer:
//
//   - It returns the capture IMAGE so the viewer can render the card.
//   - It returns `canMutate` so the frontend only shows Retry / Edit to a
//     viewer the policy permits (owner OR a coach in the owner's upline).
//     Anonymous link recipients (no viewerUserId) get `canMutate: false`
//     and see image-only — matching the Q4 / Q6 product answers.
//
// Permission posture mirrors `retryPromotionToFood`: the row is read WITHOUT
// an owner guard (the viewer may legitimately not own it), and the
// `canRetryCapture` policy — fed the owner's pre-fetched coach chain —
// decides `canMutate`. The mutate endpoint itself
// (`retryPromotionToFood`) re-checks the same policy, so a forged
// `canMutate:true` from a tampered client cannot actually promote a capture.
//
// Returns:
//   { httpStatus: 200, body: { ok: true, data: { kind: 'unknown', captureId, imageBase64, createdAt, canMutate } } }
//   { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND' } } }       — missing / soft-deleted
//   { httpStatus: 410, body: { ok: false, error: { code: 'EXPIRED' } } }         — share window passed
//   { httpStatus: 409, body: { ok: false, error: { code: 'NOT_UNKNOWN', currentType } } } — already classified
export async function resolveUnknownShare({ token, viewerUserId }) {
  const capture = await captures.findByToken(token);
  if (!capture || capture.IsDeleted === 1) {
    return { httpStatus: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found' } } };
  }
  if (capture.ShareExpiresAt && new Date(capture.ShareExpiresAt) < new Date()) {
    return { httpStatus: 410, body: { ok: false, error: { code: 'EXPIRED', message: 'This share link has expired' } } };
  }
  if (capture.ImageType !== IMAGE_TYPE_UNKNOWN) {
    return {
      httpStatus: 409,
      body: {
        ok: false,
        error: {
          code: 'NOT_UNKNOWN',
          message: `Capture is '${capture.ImageType}', not 'unknown'.`,
          currentType: capture.ImageType,
        },
      },
    };
  }

  const ownerUserId = capture.UserID ? capture.UserID.toString() : null;

  // canMutate is false for anonymous viewers and for authenticated strangers.
  // The owner and any upline coach get true.
  let canMutate = false;
  if (ownerUserId && viewerUserId != null && viewerUserId !== '') {
    const coachChain = await repo.getCoachChain(ownerUserId);
    canMutate = canRetryCapture({
      viewerId: viewerUserId,
      ownerId:  ownerUserId,
      coachChain,
    }).allowed;
  }

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        kind:        'unknown',
        captureId:   capture.ID ? capture.ID.toString() : null,
        imageBase64: capture.ImageBase64 || null,
        createdAt:   capture.CreatedAt ? capture.CreatedAt.toString() : null,
        canMutate,
      },
    },
  };
}
