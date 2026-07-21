/**
 * Unit tests for shared UTC datetime utilities.
 * Run: node --test backend/shared/lib/datetime/__tests__/datetime.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  IANA_IST,
  nowUtc,
  assertIanaTimezone,
  toUtcRange,
  toUtcRangeInclusive,
  todayInTimezone,
  formatUtcForDisplay,
  addUtcDays,
} from '../index.js';
import { applyDayFilter, applyDateRangeFilter } from '../applyDayFilter.js';

describe('nowUtc', () => {
  it('returns a valid ISO UTC string', () => {
    const ts = nowUtc();
    assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const dt = DateTime.fromISO(ts, { zone: 'utc' });
    assert.equal(dt.isValid, true);
    assert.equal(dt.offset, 0);
  });
});

describe('assertIanaTimezone', () => {
  it('accepts valid IANA zones', () => {
    assert.equal(assertIanaTimezone('Asia/Kolkata'), 'Asia/Kolkata');
    assert.equal(assertIanaTimezone('America/New_York'), 'America/New_York');
  });

  it('rejects invalid zones', () => {
    assert.throws(() => assertIanaTimezone(''), TypeError);
    assert.throws(() => assertIanaTimezone('Not/AZone'), RangeError);
  });
});

describe('toUtcRange', () => {
  it('maps an IST calendar day to correct UTC bounds', () => {
    const { startUtc, endUtc } = toUtcRange('2026-07-21', IANA_IST);
    assert.equal(startUtc, '2026-07-20T18:30:00.000Z');
    assert.equal(endUtc, '2026-07-21T18:29:59.999Z');
  });

  it('maps a US Eastern calendar day to UTC bounds', () => {
    const { startUtc, endUtc } = toUtcRange('2026-01-15', 'America/New_York');
    assert.equal(startUtc, '2026-01-15T05:00:00.000Z');
    assert.equal(endUtc, '2026-01-16T04:59:59.999Z');
  });
});

describe('toUtcRangeInclusive', () => {
  it('spans multiple days inclusively', () => {
    const { startUtc, endUtc } = toUtcRangeInclusive(
      '2026-07-20',
      '2026-07-21',
      IANA_IST,
    );
    assert.equal(startUtc, '2026-07-19T18:30:00.000Z');
    assert.equal(endUtc, '2026-07-21T18:29:59.999Z');
  });

  it('rejects inverted ranges', () => {
    assert.throws(
      () => toUtcRangeInclusive('2026-07-22', '2026-07-21', IANA_IST),
      RangeError,
    );
  });
});

describe('todayInTimezone', () => {
  it('returns YYYY-MM-DD format', () => {
    const today = todayInTimezone(IANA_IST);
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatUtcForDisplay', () => {
  it('formats UTC instant in target timezone', () => {
    const display = formatUtcForDisplay('2026-07-20T18:30:00.000Z', IANA_IST);
    assert.equal(display, '2026-07-21 00:00:00');
  });
});

describe('addUtcDays', () => {
  it('adds days to a UTC instant', () => {
    const result = addUtcDays('2026-07-20T18:30:00.000Z', 30);
    assert.equal(result, '2026-08-19T18:30:00.000Z');
  });
});

describe('applyDayFilter', () => {
  it('chains gte/lte on a query builder', () => {
    const calls = [];
    const query = {
      gte(col, val) {
        calls.push(['gte', col, val]);
        return this;
      },
      lte(col, val) {
        calls.push(['lte', col, val]);
        return this;
      },
    };

    applyDayFilter(query, 'CreatedAt', '2026-07-21', IANA_IST);

    assert.deepEqual(calls, [
      ['gte', 'CreatedAt', '2026-07-20T18:30:00.000Z'],
      ['lte', 'CreatedAt', '2026-07-21T18:29:59.999Z'],
    ]);
  });
});

describe('applyDateRangeFilter', () => {
  it('chains gte/lte for an inclusive date range', () => {
    const calls = [];
    const query = {
      gte(col, val) {
        calls.push(['gte', col, val]);
        return this;
      },
      lte(col, val) {
        calls.push(['lte', col, val]);
        return this;
      },
    };

    applyDateRangeFilter(query, 'CreatedAt', '2026-07-20', '2026-07-21', IANA_IST);

    assert.deepEqual(calls, [
      ['gte', 'CreatedAt', '2026-07-19T18:30:00.000Z'],
      ['lte', 'CreatedAt', '2026-07-21T18:29:59.999Z'],
    ]);
  });
});
