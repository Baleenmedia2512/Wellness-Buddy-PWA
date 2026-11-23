/**
 * Run: node --test backend/features/activity/__tests__/activity-report.datetime.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';
import { extractDateTime } from '../activity-report.service.js';
import { dedupeFirstLogPerMemberPerDay } from '../activity-report.repository.js';

describe('extractDateTime — education/weight IST wall clock', () => {
  it('keeps driver-Z education CreatedAt as 16:33 IST, not 22:03', () => {
    // DB stores IST wall digits; MySQL/client often serializes with a misleading Z.
    const { date, time } = extractDateTime('2026-11-23T16:33:19.000Z', IANA_IST);
    assert.equal(date, '2026-11-23');
    assert.equal(time, '16:33:19');
  });

  it('keeps naive IST wall education CreatedAt as local wall time', () => {
    const { date, time } = extractDateTime('2026-11-23 16:33:19', IANA_IST);
    assert.equal(date, '2026-11-23');
    assert.equal(time, '16:33:19');
  });

  it('does not shift morning weight CreatedAt with driver Z', () => {
    const { date, time } = extractDateTime('2026-11-02T05:05:00.000Z', IANA_IST);
    assert.equal(date, '2026-11-02');
    assert.equal(time, '05:05:00');
  });
});

describe('dedupeFirstLogPerMemberPerDay — education driver Z calendar day', () => {
  it('buckets education with driver Z on the IST wall calendar day', () => {
    const rows = [
      { UserId: '1', CreatedAt: '2026-11-23T16:33:19.000Z' },
      { UserId: '1', CreatedAt: '2026-11-23T18:00:00.000Z' },
    ];
    const deduped = dedupeFirstLogPerMemberPerDay(rows, IANA_IST);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].CreatedAt, '2026-11-23T16:33:19.000Z');
  });
});
