/**
 * Run: node --test backend/features/events/domain/__tests__/event-cancelled-notice.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventCancelledNotice,
  cancellationNoticeEmails,
  cancelledTicketCreditAmount,
  describeCancellationSettlement,
  refundableEventTicketAmount,
} from '../event-cancelled-notice.rules.js';

describe('refundableEventTicketAmount', () => {
  it('returns the paid ticket amount once', () => {
    assert.equal(refundableEventTicketAmount({ paymentStatus: 'paid', amountCharged: '250.5' }), 250.5);
  });

  it('returns 0 for a saved booking, a refunded booking, and a zero charge', () => {
    assert.equal(refundableEventTicketAmount({ paymentStatus: 'saved', amountCharged: 0 }), 0);
    assert.equal(refundableEventTicketAmount({ paymentStatus: 'refunded', amountCharged: 250 }), 0);
    assert.equal(refundableEventTicketAmount({ paymentStatus: 'paid', amountCharged: 0 }), 0);
  });
});

describe('cancelledTicketCreditAmount', () => {
  it('keeps the amount on a refunded row so the notice can name it', () => {
    assert.equal(cancelledTicketCreditAmount({ paymentStatus: 'refunded', amountCharged: 100 }), 100);
    assert.equal(cancelledTicketCreditAmount({ paymentStatus: 'saved', amountCharged: 0 }), 0);
  });
});

describe('cancellationNoticeEmails', () => {
  it('keeps the registration email and the profile email, once each', () => {
    assert.deepEqual(
      cancellationNoticeEmails(' Guest@example.com ', 'guest@example.com', 'other@example.com', 'not-an-email'),
      ['Guest@example.com', 'other@example.com'],
    );
  });
});

describe('buildEventCancelledNotice', () => {
  it('tells the guest the event is cancelled and the credit is back', () => {
    const notice = buildEventCancelledNotice({
      guestName: 'Asha',
      eventName: 'Happy life',
      eventDate: '2026-11-10',
      place: 'Hall',
      refundAmount: 2000,
      ticketNumber: 'A12',
    });
    assert.match(notice.subject, /cancelled/i);
    assert.match(notice.subject, /Happy life/);
    assert.match(notice.text, /has been cancelled/);
    assert.match(notice.text, /₹2,000/);
    assert.match(notice.text, /wallet/);
    assert.equal(notice.whatsappText, notice.text);
    assert.match(notice.html, /Event cancelled/);
  });

  it('omits a credit line when no ticket charge was taken', () => {
    const notice = buildEventCancelledNotice({
      guestName: 'Asha',
      eventName: 'Happy life',
      refundAmount: 0,
    });
    assert.match(notice.text, /Your booking is cancelled/);
    assert.doesNotMatch(notice.text, /wallet/);
  });
});

describe('describeCancellationSettlement', () => {
  it('summarises credits, email, and WhatsApp for the host', () => {
    const text = describeCancellationSettlement({
      refunded: 2,
      emailed: 2,
      whatsappSent: 0,
      whatsappReady: 2,
    });
    assert.match(text, /2 ticket credits/);
    assert.match(text, /2 cancellation emails/);
    assert.match(text, /Send WhatsApp/);
  });

  it('stays empty when nothing was settled', () => {
    assert.equal(describeCancellationSettlement({}), '');
  });
});
