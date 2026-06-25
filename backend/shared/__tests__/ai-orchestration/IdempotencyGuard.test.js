/**
 * Unit tests — IdempotencyGuard
 *
 * Pure in-memory module; no I/O. Validates:
 *   - First-time capture registrations.
 *   - Duplicate detection within the window.
 *   - Expiry after windowMs.
 *   - Size-based eviction at maxEntries.
 *   - complete() / fail() transitions.
 */
import { IdempotencyGuard, JOB_STATUS } from '../../lib/ai-orchestration/IdempotencyGuard.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGuard(overrides = {}) {
  return new IdempotencyGuard({ windowMs: 5_000, maxEntries: 10, ...overrides });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IdempotencyGuard — check (no entry)', () => {
  it('returns { duplicate: false } for an unknown captureId', () => {
    const guard = makeGuard();
    expect(guard.check('cap-1')).toEqual({ duplicate: false });
  });

  it('returns { duplicate: false } for null / undefined', () => {
    const guard = makeGuard();
    expect(guard.check(null)).toEqual({ duplicate: false });
    expect(guard.check(undefined)).toEqual({ duplicate: false });
  });
});

describe('IdempotencyGuard — register + check', () => {
  it('detects a duplicate after register()', () => {
    const guard = makeGuard();
    guard.register('cap-2', { traceId: 'trace-abc' });
    const result = guard.check('cap-2');
    expect(result.duplicate).toBe(true);
    expect(result.entry.status).toBe(JOB_STATUS.PROCESSING);
    expect(result.entry.traceId).toBe('trace-abc');
  });

  it('is NOT a duplicate immediately before register()', () => {
    const guard = makeGuard();
    expect(guard.check('cap-3').duplicate).toBe(false);
    guard.register('cap-3');
    expect(guard.check('cap-3').duplicate).toBe(true);
  });

  it('does not register when captureId is falsy', () => {
    const guard = makeGuard();
    guard.register('');
    guard.register(null);
    expect(guard.check('')).toEqual({ duplicate: false });
  });
});

describe('IdempotencyGuard — complete()', () => {
  it('transitions status to COMPLETED and stores result', () => {
    const guard = makeGuard();
    guard.register('cap-4');
    guard.complete('cap-4', { imageType: 'food' });

    const result = guard.check('cap-4');
    expect(result.duplicate).toBe(true);
    expect(result.entry.status).toBe(JOB_STATUS.COMPLETED);
    expect(result.entry.result).toEqual({ imageType: 'food' });
  });

  it('is a no-op when captureId is unknown', () => {
    const guard = makeGuard();
    expect(() => guard.complete('not-registered', {})).not.toThrow();
  });
});

describe('IdempotencyGuard — fail()', () => {
  it('transitions status to FAILED and stores errorCode', () => {
    const guard = makeGuard();
    guard.register('cap-5');
    guard.fail('cap-5', 'GEMINI_TIMEOUT');

    const result = guard.check('cap-5');
    expect(result.duplicate).toBe(true);
    expect(result.entry.status).toBe(JOB_STATUS.FAILED);
    expect(result.entry.errorCode).toBe('GEMINI_TIMEOUT');
  });
});

describe('IdempotencyGuard — time-based eviction', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('returns { duplicate: false } after windowMs has elapsed', () => {
    const guard = makeGuard({ windowMs: 1_000 });
    guard.register('cap-6');
    expect(guard.check('cap-6').duplicate).toBe(true);

    jest.advanceTimersByTime(1_001);
    expect(guard.check('cap-6').duplicate).toBe(false);
  });

  it('does NOT evict within the window', () => {
    const guard = makeGuard({ windowMs: 1_000 });
    guard.register('cap-7');

    jest.advanceTimersByTime(999);
    expect(guard.check('cap-7').duplicate).toBe(true);
  });
});

describe('IdempotencyGuard — size-based eviction', () => {
  it('drops oldest entries when maxEntries is exceeded', () => {
    const guard = makeGuard({ maxEntries: 3, windowMs: 60_000 });

    // Fill to capacity
    guard.register('e1');
    guard.register('e2');
    guard.register('e3');

    // Adding a 4th entry triggers eviction of the oldest (e1)
    guard.register('e4');

    // e1 should be gone (evicted as the oldest)
    expect(guard.check('e1').duplicate).toBe(false);
    // Remaining entries are still present
    expect(guard.check('e4').duplicate).toBe(true);
  });
});

describe('IdempotencyGuard — captureId string coercion', () => {
  it('coerces numeric captureId to string', () => {
    const guard = makeGuard();
    guard.register(42);
    expect(guard.check('42').duplicate).toBe(true);
  });
});
