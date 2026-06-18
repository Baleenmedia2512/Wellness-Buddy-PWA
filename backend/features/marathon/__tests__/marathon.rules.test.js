/**
 * marathon.rules.test.js — Unit tests for marathon domain logic.
 *
 * Pure functions only — no mocks, no I/O.
 * Coverage targets match the Pattern-A requirement: ≥95% line coverage on domain/.
 */
import {
  computeLapAndDay,
  lapStartDate,
  computeWeightChange,
  changeToGrams,
  formatWeightChange,
  findDayLeader,
  findLapLeader,
  isShareValid,
  buildCardSnapshot,
  computeTeamDailyTotal,
  CARD_TYPES,
} from '../domain/marathon.rules.js';

// ─────────────────────────────────────────────────────────────────────────────
// computeLapAndDay
// ─────────────────────────────────────────────────────────────────────────────
describe('computeLapAndDay', () => {
  const start = '2024-01-01'; // day 0

  it('returns lap 1 day 1 on the start date', () => {
    const result = computeLapAndDay(start, 10, new Date('2024-01-01'));
    expect(result).toEqual({ lapNumber: 1, dayNumber: 1, totalDaysElapsed: 0 });
  });

  it('returns lap 1 day 5 after 4 days', () => {
    const result = computeLapAndDay(start, 10, new Date('2024-01-05'));
    expect(result).toEqual({ lapNumber: 1, dayNumber: 5, totalDaysElapsed: 4 });
  });

  it('returns lap 2 day 1 on day 10', () => {
    const result = computeLapAndDay(start, 10, new Date('2024-01-11'));
    expect(result).toEqual({ lapNumber: 2, dayNumber: 1, totalDaysElapsed: 10 });
  });

  it('returns lap 7 day 1 after 60 days with 10 days/lap', () => {
    const result = computeLapAndDay(start, 10, new Date('2024-03-01')); // 60 days
    expect(result.lapNumber).toBe(7);
    expect(result.dayNumber).toBe(1);
  });

  it('clamps elapsed days to 0 if now is before start', () => {
    const result = computeLapAndDay(start, 10, new Date('2023-12-31'));
    expect(result).toEqual({ lapNumber: 1, dayNumber: 1, totalDaysElapsed: 0 });
  });

  it('handles different daysPerLap values', () => {
    // 5-day laps, 15 days elapsed → lap 4, day 1
    const result = computeLapAndDay(start, 5, new Date('2024-01-16'));
    expect(result.lapNumber).toBe(4);
    expect(result.dayNumber).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lapStartDate
// ─────────────────────────────────────────────────────────────────────────────
describe('lapStartDate', () => {
  it('returns start date for lap 1', () => {
    const d = lapStartDate('2024-01-01', 10, 1);
    expect(d.toISOString().substring(0, 10)).toBe('2024-01-01');
  });

  it('returns correct date for lap 2', () => {
    const d = lapStartDate('2024-01-01', 10, 2);
    expect(d.toISOString().substring(0, 10)).toBe('2024-01-11');
  });

  it('returns correct date for lap 7 (6 × 10 days offset)', () => {
    const d = lapStartDate('2024-01-01', 10, 7);
    expect(d.toISOString().substring(0, 10)).toBe('2024-03-01');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeWeightChange
// ─────────────────────────────────────────────────────────────────────────────
describe('computeWeightChange', () => {
  it('returns negative value for weight loss', () => {
    expect(computeWeightChange(70, 70.7)).toBeCloseTo(-0.7, 2);
  });

  it('returns positive value for weight gain', () => {
    expect(computeWeightChange(71, 70)).toBeCloseTo(1, 2);
  });

  it('returns 0 when weights are equal', () => {
    expect(computeWeightChange(70, 70)).toBe(0);
  });

  it('returns null when currentWeight is null', () => {
    expect(computeWeightChange(null, 70)).toBeNull();
  });

  it('returns null when referenceWeight is null', () => {
    expect(computeWeightChange(70, null)).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(computeWeightChange(null, null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changeToGrams
// ─────────────────────────────────────────────────────────────────────────────
describe('changeToGrams', () => {
  it('converts -0.7 kg to -700 grams', () => {
    expect(changeToGrams(-0.7)).toBe(-700);
  });

  it('converts 0.55 kg to 550 grams', () => {
    expect(changeToGrams(0.55)).toBe(550);
  });

  it('returns null for null input', () => {
    expect(changeToGrams(null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatWeightChange
// ─────────────────────────────────────────────────────────────────────────────
describe('formatWeightChange', () => {
  it('formats -0.7 as "-0.70 KG"', () => {
    expect(formatWeightChange(-0.7)).toBe('-0.70 KG');
  });

  it('formats 0.55 as "+0.55 KG"', () => {
    expect(formatWeightChange(0.55)).toBe('+0.55 KG');
  });

  it('formats 0 as "0.00 KG"', () => {
    expect(formatWeightChange(0)).toBe('0.00 KG');
  });

  it('formats null as "—"', () => {
    expect(formatWeightChange(null)).toBe('—');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findDayLeader
// ─────────────────────────────────────────────────────────────────────────────
describe('findDayLeader', () => {
  const p = (userId, dailyChange) => ({ userId, dailyChange, name: `User ${userId}` });

  it('returns the participant with the most negative dailyChange', () => {
    const participants = [p(1, -0.3), p(2, -0.7), p(3, -0.5)];
    expect(findDayLeader(participants).userId).toBe(2);
  });

  it('returns null when no participant has a negative change', () => {
    const participants = [p(1, 0.3), p(2, null), p(3, 0)];
    expect(findDayLeader(participants)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(findDayLeader([])).toBeNull();
  });

  it('breaks ties by lower userId', () => {
    const participants = [p(5, -0.7), p(2, -0.7)];
    expect(findDayLeader(participants).userId).toBe(2);
  });

  it('ignores participants with null dailyChange', () => {
    const participants = [p(1, null), p(2, -0.3)];
    expect(findDayLeader(participants).userId).toBe(2);
  });

  it('ignores participants with zero change (no loss)', () => {
    const participants = [p(1, 0), p(2, -0.1)];
    expect(findDayLeader(participants).userId).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findLapLeader
// ─────────────────────────────────────────────────────────────────────────────
describe('findLapLeader', () => {
  const p = (userId, lapChange) => ({ userId, lapChange, name: `User ${userId}` });

  it('returns the participant with the most negative lapChange', () => {
    const participants = [p(1, -1.5), p(2, -3.2), p(3, -2.0)];
    expect(findLapLeader(participants).userId).toBe(2);
  });

  it('returns null when no participant has a negative lap change', () => {
    expect(findLapLeader([p(1, 0), p(2, null)])).toBeNull();
  });

  it('breaks ties by lower userId', () => {
    expect(findLapLeader([p(9, -2), p(3, -2)]).userId).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isShareValid
// ─────────────────────────────────────────────────────────────────────────────
describe('isShareValid', () => {
  it('returns true for future expiry', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isShareValid(future)).toBe(true);
  });

  it('returns false for past expiry', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isShareValid(past)).toBe(false);
  });

  it('returns false for null expiry', () => {
    expect(isShareValid(null)).toBe(false);
  });

  it('accepts injectable clock', () => {
    const expiry = '2024-01-10T00:00:00Z';
    expect(isShareValid(expiry, new Date('2024-01-09'))).toBe(true);
    expect(isShareValid(expiry, new Date('2024-01-11'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCardSnapshot
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCardSnapshot', () => {
  it('includes cardType, generatedAt, and live data', () => {
    const snap = buildCardSnapshot('day_leader', { lapNumber: 3, dayNumber: 2 });
    expect(snap.cardType).toBe('day_leader');
    expect(snap.lapNumber).toBe(3);
    expect(snap.generatedAt).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTeamDailyTotal
// ─────────────────────────────────────────────────────────────────────────────
describe('computeTeamDailyTotal', () => {
  it('sums changes correctly (negative + negative)', () => {
    const participants = [
      { dailyChange: -0.7 },
      { dailyChange: -0.55 },
      { dailyChange: -0.3 },
    ];
    expect(computeTeamDailyTotal(participants)).toBeCloseTo(-1.55, 2);
  });

  it('treats null dailyChange as 0', () => {
    const participants = [{ dailyChange: -0.5 }, { dailyChange: null }];
    expect(computeTeamDailyTotal(participants)).toBeCloseTo(-0.5, 2);
  });

  it('returns 0 for empty array', () => {
    expect(computeTeamDailyTotal([])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CARD_TYPES constant
// ─────────────────────────────────────────────────────────────────────────────
describe('CARD_TYPES', () => {
  it('exports the four expected card types', () => {
    expect(Object.values(CARD_TYPES)).toEqual(
      expect.arrayContaining(['team', 'day_leader', 'lap_leader', 'community_leader']),
    );
  });

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(CARD_TYPES)).toBe(true);
  });
});
