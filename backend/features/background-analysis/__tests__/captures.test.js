/**
 * Unit tests for instant-share validators and service functions.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 *
 * The repository layer is mocked at the module boundary so these tests
 * are pure unit tests with no DB dependency.
 */
import { validateCreateCapture, validatePublicCapture, validateUpdateCapture } from '../analysis.validators.js';
import { createPendingCapture, getPublicCapture, list, resolvePublicCapture, save, updateCaptureType } from '../analysis.service.js';

// ─── mock repository ─────────────────────────────────────────────────────────

jest.mock('../analysis.repository.js', () => ({
  updateWithAnalysisResult: jest.fn(),
  // PR 6 — insertPendingCapture and findCaptureIdForOwner were removed.
  // captures_table is now the only at-capture-time write; food rows are
  // upserted at save() time keyed by CaptureID via findFoodByCaptureId.
  findFoodByCaptureId: jest.fn(),
  findPublicByToken: jest.fn(),
  findOwnerByToken: jest.fn(),
  insertAnalysis: jest.fn(),
  listAnalyses: jest.fn(),
  softDeleteAnalysis: jest.fn(),
  checkOwnership: jest.fn(),
  restoreAnalysis: jest.fn(),
  touchLastActive: jest.fn(),
  getCoachChain: jest.fn(),
  findUserName: jest.fn(),
  isCoCoachPaired: jest.fn(),
  getISTTimestamp: () => new Date().toISOString(),
  convertToIST: (ts) => ({ istTimestamp: ts }),
}));

// PR 4: dual-write into captures_table is mandatory on createPendingCapture
// (throws on failure). Mock the captures service so unit tests are isolated
// from the captures slice and the real Supabase client.
jest.mock('../../captures/captures.service.js', () => ({
  recordPending:   jest.fn().mockResolvedValue({ id: 1001, publicShareToken: 'mock-token' }),
  updateType:      jest.fn().mockResolvedValue({ changed: true, imageType: 'food' }),
  // PR 5 — the canonical updateType-by-CaptureID path used by the rewritten
  // updateCaptureType service function.
  updateTypeById:  jest.fn().mockResolvedValue({ changed: true, imageType: 'food' }),
}));

import * as repo from '../analysis.repository.js';
import * as captures from '../../captures/captures.service.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function expectValidationError(fn, status, msgSubstring) {
  try {
    fn();
  } catch (e) {
    expect(e.name).toBe('ValidationError');
    expect(e.status).toBe(status);
    if (msgSubstring) expect(e.message).toContain(msgSubstring);
    return;
  }
  throw new Error('Expected ValidationError to be thrown');
}

// ─── validateCreateCapture ───────────────────────────────────────────────────

describe('validateCreateCapture', () => {
  it('accepts valid body', () => {
    const body = { userId: '42', imageBase64: 'data:image/jpeg;base64,abc' };
    // token defaults to null when the optional client-supplied UUID is absent
    // (instant-share path supplies one; classic flow does not). See validator
    // comment in analysis.validators.js :: validateCreateCapture.
    expect(validateCreateCapture(body)).toEqual({ ...body, token: null });
  });

  it('ignores any imageType in the request body (type is set server-side)', () => {
    // imageType is intentionally stripped — new rows start as 'pending'
    // regardless of what the client sends.
    const body = { userId: '42', imageBase64: 'data:image/jpeg;base64,abc', imageType: 'food' };
    expect(validateCreateCapture(body)).toEqual({
      userId: '42',
      imageBase64: 'data:image/jpeg;base64,abc',
      token: null,
    });
  });

  it('rejects null body', () => {
    expectValidationError(() => validateCreateCapture(null), 400, 'body is missing');
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateCreateCapture({ imageBase64: 'x' }), 400, 'userId');
  });

  it('rejects missing imageBase64', () => {
    expectValidationError(() => validateCreateCapture({ userId: '1' }), 400, 'imageBase64');
  });
});

// ─── validatePublicCapture ───────────────────────────────────────────────────

describe('validatePublicCapture', () => {
  const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  it('accepts a valid UUID token', () => {
    expect(validatePublicCapture({ token: VALID_UUID })).toEqual({ token: VALID_UUID });
  });

  it('rejects missing token', () => {
    expectValidationError(() => validatePublicCapture({}), 400, 'token is required');
  });

  it('rejects non-UUID token', () => {
    expectValidationError(() => validatePublicCapture({ token: '../etc/passwd' }), 400, 'Invalid token format');
  });

  it('rejects empty string token', () => {
    expectValidationError(() => validatePublicCapture({ token: '' }), 400, 'token is required');
  });
});

// ─── createPendingCapture ────────────────────────────────────────────────────

describe('createPendingCapture', () => {
  beforeEach(() => {
    repo.touchLastActive.mockResolvedValue();
    captures.recordPending.mockReset().mockResolvedValue({ id: 7, publicShareToken: 'tok' });
  });

  it('returns 201 with id and token', async () => {
    const result = await createPendingCapture({ userId: '42', imageBase64: 'data:x' });
    expect(result.httpStatus).toBe(201);
    expect(result.body.ok).toBe(true);
    expect(typeof result.body.data.token).toBe('string');
    // UUID v4 format
    expect(result.body.data.token).toMatch(/^[0-9a-f-]{36}$/);
    // PR 6 — `id` returned to the FE is the captures_table CaptureID.
    expect(result.body.data.id).toBe(7);
  });

  it('does NOT write to food_nutrition_data_table at capture time (PR 6)', async () => {
    // PR 6 eliminated the speculative pre-insert that caused orphan
    // "Unknown Food / 0kcal" rows. captures_table is the only writer here.
    captures.recordPending.mockReset().mockResolvedValue({ id: 4242, publicShareToken: 'tok' });
    await createPendingCapture({ userId: '99', imageBase64: 'data:abc' });
    expect(repo.insertAnalysis).not.toHaveBeenCalled();
    expect(repo.updateWithAnalysisResult).not.toHaveBeenCalled();
  });

  it('sets shareExpiresAt ~30 days in the future on the captures.recordPending call', async () => {
    await createPendingCapture({ userId: '1', imageBase64: 'x' });
    const [call] = captures.recordPending.mock.calls;
    const expiresAt = new Date(call[0].shareExpiresAt);
    const diffDays = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  // PR 6 — captures_table is the ONLY writer. Any failure in
  // captures.recordPending must fail the whole request — there is no longer
  // a legacy food-table insert that could provide a fallback.
  it('fails the request when captures.recordPending throws', async () => {
    captures.recordPending.mockRejectedValueOnce(new Error('captures slice down'));
    await expect(
      createPendingCapture({ userId: '42', imageBase64: 'data:x' }),
    ).rejects.toThrow('captures slice down');
  });

  it('forwards the same publicShareToken to captures.recordPending and returns it', async () => {
    const r = await createPendingCapture({ userId: '42', imageBase64: 'data:x' });
    const capturesToken = captures.recordPending.mock.calls[0][0].publicShareToken;
    expect(r.body.data.token).toBe(capturesToken);
    expect(captures.recordPending).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '42',
        publicShareToken: expect.any(String),
        shareExpiresAt: expect.any(String),
        imageBase64: 'data:x',
        imagePath: 'instant-share',
        deviceInfo: 'Wellness Valley Web App',
        processedBy: 'manual_app',
      }),
    );
  });
});

// ─── getPublicCapture ────────────────────────────────────────────────────────

describe('getPublicCapture', () => {
  const VALID_TOKEN = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const FUTURE = new Date(Date.now() + 1e9).toISOString();
  const PAST   = new Date(Date.now() - 1000).toISOString();

  it('returns 404 when row not found', async () => {
    repo.findPublicByToken.mockResolvedValue(null);
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(404);
    expect(r.body.ok).toBe(false);
  });

  it('returns 410 when token expired', async () => {
    repo.findPublicByToken.mockResolvedValue({ ShareExpiresAt: PAST, AnalysisData: null });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(410);
    expect(r.body.error.code).toBe('EXPIRED');
  });

  it('returns pending:true when AnalysisData is null', async () => {
    repo.findPublicByToken.mockResolvedValue({ ShareExpiresAt: FUTURE, AnalysisData: null });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.pending).toBe(true);
  });

  it('returns full nutrition when AnalysisData is present', async () => {
    const analysis = { foods: [{ name: 'Rice' }], total: { calories: 300 } };
    repo.findPublicByToken.mockResolvedValue({
      ShareExpiresAt: FUTURE,
      AnalysisData: JSON.stringify(analysis),
      TotalCalories: 300,
      TotalProtein: 5,
      TotalCarbs: 60,
      TotalFat: 2,
      TotalFiber: 1,
      CreatedAt: FUTURE,
    });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.pending).toBe(false);
    expect(r.body.data.nutrition.calories).toBe(300);
    expect(r.body.data.analysis.foods[0].name).toBe('Rice');
  });

  it('handles AnalysisData already parsed as object', async () => {
    const analysis = { foods: [], total: { calories: 100 } };
    repo.findPublicByToken.mockResolvedValue({
      ShareExpiresAt: FUTURE,
      AnalysisData: analysis, // already an object
      TotalCalories: 100,
    });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.nutrition.calories).toBe(100);
  });

  it('handles no ShareExpiresAt (never expires)', async () => {
    repo.findPublicByToken.mockResolvedValue({ ShareExpiresAt: null, AnalysisData: null });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.pending).toBe(true);
  });
});

// ─── list ────────────────────────────────────────────────────────────────────
// The repository layer enforces `.not('"AnalysisData"', 'is', null)` so that
// pending-capture rows (pre-created for the instant-share optimisation but
// never filled in because the image turned out to be weight/education/
// smartwatch) are excluded from the nutrition dashboard.  These service-level
// tests verify the expected contract once the repo filter is applied.

describe('list', () => {
  const userId = '99';

  afterEach(() => { repo.listAnalyses.mockReset(); });

  it('returns rows and correct pagination when repo returns enriched captures', async () => {
    repo.listAnalyses.mockResolvedValue({
      rows: [
        { ID: 1, AnalysisData: JSON.stringify({ foods: [{ name: 'Rice' }] }), TotalCalories: 300 },
        { ID: 2, AnalysisData: JSON.stringify({ foods: [{ name: 'Banana' }] }), TotalCalories: 89 },
      ],
      count: 2,
    });

    const r = await list({ userId, limit: 50, offset: 0 });

    expect(r.httpStatus).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data).toHaveLength(2);
    expect(r.body.pagination).toMatchObject({ total: 2, limit: 50, offset: 0, hasMore: false });
    // Every returned row must have AnalysisData (pending-capture guard)
    r.body.data.forEach((row) => expect(row.AnalysisData).not.toBeNull());
  });

  it('returns empty data when all pending-capture rows were filtered out by repo', async () => {
    // Simulates the state where only orphan rows existed — the repo filter
    // (introduced to fix the "Unknown Food" regression) excluded all of them.
    repo.listAnalyses.mockResolvedValue({ rows: [], count: 0 });

    const r = await list({ userId, limit: 50, offset: 0 });

    expect(r.httpStatus).toBe(200);
    expect(r.body.data).toHaveLength(0);
    expect(r.body.pagination.total).toBe(0);
    expect(r.body.pagination.hasMore).toBe(false);
  });

  it('sets hasMore correctly when more pages exist', async () => {
    repo.listAnalyses.mockResolvedValue({
      rows: Array.from({ length: 20 }, (_, i) => ({
        ID: i + 1,
        AnalysisData: JSON.stringify({ foods: [] }),
      })),
      count: 45,
    });

    const r = await list({ userId, limit: 20, offset: 0 });

    expect(r.body.pagination.hasMore).toBe(true);
    expect(r.body.pagination.total).toBe(45);
  });

  it('forwards userId, limit, and offset to repo.listAnalyses', async () => {
    repo.listAnalyses.mockResolvedValue({ rows: [], count: 0 });

    await list({ userId: '42', limit: 10, offset: 30 });

    expect(repo.listAnalyses).toHaveBeenCalledWith({ userId: '42', limit: 10, offset: 30 });
  });
});

// ─── resolvePublicCapture ────────────────────────────────────────────────────

describe('resolvePublicCapture', () => {
  const TOKEN = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const FUTURE = new Date(Date.now() + 1e9).toISOString();
  const PAST   = new Date(Date.now() - 1000).toISOString();
  const OWNER  = '10';  // Adithya
  const COACH  = '20';  // Adithya's upline coach
  const COCOACH = '30'; // Praveen — co-coach partner of Adithya
  const STRANGER = '99';

  const ownerRow = { ID: 123, UserID: OWNER, CreatedAt: FUTURE, ShareExpiresAt: FUTURE };

  afterEach(() => jest.resetAllMocks());

  it('returns 404 when token has no matching row', async () => {
    repo.findOwnerByToken.mockResolvedValue(null);
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: OWNER });
    expect(r.httpStatus).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 410 when token is expired', async () => {
    repo.findOwnerByToken.mockResolvedValue({ ...ownerRow, ShareExpiresAt: PAST });
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: OWNER });
    expect(r.httpStatus).toBe(410);
    expect(r.body.error.code).toBe('EXPIRED');
  });

  it('returns 200 isSelf=true when viewer is the owner (no chain lookup)', async () => {
    repo.findOwnerByToken.mockResolvedValue(ownerRow);
    repo.findUserName.mockResolvedValue('Adithya');
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: OWNER });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.isSelf).toBe(true);
    expect(r.body.data.mealId).toBe('123');
    expect(repo.getCoachChain).not.toHaveBeenCalled();
  });

  it('returns 200 when viewer is in the upline coach chain', async () => {
    repo.findOwnerByToken.mockResolvedValue(ownerRow);
    repo.getCoachChain.mockResolvedValue([OWNER, COACH]);
    repo.findUserName.mockResolvedValue('Adithya');
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: COACH });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.isSelf).toBe(false);
    expect(r.body.data.mealId).toBe('123');
  });

  it('returns 403 when viewer is a co-coach partner (not in upline chain)', async () => {
    // Co-coaches are peers of the owner's coach and must NOT gain access via
    // the share link. Only the upline chain is trusted for nutrition sharing.
    repo.findOwnerByToken.mockResolvedValue(ownerRow);
    repo.getCoachChain.mockResolvedValue([OWNER, COACH]); // COCOACH absent
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: COCOACH });
    expect(r.httpStatus).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    expect(repo.isCoCoachPaired).not.toHaveBeenCalled();
  });

  it('returns 403 when viewer is not in the upline coach chain', async () => {
    repo.findOwnerByToken.mockResolvedValue(ownerRow);
    repo.getCoachChain.mockResolvedValue([OWNER, COACH]);
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: STRANGER });
    expect(r.httpStatus).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
  });

  it('returns imageType=smartwatch so deep-link routes to education tab', async () => {
    // Smartwatch entries are stored in education_logs_table; the repo join
    // returns the education log Id as row.ID. The service surfaces it so
    // EducationDashboard can auto-open the correct card.
    repo.findOwnerByToken.mockResolvedValue({ ...ownerRow, ImageType: 'smartwatch' });
    const r = await resolvePublicCapture({ token: TOKEN, viewerUserId: OWNER });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.imageType).toBe('smartwatch');
    expect(r.body.data.mealId).toBe('123');
  });
});

// ─── validateUpdateCapture ───────────────────────────────────────────────────

describe('validateUpdateCapture', () => {
  it('accepts all valid imageTypes', () => {
    // 'unknown' added in PR 2: low-confidence captures avoid food-table
    // pollution by being explicitly tagged 'unknown' (and auto-purged 24h
    // later by the cron at pages/api/cron/purge-unknown-captures.js).
    ['food', 'weight', 'education', 'smartwatch', 'unknown'].forEach((type) => {
      const result = validateUpdateCapture({ id: '5', userId: '42', imageType: type });
      expect(result).toEqual({ id: '5', userId: '42', imageType: type });
    });
  });

  it('rejects null body', () => {
    expectValidationError(() => validateUpdateCapture(null), 400, 'body is missing');
  });

  it('rejects missing id', () => {
    expectValidationError(() => validateUpdateCapture({ userId: '1', imageType: 'weight' }), 400, 'id is required');
  });

  it('rejects missing userId', () => {
    expectValidationError(() => validateUpdateCapture({ id: '5', imageType: 'weight' }), 400, 'userId is required');
  });

  it('rejects missing imageType', () => {
    expectValidationError(() => validateUpdateCapture({ id: '5', userId: '1' }), 400, 'imageType must be one of');
  });

  it('rejects unknown imageType', () => {
    expectValidationError(
      () => validateUpdateCapture({ id: '5', userId: '1', imageType: 'selfie' }),
      400, 'imageType must be one of',
    );
  });
});

// ─── updateCaptureType ───────────────────────────────────────────────────────

describe('updateCaptureType', () => {
  beforeEach(() => {
    captures.updateTypeById.mockReset().mockResolvedValue({ changed: true, imageType: 'weight' });
  });

  // PR 6 — `id` is now the captures_table CaptureID directly (returned by
  // createPendingCapture). No food-row indirection / findCaptureIdForOwner.
  it('delegates straight to captures.updateTypeById using `id` as the CaptureID', async () => {
    const r = await updateCaptureType({ id: 5, userId: '42', imageType: 'weight' });
    expect(r.httpStatus).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(captures.updateTypeById).toHaveBeenCalledWith({
      captureId: 5,
      userId: '42',
      toType: 'weight',
    });
  });

  it('works for education type', async () => {
    await updateCaptureType({ id: 7, userId: '10', imageType: 'education' });
    expect(captures.updateTypeById).toHaveBeenCalledWith({
      captureId: 7, userId: '10', toType: 'education',
    });
  });

  it('works for smartwatch type', async () => {
    await updateCaptureType({ id: 9, userId: '10', imageType: 'smartwatch' });
    expect(captures.updateTypeById).toHaveBeenCalledWith({
      captureId: 9, userId: '10', toType: 'smartwatch',
    });
  });

  it('returns 404 when captures.updateTypeById reports NOT_FOUND_OR_NOT_OWNER', async () => {
    captures.updateTypeById.mockResolvedValueOnce({
      changed: false, reason: 'NOT_FOUND_OR_NOT_OWNER',
    });
    const r = await updateCaptureType({ id: 5, userId: '42', imageType: 'weight' });
    expect(r.httpStatus).toBe(404);
    expect(r.body.ok).toBe(false);
    expect(r.body.error.code).toBe('CAPTURE_NOT_FOUND');
  });

  it('propagates errors from the captures slice', async () => {
    captures.updateTypeById.mockRejectedValueOnce(new Error('captures slice down'));
    await expect(
      updateCaptureType({ id: 5, userId: '42', imageType: 'weight' }),
    ).rejects.toThrow('captures slice down');
  });
});

// ─── save ─────────────────────────────────────────────────────────────────────

describe('save', () => {
  const baseInput = {
    userId: '42',
    imagePath: 'test.jpg',
    analysisResult: {
      nutrition: { calories: 350, protein: 12, carbs: 45, fat: 10, fiber: 3 },
      category: { name: 'Rice' },
      confidence: 'high',
    },
    deviceInfo: 'test-device',
    ImageBase64: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.insertAnalysis.mockResolvedValue({ ID: 99 });
    repo.findFoodByCaptureId.mockResolvedValue(null);
    captures.updateTypeById.mockResolvedValue({ changed: true, imageType: 'food' });
    repo.touchLastActive.mockResolvedValue();
  });

  it('does NOT include ImageType in the food_nutrition_data_table insert (PR-6 regression guard)', async () => {
    // ImageType was dropped from food_nutrition_data_table by
    // drop_legacy_share_columns_from_food.sql. Including it would cause
    // Supabase to reject the INSERT with a column-not-found error.
    await save(baseInput);
    expect(repo.insertAnalysis).toHaveBeenCalledTimes(1);
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload).not.toHaveProperty('ImageType');
  });

  it('inserts with CaptureID FK when captureId is supplied', async () => {
    await save({ ...baseInput, captureId: 1001 });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.CaptureID).toBe(1001);
  });

  it('promotes the capture to food after a successful insert', async () => {
    await save({ ...baseInput, captureId: 1001 });
    expect(captures.updateTypeById).toHaveBeenCalledWith({
      captureId: 1001,
      userId: '42',
      toType: 'food',
    });
  });

  it('does NOT call captures.updateTypeById when no captureId', async () => {
    await save(baseInput);
    expect(captures.updateTypeById).not.toHaveBeenCalled();
  });

  it('updates an existing food row when findFoodByCaptureId returns a match', async () => {
    repo.findFoodByCaptureId.mockResolvedValue({ ID: 77 });
    repo.updateWithAnalysisResult.mockResolvedValue({ ID: 77 });
    const r = await save({ ...baseInput, captureId: 1001 });
    expect(repo.insertAnalysis).not.toHaveBeenCalled();
    expect(repo.updateWithAnalysisResult).toHaveBeenCalledWith(77, '42', expect.not.objectContaining({ ImageType: expect.anything() }));
    expect(r.httpStatus).toBe(200);
  });

  it('returns 500 on a DB error without crashing the process', async () => {
    repo.insertAnalysis.mockRejectedValueOnce(new Error('connection refused'));
    const r = await save(baseInput);
    expect(r.httpStatus).toBe(500);
    expect(r.body.success).toBe(false);
  });
});
