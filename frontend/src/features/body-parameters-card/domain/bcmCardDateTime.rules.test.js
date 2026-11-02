/**
 * bcmCardDateTime.rules.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/bcmCardDateTime.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBcmDisplayTimezone,
  resolveBcmCardDisplayTimestamp,
  formatBcmShareCardDateTime,
  formatBcmListCardDateTime,
  formatBcmFormTime,
  bcmWallClockToIso,
  computeDefaultAppointmentDate,
  resolveBcmCardAppointmentDate,
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

describe('resolveBcmCardDisplayTimestamp', () => {
  it('prefers createdAt (session time) even when updatedAt is present', () => {
    assert.equal(
      resolveBcmCardDisplayTimestamp({
        createdAt: '2026-09-12T08:00:00.000Z',
        updatedAt: '2026-09-12T10:00:00.000Z',
      }),
      '2026-09-12T08:00:00.000Z',
    );
  });

  it('falls back to updatedAt when createdAt missing', () => {
    assert.equal(
      resolveBcmCardDisplayTimestamp({
        createdAt: null,
        updatedAt: '2026-09-12T10:00:00.000Z',
      }),
      '2026-09-12T10:00:00.000Z',
    );
  });

  it('falls back to createdAt when never updated', () => {
    assert.equal(
      resolveBcmCardDisplayTimestamp({
        createdAt: '2026-09-12T08:00:00.000Z',
        updatedAt: null,
      }),
      '2026-09-12T08:00:00.000Z',
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

  it('keeps session createdAt when card was later updated', () => {
    const text = formatBcmListCardDateTime(
      {
        recordedDate: '2026-09-12',
        createdAt: '2026-09-12T08:14:00.000Z',
        updatedAt: '2026-09-12T11:00:00.000Z', // 16:30 IST — ignored for display
      },
      'Asia/Kolkata',
    );
    assert.equal(text, '12 Sep 2026 1:44 PM');
  });
});

describe('computeDefaultAppointmentDate', () => {
  it('sets next day (+1 day) when next day is a weekday or Saturday', () => {
    // 2026-10-19 is a Monday -> next day 2026-10-20 (Tuesday)
    assert.equal(computeDefaultAppointmentDate('2026-10-19'), '2026-10-20');
    // 2026-10-23 is a Friday -> next day 2026-10-24 (Saturday)
    assert.equal(computeDefaultAppointmentDate('2026-10-23'), '2026-10-24');
    // 2026-10-25 is a Sunday -> next day 2026-10-26 (Monday)
    assert.equal(computeDefaultAppointmentDate('2026-10-25'), '2026-10-26');
  });

  it('rolls forward to Monday (+2 days) if the next day is a Sunday', () => {
    // 2026-10-24 is Saturday -> next day would be Sunday 2026-10-25 -> rolls to Monday 2026-10-26
    assert.equal(computeDefaultAppointmentDate('2026-10-24'), '2026-10-26');
  });

  it('handles month/year boundary correctly when rolling Sunday to Monday', () => {
    // 2026-10-31 is Saturday -> next day Sunday 2026-11-01 -> rolls to Monday 2026-11-02
    assert.equal(computeDefaultAppointmentDate('2026-10-31'), '2026-11-02');
  });

  it('handles ISO timestamps and Date objects', () => {
    assert.equal(computeDefaultAppointmentDate('2026-10-24T10:00:00.000Z'), '2026-10-26');
    assert.equal(computeDefaultAppointmentDate(new Date(2026, 9, 24)), '2026-10-26');
  });

  it('returns empty string for empty or invalid inputs', () => {
    assert.equal(computeDefaultAppointmentDate(''), '');
    assert.equal(computeDefaultAppointmentDate(null), '');
    assert.equal(computeDefaultAppointmentDate(undefined), '');
    assert.equal(computeDefaultAppointmentDate('invalid-date'), '');
  });
});

describe('resolveBcmCardAppointmentDate', () => {
  it('returns explicit appointmentDate if present', () => {
    assert.equal(resolveBcmCardAppointmentDate({ appointmentDate: '2026-10-22' }), '2026-10-22');
    assert.equal(resolveBcmCardAppointmentDate({ appointmentDate: '2026-10-22T08:00:00.000Z' }), '2026-10-22');
  });

  it('returns explicit appointment_date (snake_case) if present', () => {
    assert.equal(resolveBcmCardAppointmentDate({ appointment_date: '2026-10-25' }), '2026-10-25');
  });

  it('computes default appointment date from createdAt when appointment date is null/missing', () => {
    // 2026-10-21 (Wednesday) -> 2026-10-22 (Thursday)
    assert.equal(resolveBcmCardAppointmentDate({ createdAt: '2026-10-21T05:48:00.000Z' }), '2026-10-22');
    // 2026-10-24 (Saturday) -> rolls past Sunday to 2026-10-26 (Monday)
    assert.equal(resolveBcmCardAppointmentDate({ created_at: '2026-10-24T12:00:00.000Z' }), '2026-10-26');
  });

  it('computes default appointment date from recordedDate when createdAt is missing', () => {
    assert.equal(resolveBcmCardAppointmentDate({ recordedDate: '2026-10-19' }), '2026-10-20');
    assert.equal(resolveBcmCardAppointmentDate({ recorded_date: '2026-10-24' }), '2026-10-26');
  });

  it('returns empty string when card is null or non-object', () => {
    assert.equal(resolveBcmCardAppointmentDate(null), '');
    assert.equal(resolveBcmCardAppointmentDate(undefined), '');
  });
});
