import assert from 'node:assert/strict';
import test from 'node:test';
import { ticketShareCaption } from './shareTicketQr.js';

test('ticket caption names the guest, event, and ticket number', () => {
  assert.equal(
    ticketShareCaption({ name: 'praveen', eventName: 'dear life', entryCode: 'w12222' }),
    'praveen, your ticket for dear life is ready. Ticket number: w12222. Show this QR at the entrance.',
  );
});
