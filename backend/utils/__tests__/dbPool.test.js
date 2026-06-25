/**
 * dbPool.test.js — Unit tests for the database connection pool
 *
 * Per claude.md §9.1 : shared/ floor 90 % line / 80 % branch.
 * Per claude.md §9.6 : mock DB at the boundary only.
 *
 * ROOT-CAUSE REGRESSION GUARD (Bug C — pool cache not invalidated on failure)
 * ─────────────────────────────────────────────────────────────────────────────
 * When the initial connection test fires and fails (e.g. Supabase project is
 * paused / DATABASE_URL is stale), getPool() cached the broken pool into
 * globalForPool.__dbPool.  Every subsequent request reused the same bad pool
 * forever (until a Vercel cold-start), compounding ENOTFOUND errors.
 *
 * The fix adds:
 *   pool = null;
 *   globalForPool.__dbPool = null;
 * inside the .catch() of the fire-and-forget connection test so that the very
 * next request will re-create the pool with fresh credentials.
 *
 * Mock strategy
 * ─────────────
 * dbPool.js uses  `import pg from 'pg'; const { Pool } = pg;`
 * Babel @babel/preset-env transforms this to CJS. _interopRequireDefault
 * respects __esModule:true on the mock — without it Pool would be undefined
 * and the constructor call would throw.
 *
 * jest.resetModules() between tests clears the module cache (module-level
 * `let pool`) while keeping jest.mock() registrations intact.
 * global.__dbPool is cleared in beforeEach so the fresh module starts with
 * pool = null.
 */

// ─── Mocks MUST be declared before any imports (Jest hoists them) ────────────

// Top-level references that the pg mock factory will close over.
// They are assigned before any test runs so the factory captures them.
let mockPgQuery;
let mockPgOn;

// pg is imported as the default export; `__esModule: true` is required so
// Babel's _interopRequireDefault passes the .default value straight through.
jest.mock('pg', () => {
  const MockPool = jest.fn().mockImplementation(() => ({
    // These are filled in beforeEach via mockPgQuery / mockPgOn
    get query() { return mockPgQuery; },
    get on()    { return mockPgOn;    },
    end:     jest.fn(),
    connect: jest.fn(),
  }));
  return { __esModule: true, default: { Pool: MockPool } };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Flush micro-task queue so fire-and-forget .then/.catch callbacks settle. */
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

/** Clear the global pool cache so fresh module state starts from null. */
function clearGlobalPoolCache() {
  global.__dbPool = undefined;
  delete global.__dbPool;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPool — pool cache invalidation on connection failure', () => {
  beforeEach(() => {
    // Give each test a fresh module (resets module-level `let pool`)
    jest.resetModules();
    jest.clearAllMocks();
    clearGlobalPoolCache();

    // Default pg mock: .on() is a no-op, .query() resolves (overridden per-test)
    mockPgOn    = jest.fn();
    mockPgQuery = jest.fn().mockResolvedValue({
      rows: [{ current_time: new Date(), db_name: 'postgres', user_name: 'postgres' }],
    });
  });

  // ── REGRESSION guard (Bug C) ───────────────────────────────────────────────

  it('REGRESSION: nulls the cached pool when the connection test fails', async () => {
    // Arrange — pool.query (the fire-and-forget test) rejects
    mockPgQuery = jest.fn().mockRejectedValueOnce(
      new Error('(ENOTFOUND) tenant/user lnvvaeudhtazvxtmifeg not found'),
    );

    const { getPool } = await import('../dbPool.js');

    // Act
    const poolWrapper = getPool();
    expect(poolWrapper).toBeDefined(); // pool is created synchronously

    await flushAsync(); // let the .catch() settle

    // Assert — globalForPool.__dbPool must be null so the next request retries
    expect(global.__dbPool).toBeNull();
  });

  // ── REGRESSION guard (Bug C — getConnection path, XX000 / paused project) ─

  it('REGRESSION: nulls the cached pool when getConnection fails with XX000 (paused project)', async () => {
    // Fire-and-forget probe succeeds — pool gets cached
    mockPgQuery = jest.fn().mockResolvedValue({
      rows: [{ current_time: new Date(), db_name: 'postgres', user_name: 'postgres' }],
    });

    const { getPool } = await import('../dbPool.js');
    const poolWrapper = getPool();
    await flushAsync();
    expect(global.__dbPool).toBeDefined();

    // An actual getConnection() call then fails with Supabase's XX000 error
    const pausedError = Object.assign(
      new Error('(ENOTFOUND) tenant/user lnvvaeudhtazvxtmifeg not found'),
      { code: 'XX000', severity: 'FATAL' },
    );
    poolWrapper._pool.connect = jest.fn().mockRejectedValueOnce(pausedError);

    await expect(poolWrapper.getConnection()).rejects.toThrow('tenant/user');

    // Cache must now be null so the next request retries with a fresh pool
    expect(global.__dbPool).toBeNull();
  });

  it('REGRESSION: nulls the cached pool when getConnection fails with ECONNREFUSED', async () => {
    mockPgQuery = jest.fn().mockResolvedValue({
      rows: [{ current_time: new Date(), db_name: 'postgres', user_name: 'postgres' }],
    });

    const { getPool } = await import('../dbPool.js');
    const poolWrapper = getPool();
    await flushAsync();

    const connRefused = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    poolWrapper._pool.connect = jest.fn().mockRejectedValueOnce(connRefused);

    await expect(poolWrapper.getConnection()).rejects.toThrow('connection refused');
    expect(global.__dbPool).toBeNull();
  });

  it('does NOT null the cache when getConnection fails with a non-pooler error', async () => {
    mockPgQuery = jest.fn().mockResolvedValue({
      rows: [{ current_time: new Date(), db_name: 'postgres', user_name: 'postgres' }],
    });

    const { getPool } = await import('../dbPool.js');
    const poolWrapper = getPool();
    await flushAsync();

    // A transient statement error — the pool itself is healthy
    const queryError = Object.assign(new Error('column does not exist'), { code: '42703' });
    poolWrapper._pool.connect = jest.fn().mockRejectedValueOnce(queryError);

    await expect(poolWrapper.getConnection()).rejects.toThrow('column does not exist');

    // Cache must still be populated (pool is healthy, just a bad query)
    expect(global.__dbPool).not.toBeNull();
  });

  // ── Happy-path guards ──────────────────────────────────────────────────────

  it('keeps the cache populated when the connection test succeeds', async () => {
    const { getPool } = await import('../dbPool.js');

    getPool();
    await flushAsync();

    expect(global.__dbPool).toBeDefined();
    expect(global.__dbPool).not.toBeNull();
  });

  it('returns the same pool wrapper on repeated calls (singleton)', async () => {
    const { getPool } = await import('../dbPool.js');

    const first  = getPool();
    const second = getPool();

    expect(first).toBe(second);
  });

  it('exposes getConnection(), execute(), and query() on the wrapper', async () => {
    const { getPool } = await import('../dbPool.js');
    const wrapper = getPool();

    expect(typeof wrapper.getConnection).toBe('function');
    expect(typeof wrapper.execute).toBe('function');
    expect(typeof wrapper.query).toBe('function');
  });
});
