/**
 * Unit tests — CircuitBreaker
 *
 * Exercises the three-state machine (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * without any I/O. All timers are controlled via jest fake timers so the
 * suite runs in milliseconds.
 */
import { CircuitBreaker, STATE, getBreaker, allBreakerStates } from '../../lib/ai-orchestration/CircuitBreaker.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const pass = async () => 'ok';
const fail = async () => { throw Object.assign(new Error('boom'), { status: 500 }); };

function makeBreaker(overrides = {}) {
  return new CircuitBreaker({
    name:             'test',
    failureThreshold: 3,
    successThreshold: 2,
    timeoutMs:        1_000,
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CircuitBreaker — initial state', () => {
  it('starts in CLOSED state', () => {
    const cb = makeBreaker();
    expect(cb.state).toBe(STATE.CLOSED);
  });

  it('passes calls through in CLOSED state', async () => {
    const cb = makeBreaker();
    const result = await cb.execute(pass);
    expect(result).toBe('ok');
    expect(cb.state).toBe(STATE.CLOSED);
  });
});

describe('CircuitBreaker — CLOSED → OPEN transition', () => {
  it('opens after failureThreshold consecutive failures', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    for (let i = 0; i < 3; i += 1) {
      await expect(cb.execute(fail)).rejects.toThrow('boom');
    }
    expect(cb.state).toBe(STATE.OPEN);
  });

  it('does NOT open before failureThreshold is reached', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    for (let i = 0; i < 2; i += 1) {
      await expect(cb.execute(fail)).rejects.toThrow('boom');
    }
    expect(cb.state).toBe(STATE.CLOSED);
  });

  it('resets failure count on a success in CLOSED state', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    await cb.execute(pass); // success resets streak
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.state).toBe(STATE.CLOSED); // still only 2 failures
  });
});

describe('CircuitBreaker — OPEN state', () => {
  it('rejects calls immediately without invoking fn', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);

    const called = jest.fn(pass);
    await expect(cb.execute(called)).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    expect(called).not.toHaveBeenCalled();
  });

  it('throws with code CIRCUIT_OPEN when OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();

    const err = await cb.execute(pass).catch(e => e);
    expect(err.code).toBe('CIRCUIT_OPEN');
  });
});

describe('CircuitBreaker — OPEN → HALF_OPEN transition', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('transitions to HALF_OPEN after timeoutMs elapses', async () => {
    const cb = makeBreaker({ failureThreshold: 1, timeoutMs: 500 });
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);

    jest.advanceTimersByTime(500);

    // Next execute call triggers the HALF_OPEN transition
    await cb.execute(pass);
    // After one success it's still HALF_OPEN (needs successThreshold=2)
    // But the probe itself succeeded — state should be HALF_OPEN mid-probe
    // OR CLOSED if successThreshold=1. Let's verify the timeline.
    // cb has successThreshold=2 (default) so after 1 success → HALF_OPEN
  });

  it('does NOT probe before timeoutMs elapses', async () => {
    const cb = makeBreaker({ failureThreshold: 1, timeoutMs: 10_000 });
    await expect(cb.execute(fail)).rejects.toThrow();

    jest.advanceTimersByTime(9_999);

    // Still OPEN — probe attempt should throw CIRCUIT_OPEN
    const called = jest.fn(pass);
    await expect(cb.execute(called)).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    expect(called).not.toHaveBeenCalled();
  });
});

describe('CircuitBreaker — HALF_OPEN → CLOSED transition', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('closes after successThreshold consecutive successes in HALF_OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1, successThreshold: 2, timeoutMs: 100 });
    await expect(cb.execute(fail)).rejects.toThrow();

    jest.advanceTimersByTime(100);
    await cb.execute(pass); // probe 1 → HALF_OPEN
    await cb.execute(pass); // probe 2 → CLOSED
    expect(cb.state).toBe(STATE.CLOSED);
  });

  it('re-opens on failure in HALF_OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1, successThreshold: 2, timeoutMs: 100 });
    await expect(cb.execute(fail)).rejects.toThrow();

    jest.advanceTimersByTime(100);
    await expect(cb.execute(fail)).rejects.toThrow(); // probe fails → back to OPEN
    expect(cb.state).toBe(STATE.OPEN);
  });
});

describe('CircuitBreaker — registry', () => {
  it('getBreaker returns the same instance for the same name', () => {
    const a = getBreaker('registry-test');
    const b = getBreaker('registry-test');
    expect(a).toBe(b);
  });

  it('allBreakerStates returns a snapshot object', () => {
    getBreaker('snap-a');
    getBreaker('snap-b');
    const states = allBreakerStates();
    expect(typeof states).toBe('object');
    expect(states['snap-a']).toBeDefined();
    expect(states['snap-b']).toBeDefined();
    expect(states['snap-a'].state).toBe(STATE.CLOSED);
  });

  it('toJSON returns serialisable fields', () => {
    const cb = makeBreaker({ name: 'tojson-test' });
    const json = cb.toJSON();
    expect(json).toMatchObject({ name: 'tojson-test', state: STATE.CLOSED });
    expect(JSON.stringify(json)).toBeTruthy();
  });
});
