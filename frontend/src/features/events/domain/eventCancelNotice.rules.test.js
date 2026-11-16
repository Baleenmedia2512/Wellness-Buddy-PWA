/**
 * Run: node --test frontend/src/features/events/domain/eventCancelNotice.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventCancellationHomeCopy,
  unseenCancelledBookings,
} from './eventCancelNotice.rules.js';

const cancelled = {
  id: 4,
  amountCharged: 200,
  paymentStatus: 'paid',
  event: { eventName: 'Happy life', status: 'cancelled' },
};

describe('unseenCancelledBookings', () => {
  it('keeps a cancelled booking until My Bookings has been opened for it', () => {
    assert.equal(unseenCancelledBookings([cancelled], []).length, 1);
    assert.equal(unseenCancelledBookings([cancelled], [4]).length, 0);
  });

  it('ignores a booking that is still scheduled', () => {
    const scheduled = { id: 5, event: { eventName: 'Walk', status: 'scheduled' } };
    assert.equal(unseenCancelledBookings([scheduled], []).length, 0);
  });
});

describe('eventCancellationHomeCopy', () => {
  it('names one cancelled event and points to My Bookings', () => {
    const copy = eventCancellationHomeCopy([{ id: 4, name: 'Happy life' }]);
    assert.equal(copy.title, 'Happy life is cancelled');
    assert.match(copy.subtitle, /My Bookings/);
  });

  it('stays empty when every cancellation was already seen', () => {
    assert.equal(eventCancellationHomeCopy([]), null);
  });
});
