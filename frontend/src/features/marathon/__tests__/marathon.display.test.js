/**
 * marathon.display.test.js — Unit tests for frontend display helpers.
 */
import {
  buildShareUrl,
  cardTypeLabel,
  hasLiveData,
  sortParticipantsForDisplay,
} from '../domain/marathon.display.js';

describe('buildShareUrl', () => {
  it('builds a correct share URL', () => {
    expect(buildShareUrl('https://app.wellnessvalley.com', 'abc-123'))
      .toBe('https://app.wellnessvalley.com/share/marathon/abc-123');
  });

  it('returns null when token is missing', () => {
    expect(buildShareUrl('https://app.wellnessvalley.com', null)).toBeNull();
    expect(buildShareUrl('https://app.wellnessvalley.com', '')).toBeNull();
  });
});

describe('cardTypeLabel', () => {
  it('maps team to correct label',             () => expect(cardTypeLabel('team')).toBe('Share Team Card'));
  it('maps day_leader to correct label',       () => expect(cardTypeLabel('day_leader')).toBe('Share Day Leader'));
  it('maps lap_leader to correct label',       () => expect(cardTypeLabel('lap_leader')).toBe('Share Lap Leader'));
  it('maps community_leader to correct label', () => expect(cardTypeLabel('community_leader')).toBe('Share Community Leader'));
  it('returns fallback for unknown type',      () => expect(cardTypeLabel('unknown')).toBe('Share Card'));
});

describe('hasLiveData', () => {
  it('returns true when at least one participant has a dailyChange', () => {
    const cardData = { participants: [{ dailyChange: null }, { dailyChange: -0.5 }] };
    expect(hasLiveData(cardData)).toBe(true);
  });

  it('returns false when all dailyChanges are null', () => {
    const cardData = { participants: [{ dailyChange: null }] };
    expect(hasLiveData(cardData)).toBe(false);
  });

  it('returns false for empty participants', () => {
    expect(hasLiveData({ participants: [] })).toBe(false);
  });

  it('returns false for null/undefined cardData', () => {
    expect(hasLiveData(null)).toBe(false);
    expect(hasLiveData(undefined)).toBe(false);
  });
});

describe('sortParticipantsForDisplay', () => {
  it('places coach first', () => {
    const participants = [
      { userId: 1, role: 'user',  lapChange: -2 },
      { userId: 2, role: 'coach', lapChange: -1 },
    ];
    const sorted = sortParticipantsForDisplay(participants);
    expect(sorted[0].role).toBe('coach');
  });

  it('sorts non-coaches by lapChange ascending (most loss first)', () => {
    const participants = [
      { userId: 1, role: 'user', lapChange: -1 },
      { userId: 2, role: 'user', lapChange: -3 },
      { userId: 3, role: 'user', lapChange: -2 },
    ];
    const sorted = sortParticipantsForDisplay(participants);
    expect(sorted.map(p => p.userId)).toEqual([2, 3, 1]);
  });

  it('places members with no data last', () => {
    const participants = [
      { userId: 1, role: 'user', lapChange: null },
      { userId: 2, role: 'user', lapChange: -0.5 },
    ];
    const sorted = sortParticipantsForDisplay(participants);
    expect(sorted[0].userId).toBe(2);
    expect(sorted[1].userId).toBe(1);
  });

  it('does not mutate the original array', () => {
    const original = [{ userId: 1, role: 'user', lapChange: -1 }];
    const sorted   = sortParticipantsForDisplay(original);
    expect(sorted).not.toBe(original);
  });
});
