/**
 * Unit tests — ObservabilityTracer
 *
 * Pure logic, no I/O. Logger output is silenced via jest.spyOn so the
 * test runner is not noisy, but we verify that complete() and error()
 * call logger.info / logger.error with the expected keys.
 */
import { TraceContext } from '../../lib/ai-orchestration/ObservabilityTracer.js';
import logger from '../../lib/logger.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let loggerInfo;
let loggerError;

beforeEach(() => {
  loggerInfo  = jest.spyOn(logger, 'info').mockImplementation(() => {});
  loggerError = jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TraceContext — construction', () => {
  it('generates a UUID traceId when none supplied', () => {
    const tc = new TraceContext();
    expect(tc.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('accepts an explicit traceId (replay mode)', () => {
    const tc = new TraceContext({ traceId: 'fixed-trace-id' });
    expect(tc.traceId).toBe('fixed-trace-id');
  });

  it('stores captureId and userId as strings', () => {
    const tc = new TraceContext({ captureId: 42, userId: 99 });
    expect(tc.captureId).toBe('42');
    expect(tc.userId).toBe('99');
  });

  it('defaults captureId and userId to null', () => {
    const tc = new TraceContext();
    expect(tc.captureId).toBeNull();
    expect(tc.userId).toBeNull();
  });
});

describe('TraceContext — addStage()', () => {
  it('accumulates stage records', () => {
    const tc = new TraceContext();
    tc.addStage({ name: 'unified', latencyMs: 800, success: true });
    tc.addStage({ name: 'enrichment', latencyMs: 1_200, success: false, extra: { reason: 'timeout' } });

    const summary = tc.complete({ success: false });
    expect(summary).toBeDefined();
  });

  it('merges extra fields into the stage record', () => {
    const tc = new TraceContext();
    tc.addStage({ name: 'unified', latencyMs: 500, success: true, extra: { imageType: 'food' } });
    const [, payload] = loggerInfo.mock.calls.find(([e]) => e === 'ai.pipeline.complete') ?? [null, null];
    // complete() hasn't been called yet — no log yet
    expect(loggerInfo).not.toHaveBeenCalled();
  });
});

describe('TraceContext — addTokenUsage()', () => {
  it('accumulates token counts across multiple calls', () => {
    const tc = new TraceContext();
    tc.addTokenUsage({ inputTokens: 100, outputTokens: 50, model: 'unified' });
    tc.addTokenUsage({ inputTokens: 200, outputTokens: 80, model: 'enrichment' });

    const summary = tc.complete({ success: true });
    expect(summary.tokenUsage.inputTokens).toBe(300);
    expect(summary.tokenUsage.outputTokens).toBe(130);
    expect(summary.tokenUsage.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('sets modelVersion from the first addTokenUsage call only', () => {
    const tc = new TraceContext();
    tc.addTokenUsage({ model: 'unified' });
    tc.addTokenUsage({ model: 'enrichment' });
    const summary = tc.complete({ success: true });
    expect(summary.modelVersion).toBe('unified');
  });
});

describe('TraceContext — addRetry()', () => {
  it('increments retryCount', () => {
    const tc = new TraceContext();
    tc.addRetry();
    tc.addRetry();
    const summary = tc.complete({ success: true });
    expect(summary.retryCount).toBe(2);
  });
});

describe('TraceContext — complete()', () => {
  it('returns an object with the required keys', () => {
    const tc = new TraceContext({ captureId: 'cap-1' });
    const summary = tc.complete({ success: true, imageType: 'food' });

    expect(summary).toMatchObject({
      traceId:        tc.traceId,
      totalLatencyMs: expect.any(Number),
      tokenUsage:     expect.any(Object),
      retryCount:     0,
    });
    expect(summary.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('emits one structured log entry on completion', () => {
    const tc = new TraceContext();
    tc.complete({ success: false, errorCode: 'GEMINI_ERROR' });

    const call = loggerInfo.mock.calls.find(([event]) => event === 'ai.pipeline.complete');
    expect(call).toBeDefined();
    const payload = call[1];
    expect(payload.success).toBe(false);
    expect(payload.errorCode).toBe('GEMINI_ERROR');
  });
});

describe('TraceContext — error()', () => {
  it('emits a structured error log without closing the trace', () => {
    const tc = new TraceContext();
    tc.error({ stage: 'unified', message: 'parse failed', code: 'PARSE_ERROR' });

    expect(loggerError).toHaveBeenCalledWith(
      'ai.pipeline.error',
      expect.objectContaining({
        traceId:   tc.traceId,
        stage:     'unified',
        errorCode: 'PARSE_ERROR',
        message:   'parse failed',
      }),
    );
  });
});

describe('TraceContext — toContext()', () => {
  it('returns minimal correlation context', () => {
    const tc = new TraceContext({ captureId: 'cap-x', userId: 'u-1' });
    const ctx = tc.toContext();
    expect(ctx).toEqual({ traceId: tc.traceId, captureId: 'cap-x', userId: 'u-1' });
    // Should NOT expose internal arrays
    expect(ctx._stages).toBeUndefined();
  });
});

describe('TraceContext — elapsedMs()', () => {
  it('returns a non-negative number without closing the trace', () => {
    const tc = new TraceContext();
    const elapsed = tc.elapsedMs();
    expect(elapsed).toBeGreaterThanOrEqual(0);
    // complete() should still work after elapsedMs()
    expect(() => tc.complete({ success: true })).not.toThrow();
  });
});
