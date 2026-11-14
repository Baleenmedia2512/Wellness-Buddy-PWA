import assert from 'node:assert/strict';
import test from 'node:test';
import { ticketReportCsv, ticketReportMatrix } from './ticketReportExport.js';

test('ticket report keeps a scanned guest as Attended', () => {
  const matrix = ticketReportMatrix({
    rows: [{
      ticketNumber: 'w12222',
      guestName: 'Praveen',
      qrCode: 'w12222',
      entryStatus: 'Entry scanned',
      foodStatus: 'Not scanned',
      attendance: 'Attended',
      qrStatus: 'Entry scanned',
    }],
  });
  assert.equal(matrix[1][5], 'Attended');
  assert.match(ticketReportCsv({ rows: matrix.length ? [{
    ticketNumber: 'w12222',
    guestName: 'Praveen, Jr',
    qrCode: 'w12222',
    entryStatus: 'Entry scanned',
    foodStatus: 'Not scanned',
    attendance: 'Attended',
    qrStatus: 'Entry scanned',
  }] : [] }), /"Praveen, Jr"/);
  assert.match(ticketReportCsv({
    rows: [{
      ticketNumber: 'w12222',
      guestName: 'Praveen',
      qrCode: 'w12222',
      entryStatus: 'Entry scanned',
      foodStatus: 'Not scanned',
      attendance: 'Attended',
      qrStatus: 'Entry scanned',
    }],
  }), /Attended/);
});
