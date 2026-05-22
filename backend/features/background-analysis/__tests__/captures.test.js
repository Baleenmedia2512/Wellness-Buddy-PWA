/**
 * Unit tests for instant-share validators and service functions.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 *
 * The repository layer is mocked at the module boundary so these tests
 * are pure unit tests with no DB dependency.
 */
import { validateCreateCapture, validatePublicCapture } from '../analysis.validators.js';
import { createPendingCapture, getPublicCapture } from '../analysis.service.js';

// ─── mock repository ─────────────────────────────────────────────────────────

jest.mock('../analysis.repository.js', () => ({
  insertPendingCapture: jest.fn(),
  updateWithAnalysisResult: jest.fn(),
  findPublicByToken: jest.fn(),
  insertAnalysis: jest.fn(),
  listAnalyses: jest.fn(),
  softDeleteAnalysis: jest.fn(),
  checkOwnership: jest.fn(),
  restoreAnalysis: jest.fn(),
  touchLastActive: jest.fn(),
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
