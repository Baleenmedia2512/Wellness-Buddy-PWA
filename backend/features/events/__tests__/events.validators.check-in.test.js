import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { validateEventCheckIn } from '../events.validators.js';

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
});
