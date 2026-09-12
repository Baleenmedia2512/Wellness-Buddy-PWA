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
      '2026-09-12 13:44',
    );
  });

  it('formats in America/New_York for US users', () => {
    assert.equal(
      formatBcmShareCardDateTime('2026-09-12', createdAt, 'America/New_York'),
      '2026-09-12 04:14',
    );
  });

  it('falls back to recordedDate when createdAt missing', () => {
    assert.equal(
      formatBcmShareCardDateTime('2026-09-12', null, 'Asia/Kolkata'),
      '2026-09-12',
    );
  });
});

describe('formatBcmListCardDateTime', () => {
  const createdAt = '2026-09-12T08:14:00.000Z';

  it('includes time in viewer timezone', () => {
    const india = formatBcmListCardDateTime(
      { recordedDate: '2026-09-12', createdAt },
      'Asia/Kolkata',
    );
    assert.match(india, /12 Sep 2026/);
    assert.match(india, /13:44/);

    const usa = formatBcmListCardDateTime(
      { recordedDate: '2026-09-12', createdAt },
      'America/New_York',
    );
    assert.match(usa, /12 Sep 2026/);
    assert.match(usa, /04:14/);
  });
});
