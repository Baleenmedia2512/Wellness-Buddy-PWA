/**
 * Unit tests — RetryPolicy (withEnterpriseRetry)
 *
 * Fake timers control all backoff delays so the suite runs instantly.
 * Circuit breaker usage is disabled (useCircuitBreaker: false) for most
 * cases so we isolate the retry logic; a separate group tests integration
 * with the breaker.
 */
import { withEnterpriseRetry } from '../../lib/ai-orchestration/RetryPolicy.js';
import logger from '../../lib/logger.js';

// ── Silence logger ────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.spyOn(logger, 'info').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRetryable(status = 500) {
  const err = new Error('server error');
  err.status = status;
  return err;
}

function makeNonRetryable() {
  return new Error('bad input');          // no status code → not in RETRYABLE_CODES
}

const BASE_OPTS = {
  useCircuitBreaker: false,
  baseDelayMs:       1,        // near-zero so fake timers are not needed for most tests
  maxDelayMs:        10,
  timeoutMs:         0,        // disable per-attempt timeout for most unit tests
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('withEnterpriseRetry — success on first attempt', () => {
  it('resolves immediately and returns attempts=1', async () => {
    const fn = jest.fn().mockResolvedValue('value');
    const { result, attempts } = await withEnterpriseRetry(fn, { ...BASE_OPTS, label: 'test' });
    expect(result).toBe('value');
    expect(attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns totalLatencyMs >= 0', async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const { totalLatencyMs } = await withEnterpriseRetry(fn, { ...BASE_OPTS, label: 'test' });
    expect(totalLatencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('withEnterpriseRetry — retryable errors', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('retries on 500 and succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeRetryable(500))
      .mockResolvedValue('ok');

    const promise = withEnterpriseRetry(fn, { ...BASE_OPTS, maxAttempts: 3, label: 'test' });
    // Allow microtasks + timers to process
    await jest.runAllTimersAsync();
    const { result, attempts } = await promise;
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('retries on 429 (rate-limit)', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeRetryable(429))
      .mockResolvedValue('ok');

    const promise = withEnterpriseRetry(fn, { ...BASE_OPTS, maxAttempts: 2, label: 'test' });
    await jest.runAllTimersAsync();
    const { attempts } = await promise;
    expect(attempts).toBe(2);
  });

  it('retries on TIMEOUT code', async () => {
    const timeoutErr = Object.assign(new Error('timed out'), { code: 'TIMEOUT' });
    const fn = jest.fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValue('ok');

    const promise = withEnterpriseRetry(fn, { ...BASE_OPTS, maxAttempts: 2, label: 'test' });
    await jest.runAllTimersAsync();
    const { attempts } = await promise;
    expect(attempts).toBe(2);
  });

  it('exhausts all attempts and throws the last error', async () => {
    const fn = jest.fn().mockRejectedValue(makeRetryable(503));

    const promise = withEnterpriseRetry(fn, { ...BASE_OPTS, maxAttempts: 3, label: 'test' });
    await jest.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('withEnterpriseRetry — non-retryable errors', () => {
  it('does NOT retry a non-retryable error', async () => {
    const fn = jest.fn().mockRejectedValue(makeNonRetryable());
    await expect(withEnterpriseRetry(fn, { ...BASE_OPTS, maxAttempts: 3, label: 'test' }))
      .rejects.toThrow('bad input');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry CIRCUIT_OPEN', async () => {
    const err = Object.assign(new Error('breaker open'), { code: 'CIRCUIT_OPEN' });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withEnterpriseRetry(fn, { ...BASE_OPTS, maxAttempts: 3, label: 'test' }))
      .rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withEnterpriseRetry — per-attempt timeout', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('rejects with TIMEOUT code when fn takes longer than timeoutMs', async () => {
    // A function that never resolves
    const fn = jest.fn(() => new Promise(() => {}));

    const promise = withEnterpriseRetry(fn, {
      ...BASE_OPTS,
      useCircuitBreaker: false,
      maxAttempts: 1,
      timeoutMs:   100,
      label:       'timeout-test',
    });

    jest.advanceTimersByTime(200);
    await expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('withEnterpriseRetry — circuit breaker integration', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('does NOT retry when the circuit breaker throws CIRCUIT_OPEN', async () => {
    // By using a fresh unique service name we get a fresh breaker
    const service = `test-breaker-${Date.now()}`;
    const retryable = makeRetryable(500);
    const fn = jest.fn().mockRejectedValue(retryable);

    // Exhaust the default failureThreshold (5) to open the breaker
    for (let i = 0; i < 5; i += 1) {
      const p = withEnterpriseRetry(fn, {
        service,
        maxAttempts: 1,
        baseDelayMs: 1,
        maxDelayMs:  1,
        timeoutMs:   0,
        label:       'cb-open',
      });
      await jest.runAllTimersAsync();
      await p.catch(() => {});
    }

    // Now the breaker should be OPEN — next call throws immediately
    fn.mockClear();
    const openPromise = withEnterpriseRetry(fn, {
      service,
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs:  1,
      timeoutMs:   0,
      label:       'cb-reject',
    });
    await jest.runAllTimersAsync();
    await expect(openPromise).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    expect(fn).not.toHaveBeenCalled(); // fn never called — rejected by breaker
  });
});
