import {
  validateSaveUsage,
  validateSaveCorrection,
  validateGetUsage,
  validateGetPricing,
  validateGetCorrection,
  validateLatestCosts,
  validateReverseLookup,
} from '../token.validators.js';

function expectValidationError(fn, status, messageSubstring) {
  let caught;
  try { fn(); } catch (e) { caught = e; }
  expect(caught).toBeDefined();
  expect(caught.statusCode || caught.status).toBe(status);
  if (messageSubstring) {
    expect(String(caught.message)).toEqual(expect.stringContaining(messageSubstring));
  }
}

const fullUsage = {
  userId: 'u1', email: 'a@b.com',
  operationType: 'analyze', modelName: 'gemini-2.5-flash-lite',
  inputTokens: 10, outputTokens: 5, totalTokens: 15,
  inputTokenCost: 0.001, outputTokenCost: 0.0005, totalTokenCost: 0.0015,
};

describe('token.validators · validateSaveUsage', () => {
  it('passes through a fully-populated body', () => {
    expect(validateSaveUsage(fullUsage)).toEqual(fullUsage);
  });

  it('accepts zero token counts (truthy check would wrongly reject 0)', () => {
    const out = validateSaveUsage({ ...fullUsage, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    expect(out.inputTokens).toBe(0);
    expect(out.outputTokens).toBe(0);
    expect(out.totalTokens).toBe(0);
  });

  it.each([
    ['null body', null, 'Request body is missing'],
    ['missing userId', { ...fullUsage, userId: undefined }, 'userId and email are required'],
    ['missing email', { ...fullUsage, email: undefined }, 'userId and email are required'],
    ['missing operationType', { ...fullUsage, operationType: undefined }, 'operationType and modelName are required'],
    ['missing modelName', { ...fullUsage, modelName: undefined }, 'operationType and modelName are required'],
    ['missing inputTokens', { ...fullUsage, inputTokens: undefined }, 'Token counts'],
    ['missing outputTokens', { ...fullUsage, outputTokens: undefined }, 'Token counts'],
    ['missing totalTokens', { ...fullUsage, totalTokens: undefined }, 'Token counts'],
  ])('rejects when %s', (_label, body, msg) => {
    expectValidationError(() => validateSaveUsage(body), 400, msg);
  });
});

describe('token.validators · validateSaveCorrection', () => {
  it('returns the body unchanged when all required fields present', () => {
    const body = { email: 'a@b.com', correctedInputCost: 0.002, correctedOutputCost: 0.001, extra: 'kept' };
    expect(validateSaveCorrection(body)).toEqual(body);
  });

  it('accepts zero costs', () => {
    const body = { email: 'a@b.com', correctedInputCost: 0, correctedOutputCost: 0 };
    expect(validateSaveCorrection(body)).toEqual(body);
  });

  it.each([
    ['null body', null, 'Request body is missing'],
    ['missing email', { correctedInputCost: 1, correctedOutputCost: 1 }, 'Missing required fields'],
    ['missing correctedInputCost', { email: 'a@b.com', correctedOutputCost: 1 }, 'Missing required fields'],
    ['missing correctedOutputCost', { email: 'a@b.com', correctedInputCost: 1 }, 'Missing required fields'],
  ])('rejects when %s', (_label, body, msg) => {
    expectValidationError(() => validateSaveCorrection(body), 400, msg);
  });
});

describe('token.validators · validateGetUsage', () => {
  it('defaults timeRange to "month" and passes through optional filters', () => {
    const out = validateGetUsage({
      email: 'a@b.com',
      operationType: 'analyze',
      model: 'gemini',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      userToday: '2026-05-18',
    });
    expect(out).toEqual({
      email: 'a@b.com',
      timeRange: 'month',
      operationType: 'analyze',
      model: 'gemini',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      userToday: '2026-05-18',
    });
  });

  it('respects explicit timeRange', () => {
    expect(validateGetUsage({ email: 'a@b.com', timeRange: 'week' }).timeRange).toBe('week');
  });

  it.each([
    ['null query', null],
    ['empty query', {}],
    ['missing email', { timeRange: 'month' }],
  ])('rejects when %s', (_label, q) => {
    expectValidationError(() => validateGetUsage(q), 400, 'Email is required');
  });
});

describe('token.validators · validateGetPricing', () => {
  it('defaults modelName to gemini-2.5-flash-lite', () => {
    expect(validateGetPricing({ email: 'a@b.com' }))
      .toEqual({ email: 'a@b.com', modelName: 'gemini-2.5-flash-lite' });
  });

  it('respects explicit modelName', () => {
    expect(validateGetPricing({ email: 'a@b.com', modelName: 'gpt-4o' }).modelName).toBe('gpt-4o');
  });

  it.each([
    ['null query', null],
    ['missing email', {}],
  ])('rejects when %s', (_label, q) => {
    expectValidationError(() => validateGetPricing(q), 400, 'Missing required parameter: email');
  });
});

describe('token.validators · validateGetCorrection', () => {
  it('passes through all optional date filters', () => {
    const out = validateGetCorrection({
      email: 'a@b.com', timeRange: 'week',
      startDate: '2026-05-01', endDate: '2026-05-07',
    });
    expect(out).toEqual({
      email: 'a@b.com', timeRange: 'week',
      startDate: '2026-05-01', endDate: '2026-05-07',
    });
  });

  it('returns undefined for unspecified optional fields (not throws)', () => {
    const out = validateGetCorrection({ email: 'a@b.com' });
    expect(out.email).toBe('a@b.com');
    expect(out.timeRange).toBeUndefined();
  });

  it.each([
    ['null query', null],
    ['missing email', {}],
  ])('rejects when %s', (_label, q) => {
    expectValidationError(() => validateGetCorrection(q), 400, 'Email parameter is required');
  });
});

describe('token.validators · validateLatestCosts', () => {
  it('returns email when present', () => {
    expect(validateLatestCosts({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' });
  });

  it.each([
    ['null query', null],
    ['missing email', {}],
  ])('rejects when %s', (_label, q) => {
    expectValidationError(() => validateLatestCosts(q), 400, 'Email is required');
  });
});

describe('token.validators · validateReverseLookup', () => {
  it('returns correctedName when present', () => {
    expect(validateReverseLookup({ correctedName: 'Paneer' }))
      .toEqual({ correctedName: 'Paneer' });
  });

  it.each([
    ['null query', null],
    ['missing correctedName', {}],
    ['empty correctedName', { correctedName: '' }],
  ])('rejects when %s', (_label, q) => {
    expectValidationError(() => validateReverseLookup(q), 400, 'Missing required parameter: correctedName');
  });
});
