/**
 * Canonical food CreatedAt interpretation — Wellness Score day / window contract.
 * Run: node --test backend/shared/lib/datetime/__tests__/foodTimestamp.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IANA_IST } from '../datetime.js';
import {
  normalizeFoodCreatedAt,
  resolveFoodTimestamp,
  filterFoodRowsByCalendarDay,
} from '../foodTimestamp.js';

describe('resolveFoodTimestamp — calendar day contract', () => {
  it('A: naive IST wall 2026-07-24 19:45:00 belongs to 2026-07-24', () => {
    const r = resolveFoodTimestamp('2026-07-24 19:45:00', IANA_IST);
    assert.equal(r.calendarYmd, '2026-07-24');
    assert.equal(r.timeOfDay, '19:45:00');
  });

  it('B: true UTC 2026-07-24T14:15:00.000Z belongs to 2026-07-24 (19:45 IST)', () => {
    const r = resolveFoodTimestamp('2026-07-24T14:15:00.000Z', IANA_IST);
    assert.equal(r.calendarYmd, '2026-07-24');
    assert.equal(r.timeOfDay, '19:45:00');
  });

  it('C: spurious Z on IST wall must not shift into 2026-07-25', () => {
    const r = resolveFoodTimestamp('2026-07-24T19:45:00.000Z', IANA_IST);
    assert.equal(r.calendarYmd, '2026-07-24');
    assert.equal(r.timeOfDay, '19:45:00');
    assert.notEqual(r.calendarYmd, '2026-07-25');
  });

  it('honors explicit +05:30 as absolute instant', () => {
    const r = resolveFoodTimestamp('2026-07-24T19:45:00+05:30', IANA_IST);
    assert.equal(r.calendarYmd, '2026-07-24');
    assert.equal(r.timeOfDay, '19:45:00');
  });
});

describe('filterFoodRowsByCalendarDay', () => {
  const dinnerNaive = { ID: 1, CreatedAt: '2026-07-24 19:45:00' };
  const dinnerTrueUtc = { ID: 2, CreatedAt: '2026-07-24T14:15:00.000Z' };
  const dinnerSpuriousZ = { ID: 3, CreatedAt: '2026-07-24T19:45:00.000Z' };

  it('keeps A/B/C on 2026-07-24 and excludes all from 2026-07-25', () => {
    const rows = [dinnerNaive, dinnerTrueUtc, dinnerSpuriousZ];
    const jul24 = filterFoodRowsByCalendarDay(rows, '2026-07-24', IANA_IST);
    const jul25 = filterFoodRowsByCalendarDay(rows, '2026-07-25', IANA_IST);
    assert.deepEqual(jul24.map((r) => r.ID).sort(), [1, 2, 3]);
    assert.deepEqual(jul25, []);
  });

  it('C must NOT appear in today meals when today is 2026-07-25', () => {
    const today = filterFoodRowsByCalendarDay(
      [{ ID: 3, CreatedAt: '2026-07-24T19:45:00.000Z' }],
      '2026-07-25',
      IANA_IST,
    );
    assert.equal(today.length, 0);
  });
});

describe('normalizeFoodCreatedAt — same instant for day + time', () => {
  it('calendarYmd and timeOfDay derive from one utcIso', () => {
    for (const raw of [
      '2026-07-24 19:45:00',
      '2026-07-24T14:15:00.000Z',
      '2026-07-24T19:45:00.000Z',
    ]) {
      const utcIso = normalizeFoodCreatedAt(raw, IANA_IST);
      const resolved = resolveFoodTimestamp(raw, IANA_IST);
      assert.equal(resolved.utcIso, utcIso);
    }
  });
});
