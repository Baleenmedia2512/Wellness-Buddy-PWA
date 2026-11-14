import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEventTicketReport,
  eventQrExpiredReason,
  ticketAttendanceLabel,
  ticketScanDecision,
} from '../event-ticket-report.rules.js';

const during = { date: '2026-11-14', time: '18:00' };
const afterEnd = { date: '2026-11-14', time: '21:05' };

function event(overrides = {}) {
  return {
    id: 9,
    eventName: 'dear life',
    status: 'scheduled',
    eventDate: '2026-11-14',
    endTime: '21:00',
    eventDates: [{ date: '2026-11-14', startTime: '17:00', endTime: '21:00' }],
    ...overrides,
  };
}

function ticket(overrides = {}) {
  return {
    name: 'Praveen',
    entryCode: 'w12222',
    paymentStatus: 'paid',
    checkedInAt: null,
    foodCheckedInAt: null,
    participantCount: 1,
    ...overrides,
  };
}

test('event stays open until the last end time and expires after it', () => {
  const live = event();
  assert.equal(eventQrExpiredReason(live, during), null);
  assert.equal(eventQrExpiredReason(live, afterEnd), 'ended');
  assert.equal(eventQrExpiredReason(event({ status: 'cancelled' }), during), 'cancelled');
  assert.equal(
    eventQrExpiredReason(event({
      eventDates: [
        { date: '2026-11-14', endTime: '21:00' },
        { date: '2026-11-15', endTime: '18:00' },
      ],
    }), afterEnd),
    null,
  );
});

test('a missing end time keeps the QR valid through that calendar day', () => {
  const open = event({ eventDates: [{ date: '2026-11-14', endTime: null }], endTime: null });
  assert.equal(eventQrExpiredReason(open, { date: '2026-11-14', time: '23:59' }), null);
  assert.equal(eventQrExpiredReason(open, { date: '2026-11-15', time: '00:01' }), 'ended');
});

test('entry scan is once, then only food, then the QR expires', () => {
  const live = event();
  const fresh = ticket();
  assert.equal(ticketScanDecision({ event: live, registration: fresh, checkInType: 'entry', now: during }).allow, true);
  const entered = ticket({ checkedInAt: '2026-11-14T12:30:00.000Z' });
  const entryAgain = ticketScanDecision({ event: live, registration: entered, checkInType: 'entry', now: during });
  assert.equal(entryAgain.allow, false);
  assert.match(entryAgain.message, /only allowed for food/);
  assert.equal(ticketScanDecision({ event: live, registration: entered, checkInType: 'food', now: during }).allow, true);
  const both = ticket({
    checkedInAt: '2026-11-14T12:30:00.000Z',
    foodCheckedInAt: '2026-11-14T13:00:00.000Z',
  });
  const foodAgain = ticketScanDecision({ event: live, registration: both, checkInType: 'food', now: during });
  assert.equal(foodAgain.allow, false);
  assert.match(foodAgain.message, /both scanned/);
  const entryAfterFood = ticketScanDecision({ event: live, registration: both, checkInType: 'entry', now: during });
  assert.equal(entryAfterFood.allow, false);
});

test('food is refused before entry, and a finished event expires every code', () => {
  const live = event();
  const fresh = ticket();
  const foodFirst = ticketScanDecision({ event: live, registration: fresh, checkInType: 'food', now: during });
  assert.equal(foodFirst.allow, false);
  assert.match(foodFirst.message, /Entry check-in first/);
  const ended = ticketScanDecision({ event: live, registration: fresh, checkInType: 'entry', now: afterEnd });
  assert.equal(ended.allow, false);
  assert.match(ended.message, /event has ended/);
  const refunded = ticketScanDecision({
    event: live,
    registration: ticket({ paymentStatus: 'refunded' }),
    checkInType: 'entry',
    now: during,
  });
  assert.equal(refunded.allow, false);
});

test('attendance follows the entry stamp', () => {
  assert.equal(ticketAttendanceLabel(ticket()), 'Not attended');
  assert.equal(
    ticketAttendanceLabel(ticket({ checkedInAt: '2026-11-14T12:30:00.000Z' })),
    'Attended',
  );
});

test('report lists sold QR codes and does not mark a scanned guest as not attended', () => {
  const report = buildEventTicketReport(event(), [
    ticket(),
    ticket({
      name: 'Meera',
      entryCode: 'w10001',
      checkedInAt: '2026-11-14T12:00:00.000Z',
    }),
    ticket({
      name: 'Ravi',
      entryCode: 'w10002',
      checkedInAt: '2026-11-14T12:10:00.000Z',
      foodCheckedInAt: '2026-11-14T13:00:00.000Z',
    }),
    ticket({ name: 'Old', entryCode: 'w10003', paymentStatus: 'refunded' }),
    { name: 'Draft', entryCode: null, paymentStatus: 'saved' },
  ], during);

  assert.equal(report.ticketsSold, 3);
  assert.equal(report.allowedQr, 1);
  assert.equal(report.entryScanned, 2);
  assert.equal(report.foodScanned, 1);
  assert.equal(report.attended, 2);
  assert.equal(report.notAttended, 2);
  assert.equal(report.expired, 2);
  const meera = report.rows.find((row) => row.ticketNumber === 'w10001');
  assert.equal(meera.attendance, 'Attended');
  assert.equal(meera.qrStatus, 'Entry scanned');
  assert.equal(meera.entryStatus, 'Entry scanned');
  const fresh = report.rows.find((row) => row.ticketNumber === 'w12222');
  assert.equal(fresh.qrStatus, 'Allowed');
  assert.equal(fresh.attendance, 'Not attended');
  assert.equal(report.rows.some((row) => row.guestName === 'Draft'), false);
});

test('after the event ends a scanned guest stays attended and the QR is expired', () => {
  const report = buildEventTicketReport(event(), [
    ticket({ checkedInAt: '2026-11-14T12:00:00.000Z' }),
  ], afterEnd);
  assert.equal(report.rows[0].attendance, 'Attended');
  assert.equal(report.rows[0].qrStatus, 'Expired');
  assert.match(report.rows[0].qrNote, /ended/);
  assert.equal(report.attended, 1);
  assert.equal(report.notAttended, 0);
});
