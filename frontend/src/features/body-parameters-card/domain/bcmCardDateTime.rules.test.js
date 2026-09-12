/**
 * bcmCardDateTime.rules.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/bcmCardDateTime.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBcmDisplayTimezone,
  formatBcmShareCardDateTime,
  formatBcmListCardDateTime,
  formatBcmFormTime,
  bcmWallClockToIso,
} from './bcmCardDateTime.rules.js';

describe('resolveBcmDisplayTimezone', () => {
  it('uses explicit IANA string', () => {
    assert.equal(resolveBcmDisplayTimezone('America/New_York'), 'America/New_York');
  });

  it('uses profile timezoneIana', () => {
    assert.equal(
      resolveBcmDisplayTimezone({ timezoneIana: 'America/Los_Angeles' }),
      'America/Los_Angeles',
    );
  });
});

describe('formatBcmShareCardDateTime', () => {
  // 2026-09-12T08:14:00Z = 13:44 IST, 04:14 EDT
  const createdAt = '2026-09-12T08:14:00.000Z';

  it('formats in Asia/Kolkata for Indian users', () => {
    assert.equal(
      formatBcmShareCardDateTime('2026-09-12', createdAt, 'Asia/Kolkata'),
      '2026-09-12 1:44 PM',
    );
  });

  it('formats in America/New_York for US users', () => {
    assert.equal(
      formatBcmShareCardDateTime('2026-09-12', createdAt, 'America/New_York'),
      '2026-09-12 4:14 AM',
    );
  });

  it('falls back to recordedDate when createdAt missing', () => {
    assert.equal(
      formatBcmShareCardDateTime('2026-09-12', null, 'Asia/Kolkata'),
      '2026-09-12',
    );
  });
});

describe('formatBcmFormTime', () => {
  const createdAt = '2026-09-12T08:14:00.000Z';

  it('returns HH:mm in viewer timezone', () => {
    assert.equal(formatBcmFormTime(createdAt, 'Asia/Kolkata'), '13:44');
    assert.equal(formatBcmFormTime(createdAt, 'America/New_York'), '04:14');
  });
});

describe('bcmWallClockToIso', () => {
  it('round-trips IST wall clock', () => {
    const iso = bcmWallClockToIso('2026-09-12', '13:44', 'Asia/Kolkata');
    assert.equal(formatBcmFormTime(iso, 'Asia/Kolkata'), '13:44');
    assert.equal(
      formatBcmShareCardDateTime(null, iso, 'Asia/Kolkata'),
      '2026-09-12 1:44 PM',
    );
  });
});

describe('formatBcmListCardDateTime', () => {
  const createdAt = '2026-09-12T08:14:00.000Z';

  it('includes time in viewer timezone (12-hour)', () => {
    const india = formatBcmListCardDateTime(
      { recordedDate: '2026-09-12', createdAt },
      'Asia/Kolkata',
    );
    assert.equal(india, '12 Sep 2026 1:44 PM');

    const usa = formatBcmListCardDateTime(
      { recordedDate: '2026-09-12', createdAt },
      'America/New_York',
    );
    assert.equal(usa, '12 Sep 2026 4:14 AM');
  });
});
