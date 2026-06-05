/**
 * Integration-style unit tests for retryPromotionToFood
 * (backend/features/background-analysis/diary.service.js).
 *
 * PR-A.2 / ADR-0003 — Diary "Other → Retry / Edit" promotion endpoint.
 * Moved from analysis.service.js → diary.service.js in PR-B (refactor commit).
 *
 * Mocks the captures slice + analysis repository at the module boundary
 * (claude.md §9.6 — domain tests are pure; integration tests mock at the
 * boundary). `save()` itself is NOT mocked — it lives in
 * `analysis.service.js` and is exercised end-to-end via the mocked repo
 * so the integration between the two service files cannot silently break.
 * The state-machine guard and permission policy are exercised via their
 * actual implementations.
 */

import * as service from '../diary.service.js';

// ─── Mocks ──────────────────────────────────────────────────────────────────
// The analysis.repository handles food-row writes and the coach chain walk.
jest.mock('../analysis.repository.js', () => ({
  findFoodByCaptureId: jest.fn(),
  insertAnalysis: jest.fn(),
  updateWithAnalysisResult: jest.fn(),
  touchLastActive: jest.fn().mockResolvedValue(undefined),
  getCoachChain: jest.fn(),
  getISTTimestamp: jest.fn(() => '2026-06-05T10:00:00+05:30'),
  convertToIST: jest.fn((ts) => ({ istTimestamp: ts || '2026-06-05T10:00:00+05:30' })),
}));

// The captures service owns reads + state-machine writes.
jest.mock('../../captures/captures.service.js', () => ({
  findById: jest.fn(),
  updateTypeById: jest.fn(),
}));

// Cache helper — silence in tests.
jest.mock('../../../utils/cache.js', () => ({
  cache: { delete: jest.fn() },
  cacheKeys: { nutritionMeals: jest.fn((uid) => `nutritionMeals:${uid}`) },
}));

// Logger — silence in tests but assert call counts where it matters.
jest.mock('../../../shared/lib/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import * as repo from '../analysis.repository.js';
import * as captures from '../../captures/captures.service.js';
import logger from '../../../shared/lib/logger.js';

const OWNER = '42';
const COACH = '99';
const STRANGER = '500';
const CAPTURE_ID = '7';

const unknownCapture = {
  ID: CAPTURE_ID,
  UserID: OWNER,
  ImageType: 'unknown',
  ImagePath: '/originals/unknown.jpg',
  ImageBase64: 'data:image/jpeg;base64,abc',
};

const validAnalysis = {
  foods: [{ name: 'dosa', nutrition: { calories: 300 } }],
  total: { calories: 300, protein: 6, carbs: 50, fat: 8, fiber: 2 },
  confidence: 'high',
};

const baseInput = {
  captureId: CAPTURE_ID,
  viewerUserId: OWNER,
  analysisResult: validAnalysis,
  imagePath: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default happy-path: capture exists as `unknown`, save() insert path.
  captures.findById.mockResolvedValue(unknownCapture);
  captures.updateTypeById.mockResolvedValue({ changed: true, imageType: 'food' });
  repo.findFoodByCaptureId.mockResolvedValue(null); // INSERT path inside save()
  repo.insertAnalysis.mockResolvedValue({ ID: 9999 });
  // chain[0] === ownerId convention, +1 hop for the coach.
  repo.getCoachChain.mockResolvedValue([OWNER, COACH]);
});

describe('retryPromotionToFood — happy paths', () => {
  it('OWNER retries their own unknown capture → 200, food row inserted, capture promoted', async () => {
    const out = await service.retryPromotionToFood(baseInput);

    expect(out.httpStatus).toBe(200);
    expect(out.body.success).toBe(true);
    expect(out.body.id).toBe(9999);

    // Food row uses the OWNER's id, never the viewer's (they happen to
    // match for OWNER retries — verified by the COACH test below).
    expect(repo.insertAnalysis).toHaveBeenCalledTimes(1);
    expect(repo.insertAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ UserID: OWNER, CaptureID: CAPTURE_ID }),
    );

    // State-machine promotion happens.
    expect(captures.updateTypeById).toHaveBeenCalledWith({
      captureId: CAPTURE_ID,
      userId: OWNER,
      toType: 'food',
    });

    // Owner-on-self action is NOT audit-logged (intentional — ADR-0003 F5).
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('COACH retries member capture → 200, food row written under MEMBER, coach action audit-logged', async () => {
    const out = await service.retryPromotionToFood({ ...baseInput, viewerUserId: COACH });

    expect(out.httpStatus).toBe(200);

    // Critical: the food row belongs to the OWNER, not the coach.
    expect(repo.insertAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ UserID: OWNER, CaptureID: CAPTURE_ID }),
    );

    // Audit log fires for coach-on-member actions (ADR-0003 F5).
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'retryPromotionToFood: coach action on member capture',
      expect.objectContaining({
        actorId: COACH,
        ownerId: OWNER,
        captureId: CAPTURE_ID,
        action: 'retry-promotion-to-food',
      }),
    );
  });

  it('UPDATE path: existing food row for this capture → update, not duplicate insert', async () => {
    repo.findFoodByCaptureId.mockResolvedValueOnce({ ID: 5555 });
    repo.updateWithAnalysisResult.mockResolvedValueOnce({ ID: 5555 });

    const out = await service.retryPromotionToFood(baseInput);

    expect(out.httpStatus).toBe(200);
    expect(repo.insertAnalysis).not.toHaveBeenCalled();
    expect(repo.updateWithAnalysisResult).toHaveBeenCalledWith(
      5555,
      OWNER,
      expect.any(Object),
    );
  });

  it('falls back to the capture ImagePath when no imagePath supplied in body', async () => {
    await service.retryPromotionToFood(baseInput);

    expect(repo.insertAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ ImagePath: '/originals/unknown.jpg' }),
    );
  });

  it('uses the supplied imagePath when present (Edit path with a fresh upload)', async () => {
    await service.retryPromotionToFood({ ...baseInput, imagePath: '/originals/edited.jpg' });

    expect(repo.insertAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ ImagePath: '/originals/edited.jpg' }),
    );
  });
});

describe('retryPromotionToFood — denial paths', () => {
  it('returns 404 CAPTURE_NOT_FOUND when capture does not exist', async () => {
    captures.findById.mockResolvedValueOnce(null);

    const out = await service.retryPromotionToFood(baseInput);

    expect(out).toEqual({
      httpStatus: 404,
      body: { ok: false, error: { code: 'CAPTURE_NOT_FOUND', message: expect.any(String) } },
    });
    expect(repo.insertAnalysis).not.toHaveBeenCalled();
    expect(captures.updateTypeById).not.toHaveBeenCalled();
  });

  it('returns 404 when capture row is missing UserID (defensive guard)', async () => {
    captures.findById.mockResolvedValueOnce({ ...unknownCapture, UserID: null });

    const out = await service.retryPromotionToFood(baseInput);

    expect(out.httpStatus).toBe(404);
    expect(out.body.error.code).toBe('CAPTURE_NOT_FOUND');
  });

  it.each(['pending', 'food', 'weight', 'education', 'smartwatch'])(
    'returns 409 NOT_RETRYABLE when capture is currently %s (only unknown is retryable)',
    async (currentType) => {
      captures.findById.mockResolvedValueOnce({ ...unknownCapture, ImageType: currentType });

      const out = await service.retryPromotionToFood(baseInput);

      expect(out.httpStatus).toBe(409);
      expect(out.body.error.code).toBe('NOT_RETRYABLE');
      expect(out.body.error.currentType).toBe(currentType);
      expect(repo.getCoachChain).not.toHaveBeenCalled();
      expect(repo.insertAnalysis).not.toHaveBeenCalled();
    },
  );

  it('throws 403 FORBIDDEN_RETRY when viewer is a stranger (not in chain)', async () => {
    await expect(
      service.retryPromotionToFood({ ...baseInput, viewerUserId: STRANGER }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_RETRY' });

    // Permission denial is audit-logged via logger.warn (forensic trail).
    expect(logger.warn).toHaveBeenCalledWith(
      'retryPromotionToFood: permission denied',
      expect.objectContaining({
        captureId: CAPTURE_ID,
        viewerUserId: STRANGER,
        ownerUserId: OWNER,
        reason: 'NOT_IN_CHAIN',
      }),
    );
    expect(repo.insertAnalysis).not.toHaveBeenCalled();
  });

  it('throws 403 when viewer was previously a coach but member has since left the team', async () => {
    // Chain shrinks to just the owner — coach is gone.
    repo.getCoachChain.mockResolvedValueOnce([OWNER]);

    await expect(
      service.retryPromotionToFood({ ...baseInput, viewerUserId: COACH }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_RETRY' });
  });

  it('throws 403 for a co-coach (peer of owner\'s coach, not in upline)', async () => {
    // Co-coach is NOT in the chain — chain only contains owner + direct upline.
    repo.getCoachChain.mockResolvedValueOnce([OWNER, COACH]);

    await expect(
      service.retryPromotionToFood({ ...baseInput, viewerUserId: '30' }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_RETRY' });
  });
});
