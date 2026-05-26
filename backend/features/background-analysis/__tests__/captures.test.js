/**
 * Unit tests for instant-share validators and service functions.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 *
 * The repository layer is mocked at the module boundary so these tests
 * are pure unit tests with no DB dependency.
 */
import { validateCreateCapture, validatePublicCapture } from '../analysis.validators.js';
import { createPendingCapture, getPublicCapture, list, resolvePublicCapture } from '../analysis.service.js';

// ─── mock repository ─────────────────────────────────────────────────────────

jest.mock('../analysis.repository.js', () => ({
  insertPendingCapture: jest.fn(),
  updateWithAnalysisResult: jest.fn(),
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

import * as repo from '../analysis.repository.js';

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
    expect(validateCreateCapture(body)).toEqual(body);
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
    repo.insertPendingCapture.mockResolvedValue({ ID: 7, UserID: '42' });
    repo.touchLastActive.mockResolvedValue();
  });

  it('returns 201 with id and token', async () => {
    const result = await createPendingCapture({ userId: '42', imageBase64: 'data:x' });
    expect(result.httpStatus).toBe(201);
    expect(result.body.ok).toBe(true);
    expect(typeof result.body.data.token).toBe('string');
    // UUID v4 format
    expect(result.body.data.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.body.data.id).toBe(7);
  });

  it('calls insertPendingCapture with correct shape', async () => {
    await createPendingCapture({ userId: '99', imageBase64: 'data:abc' });
    expect(repo.insertPendingCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '99',
        imageBase64: 'data:abc',
        publicShareToken: expect.any(String),
        shareExpiresAt: expect.any(String),
      }),
    );
  });

  it('sets shareExpiresAt ~30 days in the future', async () => {
    await createPendingCapture({ userId: '1', imageBase64: 'x' });
    const [call] = repo.insertPendingCapture.mock.calls;
    const expiresAt = new Date(call[0].shareExpiresAt);
    const diffDays = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  it('propagates repo errors', async () => {
    repo.insertPendingCapture.mockRejectedValue(new Error('DB down'));
    await expect(createPendingCapture({ userId: '1', imageBase64: 'x' })).rejects.toThrow('DB down');
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
});
