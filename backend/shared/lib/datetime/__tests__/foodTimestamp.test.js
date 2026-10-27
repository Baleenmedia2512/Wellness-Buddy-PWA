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

  it('B: driver Z on 14:15 wall digits stays 14:15 IST, not 19:45', () => {
    const r = resolveFoodTimestamp('2026-07-24T14:15:00.000Z', IANA_IST);
    assert.equal(r.calendarYmd, '2026-07-24');
    assert.equal(r.timeOfDay, '14:15:00');
  });

  it('afternoon driver Z stays lunch time, not dinner', () => {
    const r = resolveFoodTimestamp('2026-10-25T14:49:56.453Z', IANA_IST);
    assert.equal(r.calendarYmd, '2026-10-25');
    assert.equal(r.timeOfDay, '14:49:56');
  });

  it('UTC clock before 05:30 displays as India time', () => {
    // 02:16 UTC stored by a UTC session is 7:46 AM IST, not 2:16 AM.
    const morning = resolveFoodTimestamp('2026-10-26T02:16:34.000Z', IANA_IST);
    assert.equal(morning.calendarYmd, '2026-10-26');
    assert.equal(morning.timeOfDay, '07:46:34');
    assert.equal(morning.utcIso, '2026-10-26T02:16:34.000Z');

    const midnight = resolveFoodTimestamp('2026-10-26T00:48:34.000Z', IANA_IST);
    assert.equal(midnight.timeOfDay, '06:18:34');

    const justBeforeOffset = resolveFoodTimestamp('2026-10-26T05:29:59.000Z', IANA_IST);
    assert.equal(justBeforeOffset.timeOfDay, '10:59:59');
  });

  it('05:30 and 13:01 with a driver Z stay IST wall clock', () => {
    const boundary = resolveFoodTimestamp('2026-10-26T05:30:00.000Z', IANA_IST);
    assert.equal(boundary.timeOfDay, '05:30:00');
    assert.equal(boundary.calendarYmd, '2026-10-26');

    const afternoon = resolveFoodTimestamp('2026-10-25T13:01:12.000Z', IANA_IST);
    assert.equal(afternoon.timeOfDay, '13:01:12');
    assert.equal(afternoon.calendarYmd, '2026-10-25');
  });

  it('naive early-morning digits stay IST wall clock', () => {
    const r = resolveFoodTimestamp('2026-10-26 02:16:34', IANA_IST);
    assert.equal(r.timeOfDay, '02:16:34');
    assert.equal(r.calendarYmd, '2026-10-26');
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

describe('resolveFoodTimestamp — owner display TZ (IST storage)', () => {
  const QATAR = 'Asia/Qatar';

  it('Qatar 08:00 local stored as IST wall 10:30 displays as 08:00 in Qatar', () => {
    // Upload 08:00 Asia/Qatar = 05:00 UTC = 10:30 IST wall digits in DB
    const r = resolveFoodTimestamp('2026-08-04 10:30:00', QATAR);
    assert.equal(r.utcIso, '2026-08-04T05:00:00.000Z');
    assert.equal(r.calendarYmd, '2026-08-04');
    assert.equal(r.timeOfDay, '08:00:00');
  });

  it('does not treat naive IST digits as Qatar wall clock', () => {
    // Wrong old behaviour: parse 10:30 as Qatar → 07:30 UTC → show 10:30 Qatar
    const r = resolveFoodTimestamp('2026-08-04 10:30:00', QATAR);
    assert.notEqual(r.timeOfDay, '10:30:00');
    assert.equal(r.timeOfDay, '08:00:00');
  });

  it('ignores display TZ when normalizing storage to UTC', () => {
    const asIst = normalizeFoodCreatedAt('2026-08-04 10:30:00', IANA_IST);
    const asQatarArg = normalizeFoodCreatedAt('2026-08-04 10:30:00', QATAR);
    assert.equal(asIst, asQatarArg);
    assert.equal(asIst, '2026-08-04T05:00:00.000Z');
  });

  it('spurious Z still detected via IST calendar even when display TZ is Qatar', () => {
    const r = resolveFoodTimestamp('2026-07-24T19:45:00.000Z', QATAR);
    assert.equal(r.calendarYmd, '2026-07-24');
    // 19:45 IST = 14:15 UTC = 17:15 Asia/Qatar (UTC+3)
    assert.equal(r.timeOfDay, '17:15:00');
  });
});
