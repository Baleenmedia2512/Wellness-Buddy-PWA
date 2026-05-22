/**
 * Integration test for GET /api/water/intake.
 *
 * Exercises the full vertical slice:
 *   pages/api/water/intake.js  →  validation/intake.schema.js
 *                              →  api/intake.handler.js
 *                              →  data/water.repo.js  (Supabase mocked at boundary)
 *                              →  domain/intake.rules.js
 *
 * Mock surface: the only thing stubbed is the Supabase client. Every other
 * module runs its real code. This is the pattern claude.md §9.6 prescribes for
 * integration tests — mock only at the external boundary.
 */

/* eslint-disable global-require, import/first */

// Per-test response slots, mutated before each call.
// Name MUST start with "mock" so jest.mock factory can reference it.
let mockNextResults = {};

jest.mock('../../../utils/supabaseClient.js', () => {
  const makeChain = (table) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      gte: () => chain,
      lte: () => chain,
      then: (resolve, reject) => {
        const result = mockNextResults[table] ?? { data: [], error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
      catch: (reject) => {
        const result = mockNextResults[table] ?? { data: [], error: null };
        return Promise.resolve(result).catch(reject);
      },
    };
    return chain;
  };
  const stubClient = { from: (table) => makeChain(table) };
  return {
    __esModule: true,
    getSupabaseClient: () => stubClient,
    default: () => stubClient,
    getISTTimestamp: () => '2025-05-18 00:00:00.000',
  };
});

// Silence the logger so failed-query tests don't pollute output.
jest.mock('../../../shared/lib/logger.js', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import handler from '../../../pages/api/water/intake.js';

function makeRes() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

function makeReq(method, query = {}) {
  return { method, query, body: undefined };
}

beforeEach(() => {
  mockNextResults = {};
});

describe('GET /api/water/intake — integration', () => {
  it('returns 200 with computed intake for a happy-path request', async () => {
    mockNextResults.weight_records_table = {
      data: [{ Weight: 80, CreatedAt: '2025-05-18T08:00:00' }],
      error: null,
    };
    mockNextResults.food_nutrition_data_table = {
      data: [
        {
          CreatedAt: '2025-05-18T09:00:00',
          AnalysisData: JSON.stringify({
            foods: [{ name: 'Water', volume_ml: 500 }],
          }),
        },
        {
          CreatedAt: '2025-05-18T11:00:00',
          AnalysisData: { foods: [{ name: 'Water', volume_ml: 250 }] },
        },
      ],
      error: null,
    };

    const req = makeReq('GET', { userId: '42', date: '2025-05-18' });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      date: '2025-05-18',
      userId: 42,
      weightKg: 80,
      defaultWeight: false,
      requiredMl: 4000, // 80 * 50
      totalMl: 750,
      remainingMl: 3250,
      achieved: false,
      logCount: 2,
    });
    expect(res.body.progressPercent).toBe(19); // round(750/4000 * 100)
  });

  it('returns 400 when userId is missing (validation surfaces as ValidationError → JSON)', async () => {
    const req = makeReq('GET', {});
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'userId is required' });
  });

  it('returns 400 when date format is invalid', async () => {
    const req = makeReq('GET', { userId: '1', date: '18-05-2025' });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'date must be in YYYY-MM-DD format',
    });
  });

  it('returns 405 for non-GET methods', async () => {
    const req = makeReq('POST', { userId: '1' });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ message: 'Method not allowed' });
  });

  it('handles OPTIONS preflight with 200 and CORS headers', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('falls back to DEFAULT_REQUIRED_ML (2500) when weight row is missing', async () => {
    mockNextResults.weight_records_table = { data: [], error: null };
    mockNextResults.food_nutrition_data_table = { data: [], error: null };

    const req = makeReq('GET', { userId: '7', date: '2025-05-18' });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      requiredMl: 2500,
      defaultWeight: true,
      weightKg: null,
      totalMl: 0,
      remainingMl: 2500,
      achieved: false,
      logCount: 0,
    });
  });

  it('treats a weight-query error as no weight (graceful degradation)', async () => {
    mockNextResults.weight_records_table = { data: null, error: { message: 'db down' } };
    mockNextResults.food_nutrition_data_table = { data: [], error: null };

    const req = makeReq('GET', { userId: '7', date: '2025-05-18' });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.defaultWeight).toBe(true);
    expect(res.body.requiredMl).toBe(2500);
  });

  it('treats a food-query error as empty logs', async () => {
    mockNextResults.weight_records_table = {
      data: [{ Weight: 60, CreatedAt: '2025-05-18T08:00:00' }],
      error: null,
    };
    mockNextResults.food_nutrition_data_table = {
      data: null,
      error: { message: 'db down' },
    };

    const req = makeReq('GET', { userId: '7', date: '2025-05-18' });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.totalMl).toBe(0);
    expect(res.body.logCount).toBe(0);
    expect(res.body.requiredMl).toBe(3000); // 60 * 50
  });
});
