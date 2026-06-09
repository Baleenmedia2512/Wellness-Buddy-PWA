/**
 * Unit tests for the captures state machine.
 * PURE — no mocks, no I/O. Target: 100 % lines / 100 % branches.
 */
import {
  IMAGE_TYPES,
  IMAGE_TYPE_PENDING,
  IMAGE_TYPE_FOOD,
  IMAGE_TYPE_WEIGHT,
  IMAGE_TYPE_EDUCATION,
  IMAGE_TYPE_SMARTWATCH,
  IMAGE_TYPE_UNKNOWN,
  TERMINAL_IMAGE_TYPES,
  isValidImageType,
  isTerminal,
  canTransition,
  assertCanTransition,
} from '../domain/image-types.js';

describe('IMAGE_TYPES enum', () => {
  it('contains exactly the six expected types', () => {
    expect(IMAGE_TYPES).toEqual([
      'pending', 'food', 'weight', 'education', 'smartwatch', 'unknown',
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(IMAGE_TYPES)).toBe(true);
    expect(Object.isFrozen(TERMINAL_IMAGE_TYPES)).toBe(true);
  });
});

describe('isValidImageType', () => {
  it.each(IMAGE_TYPES)('accepts %s', (t) => {
    expect(isValidImageType(t)).toBe(true);
  });
  it.each(['', null, undefined, 42, 'FOOD', 'foo', ' food '])('rejects %p', (t) => {
    expect(isValidImageType(t)).toBe(false);
  });
});

describe('isTerminal', () => {
  it.each([IMAGE_TYPE_FOOD, IMAGE_TYPE_WEIGHT, IMAGE_TYPE_EDUCATION, IMAGE_TYPE_SMARTWATCH, IMAGE_TYPE_UNKNOWN])(
    'returns true for terminal type %s', (t) => {
      expect(isTerminal(t)).toBe(true);
    },
  );
  it('returns false for pending', () => {
    expect(isTerminal(IMAGE_TYPE_PENDING)).toBe(false);
  });
  it('returns false for invalid input', () => {
    expect(isTerminal('foo')).toBe(false);
  });
});

describe('canTransition', () => {
  it.each(TERMINAL_IMAGE_TYPES)('allows pending → %s', (to) => {
    expect(canTransition(IMAGE_TYPE_PENDING, to)).toBe(true);
  });

  it.each(TERMINAL_IMAGE_TYPES)('rejects %s → pending (terminal is immutable)', (from) => {
    expect(canTransition(from, IMAGE_TYPE_PENDING)).toBe(false);
  });

  // PR-A / ADR-0003 — permitted terminal→terminal transitions for Diary Edit flow.
  it('allows unknown → food (PR-A: Diary Retry/Edit promotion)', () => {
    expect(canTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_FOOD)).toBe(true);
  });

  it('allows unknown → weight (ADR-0003: Diary Edit promotion)', () => {
    expect(canTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_WEIGHT)).toBe(true);
  });

  it('allows unknown → education (ADR-0003: Diary Edit promotion)', () => {
    expect(canTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_EDUCATION)).toBe(true);
  });

  it('rejects unknown → smartwatch (only food/weight/education allowed from unknown)', () => {
    expect(canTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_SMARTWATCH)).toBe(false);
  });

  it('rejects unknown → unknown (same-state no-op)', () => {
    expect(canTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_UNKNOWN)).toBe(false);
  });

  it('rejects food → unknown (food is immutable, no demotion path)', () => {
    expect(canTransition(IMAGE_TYPE_FOOD, IMAGE_TYPE_UNKNOWN)).toBe(false);
  });

  it('rejects all other terminal → terminal transitions', () => {
    // Build the matrix excluding the three allowed unknown→food/weight/education edges.
    for (const from of TERMINAL_IMAGE_TYPES) {
      for (const to of TERMINAL_IMAGE_TYPES) {
        const isAllowedException =
          (from === IMAGE_TYPE_UNKNOWN && to === IMAGE_TYPE_FOOD) ||
          (from === IMAGE_TYPE_UNKNOWN && to === IMAGE_TYPE_WEIGHT) ||
          (from === IMAGE_TYPE_UNKNOWN && to === IMAGE_TYPE_EDUCATION);
        if (isAllowedException) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it('rejects pending → pending', () => {
    expect(canTransition(IMAGE_TYPE_PENDING, IMAGE_TYPE_PENDING)).toBe(false);
  });

  it('rejects when either side is invalid', () => {
    expect(canTransition('foo', IMAGE_TYPE_FOOD)).toBe(false);
    expect(canTransition(IMAGE_TYPE_PENDING, 'foo')).toBe(false);
    expect(canTransition(null, IMAGE_TYPE_FOOD)).toBe(false);
    expect(canTransition(IMAGE_TYPE_PENDING, null)).toBe(false);
  });
});

describe('assertCanTransition', () => {
  it('does not throw on a legal transition', () => {
    expect(() => assertCanTransition(IMAGE_TYPE_PENDING, IMAGE_TYPE_FOOD)).not.toThrow();
  });

  it('does not throw on unknown → food (PR-A)', () => {
    expect(() => assertCanTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_FOOD)).not.toThrow();
  });

  it('does not throw on unknown → weight (ADR-0003 Diary Edit)', () => {
    expect(() => assertCanTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_WEIGHT)).not.toThrow();
  });

  it('does not throw on unknown → education (ADR-0003 Diary Edit)', () => {
    expect(() => assertCanTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_EDUCATION)).not.toThrow();
  });

  it('throws with status 409 + INVALID_STATE_TRANSITION on illegal transition', () => {
    try {
      assertCanTransition(IMAGE_TYPE_FOOD, IMAGE_TYPE_WEIGHT);
      throw new Error('expected throw');
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.code).toBe('INVALID_STATE_TRANSITION');
      expect(err.message).toMatch(/food → weight/);
      expect(err.message).toMatch(/unknown.*food.*weight.*education/); // mentions allowed exceptions
    }
  });

  it('throws on unknown → watch (only food/weight/education allowed from unknown)', () => {
    expect(() => assertCanTransition(IMAGE_TYPE_UNKNOWN, IMAGE_TYPE_SMARTWATCH))
      .toThrow(/unknown → smartwatch/);
  });

  it('throws on invalid types too', () => {
    expect(() => assertCanTransition('foo', 'bar')).toThrow();
  });
});
