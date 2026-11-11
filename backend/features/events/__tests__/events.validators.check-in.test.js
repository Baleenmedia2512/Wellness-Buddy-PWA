import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import {
  validateEventCheckIn,
  validateEventCheckInReport,
} from '../events.validators.js';

describe('validateEventCheckIn event match', () => {
  it('allows QR when it matches the selected event', () => {
    const result = validateEventCheckIn({
      userId: 7,
      eventId: 12,
      qrPayload: '12:4821',
      markCheckedIn: false,
    });
    assert.equal(result.eventId, 12);
    assert.equal(result.entryCode, '4821');
    assert.equal(result.markCheckedIn, false);
  });

  it('rejects QR for a different event than the selected check-in event', () => {
    assert.throws(
      () =>
        validateEventCheckIn({
          userId: 7,
          eventId: 99,
          qrPayload: '12:4821',
          markCheckedIn: false,
        }),
      (err) =>
        err instanceof ValidationError &&
        err.status === 400 &&
        /different event/i.test(err.message)
    );
  });

  it('allows manual code for the selected event without QR payload', () => {
    const result = validateEventCheckIn({
      userId: 7,
      eventId: 12,
      entryCode: '4821',
      markCheckedIn: false,
    });
    assert.equal(result.eventId, 12);
    assert.equal(result.entryCode, '4821');
  });

  it('allows guest ticket number as entry code and in QR payload', () => {
    const byCode = validateEventCheckIn({
      userId: 7,
      eventId: 12,
      entryCode: 'T-55',
      markCheckedIn: false,
    });
    assert.equal(byCode.entryCode, 'T-55');

    const byQr = validateEventCheckIn({
      userId: 7,
      eventId: 12,
      qrPayload: '12:T-55',
      markCheckedIn: false,
    });
    assert.equal(byQr.entryCode, 'T-55');
  });

  it('defaults check-in type to entry and accepts food', () => {
    const legacy = validateEventCheckIn({
      userId: 7,
      eventId: 12,
      entryCode: '4821',
    });
    assert.equal(legacy.checkInType, 'entry');

    const food = validateEventCheckIn({
      userId: 7,
      eventId: 12,
      entryCode: '4821',
      checkInType: 'food',
      markCheckedIn: false,
    });
    assert.equal(food.checkInType, 'food');
  });
});

describe('validateEventCheckInReport', () => {
  it('accepts the same event and entry code as check-in lookup', () => {
    const result = validateEventCheckInReport({
      userId: 7,
      eventId: 12,
      entryCode: 'T-55',
    });
    assert.equal(result.eventId, 12);
    assert.equal(result.entryCode, 'T-55');
    assert.equal(result.userId, 7);
    assert.equal(result.markCheckedIn, undefined);
    assert.equal(result.checkInType, undefined);
  });

  it('rejects QR for a different event', () => {
    assert.throws(
      () =>
        validateEventCheckInReport({
          userId: 7,
          eventId: 99,
          qrPayload: '12:4821',
        }),
      (err) =>
        err instanceof ValidationError &&
        err.status === 400 &&
        /different event/i.test(err.message)
    );
  });
});
